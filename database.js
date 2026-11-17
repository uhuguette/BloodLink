
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database', 'bloodlink.db');

const db = new sqlite3.Database(dbPath, (error) => {
    if (error) {
        console.error('Database connection failed:', error.message);
    } else {
        console.log('Connected to BloodLink database.');
    }
});

db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS Donors (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            phone TEXT NOT NULL UNIQUE,
            blood_type TEXT NOT NULL,
            district TEXT NOT NULL,
            consent INTEGER NOT NULL,
            registration_date TEXT NOT NULL,
            last_confirmed TEXT NOT NULL,
            active INTEGER DEFAULT 1
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS Reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            donor_id INTEGER NOT NULL,
            reported_at TEXT NOT NULL,
            FOREIGN KEY (donor_id) REFERENCES Donors(id)
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS Admins (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS RemovalLog (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            admin_username TEXT NOT NULL,
            donor_id INTEGER NOT NULL,
            removed_at TEXT NOT NULL
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS RCBTContacts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            phone TEXT NOT NULL
        )
    `);
});

module.exports = db;
