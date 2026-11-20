const searchForm = document.getElementById('searchForm');
const bloodTypeSelect = document.getElementById('bloodType');
const districtSelect = document.getElementById('district');
const searchMessage = document.getElementById('searchMessage');
const resultsSection = document.getElementById('results');
const rcbtListElement = document.getElementById('rcbtList');

fillSelect(bloodTypeSelect, BloodLinkData.BLOOD_TYPES, 'chooseBloodType');
fillSelect(districtSelect, BloodLinkData.DISTRICTS, 'chooseDistrict');

// Kept so results can be redrawn when the language changes
let lastResult = null;
let allCentres = [];
let messageKey = null;
const reportedIds = new Set();

function setSearchMessage(key, type) {
    messageKey = key ? { key, type } : null;
    showMessage(searchMessage, key ? t(key) : '', type);
}

function rcbtItemHtml(centre) {
    return `
        <li class="rcbt-item ${centre.nearest ? 'nearest' : ''}">
            <div>
                <strong>${escapeHtml(centre.name)}</strong>
                ${centre.nearest ? `<span class="badge">${t('nearest')}</span>` : ''}
                <small>${escapeHtml(centre.city)}</small>
            </div>
            <a class="btn btn-small" href="tel:${escapeHtml(centre.phone)}">${t('callButton')} ${escapeHtml(centre.phone)}</a>
        </li>`;
}

function donorCardHtml(donor) {
    const reported = reportedIds.has(donor.id);
    return `
        <li class="donor-card">
            <div class="donor-blood">${escapeHtml(donor.bloodType)}</div>
            <div class="donor-info">
                <strong>${escapeHtml(donor.firstName)}</strong>
                <span>📍 ${escapeHtml(donor.district)}</span>
                <small>${t('lastConfirmed')}: ${formatDate(donor.lastConfirmed)}</small>
            </div>
            <div class="donor-actions">
                <a class="btn btn-small" href="tel:${escapeHtml(donor.phone)}">${t('callButton')} ${escapeHtml(donor.phone)}</a>
                ${reported
                    ? `<span class="report-done">${t('reportThanks')}</span>`
                    : `<button type="button" class="link-button" data-report="${donor.id}">${t('reportButton')}</button>`}
            </div>
        </li>`;
}

function renderResults() {
    if (!lastResult) return;

    const { donors, rcbt } = lastResult;
    resultsSection.hidden = false;

    if (donors.length > 0) {
        resultsSection.innerHTML = `
            <h2>${t('resultsCount', { n: donors.length })}</h2>
            <ul class="donor-list">${donors.map(donorCardHtml).join('')}</ul>`;
    } else {
        // FR 3.2: no donors, show RCBT contacts (nearest first)
        resultsSection.innerHTML = `
            <div class="no-results">
                <h2>${t('noResultsTitle')}</h2>
                <p>${t('noResultsText')}</p>
            </div>
            <ul class="rcbt-list">${rcbt.map(rcbtItemHtml).join('')}</ul>`;
    }
}

function renderCentres() {
    rcbtListElement.innerHTML = allCentres.map((centre) => rcbtItemHtml({ ...centre, nearest: false })).join('');
}

searchForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const bloodType = bloodTypeSelect.value;
    const district = districtSelect.value;

    if (!bloodType || !district) {
        setSearchMessage('errSearchRequired', 'error');
        return;
    }

    setSearchMessage('searching');
    const button = searchForm.querySelector('button');
    button.disabled = true;

    try {
        const params = new URLSearchParams({ bloodType, district });
        const response = await fetch(`/api/donors/search?${params}`);
        const result = await response.json();

        if (!response.ok) {
            setSearchMessage(result.code || 'errGeneric', 'error');
            return;
        }

        setSearchMessage(null);
        lastResult = result;
        renderResults();
        resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) {
        setSearchMessage('errGeneric', 'error');
    } finally {
        button.disabled = false;
    }
});

document.addEventListener('languagechange', () => {
    if (messageKey) setSearchMessage(messageKey.key, messageKey.type);
    renderResults();
    renderCentres();
});

// Load the RCBT list on page load (FR 4.1)
fetch('/api/rcbt')
    .then((response) => response.json())
    .then((result) => {
        allCentres = result.rcbt || [];
        renderCentres();
    })
    .catch(() => {});
