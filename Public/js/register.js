const registrationForm = document.getElementById('registrationForm');
const message = document.getElementById('registrationMessage');
const phoneError = document.getElementById('phoneError');

fillSelect(document.getElementById('bloodType'), BloodLinkData.BLOOD_TYPES, 'chooseBloodType');
fillSelect(document.getElementById('district'), BloodLinkData.DISTRICTS, 'chooseDistrict');

// Remember which messages are showing so they can be re-translated
let currentMessage = null;   // { key, type }
let currentPhoneError = null;

function setMessage(key, type) {
    currentMessage = key ? { key, type } : null;
    showMessage(message, key ? t(key) : '', type);
}

function setPhoneError(key) {
    currentPhoneError = key;
    phoneError.textContent = key ? t(key) : '';
}

document.addEventListener('languagechange', () => {
    if (currentMessage) setMessage(currentMessage.key, currentMessage.type);
    setPhoneError(currentPhoneError);
});

registrationForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const donor = {
        name: document.getElementById('name').value.trim(),
        phone: document.getElementById('phone').value.replace(/\s+/g, ''),
        bloodType: document.getElementById('bloodType').value,
        district: document.getElementById('district').value,
        consent: document.getElementById('consent').checked
    };

    setMessage(null);
    setPhoneError(null);

    if (!donor.name || !donor.phone || !donor.bloodType || !donor.district) {
        setMessage('errRequired', 'error');
        return;
    }

    if (!/^07\d{8}$/.test(donor.phone)) {
        setPhoneError('errPhone');
        return;
    }

    if (!donor.consent) {
        setMessage('errConsent', 'error');
        return;
    }

    const button = registrationForm.querySelector('button');
    button.disabled = true;

    try {
        const response = await fetch('/api/donors/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(donor)
        });

        const result = await response.json();

        if (response.ok) {
            setMessage(result.code, 'success');
            registrationForm.reset();
        } else if (result.code === 'errPhone') {
            setPhoneError('errPhone');
        } else {
            setMessage(result.code || 'errGeneric', 'error');
        }
    } catch (error) {
        setMessage('errGeneric', 'error');
    } finally {
        button.disabled = false;
    }
});
