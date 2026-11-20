// Small helpers shared by the pages

// Fill a <select> with options. The first, empty option is translated.
function fillSelect(select, items, placeholderKey) {
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.setAttribute('data-translate', placeholderKey);
    placeholder.textContent = placeholderKey;
    select.appendChild(placeholder);

    items.forEach((item) => {
        const option = document.createElement('option');
        option.value = item;
        option.textContent = item;
        select.appendChild(option);
    });
}

// Stop names typed by users from being read as HTML
function escapeHtml(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatDate(isoDate, withTime = false) {
    const date = new Date(isoDate);
    const options = { day: 'numeric', month: 'short', year: 'numeric' };
    if (withTime) {
        options.hour = '2-digit';
        options.minute = '2-digit';
    }
    return date.toLocaleDateString('en-GB', options);
}

// Show a message box with a style: "success" or "error"
function showMessage(element, text, type) {
    element.textContent = text;
    element.className = `form-message ${type || ''}`;
    element.hidden = !text;
}
