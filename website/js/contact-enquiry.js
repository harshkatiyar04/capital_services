import { mountTurnstile, resetTurnstile, turnstileToken } from './turnstile.js';

const slot = document.getElementById('contact-turnstile');
let widgetId = null;

mountTurnstile(slot).then((id) => {
  widgetId = id;
}).catch(() => {
  widgetId = null;
});

window.csEnquiryGuard = {
  token() {
    return turnstileToken(widgetId);
  },
  reset() {
    resetTurnstile(widgetId);
  },
};
