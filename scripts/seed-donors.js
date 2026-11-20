// Adds 30 sample donors for testing (Sprint 0).
// Phone numbers start with 0700..., which no Rwandan network uses, so no real person gets called.
// Usage:  npm run seed               (add sample donors)
//         npm run seed -- --remove   (delete them again)
const { db, run } = require('../database');
const { DISTRICTS } = require('../Public/js/data');

const FIRST_NAMES = ['Aline', 'Eric', 'Divine', 'Jean', 'Claudine', 'Patrick', 'Grace', 'Emmanuel',
    'Diane', 'Olivier', 'Sandrine', 'Fabrice', 'Josiane', 'Kevin', 'Ange', 'Thierry',
    'Esther', 'Yves', 'Clarisse', 'Innocent', 'Nadine', 'Samuel', 'Belise', 'Didier',
    'Vanessa', 'Gilbert', 'Chantal', 'Moise', 'Ariane', 'Bosco'];
const LAST_NAMES = ['Mukamana', 'Niyonzima', 'Uwimana', 'Habimana', 'Mutoni', 'Nshimiyimana',
    'Ingabire', 'Hakizimana', 'Umutoni', 'Bizimana'];

// Roughly how common each type is, with rare ones (like AB-) included on purpose
const BLOOD_TYPES = ['O+', 'O+', 'O+', 'O+', 'A+', 'A+', 'A+', 'B+', 'B+', 'AB+', 'O-', 'A-', 'B-', 'AB-'];

async function main() {
    if (process.env.NODE_ENV === 'production') {
        console.log('Refusing to add sample donors on the live server.');
        process.exit(1);
    }

    if (process.argv.includes('--remove')) {
        const result = await run("DELETE FROM Donors WHERE phone LIKE '0700%'");
        console.log(`Removed ${result.changes} sample donors.`);
        return db.close();
    }

    const kigali = ['Gasabo', 'Kicukiro', 'Nyarugenge'];

    for (let i = 0; i < 30; i++) {
        const name = `${FIRST_NAMES[i]} ${LAST_NAMES[i % LAST_NAMES.length]}`;
        const phone = `07000000${String(i + 1).padStart(2, '0')}`;
        const bloodType = BLOOD_TYPES[i % BLOOD_TYPES.length];
        // Most donors in Kigali (where the pilot runs), some elsewhere
        const district = i < 20 ? kigali[i % 3] : DISTRICTS[(i * 7) % DISTRICTS.length];

        // The last 3 have not reconfirmed in over 90 days, to test hiding
        const daysAgo = i >= 27 ? 100 + i : i * 2;
        const date = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();

        await run(
            `INSERT INTO Donors (name, phone, blood_type, district, consent, registration_date, last_confirmed, active)
             VALUES (?, ?, ?, ?, 1, ?, ?, 1)
             ON CONFLICT(phone) DO NOTHING`,
            [name, phone, bloodType, district, date, date]
        );
    }

    console.log('Added 30 sample donors (phones 0700000001 to 0700000030).');
    db.close();
}

main().catch((error) => {
    console.error(error.message);
    process.exit(1);
});
