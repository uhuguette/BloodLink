const donorRows = document.getElementById('donorRows');
const removalRows = document.getElementById('removalRows');
const flaggedOnly = document.getElementById('flaggedOnly');

let donors = [];
let removals = [];

// Every admin request goes through here; a 401 means the session timed out (NFR 2)
async function api(url, options = {}) {
    const response = await fetch(url, options);
    if (response.status === 401) {
        location.href = '/admin-login.html?expired=1';
        throw new Error('Session expired');
    }
    if (!response.ok) throw new Error('Request failed');
    return response.json();
}

function statusHtml(donor) {
    const labels = [];
    if (donor.reported) labels.push(`<span class="status status-reported">${t('statusReported')}</span>`);
    if (donor.stale) labels.push(`<span class="status status-stale">${t('statusStale')}</span>`);
    if (!labels.length) labels.push(`<span class="status status-active">${t('statusActive')}</span>`);
    return labels.join(' ');
}

function renderDonors() {
    const list = flaggedOnly.checked ? donors.filter((donor) => donor.flagged) : donors;

    document.getElementById('statTotal').textContent = donors.length;
    document.getElementById('statFlagged').textContent = donors.filter((donor) => donor.flagged).length;
    document.getElementById('statVisible').textContent = donors.filter((donor) => !donor.flagged).length;

    if (!list.length) {
        donorRows.innerHTML = `<tr><td colspan="9" class="empty">${t('noDonors')}</td></tr>`;
        return;
    }

    donorRows.innerHTML = list.map((donor) => `
        <tr class="${donor.flagged ? 'flagged' : ''}">
            <td>${donor.id}</td>
            <td>${escapeHtml(donor.name)}</td>
            <td>${escapeHtml(donor.phone)}</td>
            <td>${escapeHtml(donor.bloodType)}</td>
            <td>${escapeHtml(donor.district)}</td>
            <td>${formatDate(donor.lastConfirmed)}</td>
            <td>${donor.reports}</td>
            <td>${statusHtml(donor)}</td>
            <td class="actions">
                ${donor.flagged ? `<button type="button" class="btn-small btn-light" data-keep="${donor.id}">${t('keepButton')}</button>` : ''}
                <button type="button" class="btn-small" data-remove="${donor.id}">${t('removeButton')}</button>
            </td>
        </tr>`).join('');
}

function renderRemovals() {
    if (!removals.length) {
        removalRows.innerHTML = `<tr><td colspan="3" class="empty">${t('noRemovals')}</td></tr>`;
        return;
    }

    removalRows.innerHTML = removals.map((entry) => `
        <tr>
            <td>${escapeHtml(entry.admin_username)}</td>
            <td>${entry.donor_id}</td>
            <td>${formatDate(entry.removed_at, true)}</td>
        </tr>`).join('');
}

async function loadAll() {
    try {
        const [me, donorResult, removalResult] = await Promise.all([
            api('/api/admin/me'),
            api('/api/admin/donors'),
            api('/api/admin/removals')
        ]);

        document.getElementById('adminName').textContent = me.username;
        donors = donorResult.donors;
        removals = removalResult.removals;
        renderDonors();
        renderRemovals();
    } catch (error) {
        // api() already redirects on session timeout
    }
}

donorRows.addEventListener('click', async (event) => {
    const removeButton = event.target.closest('[data-remove]');
    const keepButton = event.target.closest('[data-keep]');

    try {
        if (removeButton && confirm(t('removeConfirm'))) {
            await api(`/api/admin/donors/${removeButton.dataset.remove}`, { method: 'DELETE' });
            await loadAll();
        } else if (keepButton && confirm(t('keepConfirm'))) {
            await api(`/api/admin/donors/${keepButton.dataset.keep}/keep`, { method: 'POST' });
            await loadAll();
        }
    } catch (error) {
        if (error.message !== 'Session expired') alert(t('errGeneric'));
    }
});

flaggedOnly.addEventListener('change', renderDonors);

document.getElementById('logoutButton').addEventListener('click', async () => {
    await fetch('/api/admin/logout', { method: 'POST' }).catch(() => {});
    location.href = '/admin-login.html';
});

document.addEventListener('languagechange', () => {
    renderDonors();
    renderRemovals();
});

loadAll();
