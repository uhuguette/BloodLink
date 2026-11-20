
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

// Read information sent from forms
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Admin sessions: expire after 15 minutes of inactivity
app.use(session({
    secret: process.env.SESSION_SECRET || 'bloodlink-development-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: SESSION_MINUTES * 60 * 1000,
        httpOnly: true
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

// ---------- Pages ----------

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'Public', 'index.html'));
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

// ---------- FR 4: RCBT information ----------

app.get('/api/rcbt', async (req, res) => {
    try {
        return res.json({ rcbt: await rcbtList(req.query.district) });
    } catch (error) {
        console.error(error.message);
        return fail(res, 500, 'errGeneric', 'Could not load blood centres.');
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`BloodLink is running at http://localhost:${PORT}`);
});
