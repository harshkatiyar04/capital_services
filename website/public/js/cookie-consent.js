/**
 * Cookie choice for the public site.
 * Analytics is not loaded until the visitor accepts.
 */
const GA_ID = window.CS_GA_ID || '';
const CONSENT_NAME = 'cs_cookie_consent';
const SIX_MONTHS = 60 * 60 * 24 * 180;

function readConsent() {
  const match = document.cookie.match(/(?:^|; )cs_cookie_consent=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : '';
}

function writeConsent(value) {
  const secure = location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${CONSENT_NAME}=${encodeURIComponent(value)}; Max-Age=${SIX_MONTHS}; Path=/; SameSite=Lax${secure}`;
}

function loadAnalytics() {
  if (!GA_ID || window.__csGaLoaded) return;
  window.__csGaLoaded = true;
  window.dataLayer = window.dataLayer || [];
  function gtag() {
    window.dataLayer.push(arguments);
  }
  window.gtag = gtag;
  gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'granted',
    functionality_storage: 'denied',
    personalization_storage: 'denied',
    security_storage: 'granted',
  });
  gtag('js', new Date());
  gtag('config', GA_ID);
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`;
  document.head.appendChild(script);
}

function clearAnalyticsCookies() {
  const names = document.cookie
    .split(';')
    .map((part) => part.split('=')[0].trim())
    .filter((name) => name === '_ga' || name === '_gid' || name.startsWith('_ga_') || name.startsWith('_gat'));
  const host = location.hostname;
  const bare = host.replace(/^www\./, '');
  const domains = ['', host, `.${host}`, bare, `.${bare}`];
  names.forEach((name) => {
    domains.forEach((domain) => {
      const domainPart = domain ? `; domain=${domain}` : '';
      document.cookie = `${name}=; Max-Age=0; path=/${domainPart}`;
    });
  });
}

function hideBanner() {
  const banner = document.getElementById('cookie-banner');
  if (banner) banner.hidden = true;
  document.body.classList.remove('cookie-banner-open');
}

function choose(value) {
  writeConsent(value);
  hideBanner();
  if (value === 'accepted') loadAnalytics();
  else clearAnalyticsCookies();
}

function buildBanner() {
  const banner = document.createElement('div');
  banner.id = 'cookie-banner';
  banner.className = 'cookie-banner';
  banner.setAttribute('role', 'dialog');
  banner.setAttribute('aria-label', 'Cookies');
  banner.setAttribute('aria-describedby', 'cookie-banner-text');
  banner.innerHTML = `
      <p id="cookie-banner-text">We use one cookie to remember this choice. Analytics cookies are set only if you accept. <a href="cookies.html">Cookie policy</a></p>
      <div class="cookie-banner-actions">
        <button type="button" class="btn btn-sm cookie-reject" data-cookie-reject>Reject</button>
        <button type="button" class="btn btn-sm btn-primary" data-cookie-accept>Accept</button>
      </div>`;
  document.body.appendChild(banner);
  banner.querySelector('[data-cookie-reject]').addEventListener('click', () => choose('rejected'));
  banner.querySelector('[data-cookie-accept]').addEventListener('click', () => choose('accepted'));
  return banner;
}

function showBanner(focusChoice) {
  const banner = document.getElementById('cookie-banner') || buildBanner();
  banner.hidden = false;
  document.body.classList.add('cookie-banner-open');
  if (!focusChoice) return;
  const reject = banner.querySelector('[data-cookie-reject]');
  if (reject) reject.focus();
}

function initCookieConsent() {
  const choice = readConsent();
  if (choice === 'accepted') loadAnalytics();
  else if (choice !== 'rejected') showBanner();

  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-cookie-settings]');
    if (!trigger) return;
    event.preventDefault();
    showBanner(true);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCookieConsent);
} else {
  initCookieConsent();
}
