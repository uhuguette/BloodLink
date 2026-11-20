// Automated tests for the SRS requirements. Run with: npm test
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Use a throwaway database so real data is never touched
const dbFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'bloodlink-')), 'test.db');
process.env.DB_PATH = dbFile;
process.env.NODE_ENV = 'test';

const bcrypt = require('bcrypt');
const app = require('../server');
const { db, run, get } = require('../database');

let server;
let base;
const ADMIN_USER = 'testadmin';
const ADMIN_PASS = `test-${Math.random().toString(36).slice(2)}`;

before(async () => {
    await new Promise((resolve) => { server = app.listen(0, resolve); });
    base = `http://127.0.0.1:${server.address().port}`;
    await run('INSERT INTO Admins (username, password) VALUES (?, ?)', [ADMIN_USER, await bcrypt.hash(ADMIN_PASS, 4)]);
});

after(() => {
    server.close();
    db.close();
});

function register(donor) {
    return fetch(`${base}/api/donors/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consent: true, bloodType: 'AB-', district: 'Gasabo', ...donor })
    });
}

function search(bloodType, district) {
    return fetch(`${base}/api/donors/search?${new URLSearchParams({ bloodType, district })}`).then((r) => r.json());
}

async function loginCookie() {
    const response = await fetch(`${base}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: ADMIN_USER, password: ADMIN_PASS })
    });
    assert.strictEqual(response.status, 200);
    return response.headers.get('set-cookie').split(';')[0];
}

test('FR 1.2: bad phone numbers are rejected', async () => {
    for (const phone of ['0812345678', '07123', '071234567890', 'abcdefghij']) {
        const response = await register({ name: 'Test Person', phone });
        assert.strictEqual(response.status, 400, phone);
        assert.strictEqual((await response.json()).code, 'errPhone');
    }
});

test('NFR 4: no consent means no sign-up', async () => {
    const response = await register({ name: 'Test Person', phone: '0781111111', consent: false });
    assert.strictEqual(response.status, 400);
    assert.strictEqual((await response.json()).code, 'errConsent');
});

test('FR 1.2: same phone number updates the existing record', async () => {
    assert.strictEqual((await register({ name: 'Aline Mukamana', phone: '0782222222' })).status, 201);
    const second = await register({ name: 'Aline M Mukamana', phone: '0782222222', district: 'Kicukiro' });
    assert.strictEqual((await second.json()).code, 'registerUpdated');
    const { count } = await get("SELECT COUNT(*) AS count FROM Donors WHERE phone = '0782222222'");
    assert.strictEqual(count, 1);
});

test('FR 3.1 + NFR 5: search shows first names only, max 20', async () => {
    for (let i = 0; i < 25; i++) {
        await register({ name: `Donor${i} Lastname`, phone: `07830000${String(i).padStart(2, '0')}`, bloodType: 'O-', district: 'Huye' });
    }
    const result = await search('O-', 'Huye');
    assert.strictEqual(result.donors.length, 20);
    assert.ok(result.donors.every((d) => !d.firstName.includes(' ')));
    assert.ok(result.donors[0].phone && result.donors[0].lastConfirmed);
});

test('FR 3.2: no results returns RCBT contacts, nearest first', async () => {
    const result = await search('B-', 'Rusizi');
    assert.strictEqual(result.donors.length, 0);
    assert.ok(result.rcbt.length > 0);
    assert.strictEqual(result.rcbt[0].city, 'Karongi');
    assert.strictEqual(result.rcbt[0].nearest, true);
});

test('Donors not reconfirmed in 90 days are hidden', async () => {
    await register({ name: 'Old Donor', phone: '0784444444', bloodType: 'A-', district: 'Musanze' });
    await run("UPDATE Donors SET last_confirmed = '2020-01-01T00:00:00.000Z' WHERE phone = '0784444444'");
    assert.strictEqual((await search('A-', 'Musanze')).donors.length, 0);
});

test('FR 3.3: two reports hide a donor; one person cannot report twice', async () => {
    await register({ name: 'Reported Donor', phone: '0785555555', bloodType: 'B+', district: 'Nyanza' });
    const [donor] = (await search('B+', 'Nyanza')).donors;

    // The same browser reporting twice only counts once
    const first = await fetch(`${base}/api/donors/${donor.id}/report`, { method: 'POST' });
    const cookie = first.headers.get('set-cookie').split(';')[0];
    await fetch(`${base}/api/donors/${donor.id}/report`, { method: 'POST', headers: { cookie } });
    assert.strictEqual((await search('B+', 'Nyanza')).donors.length, 1);

    // A second person reports it: now hidden
    await fetch(`${base}/api/donors/${donor.id}/report`, { method: 'POST' });
    assert.strictEqual((await search('B+', 'Nyanza')).donors.length, 0);
});

test('NFR 1: admin pages are blocked without login', async () => {
    const page = await fetch(`${base}/admin`);
    assert.strictEqual(page.status, 403);
    assert.match(await page.text(), /Access denied/);

    assert.strictEqual((await fetch(`${base}/api/admin/donors`)).status, 401);
    assert.strictEqual((await fetch(`${base}/admin.html`)).status, 404);
});

test('FR 5.1: wrong password gives access denied', async () => {
    const response = await fetch(`${base}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: ADMIN_USER, password: 'wrong-password' })
    });
    assert.strictEqual(response.status, 401);
});

test('NFR 2: admin password is stored as a hash', async () => {
    const admin = await get('SELECT password FROM Admins WHERE username = ?', [ADMIN_USER]);
    assert.notStrictEqual(admin.password, ADMIN_PASS);
    assert.match(admin.password, /^\$2[aby]\$/);
});

test('FR 5.2 + 5.3 + NFR 3: admin sees flagged donors, removal is logged', async () => {
    const cookie = await loginCookie();
    const { donors } = await (await fetch(`${base}/api/admin/donors`, { headers: { cookie } })).json();

    const flagged = donors.find((d) => d.phone === '0785555555');
    assert.strictEqual(flagged.flagged, true);
    assert.strictEqual(flagged.reported, true);
    assert.strictEqual(donors.find((d) => d.phone === '0784444444').stale, true);

    const removed = await fetch(`${base}/api/admin/donors/${flagged.id}`, { method: 'DELETE', headers: { cookie } });
    assert.strictEqual(removed.status, 200);

    const log = await get('SELECT * FROM RemovalLog WHERE donor_id = ?', [flagged.id]);
    assert.strictEqual(log.admin_username, ADMIN_USER);
    assert.ok(log.removed_at);
    assert.strictEqual(await get('SELECT id FROM Donors WHERE id = ?', [flagged.id]), undefined);
});

test('Admin "keep" restores a flagged donor to search', async () => {
    const cookie = await loginCookie();
    const donor = await get("SELECT id FROM Donors WHERE phone = '0784444444'");
    await fetch(`${base}/api/admin/donors/${donor.id}/keep`, { method: 'POST', headers: { cookie } });
    assert.strictEqual((await search('A-', 'Musanze')).donors.length, 1);
});

test('NFR 7: search over 1,000 donors answers in under 2 seconds', async () => {
    await run('BEGIN');
    const now = new Date().toISOString();
    for (let i = 0; i < 1000; i++) {
        await run(
            `INSERT INTO Donors (name, phone, blood_type, district, consent, registration_date, last_confirmed, active)
             VALUES (?, ?, 'O+', 'Gasabo', 1, ?, ?, 1)`,
            [`Load${i} Test`, `0789${String(i).padStart(6, '0')}`, now, now]
        );
    }
    await run('COMMIT');

    let fast = 0;
    for (let i = 0; i < 20; i++) {
        const start = Date.now();
        await search('O+', 'Gasabo');
        if (Date.now() - start < 2000) fast++;
    }
    assert.ok(fast >= 19, `${fast}/20 searches were under 2 seconds`);
});
