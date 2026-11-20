// Create (or reset) an admin account.
// Usage: npm run create-admin -- <username> <password>
const bcrypt = require('bcrypt');
const { db, run } = require('../database');

async function main() {
    const [username, password] = process.argv.slice(2);

    if (!username || !password) {
        console.log('Usage: npm run create-admin -- <username> <password>');
        process.exit(1);
    }

    // NFR 2: at least 8 characters
    if (password.length < 8) {
        console.log('The password must be at least 8 characters long.');
        process.exit(1);
    }

    // NFR 2: store a hash, never the password itself
    const hash = await bcrypt.hash(password, 12);

    await run(
        `INSERT INTO Admins (username, password) VALUES (?, ?)
         ON CONFLICT(username) DO UPDATE SET password = excluded.password`,
        [username.trim(), hash]
    );

    console.log(`Admin "${username.trim()}" is ready. Log in at /admin-login.html`);
    db.close();
}

main().catch((error) => {
    console.error(error.message);
    process.exit(1);
});
