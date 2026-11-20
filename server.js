
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const path = require('path');

const { get, all, run } = require('./database');
const { BLOOD_TYPES, DISTRICTS, NEAREST_RCBT } = require('./Public/js/data');

const app = express();
const PORT = process.env.PORT || 3000;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// Rules from the SRS
const MAX_RESULTS = 20;          // NFR 5
const STALE_DAYS = 90;           // hidden if not reconfirmed in 90 days
const REPORT_LIMIT = 2;          // hidden after 2 reports
const SESSION_MINUTES = 15;      // NFR 2

if (IS_PRODUCTION && !process.env.SESSION_SECRET) {
    console.warn('WARNING: set the SESSION_SECRET environment variable in production.');
}

// Free hosts (Render, Railway) sit behind a proxy that handles HTTPS
app.set('trust proxy', 1);

// NFR 6: send http visitors to https (only on the live server)
app.use((req, res, next) => {
    if (IS_PRODUCTION && !req.secure) {
        return res.redirect(301, `https://${req.headers.host}${req.originalUrl}`);
    }
    next();
});

// Read information sent from forms
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Admin sessions: expire after 15 minutes of inactivity
app.use(session({
    secret: process.env.SESSION_SECRET || 'bloodlink-development-secret',
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
        maxAge: SESSION_MINUTES * 60 * 1000,
        httpOnly: true,
        sameSite: 'lax',
        secure: IS_PRODUCTION
    }
}));

// Make frontend files available
app.use(express.static(path.join(__dirname, 'Public')));

// ---------- Helpers ----------

function staleCutoff() {
    const date = new Date();
    date.setDate(date.getDate() - STALE_DAYS);
    return date.toISOString();
}

function firstName(fullName) {
    return fullName.trim().split(/\s+/)[0];
}

// Every error is sent with a "code" so the website can show it in English or Kinyarwanda
function fail(res, status, code, message) {
    return res.status(status).json({ code, message });
}

async function rcbtList(district) {
    const centres = await all('SELECT name, city, phone FROM RCBTContacts ORDER BY name');
    const nearestCity = NEAREST_RCBT[district];

    // Put the nearest centre first
    return centres
        .map((centre) => ({ ...centre, nearest: centre.city === nearestCity }))
        .sort((a, b) => Number(b.nearest) - Number(a.nearest));
}

// NFR 1: only logged-in admins get through
function requireAdmin(req, res, next) {
    if (req.session && req.session.admin) return next();
    return fail(res, 401, 'accessDenied', 'Access denied.');
}

// ---------- Pages ----------

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'Public', 'index.html'));
});

// The admin dashboard lives outside Public so it cannot be opened without logging in
app.get('/admin', (req, res) => {
    if (!req.session.admin) {
        return res.status(403).send(`<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Access denied - BloodLink</title><link rel="stylesheet" href="/css/style.css"></head>
<body><main class="page"><section class="card">
<h2>Access denied</h2><p>You must be logged in as an admin to view this page.</p>
<a class="btn" href="/admin-login.html">Go to admin login</a>
</section></main></body></html>`);
    }
    res.sendFile(path.join(__dirname, 'views', 'admin.html'));
});

// ---------- FR 1: Donor registration ----------

app.post('/api/donors/register', async (req, res) => {
    const body = req.body || {};
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const phone = typeof body.phone === 'string' ? body.phone.replace(/\s+/g, '') : '';
    const { bloodType, district } = body;
    const consent = body.consent === true || body.consent === 'on';

    if (!name || !phone || !bloodType || !district) {
        return fail(res, 400, 'errRequired', 'Please fill in all required fields.');
    }
    if (name.length > 100) {
        return fail(res, 400, 'errName', 'Name is too long.');
    }
    // FR 1.2: valid Rwandan number = 10 digits starting with 07
    if (!/^07\d{8}$/.test(phone)) {
        return fail(res, 400, 'errPhone', 'Enter a valid Rwandan phone number (07XXXXXXXX).');
    }
    if (!BLOOD_TYPES.includes(bloodType)) {
        return fail(res, 400, 'errBloodType', 'Invalid blood type.');
    }
    if (!DISTRICTS.includes(district)) {
        return fail(res, 400, 'errDistrict', 'Invalid district.');
    }
    // NFR 4: no consent, no registration
    if (!consent) {
        return fail(res, 400, 'errConsent', 'Please agree to the consent statement.');
    }

    try {
        const now = new Date().toISOString();
        const existing = await get('SELECT id FROM Donors WHERE phone = ?', [phone]);

        if (existing) {
            // Same phone number: update the record and reconfirm the donor (FR 1.2, FR 1.3)
            await run(
                `UPDATE Donors
                 SET name = ?, blood_type = ?, district = ?, consent = 1, last_confirmed = ?
                 WHERE id = ?`,
                [name, bloodType, district, now, existing.id]
            );
            return res.json({ code: 'registerUpdated', message: 'Your details were updated and reconfirmed.' });
        }

        await run(
            `INSERT INTO Donors
             (name, phone, blood_type, district, consent, registration_date, last_confirmed, active)
             VALUES (?, ?, ?, ?, 1, ?, ?, 1)`,
            [name, phone, bloodType, district, now, now]
        );
        return res.status(201).json({ code: 'registerSuccess', message: 'Donor registered successfully!' });
    } catch (error) {
        console.error(error.message);
        return fail(res, 500, 'errGeneric', 'Registration failed. Please try again.');
    }
});

// ---------- FR 2 + FR 3: Donor search ----------

app.get('/api/donors/search', async (req, res) => {
    const { bloodType, district } = req.query;

    if (!BLOOD_TYPES.includes(bloodType) || !DISTRICTS.includes(district)) {
        return fail(res, 400, 'errSearchRequired', 'Please choose a blood type and a district.');
    }

    try {
        // FR 2.3: hidden donors (reported twice) and donors not reconfirmed in 90 days are left out
        const rows = await all(
            `SELECT id, name, blood_type, district, phone, last_confirmed
             FROM Donors
             WHERE blood_type = ? AND district = ? AND active = 1 AND last_confirmed >= ?
             ORDER BY last_confirmed DESC
             LIMIT ?`,
            [bloodType, district, staleCutoff(), MAX_RESULTS]
        );

        // NFR 5: only the first name is shown
        const donors = rows.map((donor) => ({
            id: donor.id,
            firstName: firstName(donor.name),
            bloodType: donor.blood_type,
            district: donor.district,
            phone: donor.phone,
            lastConfirmed: donor.last_confirmed
        }));

        // FR 3.2: never leave the seeker with an empty screen
        const rcbt = donors.length === 0 ? await rcbtList(district) : [];

        return res.json({ donors, rcbt });
    } catch (error) {
        console.error(error.message);
        return fail(res, 500, 'errGeneric', 'Search failed. Please try again.');
    }
});

// ---------- FR 3.3: Report an unreachable donor ----------

app.post('/api/donors/:id/report', async (req, res) => {
    const donorId = Number(req.params.id);
    if (!Number.isInteger(donorId)) return fail(res, 400, 'errGeneric', 'Invalid donor.');

    try {
        const donor = await get('SELECT id FROM Donors WHERE id = ?', [donorId]);
        if (!donor) return fail(res, 404, 'errGeneric', 'Donor not found.');

        // One report per donor per browser, so one person cannot hide a donor alone
        req.session.reported = req.session.reported || [];
        if (req.session.reported.includes(donorId)) {
            return res.json({ code: 'reportThanks', message: 'Thank you. The report was recorded.' });
        }
        req.session.reported.push(donorId);

        await run('INSERT INTO Reports (donor_id, reported_at) VALUES (?, ?)', [donorId, new Date().toISOString()]);

        const { count } = await get('SELECT COUNT(*) AS count FROM Reports WHERE donor_id = ?', [donorId]);
        if (count >= REPORT_LIMIT) {
            // Hidden from search until the admin reviews it
            await run('UPDATE Donors SET active = 0 WHERE id = ?', [donorId]);
        }

        return res.json({ code: 'reportThanks', message: 'Thank you. The report was recorded.' });
    } catch (error) {
        console.error(error.message);
        return fail(res, 500, 'errGeneric', 'Report failed. Please try again.');
    }
});

// ---------- FR 4: RCBT information ----------

app.get('/api/rcbt', async (req, res) => {
    try {
        return res.json({ rcbt: await rcbtList(req.query.district) });
    } catch (error) {
        console.error(error.message);
        return fail(res, 500, 'errGeneric', 'Could not load blood centres.');
    }
});

// ---------- FR 5: Admin ----------

app.post('/api/admin/login', async (req, res) => {
    const { username, password } = req.body || {};

    if (typeof username !== 'string' || typeof password !== 'string') {
        return fail(res, 401, 'errLogin', 'Access denied. Wrong username or password.');
    }

    try {
        const admin = await get('SELECT username, password FROM Admins WHERE username = ?', [username.trim()]);
        const valid = admin && await bcrypt.compare(password, admin.password);

        if (!valid) {
            return fail(res, 401, 'errLogin', 'Access denied. Wrong username or password.');
        }

        // New session ID after login
        req.session.regenerate((error) => {
            if (error) return fail(res, 500, 'errGeneric', 'Login failed.');
            req.session.admin = admin.username;
            return res.json({ username: admin.username });
        });
    } catch (error) {
        console.error(error.message);
        return fail(res, 500, 'errGeneric', 'Login failed.');
    }
});

app.post('/api/admin/logout', (req, res) => {
    req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/admin/me', requireAdmin, (req, res) => {
    res.json({ username: req.session.admin });
});

// FR 5.2: full donor list, flagged donors marked
app.get('/api/admin/donors', requireAdmin, async (req, res) => {
    try {
        const cutoff = staleCutoff();
        const rows = await all(
            `SELECT d.*, (SELECT COUNT(*) FROM Reports r WHERE r.donor_id = d.id) AS reports
             FROM Donors d
             ORDER BY d.registration_date DESC`
        );

        const donors = rows.map((donor) => {
            const reported = donor.active === 0 || donor.reports >= REPORT_LIMIT;
            const stale = donor.last_confirmed < cutoff;
            return {
                id: donor.id,
                name: donor.name,
                phone: donor.phone,
                bloodType: donor.blood_type,
                district: donor.district,
                registrationDate: donor.registration_date,
                lastConfirmed: donor.last_confirmed,
                reports: donor.reports,
                reported,
                stale,
                flagged: reported || stale
            };
        });

        return res.json({ donors });
    } catch (error) {
        console.error(error.message);
        return fail(res, 500, 'errGeneric', 'Could not load donors.');
    }
});

// FR 5.3 + NFR 3: remove a donor and record it in the removal log
app.delete('/api/admin/donors/:id', requireAdmin, async (req, res) => {
    const donorId = Number(req.params.id);
    if (!Number.isInteger(donorId)) return fail(res, 400, 'errGeneric', 'Invalid donor.');

    try {
        const donor = await get('SELECT id FROM Donors WHERE id = ?', [donorId]);
        if (!donor) return fail(res, 404, 'errGeneric', 'Donor not found.');

        // The log is written first, so a removal can never go unrecorded
        await run(
            'INSERT INTO RemovalLog (admin_username, donor_id, removed_at) VALUES (?, ?, ?)',
            [req.session.admin, donorId, new Date().toISOString()]
        );
        await run('DELETE FROM Reports WHERE donor_id = ?', [donorId]);
        await run('DELETE FROM Donors WHERE id = ?', [donorId]);

        return res.json({ code: 'removed', message: 'Donor removed.' });
    } catch (error) {
        console.error(error.message);
        return fail(res, 500, 'errGeneric', 'Could not remove donor.');
    }
});

// Admin reviewed a flagged donor and decided to keep them
app.post('/api/admin/donors/:id/keep', requireAdmin, async (req, res) => {
    const donorId = Number(req.params.id);
    if (!Number.isInteger(donorId)) return fail(res, 400, 'errGeneric', 'Invalid donor.');

    try {
        await run('DELETE FROM Reports WHERE donor_id = ?', [donorId]);
        const result = await run(
            'UPDATE Donors SET active = 1, last_confirmed = ? WHERE id = ?',
            [new Date().toISOString(), donorId]
        );
        if (result.changes === 0) return fail(res, 404, 'errGeneric', 'Donor not found.');
        return res.json({ code: 'kept', message: 'Donor kept.' });
    } catch (error) {
        console.error(error.message);
        return fail(res, 500, 'errGeneric', 'Could not update donor.');
    }
});

app.get('/api/admin/removals', requireAdmin, async (req, res) => {
    try {
        const removals = await all('SELECT * FROM RemovalLog ORDER BY removed_at DESC LIMIT 200');
        return res.json({ removals });
    } catch (error) {
        console.error(error.message);
        return fail(res, 500, 'errGeneric', 'Could not load the removal log.');
    }
});

// Unknown API routes
app.use('/api', (req, res) => fail(res, 404, 'errGeneric', 'Not found.'));

// Start the server (only when run directly, not when the tests load it)
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`BloodLink is running at http://localhost:${PORT}`);
    });
}

module.exports = app;
