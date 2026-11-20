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
    ],

    // Which RCBT city is closest to each district
    NEAREST_RCBT: {
        Gasabo: 'Kigali', Kicukiro: 'Kigali', Nyarugenge: 'Kigali',
        Bugesera: 'Kigali', Kamonyi: 'Kigali', Muhanga: 'Kigali',
        Rulindo: 'Kigali', Gicumbi: 'Kigali',
        Burera: 'Musanze', Gakenke: 'Musanze', Musanze: 'Musanze',
        Nyabihu: 'Musanze', Rubavu: 'Musanze',
        Gisagara: 'Huye', Huye: 'Huye', Nyamagabe: 'Huye',
        Nyanza: 'Huye', Nyaruguru: 'Huye', Ruhango: 'Huye',
        Gatsibo: 'Rwamagana', Kayonza: 'Rwamagana', Kirehe: 'Rwamagana',
        Ngoma: 'Rwamagana', Nyagatare: 'Rwamagana', Rwamagana: 'Rwamagana',
        Karongi: 'Karongi', Ngororero: 'Karongi', Nyamasheke: 'Karongi',
        Rusizi: 'Karongi', Rutsiro: 'Karongi'
    }
};

// Allow the server (Node.js) to use the same lists
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BloodLinkData;
}
