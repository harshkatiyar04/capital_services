const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LOGO = 'https://res.cloudinary.com/foxrj3tm/image/upload/f_jpg,q_auto,w_360/v1787939389/capital-services/logos/capital-services-logo.jpg';

function oneLine(value, max = 200) {
  return String(value || '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function recipients() {
  return String(process.env.ENQUIRY_NOTIFY_TO || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter((item) => EMAIL.test(item))
    .slice(0, 5);
}

function sourceLabel(source) {
  return source === 'chat' ? 'Registered using chat' : 'Contact form';
}

function fieldRow(label, value) {
  const shown = value || '—';
  return `
    <tr>
      <td style="padding:11px 0;border-bottom:1px solid #eee8dc;font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#c8102e;width:108px;vertical-align:top;">${label}</td>
      <td style="padding:11px 0;border-bottom:1px solid #eee8dc;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.45;color:#1a1a1a;">${escapeHtml(shown)}</td>
    </tr>`;
}

function enquiryHtml({ source, name, email, phone, company, service, message }) {
  const body = escapeHtml(message || '—').replace(/\n/g, '<br>');
  return `<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:0;background:#faf9f7;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf9f7;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e5e2dc;">
          <tr>
            <td style="height:4px;background:#c8102e;font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <tr>
            <td align="center" style="padding:28px 32px 18px;">
              <img src="${LOGO}" width="168" alt="Capital Services" style="display:block;margin:0 auto 16px;border:0;width:168px;height:auto;">
              <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:#c8102e;">New enquiry</p>
              <h1 style="margin:8px 0 0;font-family:Georgia,'Times New Roman',serif;font-size:32px;line-height:1.15;font-weight:500;color:#1a1a1a;">${escapeHtml(name)}</h1>
              <p style="margin:8px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#5c5c5c;">${escapeHtml(source)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px;">
              <div style="height:2px;background:#e8a020;font-size:0;line-height:0;">&nbsp;</div>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px 4px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${fieldRow('Email', email)}
                ${fieldRow('Phone', phone)}
                ${fieldRow('Postcode', company)}
                ${fieldRow('Service', service)}
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:22px 32px 8px;">
              <p style="margin:0 0 8px;font-family:Georgia,'Times New Roman',serif;font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:#c8102e;">Message</p>
              <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:18px;line-height:1.55;color:#1a1a1a;">${body}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px 28px;">
              <a href="https://www.capitalservices.com/admin" style="display:inline-block;background:#1a1a1a;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;text-decoration:none;padding:12px 18px;">Open the ledger</a>
            </td>
          </tr>
          <tr>
            <td style="background:#1a1a1a;padding:18px 32px;">
              <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:16px;color:#e8a020;">We care and it shows</p>
              <p style="margin:6px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:#faf9f7;">Capital Services · 01923 270022 · enquiries@capitalservices.com</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function enquiryNotice(enquiry = {}) {
  const to = recipients();
  const name = oneLine(enquiry.name, 120) || 'Website enquiry';
  const email = oneLine(enquiry.email, 160);
  const phone = oneLine(enquiry.phone, 40);
  const company = oneLine(enquiry.company, 120);
  const service = oneLine(enquiry.service, 80);
  const source = sourceLabel(enquiry.source);
  const message = String(enquiry.message || '').replace(/\r/g, '').slice(0, 4000);
  const from = oneLine(process.env.ENQUIRY_FROM, 180) || 'Capital Services <onboarding@resend.dev>';
  const lines = [
    `Source: ${source}`,
    `Name: ${name}`,
    `Email: ${email || '—'}`,
    `Phone: ${phone || '—'}`,
    `Postcode: ${company || '—'}`,
    `Service: ${service || '—'}`,
    '',
    message,
  ];
  return {
    to,
    from,
    reply_to: EMAIL.test(email) ? email : undefined,
    subject: oneLine(`New enquiry from ${name}`, 180),
    text: lines.join('\n'),
    html: enquiryHtml({ source, name, email, phone, company, service, message }),
  };
}

export async function notifyEnquiry(enquiry) {
  const key = String(process.env.RESEND_API_KEY || '').trim();
  const notice = enquiryNotice(enquiry);
  if (!key || !notice.to.length) {
    console.error('enquiry mail skipped', !key ? 'missing RESEND_API_KEY' : 'missing ENQUIRY_NOTIFY_TO');
    return { sent: false, reason: 'not-configured' };
  }

  const body = {
    from: notice.from,
    to: notice.to,
    subject: notice.subject,
    text: notice.text,
    html: notice.html,
  };
  if (notice.reply_to) body.reply_to = notice.reply_to;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error('enquiry mail failed', data.message || res.status);
      return { sent: false, reason: 'provider' };
    }
    return { sent: true };
  } catch (err) {
    console.error('enquiry mail failed', err instanceof Error ? err.message : 'request failed');
    return { sent: false, reason: 'provider' };
  }
}
