
export const GOOGLE_MAPS_REVIEW_URL =
  'https://search.google.com/local/writereview?placeid=ChIJk7FSuKRBdkgRSTWp5H8Etv0';

const FALLBACK_REVIEWS = [
  "Capital Services were brilliant after our kitchen flood — they attended quickly for the make-safe, set up professional drying throughout the property, and managed the full reinstatement with clear updates at every stage. The team were respectful of our home and kept us informed throughout the insurance process. We felt genuinely looked after from the first call through to sign-off. Couldn't recommend them more highly.",
  "After fire damage to our property, Capital Services handled everything from emergency strip-out and decontamination through to the full rebuild. Their surveyors and contractors worked seamlessly with our insurer, and communication was excellent from start to finish. The finished result exceeded our expectations and the whole experience was far less stressful than we feared.",
  "I was thoroughly impressed with the professionalism and efficiency of Capital Services after a burst pipe caused significant water damage to our home. Their team responded promptly, carried out thorough drying and monitoring, and coordinated all reinstatement works without us having to chase anyone. The property was returned to a superb standard and we would happily use them again.",
  "They coordinated with our insurers brilliantly on a major loss at our commercial premises, minimising downtime while works were completed to a very high standard. Capital Services managed tenders, contractors and progress reporting throughout, which gave us real confidence in the process. Outstanding service from a knowledgeable team.",
  "Subsidence repairs were handled efficiently from investigation through to specialist remediation and reinstatement. The surveyors explained every step clearly and the workmanship was excellent throughout. Capital Services made a complex claim feel manageable and we are delighted with the outcome.",
  "From emergency make-safe following storm damage through to final reinstatement, Capital Services took the stress out of a difficult situation. They were on site quickly, kept the property secure, and delivered quality repairs on schedule. A professional, customer-focused service we would recommend without hesitation.",
  "Flooding at our home was incredibly stressful, but Capital Services managed the full restoration with genuine care and skill. Drying, strip-out and rebuild were all handled under one roof with consistent communication. The team went above and beyond to get us back to normal as quickly as possible.",
  "Fire and smoke damage restoration was handled with complete professionalism — from the initial make-safe and drying through to a flawless reinstatement. Capital Services worked closely with our insurer and kept us updated at every stage. The quality of finish was immaculate and the process was smooth throughout.",
];

async function generateReviewWithAI() {
  try {
    const response = await fetch('/api/generate-review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) throw new Error(`API error ${response.status}`);
    const data = await response.json();
    if (data.review) return { review: data.review, source: 'ai' };
    throw new Error('Empty review');
  } catch {
    return { review: getRandomFallback(), source: 'fallback' };
  }
}

function getRandomFallback() {
  const idx = (Date.now() + Math.floor(Math.random() * 1000)) % FALLBACK_REVIEWS.length;
  return FALLBACK_REVIEWS[idx];
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      document.body.removeChild(textarea);
      return true;
    } catch {
      document.body.removeChild(textarea);
      return false;
    }
  }
}

export function initReviewGenerator() {
  const leaveReviewBtn = document.getElementById('leave-review-btn');
  const modal = document.getElementById('review-modal');
  if (!leaveReviewBtn || !modal) return;

  const reviewTextEl = modal.querySelector('.review-text');
  const copyBtn = modal.querySelector('.review-copy-btn');
  const goBtn = modal.querySelector('.review-go-btn');
  const closeBtn = modal.querySelector('.review-modal-close');
  const loadingEl = modal.querySelector('.review-loading');
  const contentEl = modal.querySelector('.review-content');
  const starsContainer = modal.querySelector('.review-stars-display');
  const footerNote = modal.querySelector('.review-modal-footer p');

  if (goBtn && !goBtn.getAttribute('href')) {
    goBtn.setAttribute('href', GOOGLE_MAPS_REVIEW_URL);
    goBtn.setAttribute('target', '_blank');
    goBtn.setAttribute('rel', 'noopener noreferrer');
  }

  leaveReviewBtn.addEventListener('click', async (e) => {
    e.preventDefault();

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    loadingEl.style.display = 'flex';
    contentEl.style.display = 'none';

    if (starsContainer) {
      const stars = starsContainer.querySelectorAll('.star-icon');
      stars.forEach((star, i) => {
        star.style.animationDelay = `${i * 0.12}s`;
        star.classList.remove('filled');
        void star.offsetWidth;
        star.classList.add('filled');
      });
    }

    const { review, source } = await generateReviewWithAI();

    loadingEl.style.display = 'none';
    contentEl.style.display = 'block';
    reviewTextEl.textContent = review;

    if (footerNote) {
      footerNote.textContent =
        source === 'ai'
          ? 'Review ready — copy it, then paste on Google when the page opens.'
          : 'Review ready — copy it, then paste on Google when the page opens.';
    }

    contentEl.style.opacity = '0';
    contentEl.style.transform = 'translateY(10px)';
    requestAnimationFrame(() => {
      contentEl.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
      contentEl.style.opacity = '1';
      contentEl.style.transform = 'translateY(0)';
    });
  });

  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      const text = reviewTextEl.textContent;
      const copied = await copyToClipboard(text);

      if (copied) {
        const originalText = copyBtn.innerHTML;
        copyBtn.innerHTML =
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg> Copied!';
        copyBtn.classList.add('copied');
        setTimeout(() => {
          copyBtn.innerHTML = originalText;
          copyBtn.classList.remove('copied');
        }, 2000);
      }
    });
  }

  if (goBtn) {
    goBtn.addEventListener('click', () => {
      void copyToClipboard(reviewTextEl.textContent);
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', closeModal);
  }

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('active')) {
      closeModal();
    }
  });

  function closeModal() {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }
}
