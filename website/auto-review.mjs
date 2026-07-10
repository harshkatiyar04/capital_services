import puppeteer from 'puppeteer-core';
import 'dotenv/config';

const REVIEW_URL = 'https://search.google.com/local/writereview?placeid=ChIJK7FSuKRBdkgRSTWp5H8Etv0';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';

const REVIEW_PROMPTS = [
  "Write a short, authentic 5-star Google review (2-4 sentences) for Capital Services, a property restoration and insurance claims company in Watford, UK. They handle fire/flood damage restoration, drying, strip-out works, reinstatement, and major loss projects. Make it sound like a real homeowner or business owner. Mention specific services like making safe, drying, or reinstatement naturally. Do NOT use any greeting or sign-off. Just the review text. Be warm, genuine, and unique.",
  "Write a brief, heartfelt 5-star Google review (2-4 sentences) for Capital Services, a UK property care company that handles insurance claims, flood/fire damage, and property restoration. Sound like a genuine customer who had their property restored after damage. Mention their professionalism and quick response. No greeting or sign-off. Just the review.",
  "Compose a glowing 5-star Google review (2-3 sentences) for Capital Services based in Watford/Yateley, UK. They specialize in property damage restoration including strip-out, drying, validation, and reinstatement for insurance claims. Write as if you're a satisfied property owner. Be specific but natural. No greetings or closings.",
  "Create an enthusiastic but genuine 5-star review (2-4 sentences) for Capital Services, a property restoration firm handling insurance work across the UK. Mention their team's expertise in areas like major loss, commercial claims, subsidence, or high net worth properties. Sound real and personal. No opening or closing formalities.",
  "Write a concise, honest-sounding 5-star Google review (2-3 sentences) for Capital Services. They restored a property after significant damage — could be water, fire, or structural. Praise their communication, timeliness, and quality of work. Sound like a real person, not marketing copy. No greetings.",
];

const FALLBACK_REVIEWS = [
  "Capital Services were absolutely brilliant after our kitchen flood. Their team arrived quickly, managed the drying and strip-out with real care, and the reinstatement was flawless. Couldn't recommend them highly enough.",
  "After a devastating fire at our property, Capital Services handled everything from making safe to complete reinstatement. Their professionalism and attention to detail throughout the insurance process was exceptional.",
  "We had significant water damage and Capital Services made the entire restoration process seamless. Their drying team was thorough, the communication was excellent, and the final result exceeded our expectations.",
  "Fantastic experience with Capital Services on a major loss project. They coordinated with our insurers brilliantly and delivered a restoration that was better than the original. Truly professional outfit.",
  "Capital Services restored our commercial property after subsidence damage. Their specialist team was knowledgeable, efficient, and kept us informed at every stage. The quality of workmanship was outstanding.",
  "From the initial make-safe through to final reinstatement, Capital Services were superb. They took the stress out of a very difficult situation and delivered exceptional results on time.",
  "I cannot praise Capital Services enough. After flooding damaged our home, they managed everything — strip-out, drying, and rebuild — with genuine care and impressive skill. Our home looks better than ever.",
  "Outstanding service from Capital Services. Their team handled our fire damage restoration with complete professionalism. The insurance process was smooth and the finished work was immaculate.",
];

async function generateReview() {
  if (!GROQ_API_KEY) {
    console.log('No Groq API key, using fallback');
    return FALLBACK_REVIEWS[Math.floor(Math.random() * FALLBACK_REVIEWS.length)];
  }

  const prompt = REVIEW_PROMPTS[Math.floor(Math.random() * REVIEW_PROMPTS.length)];
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_API_KEY}` },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: 'You write authentic Google reviews. Output ONLY the review text — no quotes, no labels.' },
          { role: 'user', content: prompt }
        ],
        temperature: 1.1,
        max_tokens: 200,
        top_p: 0.95,
      }),
    });
    if (!res.ok) throw new Error(`API ${res.status}`);
    const data = await res.json();
    let review = data.choices?.[0]?.message?.content?.trim();
    if (!review) throw new Error('Empty');
    return review.replace(/^["']|["']$/g, '');
  } catch (err) {
    console.log('AI failed, using fallback:', err.message);
    return FALLBACK_REVIEWS[Math.floor(Math.random() * FALLBACK_REVIEWS.length)];
  }
}

async function run() {
  console.log('Generating review...');
  const reviewText = await generateReview();
  console.log(`\nReview: "${reviewText}"\n`);

  console.log('Launching Chrome...');
  const browser = await puppeteer.launch({
    headless: false,
    executablePath: CHROME_PATH,
    defaultViewport: null,
    args: ['--start-maximized'],
  });

  const page = await browser.newPage();
  await page.goto(REVIEW_URL, { waitUntil: 'networkidle2', timeout: 60000 });

  console.log('If login is required, please sign in. Waiting for review form...\n');

  // Wait for star rating elements to appear
  try {
    await page.waitForFunction(() => {
      return document.querySelector('[data-rating="5"]') ||
             document.querySelector('[aria-label*="star" i]') ||
             document.querySelector('span[data-value="5"]') ||
             document.querySelector('[role="radio"]');
    }, { timeout: 120000 });
  } catch {
    console.log('Timed out waiting for stars. You may need to interact with the page.');
  }

  await new Promise(r => setTimeout(r, 2000));

  // Click 5 stars
  const starClicked = await page.evaluate(() => {
    let star = document.querySelector('[data-rating="5"]');
    if (star) { star.click(); return 'data-rating'; }

    const allEls = document.querySelectorAll('[aria-label]');
    for (const el of allEls) {
      const label = el.getAttribute('aria-label').toLowerCase();
      if (label.includes('5 star') || label.includes('five star')) {
        el.click(); return 'aria-label';
      }
    }

    star = document.querySelector('[data-value="5"]');
    if (star) { star.click(); return 'data-value'; }

    const radios = Array.from(document.querySelectorAll('[role="radio"]'));
    const starRadios = radios.filter(el => (el.getAttribute('aria-label') || '').toLowerCase().includes('star'));
    if (starRadios.length >= 5) { starRadios[4].click(); return 'role-radio'; }

    const containers = document.querySelectorAll('[class*="star"], [class*="rating"]');
    for (const c of containers) {
      if (c.children.length === 5) { c.children[4].click(); return 'container'; }
    }
    return null;
  });

  console.log(starClicked ? `5 stars selected (${starClicked})` : 'Could not auto-select stars. Click 5 stars manually.');
  await new Promise(r => setTimeout(r, 1500));

  // Fill review text
  const filled = await page.evaluate((text) => {
    let el = document.querySelector('textarea');
    if (el) {
      el.focus();
      el.value = text;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return 'textarea';
    }

    el = document.querySelector('[contenteditable="true"]');
    if (el) {
      el.focus();
      el.textContent = text;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      return 'contenteditable';
    }

    el = document.querySelector('[role="textbox"]');
    if (el) {
      el.focus();
      el.textContent = text;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      return 'role-textbox';
    }
    return null;
  }, reviewText);

  if (filled) {
    console.log(`Review filled (${filled})`);
  } else {
    console.log('Direct fill failed, trying keyboard input...');
    const focused = await page.evaluate(() => {
      const t = document.querySelector('textarea') || document.querySelector('[contenteditable="true"]') || document.querySelector('[role="textbox"]');
      if (t) { t.focus(); return true; }
      return false;
    });
    if (focused) {
      await page.keyboard.type(reviewText, { delay: 30 });
      console.log('Review typed via keyboard');
    } else {
      console.log('Could not find text input. Paste manually.');
    }
  }

  console.log('\n--- DONE ---');
  console.log('5 stars + review filled. Verify and click Post.');
  console.log('Close browser when finished.\n');

  browser.on('disconnected', () => process.exit(0));
}

run().catch(err => { console.error('Error:', err.message); process.exit(1); });
