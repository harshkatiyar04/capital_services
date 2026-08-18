import { clearToken, getToken, ops, STAR_LABELS } from './ops-client.js';

const METRICS = {
  trade: [
    { key: 'punctuality', label: 'Punctuality', opt: false },
    { key: 'politeness', label: 'Politeness', opt: false },
    { key: 'tidiness', label: 'Tidiness', opt: false },
    { key: 'quality', label: 'Quality of work', opt: false },
    { key: 'presentation', label: 'Presentation', opt: false },
    { key: 'professionalism', label: 'Professionalism', opt: true },
  ],
  office: [
    { key: 'communication', label: 'Communication & timeline', opt: false },
    { key: 'friendliness', label: 'Friendly & approachable', opt: false },
  ],
  surveyor: [
    { key: 'punctuality', label: 'Punctuality', opt: false },
    { key: 'communication', label: 'Clarity on the project', opt: false },
    { key: 'presentation', label: 'Well presented', opt: false },
    { key: 'friendliness', label: 'Friendliness', opt: false },
  ],
};

const STAR = `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2.6l2.4 6.1 6.6.4-5.1 4.2 1.7 6.4L12 16.8 6.4 19.7l1.7-6.4L3 9.1l6.6-.4L12 2.6z"/></svg>`;
const $ = (id) => document.getElementById(id);

let dash = null;
const reviewState = { jobId: null, worker: null, scores: {}, extra: {}, overall: 0 };

function tierEl(tier) {
  if (!tier) return '';
  return `<span class="tier tier-${tier.id}"><i></i>${tier.label}</span>`;
}

function stars(group, current = 0) {
  const wrap = document.createElement('div');
  wrap.className = 'ops-stars';
  for (let i = 1; i <= 5; i += 1) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `ops-star${i <= current ? ' is-on' : ''}`;
    btn.innerHTML = STAR;
    btn.dataset.value = String(i);
    btn.title = STAR_LABELS[i - 1];
    wrap.appendChild(btn);
  }
  wrap.addEventListener('click', (e) => {
    const btn = e.target.closest('.ops-star');
    if (!btn) return;
    const value = Number(btn.dataset.value);
    const [kind, key, extraRole] = group.split('.');
    if (kind === 'own') reviewState.scores[key] = value;
    else if (kind === 'overall') reviewState.overall = value;
    else reviewState.extra[extraRole].scores[key] = value;
    wrap.querySelectorAll('.ops-star').forEach((el, idx) => el.classList.toggle('is-on', idx < value));
  });
  return wrap;
}

function rateRow(label, group, opt = false) {
  const row = document.createElement('div');
  row.className = 'ops-rate';
  row.innerHTML = `<div class="ops-rate-copy"><strong>${label}</strong><small>${opt ? 'Optional' : STAR_LABELS.join(' · ')}</small></div>`;
  row.appendChild(stars(group, 0));
  return row;
}

function renderBoard() {
  const { user, stats, jobs } = dash;
  $('who').textContent = `${user.name} · ${user.workId}`;
  const pending = (jobs || []).filter((j) => !j.reviewed).length;
  $('board').innerHTML = `
    <p class="ops-kicker">${user.workId}</p>
    <h1 class="ops-title">${user.name}</h1>
    <div class="ops-kpis">
      <div class="ops-kpi"><b>${stats?.average != null ? stats.average.toFixed(1) : '—'}</b><span>Average</span></div>
      <div class="ops-kpi"><b>${stats?.place ? '#' + stats.place : '—'}</b><span>In your line</span></div>
      <div class="ops-kpi"><b>${tierEl(stats?.tier)}</b><span>Tier</span></div>
    </div>

    <div class="ops-card">
      <div class="ops-section-head">
        <h2>Log a job</h2>
        <span class="ops-hint">Then collect the review on site</span>
      </div>
      <form id="job-form">
        <div class="ops-row">
          <div class="ops-field">
            <label for="cust">Customer name</label>
            <input class="ops-input" id="cust" required>
          </div>
          <div class="ops-field">
            <label for="jnum">Job number</label>
            <input class="ops-input" id="jnum" required>
          </div>
        </div>
        <p class="ops-error ops-hidden" id="job-err"></p>
        <button class="btn btn-primary" type="submit">Save job</button>
      </form>
    </div>

    <div class="ops-card">
      <div class="ops-section-head">
        <h2>Jobs</h2>
        <span class="ops-hint">${pending} waiting for review</span>
      </div>
      ${(jobs || []).length ? `
        <div style="overflow:auto">
          <table class="ops-table">
            <thead><tr><th>Customer</th><th>Job no.</th><th>Status</th><th></th></tr></thead>
            <tbody>
              ${jobs.map((j) => `
                <tr>
                  <td>${j.customerName}</td>
                  <td>${j.jobNumber}</td>
                  <td><span class="ops-status ${j.reviewed ? 'ops-status--done' : 'ops-status--open'}">${j.reviewed ? 'Reviewed' : 'Open'}</span></td>
                  <td>${j.reviewed ? '—' : `<button type="button" class="btn btn-primary btn-sm" data-collect="${j.id}">Collect review</button>`}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>` : '<p class="ops-hint">No jobs yet. Log the first one above.</p>'}
    </div>
  `;

  $('job-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await ops('jobs', {
        method: 'POST',
        body: { customerName: $('cust').value, jobNumber: $('jnum').value },
      });
      await reload();
    } catch (err) {
      const el = $('job-err');
      el.textContent = err.message;
      el.classList.remove('ops-hidden');
    }
  });

  document.querySelectorAll('[data-collect]').forEach((btn) => {
    btn.addEventListener('click', () => openReview(btn.dataset.collect));
  });
}

async function openReview(jobId) {
  const data = await ops(`job?id=${encodeURIComponent(jobId)}`);
  reviewState.jobId = jobId;
  reviewState.worker = data.worker;
  reviewState.scores = {};
  reviewState.overall = 0;
  reviewState.extra = {};
  $('review-title').textContent = `${data.job.customerName} · ${data.job.jobNumber}`;
  const form = $('review-form');
  form.innerHTML = '';
  const intro = document.createElement('p');
  intro.className = 'ops-lede';
  intro.textContent = `Please rate ${data.worker.name}. About two minutes.`;
  form.appendChild(intro);

  const head = document.createElement('div');
  head.className = 'ops-section-head';
  head.innerHTML = `<h2 style="font-size:1.4rem">${data.worker.name}</h2><span class="ops-hint">1–5 stars</span>`;
  form.appendChild(head);
  METRICS[data.worker.role].forEach((m) => form.appendChild(rateRow(m.label, `own.${m.key}`, m.opt)));

  const extraWrap = document.createElement('div');
  extraWrap.innerHTML = `<p class="ops-hint" style="margin:1.2rem 0 .6rem">Anyone else on this job? Optional.</p>`;
  ['office', 'surveyor', 'trade'].filter((r) => r !== data.worker.role).forEach((role) => {
    const people = (data.colleagues || []).filter((w) => w.role === role);
    if (!people.length) return;
    const field = document.createElement('div');
    field.className = 'ops-field';
    const labels = { trade: 'Crew', office: 'Office', surveyor: 'Surveyor' };
    field.innerHTML = `<label>${labels[role]}</label>
      <select class="ops-select" data-extra="${role}">
        <option value="">Skip</option>
        ${people.map((p) => `<option value="${p.id}">${p.name} · ${p.workId}</option>`).join('')}
      </select>
      <div data-extra-metrics="${role}"></div>`;
    extraWrap.appendChild(field);
  });
  form.appendChild(extraWrap);

  extraWrap.querySelectorAll('[data-extra]').forEach((sel) => {
    sel.addEventListener('change', () => {
      const role = sel.dataset.extra;
      const host = extraWrap.querySelector(`[data-extra-metrics="${role}"]`);
      host.innerHTML = '';
      if (!sel.value) {
        delete reviewState.extra[role];
        return;
      }
      reviewState.extra[role] = { workerId: sel.value, scores: {} };
      METRICS[role].forEach((m) => host.appendChild(rateRow(m.label, `extra.${m.key}.${role}`, m.opt)));
    });
  });

  const overallHead = document.createElement('div');
  overallHead.className = 'ops-section-head';
  overallHead.style.marginTop = '1rem';
  overallHead.innerHTML = `<h2 style="font-size:1.4rem">The job as a whole</h2>`;
  form.appendChild(overallHead);
  form.appendChild(rateRow('Overall satisfaction', 'overall.satisfaction'));

  const improve = document.createElement('div');
  improve.className = 'ops-field';
  improve.style.marginTop = '1rem';
  improve.innerHTML = `<label for="improve">What can we do better?</label>
    <textarea class="ops-textarea" id="improve" maxlength="600" placeholder="Optional"></textarea>
    <p class="ops-error ops-hidden" id="rev-err"></p>
    <div class="ops-actions"><button class="btn btn-primary" type="submit">Send review</button></div>`;
  form.appendChild(improve);

  $('review-overlay').classList.remove('ops-hidden');
  document.body.style.overflow = 'hidden';
}

function closeReview() {
  $('review-overlay').classList.add('ops-hidden');
  document.body.style.overflow = '';
}

async function reload() {
  dash = await ops('dashboard');
  renderBoard();
}

document.addEventListener('DOMContentLoaded', async () => {
  if (!getToken()) {
    location.replace('team.html');
    return;
  }

  $('logout-btn').addEventListener('click', async () => {
    try { await ops('logout', { method: 'POST', body: {} }); } catch {}
    clearToken();
    location.href = 'team.html';
  });
  $('close-review').addEventListener('click', closeReview);

  $('review-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const role = reviewState.worker.role;
    for (const m of METRICS[role]) {
      if (!m.opt && !reviewState.scores[m.key]) {
        const el = $('rev-err');
        el.textContent = `Please rate ${m.label.toLowerCase()}.`;
        el.classList.remove('ops-hidden');
        return;
      }
    }
    if (!reviewState.overall) {
      const el = $('rev-err');
      el.textContent = 'Please give an overall satisfaction rating.';
      el.classList.remove('ops-hidden');
      return;
    }
    const body = {
      jobId: reviewState.jobId,
      scores: reviewState.scores,
      overallSatisfaction: reviewState.overall,
      improvement: $('improve')?.value || '',
    };
    Object.entries(reviewState.extra).forEach(([roleKey, block]) => {
      body[roleKey] = block;
    });
    try {
      await ops('survey', { method: 'POST', body });
      closeReview();
      await reload();
    } catch (err) {
      const el = $('rev-err');
      el.textContent = err.message;
      el.classList.remove('ops-hidden');
    }
  });

  try {
    const me = await ops('me');
    if (me.user?.kind !== 'worker') {
      location.replace(me.user?.kind === 'admin' ? 'admin.html' : 'team.html');
      return;
    }
    await reload();
  } catch {
    clearToken();
    location.replace('team.html');
  }
});
