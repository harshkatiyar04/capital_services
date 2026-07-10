
const GOOGLE_MAPS_REVIEW_URL = 'https://search.google.com/local/writereview?placeid=ChIJK7FSuKRBdkgRSTWp5H8Etv0';

const FALLBACK_REVIEWS = [
  "Capital Services were brilliant after our kitchen flood — quick make-safe, thorough drying, and a flawless reinstatement. Couldn't recommend them more.",
  "After fire damage, they handled everything from strip-out to rebuild with real care and clear communication throughout.",
  "Water damage restoration was seamless — professional team, excellent updates, and the finished result exceeded our expectations.",
  "They coordinated with our insurers brilliantly on a major loss and delivered work that looks better than before.",
  "Subsidence repairs were handled efficiently — knowledgeable team and outstanding workmanship from start to finish.",
  "From emergency make-safe to final reinstatement, they took the stress out of a difficult situation.",
  "Flooding at our home was stressful, but Capital Services managed the full restoration with genuine care and skill.",
  "Fire damage restoration was handled with complete professionalism — smooth insurance process and immaculate finish.",
];

async function generateReviewWithAI() {
  try {
    const response = await fetch('/api/generate-review', { method: 'POST' });
    if (!response.ok) throw new Error('API error');
    const data = await response.json();
    if (data.review) return data.review;
    return getRandomFallback();
  } catch {
    return getRandomFallback();
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

    const review = await generateReviewWithAI();

    loadingEl.style.display = 'none';
    contentEl.style.display = 'block';
    reviewTextEl.textContent = review;

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
        copyBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg> Copied!';
        copyBtn.classList.add('copied');
        setTimeout(() => {
          copyBtn.innerHTML = originalText;
          copyBtn.classList.remove('copied');
        }, 2000);
      }
    });
  }

  if (goBtn) {
    goBtn.addEventListener('click', async () => {
      const text = reviewTextEl.textContent;
      await copyToClipboard(text);

      const originalHtml = goBtn.innerHTML;
      goBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg> Copied! Opening Google...';
      goBtn.style.backgroundColor = '#10b981';
      goBtn.style.color = '#fff';

      setTimeout(() => {
        window.open(GOOGLE_MAPS_REVIEW_URL, '_blank');
        setTimeout(() => {
          goBtn.innerHTML = originalHtml;
          goBtn.style.backgroundColor = '';
          goBtn.style.color = '';
        }, 500);
      }, 800);
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
