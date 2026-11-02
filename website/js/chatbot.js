/* ================================================================
   Live AI chatbot + office Xelion chat + enquiry form
   Xelion / Office tab is on hold — set true when resuming integration.
   ================================================================ */

import { mountTurnstile, resetTurnstile, turnstileToken } from './turnstile.js';
import { ukPhoneMessage } from './phone-check.js';

/** Xelion Office live chat — held until Capital/Expert phoneline setup. */
const OFFICE_CHAT_ENABLED = false;

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

function displayNameAsClientId(name) {
  const clean = String(name || '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
  return clean || 'Website visitor';
}

function messageList(raw) {
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.data)) {
    return raw.data.map((row) => row.object || row).filter(Boolean);
  }
  if (Array.isArray(raw?.messages)) return raw.messages;
  return [];
}

function enhancePanel(panel) {
  if (panel.dataset.enhanced === '1') return;
  panel.dataset.enhanced = '1';

  panel.innerHTML = `
    <div class="chatbot-header">
      <div class="chatbot-header-copy">
        <p class="chatbot-header-kicker">Capital Support</p>
        <span class="chatbot-status is-online" id="chatbot-status"><i aria-hidden="true"></i> <span id="chatbot-status-text">Online</span></span>
      </div>
      <button type="button" class="chatbot-close" aria-label="Close chat">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>
    </div>

    <div class="chatbot-main">
      <div class="chatbot-body" id="chatbot-body"></div>

      <form class="chatbot-enquiry chatbot-hidden" id="chatbot-enquiry-form" novalidate>
        <p class="chatbot-enquiry-hint">Send a message to the office — we’ll get back to you as soon as we can.</p>
        <div class="chatbot-enquiry-grid">
          <input class="form-input" id="chat-enq-name" name="name" placeholder="Your name" autocomplete="name" required>
          <input class="form-input" id="chat-enq-email" name="email" type="email" placeholder="Email" autocomplete="email" required>
        </div>
        <input class="form-input" id="chat-enq-phone" name="phone" type="tel" placeholder="Phone (optional)" autocomplete="tel">
        <textarea class="form-textarea" id="chat-enq-message" name="message" rows="4" placeholder="How can we help?" required></textarea>
        <div class="enquiry-hp" aria-hidden="true">
          <label for="chat-enq-website">Company website</label>
          <input type="text" id="chat-enq-website" name="company_website" tabindex="-1" autocomplete="off">
        </div>
        <div class="turnstile-slot" id="chat-enq-turnstile"></div>
        <p class="chatbot-enquiry-status" id="chat-enq-status" hidden></p>
        <button type="submit" class="btn btn-primary" style="width:100%">Send enquiry</button>
      </form>

      <form class="chatbot-office-gate chatbot-hidden" id="chatbot-office-gate" novalidate>
        <p class="chatbot-enquiry-hint" id="office-gate-hint">Before we connect you to the office, tell us who you are.</p>
        <input class="form-input" id="office-name" name="name" placeholder="Your name" autocomplete="name" required>
        <input class="form-input" id="office-phone" name="phone" type="tel" placeholder="Contact number" autocomplete="tel" required>
        <input class="form-input" id="office-email" name="email" type="email" placeholder="Email (optional)" autocomplete="email">
        <div class="turnstile-slot chatbot-hidden" id="office-gate-turnstile"></div>
        <p class="chatbot-enquiry-status" id="office-gate-status" hidden></p>
        <button type="submit" class="btn btn-primary" style="width:100%" id="office-gate-submit">Start office chat</button>
      </form>

      <form class="chatbot-office-feedback chatbot-hidden" id="chatbot-office-feedback" novalidate>
        <p class="chatbot-enquiry-hint">How was the office chat?</p>
        <div class="chatbot-rating" id="office-rating" role="group" aria-label="Rating">
          <button type="button" data-rating="1" aria-label="1 star">1</button>
          <button type="button" data-rating="2" aria-label="2 stars">2</button>
          <button type="button" data-rating="3" aria-label="3 stars">3</button>
          <button type="button" data-rating="4" aria-label="4 stars">4</button>
          <button type="button" data-rating="5" aria-label="5 stars">5</button>
        </div>
        <textarea class="form-textarea" id="office-feedback-text" rows="3" placeholder="Anything we can improve? (optional)"></textarea>
        <p class="chatbot-enquiry-status" id="office-feedback-status" hidden></p>
        <button type="submit" class="btn btn-primary" style="width:100%">Send feedback</button>
        <button type="button" class="chatbot-office-skip" id="office-feedback-skip">Skip</button>
      </form>
    </div>

    <div class="chatbot-composer">
      <div class="chatbot-modes" role="tablist">
        <button type="button" class="chatbot-mode is-on" data-tab="chat" role="tab">Ask us</button>
        ${OFFICE_CHAT_ENABLED ? '<button type="button" class="chatbot-mode" data-tab="office" role="tab">Office</button>' : '<!-- Office tab: Xelion on hold -->'}
        <button type="button" class="chatbot-mode" data-tab="enquiry" role="tab">Enquiry</button>
      </div>
      <div class="chat-register chatbot-hidden" id="chat-register">
        <p>Complete the check to register this with the office.</p>
        <div class="turnstile-slot" id="chat-ask-turnstile"></div>
        <button type="button" class="btn btn-primary" id="chat-register-btn">Register using chat</button>
      </div>
      <div class="chatbot-office-bar chatbot-hidden" id="chatbot-office-bar">
        <button type="button" class="chatbot-office-end" id="chat-office-end">End chat</button>
      </div>
      <div class="chatbot-input" id="chatbot-input-row">
        <input type="text" placeholder="Type your message…" aria-label="Chat message" autocomplete="off">
        <button type="button" aria-label="Send">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
        </button>
      </div>
    </div>
  `;

  const body = panel.querySelector('#chatbot-body');
  const enquiry = panel.querySelector('#chatbot-enquiry-form');
  const officeGate = panel.querySelector('#chatbot-office-gate');
  const officeFeedback = panel.querySelector('#chatbot-office-feedback');
  const statusEl = panel.querySelector('#chatbot-status');
  const statusText = panel.querySelector('#chatbot-status-text');
  const officeBar = panel.querySelector('#chatbot-office-bar');
  const endBtn = panel.querySelector('#chat-office-end');
  let turnstileId = null;
  let turnstileMount = null;
  let tab = 'chat';

  const office = {
    sessionId: '',
    feedbackSessionId: '',
    socket: null,
    poll: null,
    seen: new Set(),
    started: false,
    ended: false,
    connecting: false,
    awaitingFeedback: false,
    rating: 0,
    displayName: '',
    email: '',
    phone: '',
    typingTimer: null,
    typingPingAt: 0,
    agentTypingNode: null,
    agentTypingClear: null,
    lineBlocked: false,
    detailsCaptured: false,
    presence: null,
    presenceNoticeShown: false,
    gateTurnstileId: null,
    gateTurnstileMount: null,
  };

  function ensureTurnstile() {
    if (turnstileId != null) return Promise.resolve(turnstileId);
    if (!turnstileMount) {
      turnstileMount = mountTurnstile(enquiry.querySelector('#chat-enq-turnstile'), { size: 'flexible' })
        .then((id) => {
          turnstileId = id;
          return id;
        })
        .catch((err) => {
          turnstileMount = null;
          throw err;
        });
    }
    return turnstileMount;
  }
  const inputRow = panel.querySelector('#chatbot-input-row');
  const modes = panel.querySelector('.chatbot-modes');
  const input = inputRow.querySelector('input');
  const sendBtn = inputRow.querySelector('button');
  const registerBox = panel.querySelector('#chat-register');
  const registerBtn = panel.querySelector('#chat-register-btn');
  let askTurnstileId = null;
  let askTurnstileMount = null;

  function chatSessionId() {
    const key = 'cs_chat_session';
    let id = sessionStorage.getItem(key);
    if (!id || !/^cs_[a-z0-9]{24}$/.test(id)) {
      const bytes = crypto.getRandomValues(new Uint8Array(12));
      id = `cs_${[...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')}`;
      sessionStorage.setItem(key, id);
    }
    return id;
  }

  function ensureAskTurnstile() {
    if (askTurnstileId != null) return Promise.resolve(askTurnstileId);
    if (!askTurnstileMount) {
      askTurnstileMount = mountTurnstile(panel.querySelector('#chat-ask-turnstile'), { size: 'flexible' })
        .then((id) => {
          askTurnstileId = id;
          return id;
        })
        .catch((err) => {
          askTurnstileMount = null;
          throw err;
        });
    }
    return askTurnstileMount;
  }

  function setStatus(label, state = 'online') {
    statusText.textContent = label;
    statusEl.classList.remove('is-online', 'is-connecting', 'is-offline');
    statusEl.classList.add(
      state === 'offline' ? 'is-offline' : state === 'connecting' ? 'is-connecting' : 'is-online',
    );
  }

  function stopOfficeListen() {
    if (office.socket) {
      try { office.socket.close(); } catch {}
      office.socket = null;
    }
    if (office.poll) {
      clearInterval(office.poll);
      office.poll = null;
    }
  }

  async function refreshOfficeMessages() {
    if (!office.sessionId || office.ended) return;
    try {
      const data = await postJson('/api/xelion', { action: 'messages', sessionId: office.sessionId });
      const rows = messageList(data.messages);
      const myName = office.displayName.toLowerCase();
      for (const row of rows) {
        const id = String(row.id || `${row.date || ''}:${row.contents || ''}`);
        if (!id || office.seen.has(id)) continue;
        office.seen.add(id);
        const text = String(row.contents || row.text || '').trim();
        if (!text) continue;
        const who = String(row.creatorName || 'Office').trim();
        // Skip the visitor's own posts so they are not echoed back into the thread.
        if (myName && who.toLowerCase() === myName) continue;
        appendMessage(body, who ? `${who}: ${text}` : text, 'bot');
      }
    } catch {
      /* keep listening */
    }
  }

  function showAgentTyping(on) {
    if (!on) {
      if (office.agentTypingNode) {
        office.agentTypingNode.remove();
        office.agentTypingNode = null;
      }
      if (office.agentTypingClear) {
        clearTimeout(office.agentTypingClear);
        office.agentTypingClear = null;
      }
      return;
    }
    if (!office.agentTypingNode) {
      office.agentTypingNode = appendMessage(body, 'Office is typing…', 'bot');
      office.agentTypingNode.classList.add('is-pending');
    }
    if (office.agentTypingClear) clearTimeout(office.agentTypingClear);
    office.agentTypingClear = setTimeout(() => showAgentTyping(false), 15000);
  }

  function handleOfficeSocketPayload(raw) {
    let data = raw;
    try {
      data = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch {
      refreshOfficeMessages();
      return;
    }
    const type = String(data?.notificationType || data?.type || data?.event || '').toLowerCase();
    if (type.includes('typing')) {
      showAgentTyping(true);
      return;
    }
    if (type.includes('noagents')) {
      setStatus('No agents available', 'connecting');
      return;
    }
    if (type.includes('activated') || type.includes('activeuser')) {
      const agent = data?.activeUserName || data?.agentName || data?.userName || '';
      setStatus(agent ? `With ${agent}` : 'Agent joined', 'online');
      return;
    }
    if (type.includes('ended')) {
      endOfficeChat({ fromServer: true });
      return;
    }
    showAgentTyping(false);
    refreshOfficeMessages();
  }

  function connectOfficeSocket(url) {
    if (!url || office.socket) return;
    try {
      const socket = new WebSocket(url);
      office.socket = socket;
      socket.addEventListener('message', (ev) => {
        handleOfficeSocketPayload(ev.data);
      });
      socket.addEventListener('close', () => {
        office.socket = null;
      });
      socket.addEventListener('error', () => {
        try { socket.close(); } catch {}
      });
    } catch {
      /* polling covers this */
    }
  }

  function pingTyping() {
    if (!office.sessionId || office.ended) return;
    const now = Date.now();
    if (now - office.typingPingAt < 10000) return;
    office.typingPingAt = now;
    postJson('/api/xelion', { action: 'typing', sessionId: office.sessionId }).catch(() => {});
  }

  function presenceErrorMessage(presence) {
    if (!presence) return 'Office chat is offline. Please leave an enquiry.';
    if (presence.status === 'dnd') {
      return [presence.dndText1, presence.dndText2].filter(Boolean).join(' ') || presence.message || presence.label;
    }
    return presence.message || presence.label || presence.error || 'Office chat is offline. Please leave an enquiry.';
  }

  function ensureOfficeGateTurnstile() {
    const slot = officeGate.querySelector('#office-gate-turnstile');
    if (!slot) return Promise.resolve(null);
    slot.classList.remove('chatbot-hidden');
    if (office.gateTurnstileId != null) return Promise.resolve(office.gateTurnstileId);
    if (!office.gateTurnstileMount) {
      office.gateTurnstileMount = mountTurnstile(slot, { size: 'flexible' })
        .then((id) => {
          office.gateTurnstileId = id;
          return id;
        })
        .catch((err) => {
          office.gateTurnstileMount = null;
          throw err;
        });
    }
    return office.gateTurnstileMount;
  }

  function updateOfficeGateCopy(presence) {
    const hint = officeGate.querySelector('#office-gate-hint');
    const submit = officeGate.querySelector('#office-gate-submit');
    const slot = officeGate.querySelector('#office-gate-turnstile');
    const blocked = presence && !presence.available;
    if (hint) {
      hint.textContent = blocked
        ? 'Live chat is closed right now. Leave your name and number and we will call you back.'
        : 'Before we connect you to the office, tell us who you are.';
    }
    if (submit) {
      submit.textContent = blocked ? 'Leave my details' : 'Start office chat';
    }
    if (slot && !blocked) slot.classList.add('chatbot-hidden');
    if (blocked) ensureOfficeGateTurnstile().catch(() => {});
  }

  function showOfficePresenceNotice(presence) {
    if (!presence || presence.available || office.presenceNoticeShown) return;
    office.presenceNoticeShown = true;
    if (office.displayName) {
      appendMessage(
        body,
        `Thanks ${office.displayName}. We have your number${office.phone ? ` (${office.phone})` : ''} and will get back to you.`,
        'bot',
      );
    }
    if (presence.status === 'dnd') {
      if (presence.dndText1) appendMessage(body, presence.dndText1, 'bot');
      if (presence.dndText2) appendMessage(body, presence.dndText2, 'bot');
    } else {
      appendMessage(body, presenceErrorMessage(presence), 'bot');
    }
    if (presence.officeHours) {
      appendMessage(body, `Office hours: ${presence.officeHours}.`, 'bot');
    }
    const phone = presence.contactPhone || '01923 270022';
    const email = presence.contactEmail || 'info@capitalservices.com';
    appendMessage(body, `Call us on ${phone} or email ${email}.`, 'bot');
    appendMessage(body, 'You can also leave a fuller enquiry on the Enquiry tab.', 'bot');
  }

  async function saveAfterHoursCallback() {
    await ensureOfficeGateTurnstile();
    await postJson('/api/ops/enquiries', {
      source: 'chat',
      name: office.displayName,
      email: office.email,
      phone: office.phone,
      message:
        office.presence?.status === 'dnd'
          ? 'Outside office hours — callback requested from website Office chat.'
          : 'Office chat unavailable — callback requested from website Office chat.',
      turnstileToken: turnstileToken(office.gateTurnstileId),
    });
    resetTurnstile(office.gateTurnstileId);
  }

  async function refreshOfficePresence() {
    try {
      const presenceRes = await fetch('/api/xelion?action=presence', { headers: { Accept: 'application/json' } });
      const presence = await presenceRes.json().catch(() => ({}));
      if (!presenceRes.ok) {
        office.presence = {
          available: false,
          status: 'unavailable',
          label: presence.error || 'Office chat offline',
          message: presence.error || 'Office chat offline',
        };
      } else {
        office.presence = presence;
      }
    } catch {
      office.presence = {
        available: false,
        status: 'unavailable',
        label: 'Office chat offline',
        message: 'Office chat offline',
      };
    }
    office.lineBlocked = !office.presence?.available;
    updateOfficeGateCopy(office.presence);
    return office.presence;
  }

  async function ensureOfficeSession() {
    if (office.started && office.sessionId && !office.ended) return office.sessionId;
    if (office.connecting) throw new Error('Still connecting to the office…');
    if (!office.displayName) throw new Error('Please enter your name first.');

    office.connecting = true;
    office.started = false;
    office.sessionId = '';
    office.ended = false;
    setStatus('Checking office line…', 'connecting');

    try {
      const presence = await refreshOfficePresence();
      if (!presence.available) {
        throw new Error(presenceErrorMessage(presence));
      }

      setStatus('Opening chat session…', 'connecting');
      const data = await postJson('/api/xelion', {
        action: 'start',
        clientId: office.displayName,
        email: office.email,
        phone: office.phone,
      });
      const sessionId = String(data.session?.id || '').trim();
      if (!sessionId) throw new Error('Could not open an office chat session.');

      office.sessionId = sessionId;
      office.started = true;
      office.ended = false;
      office.lineBlocked = false;
      office.detailsCaptured = true;
      office.seen = new Set();
      setStatus('Waiting for an agent', 'online');
      if (data.websocket) connectOfficeSocket(data.websocket);
      if (!office.poll) office.poll = setInterval(refreshOfficeMessages, 4000);
      appendMessage(
        body,
        `Thanks ${office.displayName}. Session ${sessionId} is open on the office line. An agent will join when available.`,
        'bot',
      );
      return sessionId;
    } catch (err) {
      office.started = false;
      office.sessionId = '';
      office.ended = false;
      stopOfficeListen();
      setStatus(office.presence?.status === 'dnd' ? 'Outside office hours' : 'Office unavailable', 'offline');
      throw err;
    } finally {
      office.connecting = false;
    }
  }

  async function endOfficeChat({ fromServer = false } = {}) {
    if (office.ended && !office.awaitingFeedback) return;
    stopOfficeListen();
    showAgentTyping(false);
    const closedId = office.sessionId;
    if (closedId && !fromServer && !office.ended) {
      try {
        await postJson('/api/xelion', { action: 'end', sessionId: closedId });
      } catch {
        /* already closed on their side is fine */
      }
    }
    office.feedbackSessionId = closedId || office.feedbackSessionId;
    office.ended = true;
    office.started = false;
    office.sessionId = '';
    office.awaitingFeedback = Boolean(office.feedbackSessionId);
    office.rating = 0;
    setStatus('Chat ended', 'offline');
    appendMessage(body, 'Office chat ended. A quick rating helps the team.', 'bot');
    if (tab === 'office') showTab('office');
  }

  body.insertAdjacentHTML(
    'beforeend',
    `<div class="chatbot-welcome">
      <p class="chatbot-welcome-hi">Hello there,</p>
      <p class="chatbot-welcome-lead">How may I help you?</p>
      <p class="chatbot-welcome-sub">${
        OFFICE_CHAT_ENABLED
          ? 'Ask about services, coverage, or next steps. Prefer a person? Open Office. Prefer a callback? Open Enquiry.'
          : 'Ask about services, coverage, or next steps — or open Enquiry if you would rather leave a message.'
      }</p>
    </div>`,
  );

  function renderOfficeTab() {
    const isOffice = tab === 'office';
    if (!isOffice) return;
    const officeReady = office.started && !office.ended;
    const officeFeedbackOpen = office.awaitingFeedback;
    const showNotice = office.detailsCaptured && office.lineBlocked && !officeReady && !officeFeedbackOpen;
    const officeNeedsDetails = !officeReady && !officeFeedbackOpen && !showNotice;

    body.classList.toggle('chatbot-hidden', officeNeedsDetails || officeFeedbackOpen);
    inputRow.classList.toggle('chatbot-hidden', true);
    enquiry.classList.add('chatbot-hidden');
    officeGate.classList.toggle('chatbot-hidden', !officeNeedsDetails);
    officeFeedback.classList.toggle('chatbot-hidden', !officeFeedbackOpen);
    officeBar.classList.toggle('chatbot-hidden', !officeReady);
    if (officeReady) inputRow.classList.remove('chatbot-hidden');

    if (officeFeedbackOpen) {
      setStatus('Rate this chat', 'offline');
      officeFeedback.querySelectorAll('[data-rating]').forEach((b) => {
        b.classList.toggle('is-on', Number(b.dataset.rating) <= office.rating);
      });
    } else if (office.connecting) {
      setStatus('Connecting…', 'connecting');
    } else if (officeReady) {
      setStatus('Waiting for an agent', 'online');
      input.placeholder = 'Message the office…';
    } else if (showNotice) {
      setStatus(office.presence?.status === 'dnd' ? 'Outside office hours' : 'Office unavailable', 'offline');
      showOfficePresenceNotice(office.presence);
    } else {
      setStatus('Enter your details', 'connecting');
      officeGate.querySelector('#office-name')?.focus();
    }
  }

  function showTab(name) {
    tab = name;
    modes.querySelectorAll('.chatbot-mode').forEach((b) => b.classList.toggle('is-on', b.dataset.tab === name));
    const isEnquiry = name === 'enquiry';
    const isOffice = name === 'office';
    const isChat = name === 'chat';
    const officeReady = isOffice && office.started && !office.ended;
    const officeFeedbackOpen = isOffice && office.awaitingFeedback;
    const showNotice = isOffice && office.detailsCaptured && office.lineBlocked && !officeReady && !officeFeedbackOpen;
    const officeNeedsDetails = isOffice && !officeReady && !officeFeedbackOpen && !showNotice;

    body.classList.toggle('chatbot-hidden', isEnquiry || officeNeedsDetails || officeFeedbackOpen);
    inputRow.classList.toggle('chatbot-hidden', isEnquiry || officeNeedsDetails || officeFeedbackOpen || showNotice);
    enquiry.classList.toggle('chatbot-hidden', !isEnquiry);
    officeGate.classList.toggle('chatbot-hidden', !officeNeedsDetails);
    officeFeedback.classList.toggle('chatbot-hidden', !officeFeedbackOpen);
    officeBar.classList.toggle('chatbot-hidden', !officeReady);
    if (!isChat) registerBox.classList.add('chatbot-hidden');
    panel.classList.toggle('is-enquiry', isEnquiry);
    panel.classList.toggle('is-office', isOffice);

    if (!isOffice) office.presenceNoticeShown = false;

    if (isChat) {
      setStatus('Online', 'online');
      input.placeholder = 'Type your message…';
    } else if (isOffice) {
      refreshOfficePresence().then(() => {
        if (tab !== 'office') return;
        renderOfficeTab();
      });
      renderOfficeTab();
    } else {
      setStatus('Leave an enquiry', 'online');
      ensureTurnstile().catch(() => {});
    }
  }

  officeGate.addEventListener('submit', async (e) => {
    e.preventDefault();
    const status = officeGate.querySelector('#office-gate-status');
    const btn = officeGate.querySelector('button[type="submit"]');
    const name = displayNameAsClientId(officeGate.querySelector('#office-name').value);
    const email = String(officeGate.querySelector('#office-email').value || '').trim();
    const phone = String(officeGate.querySelector('#office-phone').value || '').trim();
    status.hidden = true;
    if (!name || name === 'Website visitor') {
      status.hidden = false;
      status.textContent = 'Please enter your name.';
      status.className = 'chatbot-enquiry-status is-err';
      return;
    }
    if (!phone) {
      status.hidden = false;
      status.textContent = 'Please enter your contact number.';
      status.className = 'chatbot-enquiry-status is-err';
      return;
    }
    const phoneMessage = ukPhoneMessage(phone);
    if (phoneMessage) {
      status.hidden = false;
      status.textContent = phoneMessage;
      status.className = 'chatbot-enquiry-status is-err';
      return;
    }
    office.displayName = name;
    office.email = email;
    office.phone = phone;
    btn.disabled = true;
    try {
      const presence = await refreshOfficePresence();
      if (!presence.available) {
        try {
          await saveAfterHoursCallback();
        } catch (saveErr) {
          status.hidden = false;
          status.textContent = saveErr.message || 'Could not save your details. Please try again.';
          status.className = 'chatbot-enquiry-status is-err';
          resetTurnstile(office.gateTurnstileId);
          return;
        }
        office.detailsCaptured = true;
        office.presenceNoticeShown = false;
        setStatus(presence.status === 'dnd' ? 'Outside office hours' : 'Office unavailable', 'offline');
        showTab('office');
        return;
      }
      office.detailsCaptured = true;
      await ensureOfficeSession();
      showTab('office');
    } catch (err) {
      status.hidden = false;
      status.textContent = err.message || 'Office chat is unavailable.';
      status.className = 'chatbot-enquiry-status is-err';
      setStatus('Office unavailable', 'offline');
    } finally {
      btn.disabled = false;
    }
  });

  modes.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-tab]');
    if (btn) showTab(btn.dataset.tab);
  });

  endBtn.addEventListener('click', () => {
    endOfficeChat();
    officeBar.classList.add('chatbot-hidden');
  });

  officeFeedback.querySelector('#office-rating').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-rating]');
    if (!btn) return;
    office.rating = Number(btn.dataset.rating) || 0;
    officeFeedback.querySelectorAll('[data-rating]').forEach((b) => {
      b.classList.toggle('is-on', Number(b.dataset.rating) <= office.rating);
    });
  });

  officeFeedback.querySelector('#office-feedback-skip').addEventListener('click', () => {
    office.awaitingFeedback = false;
    office.feedbackSessionId = '';
    office.rating = 0;
    showTab('office');
  });

  officeFeedback.addEventListener('submit', async (e) => {
    e.preventDefault();
    const status = officeFeedback.querySelector('#office-feedback-status');
    const btn = officeFeedback.querySelector('button[type="submit"]');
    status.hidden = true;
    if (!office.rating) {
      status.hidden = false;
      status.textContent = 'Please choose a rating from 1 to 5.';
      status.className = 'chatbot-enquiry-status is-err';
      return;
    }
    if (!office.feedbackSessionId) {
      office.awaitingFeedback = false;
      showTab('office');
      return;
    }
    btn.disabled = true;
    try {
      await postJson('/api/xelion', {
        action: 'feedback',
        sessionId: office.feedbackSessionId,
        rating: office.rating,
        feedback: officeFeedback.querySelector('#office-feedback-text').value,
      });
      office.awaitingFeedback = false;
      office.feedbackSessionId = '';
      office.rating = 0;
      officeFeedback.querySelector('#office-feedback-text').value = '';
      appendMessage(body, 'Thank you for the feedback.', 'bot');
      showTab('office');
    } catch (err) {
      status.hidden = false;
      status.textContent = err.message || 'Could not send feedback.';
      status.className = 'chatbot-enquiry-status is-err';
    } finally {
      btn.disabled = false;
    }
  });

  async function postChat({ addUserText = '' } = {}) {
    const text = addUserText.trim();
    if (text) {
      appendMessage(body, text, 'user');
      history.push({ role: 'user', content: text });
    }
    if (!history.length) return;
    const thinking = appendMessage(body, 'Thinking…', 'bot');
    thinking.classList.add('is-pending');
    registerBtn.disabled = true;
    try {
      const data = await postJson('/api/chat', {
        messages: history,
        chatSession: chatSessionId(),
        turnstileToken: turnstileToken(askTurnstileId),
      });
      thinking.remove();
      appendMessage(body, data.reply, 'bot');
      history.push({ role: 'assistant', content: data.reply });
      if (data.saved) {
        registerBox.classList.add('chatbot-hidden');
        resetTurnstile(askTurnstileId);
      } else if (data.needsCheck) {
        registerBox.classList.remove('chatbot-hidden');
        ensureAskTurnstile().catch(() => {});
      }
    } catch (err) {
      thinking.remove();
      appendMessage(body, err.message || 'Chat is unavailable right now. Please leave an enquiry instead.', 'bot');
    } finally {
      registerBtn.disabled = false;
    }
  }

  async function sendOffice(text) {
    appendMessage(body, text, 'user');
    const pending = appendMessage(body, 'Sending…', 'bot');
    pending.classList.add('is-pending');
    try {
      const sessionId = await ensureOfficeSession();
      officeBar.classList.remove('chatbot-hidden');
      const data = await postJson('/api/xelion', {
        action: 'message',
        sessionId,
        text,
      });
      pending.remove();
      const id = String(data.message?.id || '');
      if (id) office.seen.add(id);
      setStatus('Online · waiting for an agent');
    } catch (err) {
      pending.remove();
      appendMessage(body, err.message || 'Could not reach the office. Please leave an enquiry.', 'bot');
    }
  }

  async function sendChat() {
    const text = (input.value || '').trim();
    if (!text) return;
    input.value = '';
    if (tab === 'office') await sendOffice(text);
    else await postChat({ addUserText: text });
  }

  registerBtn.addEventListener('click', async () => {
    if (!turnstileToken(askTurnstileId)) {
      appendMessage(body, 'Complete the security check, then press Register using chat.', 'bot');
      return;
    }
    await postChat();
  });

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
  input.addEventListener('input', () => {
    if (tab === 'office' && office.started && !office.ended) pingTyping();
  });

  enquiry.addEventListener('submit', async (e) => {
    e.preventDefault();
    const status = enquiry.querySelector('#chat-enq-status');
    const btn = enquiry.querySelector('button[type="submit"]');
    status.hidden = true;
    const phoneMessage = ukPhoneMessage(enquiry.querySelector('#chat-enq-phone').value);
    if (phoneMessage) {
      status.hidden = false;
      status.textContent = phoneMessage;
      status.className = 'chatbot-enquiry-status is-err';
      return;
    }
    btn.disabled = true;
    try {
      await ensureTurnstile();
      const data = await postJson('/api/ops/enquiries', {
        source: 'chat',
        name: enquiry.querySelector('#chat-enq-name').value,
        email: enquiry.querySelector('#chat-enq-email').value,
        phone: enquiry.querySelector('#chat-enq-phone').value,
        message: enquiry.querySelector('#chat-enq-message').value,
        company_website: enquiry.querySelector('#chat-enq-website').value,
        turnstileToken: turnstileToken(turnstileId),
      });
      enquiry.reset();
      resetTurnstile(turnstileId);
      status.hidden = false;
      status.textContent = data.message || 'Enquiry logged. Thank you.';
      status.className = 'chatbot-enquiry-status is-ok';
      showTab('chat');
      appendMessage(body, 'Thanks — your enquiry is with the office team. We’ll get back to you as soon as we can.', 'bot');
    } catch (err) {
      status.hidden = false;
      status.textContent = err.message || 'Could not save enquiry';
      status.className = 'chatbot-enquiry-status is-err';
      resetTurnstile(turnstileId);
    } finally {
      btn.disabled = false;
    }
  });
}

const PROMPT_STORAGE_KEY = 'cs_chat_prompt_dismissed';

function mountChatPrompt(fab, openChat) {
  const prompt = document.createElement('div');
  prompt.className = 'chatbot-prompt';
  prompt.id = 'chatbot-prompt';
  prompt.setAttribute('role', 'dialog');
  prompt.setAttribute('aria-label', 'Chat with Capital Services');
  prompt.innerHTML = `
    <button type="button" class="chatbot-prompt-open">
      How may I help you?
    </button>
    <button type="button" class="chatbot-prompt-dismiss" aria-label="Dismiss">
      <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 2.5l7 7M9.5 2.5l-7 7" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>
    </button>
  `;
  document.body.appendChild(prompt);

  const dismissed = () => sessionStorage.getItem(PROMPT_STORAGE_KEY) === '1';

  const show = () => {
    if (dismissed() || document.querySelector('.chatbot-panel.active')) return;
    prompt.hidden = false;
    requestAnimationFrame(() => prompt.classList.add('is-visible'));
  };

  const hide = (persist = false) => {
    prompt.classList.remove('is-visible');
    if (persist) sessionStorage.setItem(PROMPT_STORAGE_KEY, '1');
    window.setTimeout(() => {
      if (!prompt.classList.contains('is-visible')) prompt.hidden = true;
    }, 200);
  };

  prompt.hidden = true;

  prompt.querySelector('.chatbot-prompt-dismiss')?.addEventListener('click', (e) => {
    e.stopPropagation();
    hide(true);
  });

  prompt.querySelector('.chatbot-prompt-open')?.addEventListener('click', () => {
    hide(true);
    openChat();
  });

  if (!dismissed()) {
    window.setTimeout(show, 1200);
  }

  return { show, hide, el: prompt };
}

export function initChatbot() {
  const fab = document.querySelector('.chatbot-fab');
  const panel = document.querySelector('.chatbot-panel');
  if (!fab || !panel) return;

  fab.classList.remove('chatbot-fab--avatar');
  fab.innerHTML = `
    <svg class="chatbot-fab-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;
  fab.setAttribute('aria-label', 'Open chat with Capital Services');

  enhancePanel(panel);

  let promptApi = null;

  const openChat = () => {
    promptApi?.hide(true);
    panel.classList.add('active');
    fab.style.display = 'none';
  };

  const closeChat = () => {
    panel.classList.remove('active');
    fab.style.display = '';
  };

  promptApi = mountChatPrompt(fab, openChat);

  fab.addEventListener('click', () => {
    if (panel.classList.contains('active')) {
      closeChat();
      return;
    }
    openChat();
  });

  const closeBtn = panel.querySelector('.chatbot-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', closeChat);
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && panel.classList.contains('active')) {
      e.preventDefault();
      closeChat();
    }
  });
}
