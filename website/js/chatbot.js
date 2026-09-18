/* ================================================================
   Live AI chatbot + enquiry form (Capital Services)
   ================================================================ */

const history = [];

function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

function appendMessage(body, text, kind = 'bot') {
  const node = el(`<div class="chatbot-message chatbot-message--${kind}"></div>`);
  node.textContent = text;
  body.appendChild(node);
  body.scrollTop = body.scrollHeight;
  return node;
}

async function postJson(url, payload) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function enhancePanel(panel) {
  if (panel.dataset.enhanced === '1') return;
  panel.dataset.enhanced = '1';

  panel.innerHTML = `
    <div class="chatbot-header">
      <img class="chatbot-avatar" src="https://res.cloudinary.com/foxrj3tm/image/upload/f_auto,q_auto,w_64/v1787939391/capital-services/logos/cs-logo-no-text-house-and-heart-large-high-res.jpg" alt="">
      <div class="chatbot-header-copy">
        <h4>Capital Services</h4>
        <span class="chatbot-status"><i></i> Online · AI assistant</span>
      </div>
      <button type="button" class="chatbot-close" aria-label="Close chat">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>
    </div>

    <div class="chatbot-main">
      <div class="chatbot-body" id="chatbot-body"></div>

      <form class="chatbot-enquiry chatbot-hidden" id="chatbot-enquiry-form" novalidate>
        <p class="chatbot-enquiry-hint">Send a message to the office — we aim to reply within 24 hours.</p>
        <div class="chatbot-enquiry-grid">
          <input class="form-input" id="chat-enq-name" name="name" placeholder="Your name" autocomplete="name" required>
          <input class="form-input" id="chat-enq-email" name="email" type="email" placeholder="Email" autocomplete="email" required>
        </div>
        <input class="form-input" id="chat-enq-phone" name="phone" type="tel" placeholder="Phone (optional)" autocomplete="tel">
        <textarea class="form-textarea" id="chat-enq-message" name="message" rows="4" placeholder="How can we help?" required></textarea>
        <p class="chatbot-enquiry-status" id="chat-enq-status" hidden></p>
        <button type="submit" class="btn btn-primary" style="width:100%">Send enquiry</button>
      </form>
    </div>

    <div class="chatbot-composer">
      <div class="chatbot-modes" role="tablist">
        <button type="button" class="chatbot-mode is-on" data-tab="chat" role="tab">Ask us</button>
        <button type="button" class="chatbot-mode" data-tab="enquiry" role="tab">Leave enquiry</button>
      </div>
      <div class="chatbot-input" id="chatbot-input-row">
        <input type="text" placeholder="Ask about services, coverage…" aria-label="Chat message" autocomplete="off">
        <button type="button" aria-label="Send">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
        </button>
      </div>
    </div>
  `;

  const body = panel.querySelector('#chatbot-body');
  const enquiry = panel.querySelector('#chatbot-enquiry-form');
  const inputRow = panel.querySelector('#chatbot-input-row');
  const modes = panel.querySelector('.chatbot-modes');
  const input = inputRow.querySelector('input');
  const sendBtn = inputRow.querySelector('button');

  appendMessage(
    body,
    'Hi — ask about our restoration services, coverage areas, or next steps. Prefer a human reply? Switch to Leave enquiry.',
  );

  function showTab(name) {
    modes.querySelectorAll('.chatbot-mode').forEach((b) => b.classList.toggle('is-on', b.dataset.tab === name));
    const isChat = name === 'chat';
    body.classList.toggle('chatbot-hidden', !isChat);
    inputRow.classList.toggle('chatbot-hidden', !isChat);
    enquiry.classList.toggle('chatbot-hidden', isChat);
    panel.classList.toggle('is-enquiry', !isChat);
    if (isChat) input.focus();
  }

  modes.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-tab]');
    if (btn) showTab(btn.dataset.tab);
  });

  async function sendChat() {
    const text = (input.value || '').trim();
    if (!text) return;
    input.value = '';
    appendMessage(body, text, 'user');
    history.push({ role: 'user', content: text });
    const thinking = appendMessage(body, 'Thinking…', 'bot');
    thinking.classList.add('is-pending');
    try {
      const data = await postJson('/api/chat', { messages: history });
      thinking.remove();
      appendMessage(body, data.reply, 'bot');
      history.push({ role: 'assistant', content: data.reply });
    } catch (err) {
      thinking.remove();
      appendMessage(body, err.message || 'Chat is unavailable right now. Please leave an enquiry instead.', 'bot');
    }
  }

  sendBtn.addEventListener('click', (e) => {
    e.preventDefault();
    sendChat();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      sendChat();
    }
  });

  enquiry.addEventListener('submit', async (e) => {
    e.preventDefault();
    const status = enquiry.querySelector('#chat-enq-status');
    const btn = enquiry.querySelector('button[type="submit"]');
    status.hidden = true;
    btn.disabled = true;
    try {
      const data = await postJson('/api/ops/enquiries', {
        source: 'chat',
        name: enquiry.querySelector('#chat-enq-name').value,
        email: enquiry.querySelector('#chat-enq-email').value,
        phone: enquiry.querySelector('#chat-enq-phone').value,
        message: enquiry.querySelector('#chat-enq-message').value,
      });
      enquiry.reset();
      status.hidden = false;
      status.textContent = data.message || 'Enquiry logged. Thank you.';
      status.className = 'chatbot-enquiry-status is-ok';
      showTab('chat');
      appendMessage(body, 'Thanks — your enquiry is with the office team. We aim to respond within 24 hours.', 'bot');
    } catch (err) {
      status.hidden = false;
      status.textContent = err.message || 'Could not save enquiry';
      status.className = 'chatbot-enquiry-status is-err';
    } finally {
      btn.disabled = false;
    }
  });
}

export function initChatbot() {
  const fab = document.querySelector('.chatbot-fab');
  const panel = document.querySelector('.chatbot-panel');
  if (!fab || !panel) return;

  enhancePanel(panel);

  fab.addEventListener('click', () => {
    panel.classList.toggle('active');
    fab.style.display = panel.classList.contains('active') ? 'none' : '';
    if (panel.classList.contains('active')) {
      panel.querySelector('#chatbot-input-row input')?.focus();
    }
  });

  const closeBtn = panel.querySelector('.chatbot-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      panel.classList.remove('active');
      fab.style.display = '';
    });
  }
}
