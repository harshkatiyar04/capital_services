/* ================================================================
   Testimonials — horizontal scroll carousel
   ================================================================ */

export function initTestimonialsCarousel() {
  document.querySelectorAll('.testimonials-carousel').forEach(initCarousel);
}

function initCarousel(carousel) {
  const track = carousel.querySelector('.testimonials-track');
  const prev = carousel.querySelector('.testimonials-nav--prev');
  const next = carousel.querySelector('.testimonials-nav--next');
  const dotsEl = carousel.querySelector('.testimonials-dots');
  if (!track) return;

  const cards = [...track.querySelectorAll('.testimonial-card')];
  if (!cards.length) return;

  const scrollStep = () => {
    const card = cards[0];
    const gap = parseFloat(getComputedStyle(track).gap) || 24;
    return card.offsetWidth + gap;
  };

  prev?.addEventListener('click', () => {
    track.scrollBy({ left: -scrollStep(), behavior: 'smooth' });
  });

  next?.addEventListener('click', () => {
    const maxScroll = track.scrollWidth - track.clientWidth;
    const nextLeft = Math.min(track.scrollLeft + scrollStep(), maxScroll);
    track.scrollTo({ left: nextLeft, behavior: 'smooth' });
  });

  let dots = [];
  if (dotsEl) {
    dots = cards.map((_, index) => {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'testimonials-dot';
      dot.setAttribute('aria-label', `Go to review ${index + 1}`);
      dot.addEventListener('click', () => {
        track.scrollTo({ left: index * scrollStep(), behavior: 'smooth' });
      });
      dotsEl.appendChild(dot);
      return dot;
    });
  }

  const updateState = () => {
    const maxScroll = track.scrollWidth - track.clientWidth;
    const atStart = track.scrollLeft <= 4;
    const atEnd = track.scrollLeft >= maxScroll - 4;

    if (prev) prev.disabled = atStart;
    if (next) next.disabled = atEnd || maxScroll <= 0;

    if (dots.length) {
      const index = maxScroll <= 0
        ? 0
        : Math.round(track.scrollLeft / scrollStep());
      dots.forEach((dot, i) => dot.classList.toggle('active', i === index));
    }
  };

  track.addEventListener('scroll', updateState, { passive: true });
  window.addEventListener('resize', updateState);
  updateState();
}
