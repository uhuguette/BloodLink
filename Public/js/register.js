
const registrationForm = document.getElementById('registrationForm');

registrationForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const donor = {
        name: document.getElementById('name').value.trim(),
        phone: document.getElementById('phone').value.trim(),
        bloodType: document.getElementById('bloodType').value,
        district: document.getElementById('district').value.trim(),
        consent: document.getElementById('consent').checked
    };

    const message = document.getElementById('registrationMessage');

    const phonePattern = /^07\d{8}$/;

    if (!phonePattern.test(donor.phone)) {
        message.textContent = 'Enter a valid Rwandan phone number (07XXXXXXXX).';
        return;
    }

    if (!donor.consent) {
        message.textContent = 'Please agree to the consent statement.';
        return;
    }

    try {
        const response = await fetch('/api/donors/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(donor)
        });

        const result = await response.json();

        message.textContent = result.message;

        if (response.ok) {
            registrationForm.reset();
        }
    } catch (error) {
        message.textContent = 'Something went wrong. Please try again.';
    }
});
