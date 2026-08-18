import { STAR_LABELS, ops } from './ops-client.js';

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

const state = {
  step: 1,
  roles: new Set(['trade']),
  workers: [],
  scores: { trade: {}, office: {}, surveyor: {}, overall: 0 },
};

const $ = (id) => document.getElementById(id);

function starRow(group, current = 0, optional = false) {
  const wrap = document.createElement('div');
  wrap.className = 'ops-stars';
  wrap.setAttribute('role', 'radiogroup');
  wrap.dataset.group = group;
  for (let i = 1; i <= 5; i += 1) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `ops-star${i <= current ? ' is-on' : ''}`;
    btn.innerHTML = STAR;
    btn.dataset.value = String(i);
    btn.setAttribute('aria-label', `${i} star${i > 1 ? 's' : ''} — ${STAR_LABELS[i - 1]}`);
    btn.title = STAR_LABELS[i - 1];
    wrap.appendChild(btn);
  }
  wrap.addEventListener('click', (e) => {
    const btn = e.target.closest('.ops-star');
    if (!btn) return;
    const value = Number(btn.dataset.value);
    const [role, key] = group.split('.');
    if (role === 'overall') state.scores.overall = value;
    else state.scores[role][key] = value;
    wrap.querySelectorAll('.ops-star').forEach((el, idx) => {
      el.classList.toggle('is-on', idx < value);
    });
    const caption = wrap.parentElement.querySelector('small');
    if (caption) caption.textContent = optional && !value ? 'Optional' : STAR_LABELS[value - 1];
  });
  return wrap;
}

function rateBlock(role, metric) {
  const row = document.createElement('div');
  row.className = 'ops-rate';
  const value = state.scores[role][metric.key] || 0;
  row.innerHTML = `<div class="ops-rate-copy"><strong>${metric.label}</strong><small>${metric.opt ? 'Optional' : 'Tap a star'}</small></div>`;
  row.appendChild(starRow(`${role}.${metric.key}`, value, metric.opt));
  return row;
}

function fillSelects() {
  for (const role of ['trade', 'office', 'surveyor']) {
    const sel = $(`${role}-worker`);
    const people = state.workers.filter((w) => w.role === role);
    const pre = new URLSearchParams(location.search).get('wid');
    sel.innerHTML = `<option value="">Select…</option>` + people.map((w) =>
      `<option value="${w.id}" ${pre && w.workId === pre ? 'selected' : ''}>${w.name} · ${w.workId}</option>`
    ).join('');
    if (pre && people.some((w) => w.workId === pre && w.role === role)) {
      state.roles.add(role);
    }
  }
  syncRoleUi();
}

function syncRoleUi() {
  document.querySelectorAll('[data-role]').forEach((chip) => {
    chip.classList.toggle('is-on', state.roles.has(chip.dataset.role));
  });
  document.querySelectorAll('[data-pick]').forEach((el) => {
    el.classList.toggle('ops-hidden', !state.roles.has(el.dataset.pick));
  });
}

function renderStep2() {
  const host = $('step-2');
  host.innerHTML = '';
  for (const role of ['trade', 'office', 'surveyor']) {
    if (!state.roles.has(role)) continue;
    const titles = { trade: 'On-site crew', office: 'Office staff', surveyor: 'Surveyor' };
    const head = document.createElement('div');
    head.className = 'ops-section-head';
    head.innerHTML = `<h2>${titles[role]}</h2><span class="ops-hint">1–5 stars</span>`;
    host.appendChild(head);
    METRICS[role].forEach((m) => host.appendChild(rateBlock(role, m)));
  }
}

function renderOverall() {
  const host = $('overall-rate');
  host.innerHTML = '';
  const row = document.createElement('div');
  row.className = 'ops-rate';
  row.innerHTML = `<div class="ops-rate-copy"><strong>Overall satisfaction</strong><small>The job from start to finish</small></div>`;
  row.appendChild(starRow('overall.satisfaction', state.scores.overall));
  host.appendChild(row);
}

function setStep(n) {
  state.step = n;
  $('step-1').classList.toggle('ops-hidden', n !== 1);
  $('step-2').classList.toggle('ops-hidden', n !== 2);
  $('step-3').classList.toggle('ops-hidden', n !== 3);
  document.querySelectorAll('#progress span').forEach((el, i) => el.classList.toggle('is-on', i < n));
  $('back-btn').classList.toggle('ops-hidden', n === 1);
  $('next-btn').textContent = n === 3 ? 'Send feedback' : 'Continue';
  $('form-error').classList.add('ops-hidden');
  if (n === 2) renderStep2();
  if (n === 3) renderOverall();
}

function showError(msg) {
  const el = $('form-error');
  el.textContent = msg;
  el.classList.remove('ops-hidden');
}

function payload() {
  const body = {
    customerName: $('customer-name').value,
    jobRef: $('job-ref').value,
    overallSatisfaction: state.scores.overall,
    improvement: $('improvement').value,
  };
  for (const role of state.roles) {
    body[role] = {
      workerId: $(`${role}-worker`).value,
      scores: { ...state.scores[role] },
    };
  }
  return body;
}

document.addEventListener('DOMContentLoaded', async () => {
  document.querySelectorAll('[data-role]').forEach((chip) => {
    chip.addEventListener('click', () => {
      const role = chip.dataset.role;
      if (state.roles.has(role)) {
        if (state.roles.size === 1) return;
        state.roles.delete(role);
      } else state.roles.add(role);
      syncRoleUi();
    });
  });

  $('back-btn').addEventListener('click', () => setStep(Math.max(1, state.step - 1)));

  $('survey-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (state.step === 1) {
      for (const role of state.roles) {
        if (!$(`${role}-worker`).value) return showError('Select who you dealt with, or untick that role.');
      }
      return setStep(2);
    }
    if (state.step === 2) {
      for (const role of state.roles) {
        for (const m of METRICS[role]) {
          if (!m.opt && !state.scores[role][m.key]) {
            return showError(`Please rate ${m.label.toLowerCase()}.`);
          }
        }
      }
      return setStep(3);
    }
    if (!state.scores.overall) return showError('Please give an overall satisfaction rating.');
    $('next-btn').disabled = true;
    try {
      await ops('survey', { method: 'POST', body: payload() });
      $('survey-form').classList.add('ops-hidden');
      document.getElementById('progress').classList.add('ops-hidden');
      $('done').classList.remove('ops-hidden');
    } catch (err) {
      showError(err.message);
      $('next-btn').disabled = false;
    }
  });

  try {
    const data = await ops('workers');
    state.workers = data.workers || [];
    fillSelects();
  } catch {
    showError('Could not load the crew list. Refresh and try again.');
  }
});
