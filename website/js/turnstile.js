const TEST_SITE_KEY = '1x00000000000000000000AA';

export function turnstileSiteKey() {
  const host = window.location.hostname;
  const onThisComputer = host === 'localhost' || host === '127.0.0.1';
  if (onThisComputer) return TEST_SITE_KEY;
  return import.meta.env.VITE_TURNSTILE_SITE_KEY || '';
}

const tokens = new Map();
let scriptPromise;

function loadScript() {
  if (window.turnstile) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Could not load the security check'));
      document.head.appendChild(script);
    });
  }
  return scriptPromise;
}

export async function mountTurnstile(el, { size = 'flexible' } = {}) {
  const sitekey = turnstileSiteKey();
  if (!sitekey || !el) return null;
  await loadScript();
  const id = window.turnstile.render(el, {
    sitekey,
    theme: 'light',
    size,
    callback(token) { tokens.set(id, token); },
    'expired-callback'() { tokens.delete(id); },
    'error-callback'() { tokens.delete(id); },
  });
  return id;
}

export function turnstileToken(widgetId) {
  const stored = widgetId == null ? '' : tokens.get(widgetId) || '';
  if (stored) return stored;
  if (!window.turnstile || widgetId == null) return '';
  return window.turnstile.getResponse(widgetId) || '';
}

export function resetTurnstile(widgetId) {
  if (widgetId != null) tokens.delete(widgetId);
  if (window.turnstile && widgetId != null) window.turnstile.reset(widgetId);
}
