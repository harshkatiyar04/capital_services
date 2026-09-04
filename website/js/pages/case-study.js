/* ================================================================
   CAPITAL SERVICES — Case Study Page JS
   Counters, before/after slider, timeline
   ================================================================ */

document.addEventListener('DOMContentLoaded', () => {
  initCounters();
  initBeforeAfter();
  initTimeline();
});

/* ── Animated Counters ── */
function initCounters() {
  const counters = document.querySelectorAll('[data-count]');
  if (!counters.length) return;

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        observer.unobserve(entry.target);
        animateCounter(entry.target, prefersReduced);
      });
    },
    { threshold: 0.3 },
  );

  counters.forEach((el) => observer.observe(el));
}

function animateCounter(el, instant) {
  const target = parseInt(el.dataset.count, 10);
  const prefix = el.dataset.prefix || '';
  const suffix = el.dataset.suffix || '';
  const duration = instant ? 0 : 1800;

  if (duration === 0) {
    el.textContent = prefix + target.toLocaleString() + suffix;
    return;
  }

  const start = performance.now();
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  function tick(now) {
    const progress = Math.min((now - start) / duration, 1);
    el.textContent = prefix + Math.round(ease(progress) * target).toLocaleString() + suffix;
    if (progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

/* ── Before / After Slider ── */
function initBeforeAfter() {
  const sliders = document.querySelectorAll('.cs-ba');
  sliders.forEach((slider) => {
    const before = slider.querySelector('.cs-ba__img--before');
    const handle = slider.querySelector('.cs-ba__handle');
    if (!before || !handle) return;

    let isDragging = false;
    let hinted = false;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function setPercent(percent) {
      const p = Math.max(0, Math.min(100, percent));
      before.style.clipPath = `inset(0 ${100 - p}% 0 0)`;
      handle.style.left = `${p}%`;
      slider.setAttribute('aria-valuenow', String(Math.round(p)));
    }

    function updateFromClientX(clientX) {
      const rect = slider.getBoundingClientRect();
      setPercent(((clientX - rect.left) / rect.width) * 100);
    }

    setPercent(50);
    slider.setAttribute('role', 'slider');
    slider.setAttribute('aria-label', 'Compare before and after');
    slider.setAttribute('aria-valuemin', '0');
    slider.setAttribute('aria-valuemax', '100');
    slider.setAttribute('tabindex', '0');

    slider.addEventListener('mousedown', (e) => {
      isDragging = true;
      slider.classList.remove('is-hinting');
      updateFromClientX(e.clientX);
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      updateFromClientX(e.clientX);
    });

    document.addEventListener('mouseup', () => {
      isDragging = false;
    });

    slider.addEventListener(
      'touchstart',
      (e) => {
        isDragging = true;
        slider.classList.remove('is-hinting');
        updateFromClientX(e.touches[0].clientX);
      },
      { passive: true },
    );

    slider.addEventListener(
      'touchmove',
      (e) => {
        if (!isDragging) return;
        updateFromClientX(e.touches[0].clientX);
      },
      { passive: true },
    );

    slider.addEventListener('touchend', () => {
      isDragging = false;
    });

    slider.addEventListener('keydown', (e) => {
      const now = Number(slider.getAttribute('aria-valuenow') || 50);
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setPercent(now - 5);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setPercent(now + 5);
      } else if (e.key === 'Home') {
        e.preventDefault();
        setPercent(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        setPercent(100);
      }
    });

    if (!reduced) {
      const hintObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting || hinted) return;
            hinted = true;
            hintObserver.disconnect();
            slider.classList.add('is-hinting');
            setPercent(35);
            requestAnimationFrame(() => {
              requestAnimationFrame(() => setPercent(65));
            });
            setTimeout(() => {
              setPercent(50);
              setTimeout(() => slider.classList.remove('is-hinting'), 1200);
            }, 1200);
          });
        },
        { threshold: 0.45 },
      );
      hintObserver.observe(slider);
    }
  });
}

/* ── Timeline Scroll Fill ── */
function initTimeline() {
  const track = document.querySelector('.cs-timeline__track');
  if (!track) return;

  const fill = track.querySelector('.cs-timeline__line-fill');
  const items = track.querySelectorAll('.cs-timeline__item');
  if (!fill || !items.length) return;

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function updateTimeline() {
    const trackRect = track.getBoundingClientRect();
    const trackTop = trackRect.top;
    const trackHeight = trackRect.height;
    const viewportMid = window.innerHeight * 0.6;
    const progress = Math.max(0, Math.min((viewportMid - trackTop) / trackHeight, 1));

    fill.style.height = prefersReduced ? '100%' : `${progress * 100}%`;

    items.forEach((item) => {
      if (item.getBoundingClientRect().top < viewportMid) {
        item.classList.add('is-active');
      }
    });
  }

  window.addEventListener('scroll', updateTimeline, { passive: true });
  updateTimeline();
}
