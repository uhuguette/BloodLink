// Shared lists used by both the website and the server (single source of truth)

const BloodLinkData = {
    BLOOD_TYPES: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],

    // Rwanda's 30 districts, grouped by province
    DISTRICTS: [
        // Kigali City
        'Gasabo', 'Kicukiro', 'Nyarugenge',
        // Northern Province
        'Burera', 'Gakenke', 'Gicumbi', 'Musanze', 'Rulindo',
        // Southern Province
        'Gisagara', 'Huye', 'Kamonyi', 'Muhanga', 'Nyamagabe', 'Nyanza', 'Nyaruguru', 'Ruhango',
        // Eastern Province
        'Bugesera', 'Gatsibo', 'Kayonza', 'Kirehe', 'Ngoma', 'Nyagatare', 'Rwamagana',
        // Western Province
        'Karongi', 'Ngororero', 'Nyabihu', 'Nyamasheke', 'Rubavu', 'Rusizi', 'Rutsiro'
    ]
};

// Allow the server (Node.js) to use the same lists
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BloodLinkData;
}
