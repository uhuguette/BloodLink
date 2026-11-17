
const express = require('express');
const session = require('express-session');
const path = require('path');

const db = require('./database');

const app = express();
const PORT = 3000;

// Read information sent from forms
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Set up admin sessions
app.use(session({
    secret: 'bloodlink-development-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 15 * 60 * 1000,
        httpOnly: true
    }
}));

// Make frontend files available
app.use(express.static(path.join(__dirname, 'Public')));

// Display the homepage
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'Public', 'index.html'));
});

// Register a new donor
app.post('/api/donors/register', (req, res) => {
    const { name, phone, bloodType, district, consent } = req.body;

    // Check that all required information is provided
    if (!name || !phone || !bloodType || !district || consent !== true) {
        return res.status(400).json({
            message: 'Please provide all required information and consent.'
        });
    }

    // Validate the Rwandan phone number
    if (!/^07\d{8}$/.test(phone)) {
        return res.status(400).json({
            message: 'Please enter a valid phone number.'
        });
    }

    // Check that the blood type is valid
    const validBloodTypes = [
        'A+', 'A-', 'B+', 'B-',
        'AB+', 'AB-', 'O+', 'O-'
    ];

    if (!validBloodTypes.includes(bloodType)) {
        return res.status(400).json({
            message: 'Invalid blood type.'
        });
    }

    const today = new Date().toISOString();

    const sql = `
        INSERT INTO Donors
        (name, phone, blood_type, district, consent,
         registration_date, last_confirmed, active)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1)
        ON CONFLICT(phone) DO UPDATE SET
            name = excluded.name,
            blood_type = excluded.blood_type,
            district = excluded.district,
            consent = excluded.consent,
            last_confirmed = excluded.last_confirmed,
            active = 1
    `;

    db.run(
        sql,
        [name.trim(), phone, bloodType, district.trim(), 1, today, today],
        function (error) {
            if (error) {
                console.error(error.message);

                return res.status(500).json({
                    message: 'Registration failed. Please try again.'
                });
            }

            res.status(201).json({
                message: 'Donor registered successfully!'
            });
        }
    );
});


// Start the server
app.listen(PORT, () => {
    console.log(`BloodLink is running at http://localhost:${PORT}`);
});
