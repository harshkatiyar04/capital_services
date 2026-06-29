/* ================================================================
   CAPITAL SERVICES — Animated Counter
   Count-up animation for stat numbers
   ================================================================ */

class AnimatedCounter {
  constructor() {
    this.counters = [];
    this.init();
  }

  init() {
    document.addEventListener('DOMContentLoaded', () => {
      this.setupCounters();
    });
  }

  setupCounters() {
    const counterElements = document.querySelectorAll('[data-counter]');

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          this.animateCounter(entry.target);
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.5 });

    counterElements.forEach(el => observer.observe(el));
  }

  animateCounter(element) {
    const target = parseInt(element.getAttribute('data-counter'), 10);
    const suffix = element.getAttribute('data-suffix') || '';
    const prefix = element.getAttribute('data-prefix') || '';
    const duration = parseInt(element.getAttribute('data-duration') || '2000', 10);

    let start = 0;
    const startTime = performance.now();

    const easeOutQuart = (t) => 1 - Math.pow(1 - t, 4);

    const update = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeOutQuart(progress);
      const current = Math.floor(easedProgress * target);

      element.textContent = prefix + current.toLocaleString() + suffix;

      if (progress < 1) {
        requestAnimationFrame(update);
      } else {
        element.textContent = prefix + target.toLocaleString() + suffix;
      }
    };

    requestAnimationFrame(update);
  }
}

// Auto-initialize
const counterAnimator = new AnimatedCounter();

export { AnimatedCounter };
