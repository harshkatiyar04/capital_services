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

// Xelion office presence on hold — uncomment when resuming Office chat.
// async function loadOfficePresence() {
//   const box = document.getElementById('office-presence');
//   const text = document.getElementById('office-presence-text');
//   const openBtn = document.getElementById('office-presence-open');
//   if (!box || !text) return;
//   try {
//     const res = await fetch('/api/xelion?action=presence', { headers: { Accept: 'application/json' } });
//     const data = await res.json().catch(() => ({}));
//     box.hidden = false;
//     box.classList.toggle('is-online', Boolean(data.available));
//     box.classList.toggle('is-offline', !data.available);
//     if (!data.available && data.status === 'dnd') {
//       const lines = [data.dndText1, data.dndText2].filter(Boolean);
//       if (data.officeHours) lines.push(`Office hours: ${data.officeHours}`);
//       if (data.contactPhone || data.contactEmail) {
//         lines.push(`Call ${data.contactPhone || '01923 270022'} · ${data.contactEmail || 'info@capitalservices.com'}`);
//       }
//       text.textContent = lines.join('\n') || data.message || data.label;
//     } else if (!data.available) {
//       const lines = [data.message || data.label || 'Office chat offline'];
//       if (data.officeHours) lines.push(`Office hours: ${data.officeHours}`);
//       if (data.contactPhone) lines.push(`Call ${data.contactPhone}`);
//       text.textContent = lines.join('\n');
//     } else {
//       text.textContent = data.label || 'Office chat available';
//     }
//     if (openBtn) {
//       openBtn.hidden = !data.available;
//       openBtn.onclick = () => {
//         const fab = document.getElementById('chatbot-fab');
//         const panel = document.getElementById('chatbot-panel');
//         if (fab && panel && !panel.classList.contains('active')) fab.click();
//         panel?.querySelector('[data-tab="office"]')?.click();
//       };
//     }
//   } catch {
//     box.hidden = true;
//   }
// }
//
// loadOfficePresence();
