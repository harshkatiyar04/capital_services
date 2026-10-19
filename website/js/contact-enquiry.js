import { mountTurnstile, resetTurnstile, turnstileToken } from './turnstile.js';
import { ukPhoneMessage } from './phone-check.js';

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
  phoneMessage: ukPhoneMessage,
};
