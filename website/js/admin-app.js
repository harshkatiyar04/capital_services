import { clearToken, getToken, ops, setToken } from './ops-client.js';

const $ = (id) => document.getElementById(id);
let cache = null;
let view = 'overview';
let boardRole = 'trade';

function showShell(mode) {
  $('gate').classList.toggle('ops-hidden', mode !== 'gate');
  $('boot').classList.toggle('ops-hidden', mode !== 'boot');
  $('app').classList.toggle('ops-hidden', mode !== 'app');
}

function tierEl(tier) {
  if (!tier) return '';
  return `<span class="tier tier-${tier.id}"><i></i>${tier.label}</span>`;
}

function boardTable(rows) {
  return `
    <div style="overflow:auto">
      <table class="ops-table">
        <thead><tr><th>#</th><th>Name</th><th>ID</th><th>Tier</th><th>Avg</th><th>Cards</th></tr></thead>
        <tbody>
          ${(rows || []).map((r) => `
            <tr>
              <td class="num">${r.place || '—'}</td>
              <td>${r.name}</td>
              <td>${r.workId}</td>
              <td>${tierEl(r.tier)}</td>
              <td class="num">${r.average != null ? r.average.toFixed(1) : '—'}</td>
              <td class="num">${r.reviews}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

function render() {
  const d = cache;
  const panel = $('panel');
  if (view === 'overview') {
    panel.innerHTML = `
      <p class="ops-kicker">House</p>
      <h1 class="ops-title" style="font-size:2.3rem">Ledger</h1>
      <div class="ops-kpis">
        <div class="ops-kpi"><b>${d.counts.workers}</b><span>Active people</span></div>
        <div class="ops-kpi"><b>${d.counts.jobs || 0}</b><span>Jobs logged</span></div>
        <div class="ops-kpi"><b>${d.counts.enquiries || 0}</b><span>Enquiries</span></div>
        <div class="ops-kpi"><b>${d.overall != null ? d.overall.toFixed(1) : '—'}</b><span>Overall satisfaction</span></div>
      </div>
      <div class="ops-card">
        <div class="ops-section-head"><h2>Tiers</h2><span class="ops-hint">${d.minReviews} cards to lock a tier</span></div>
        <p class="ops-comment">Foundation · Bronze · Silver · Gold · Capital. Average of the role stars, not the closing satisfaction mark.</p>
      </div>
      <div class="ops-card">
        <div class="ops-section-head"><h2>Crew board</h2></div>
        ${boardTable(d.leaderboard.trade.slice(0, 8))}
      </div>`;
  }

  if (view === 'board') {
    panel.innerHTML = `
      <div class="ops-section-head"><h2>Leaderboard</h2></div>
      <div class="ops-chips" id="role-chips">
        <button type="button" class="ops-chip ${boardRole === 'trade' ? 'is-on' : ''}" data-r="trade">Crew</button>
        <button type="button" class="ops-chip ${boardRole === 'office' ? 'is-on' : ''}" data-r="office">Office</button>
        <button type="button" class="ops-chip ${boardRole === 'surveyor' ? 'is-on' : ''}" data-r="surveyor">Surveyor</button>
      </div>
      <div class="ops-card">${boardTable(d.leaderboard[boardRole])}</div>`;
    panel.querySelectorAll('[data-r]').forEach((btn) => {
      btn.addEventListener('click', () => {
        boardRole = btn.dataset.r;
        render();
      });
    });
  }

  if (view === 'people') {
    panel.innerHTML = `
      <div class="ops-section-head"><h2>Issue credentials</h2><span class="ops-hint">Work ID + one-time PIN</span></div>
      <div class="ops-card">
        <form id="issue-form">
          <div class="ops-row">
            <div class="ops-field">
              <label for="new-name">Full name</label>
              <input class="ops-input" id="new-name" required>
            </div>
            <div class="ops-field">
              <label for="new-role">Line</label>
              <select class="ops-select" id="new-role">
                <option value="trade">On-site crew</option>
                <option value="office">Office staff</option>
                <option value="surveyor">Surveyor</option>
              </select>
            </div>
          </div>
          <p class="ops-error ops-hidden" id="issue-error"></p>
          <button class="btn btn-primary" type="submit">Issue Work ID</button>
        </form>
        <div id="issued" class="ops-issued ops-hidden"></div>
      </div>
      <div class="ops-card">
        <div class="ops-section-head"><h2>People</h2></div>
        <div style="overflow:auto">
          <table class="ops-table">
            <thead><tr><th>Name</th><th>ID</th><th>Line</th><th></th></tr></thead>
            <tbody>
              ${d.workers.map((w) => `
                <tr>
                  <td>${w.name}</td>
                  <td>${w.workId}</td>
                  <td>${w.role}</td>
                  <td><button type="button" class="ops-link" data-toggle="${w.id}" data-active="${w.active}">${w.active ? 'Hold' : 'Restore'}</button></td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>`;

    $('issue-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const res = await ops('admin/workers', {
          method: 'POST',
          body: { name: $('new-name').value, role: $('new-role').value },
        });
        const box = $('issued');
        box.classList.remove('ops-hidden');
        box.innerHTML = `<p class="ops-kicker">Give them once</p>
          <p>Work ID <code>${res.worker.workId}</code></p>
          <p>PIN <code>${res.pin}</code></p>
          <p class="ops-hint">${res.note}</p>
          <p class="ops-hint">Job card link: survey.html?wid=${res.worker.workId}</p>`;
        cache = await ops('admin/overview');
      } catch (ex) {
        const el = $('issue-error');
        el.textContent = ex.message;
        el.classList.remove('ops-hidden');
      }
    });

    panel.querySelectorAll('[data-toggle]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        await ops('admin/workers/active', {
          method: 'POST',
          body: { workerId: btn.dataset.toggle, active: btn.dataset.active !== 'true' },
        });
        cache = await ops('admin/overview');
        render();
      });
    });
  }

  if (view === 'enquiries') {
    const rows = d.enquiries || [];
    panel.innerHTML = `
      <div class="ops-section-head">
        <h2>Enquiries</h2>
        <span class="ops-hint">Contact form + chat · ${rows.length} latest</span>
      </div>
      ${rows.length ? rows.map((e) => `
        <article class="ops-card" data-enquiry="${e.id}">
          <div class="ops-section-head">
            <h2 style="font-size:1.15rem">${e.name} · ${e.email}</h2>
            <span class="ops-hint">${new Date(e.createdAt).toLocaleString('en-GB')} · ${e.source === 'chat' ? 'Registered using chat' : e.source === 'contact' ? 'Contact form' : e.source} · ${e.status}</span>
          </div>
          ${e.phone ? `<p class="ops-comment">Phone: ${e.phone}</p>` : ''}
          ${e.company ? `<p class="ops-comment">Company: ${e.company}</p>` : ''}
          ${e.service ? `<p class="ops-comment">Service: ${e.service}</p>` : ''}
          <p class="ops-comment" style="margin-top:.5rem;white-space:pre-wrap">${e.message}</p>
          <div class="ops-chips" style="margin-top:.75rem">
            <button type="button" class="ops-chip ${e.status === 'new' ? 'is-on' : ''}" data-status="new" data-id="${e.id}">New</button>
            <button type="button" class="ops-chip ${e.status === 'in_progress' ? 'is-on' : ''}" data-status="in_progress" data-id="${e.id}">In progress</button>
            <button type="button" class="ops-chip ${e.status === 'closed' ? 'is-on' : ''}" data-status="closed" data-id="${e.id}">Closed</button>
          </div>
        </article>`).join('') : '<div class="ops-card"><p class="ops-hint">No enquiries yet.</p></div>'}`;

    panel.querySelectorAll('[data-status]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        await ops('admin/enquiries/status', {
          method: 'POST',
          body: { id: btn.dataset.id, status: btn.dataset.status },
        });
        cache = await ops('admin/overview');
        render();
      });
    });
  }

  if (view === 'cards') {
    panel.innerHTML = `
      <div class="ops-section-head"><h2>Job cards</h2><span class="ops-hint">${d.surveys.length} latest</span></div>
      ${d.surveys.map((s) => `
        <article class="ops-card">
          <div class="ops-section-head">
            <h2 style="font-size:1.2rem">${s.customerName || 'Anonymous'} ${s.jobRef ? '· ' + s.jobRef : ''}</h2>
            <span class="ops-hint">${new Date(s.createdAt).toLocaleString('en-GB')} · overall ${s.overallSatisfaction}/5</span>
          </div>
          ${s.sections.map((sec) => `<p class="ops-comment">${sec.workerName} (${sec.workId}, ${sec.role}) — ${sec.average.toFixed(1)}</p>`).join('')}
          ${s.improvement ? `<p class="ops-comment" style="margin-top:.75rem">“${s.improvement}”</p>` : ''}
        </article>`).join('') || '<div class="ops-card"><p class="ops-hint">No cards yet.</p></div>'}`;
  }
}

async function boot() {
  cache = await ops('admin/overview');
  showShell('app');
  render();
}

document.addEventListener('DOMContentLoaded', async () => {
  $('logout-btn').addEventListener('click', async () => {
    try { await ops('logout', { method: 'POST', body: {} }); } catch {}
    clearToken();
    showShell('gate');
  });

  $('rail').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-view]');
    if (!btn) return;
    view = btn.dataset.view;
    $('rail').querySelectorAll('button').forEach((b) => b.classList.toggle('is-on', b === btn));
    render();
  });

  $('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const data = await ops('login', {
        method: 'POST',
        body: { identifier: $('identifier').value, password: $('password').value },
      });
      if (data.user?.kind !== 'admin') {
        throw new Error('Office login only');
      }
      setToken(data.token);
      showShell('boot');
      await boot();
    } catch (ex) {
      showShell('gate');
      const el = $('login-error');
      el.textContent = ex.message;
      el.classList.remove('ops-hidden');
    }
  });

  if (getToken()) {
    showShell('boot');
    try { await boot(); } catch { clearToken(); showShell('gate'); }
  } else {
    showShell('gate');
  }
});
