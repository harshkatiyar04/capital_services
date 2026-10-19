import { getToken, ops, setToken } from './ops-client.js';

const $ = (id) => document.getElementById(id);

function show(which) {
  ['choose', 'worker-gate', 'admin-gate', 'wait'].forEach((id) => {
    $(id).classList.toggle('ops-hidden', id !== which);
  });
}

function hold(which, title) {
  $('wait-title').textContent = title;
  show('wait');
  return which;
}

function fail(id, msg) {
  const el = $(id);
  el.textContent = msg;
  el.classList.remove('ops-hidden');
}

async function routeExisting() {
  const token = getToken();
  if (!token) {
    show('choose');
    return;
  }
  hold('choose', 'Checking your sign-in');
  try {
    const { user } = await ops('me');
    if (user.kind === 'admin') location.replace('admin.html');
    else location.replace('crew.html');
  } catch {
    show('choose');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-gate]').forEach((btn) => {
    btn.addEventListener('click', () => show(btn.dataset.gate === 'admin' ? 'admin-gate' : 'worker-gate'));
  });
  document.querySelectorAll('[data-back]').forEach((btn) => {
    btn.addEventListener('click', () => show('choose'));
  });

  $('worker-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    hold('worker-gate', 'Signing you in');
    try {
      const data = await ops('login', {
        method: 'POST',
        body: { identifier: $('w-id').value, password: $('w-pass').value },
      });
      if (data.user?.kind !== 'worker') throw new Error('Use the admin door for office access');
      setToken(data.token);
      location.href = 'crew.html';
    } catch (err) {
      show('worker-gate');
      fail('w-login-err', err.message);
    }
  });

  $('worker-signup').addEventListener('submit', async (e) => {
    e.preventDefault();
    if ($('s-pass').value !== $('s-pass-2').value) return fail('w-sign-err', 'Passwords do not match.');
    hold('worker-gate', 'Creating your account');
    try {
      const data = await ops('signup', {
        method: 'POST',
        body: {
          name: $('s-name').value,
          role: $('s-role').value,
          password: $('s-pass').value,
        },
      });
      setToken(data.token);
      location.href = 'crew.html';
    } catch (err) {
      show('worker-gate');
      fail('w-sign-err', err.message);
    }
  });

  $('admin-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    hold('admin-gate', 'Signing you in');
    try {
      const data = await ops('login', {
        method: 'POST',
        body: { identifier: $('a-id').value, password: $('a-pass').value },
      });
      if (data.user?.kind !== 'admin') throw new Error('Office login only');
      setToken(data.token);
      location.href = 'admin.html';
    } catch (err) {
      show('admin-gate');
      fail('a-err', err.message);
    }
  });

  routeExisting();
});
