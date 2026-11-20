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
