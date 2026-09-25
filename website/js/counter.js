/* ================================================================
   CAPITAL SERVICES — Animated Counter
   Count-up animation for stat numbers
   Supports: data-counter, data-prefix, data-suffix, data-format
   Formats: "comma" (50,000), "decimal" (4.3), "plain" (26)
   ================================================================ */

class AnimatedCounter {
  constructor() {
    this.counters = [];
    this.init();
  }

  init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setupCounters());
    } else {
      this.setupCounters();
    }
  }

  setupCounters() {
    const counterElements = document.querySelectorAll('[data-counter]');
    if (!counterElements.length) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          this.animateCounter(entry.target);
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.3, rootMargin: '0px 0px -40px 0px' });

    counterElements.forEach(el => observer.observe(el));
  }

  animateCounter(element) {
    const raw = element.getAttribute('data-counter');
    const isDecimal = raw.includes('.');
    const target = isDecimal ? parseFloat(raw) : parseInt(raw, 10);
    const suffix = element.getAttribute('data-suffix') || '';
    const prefix = element.getAttribute('data-prefix') || '';
    const format = element.getAttribute('data-format') || 'plain';
    const duration = parseInt(element.getAttribute('data-duration') || '2200', 10);

    const startTime = performance.now();

    // Smoother ease curve — cubic bezier approximation
    const easeOutExpo = (t) => t === 1 ? 1 : 1 - Math.pow(2, -10 * t);

    const formatNumber = (num) => {
      if (format === 'comma') {
        return num.toLocaleString('en-GB');
      }
      if (format === 'decimal') {
        return num.toFixed(1);
      }
      return num.toString();
    };

    const update = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeOutExpo(progress);

      let current;
      if (isDecimal) {
        current = easedProgress * target;
        // Round to one decimal during animation
        current = Math.round(current * 10) / 10;
      } else {
        current = Math.floor(easedProgress * target);
      }

      element.textContent = prefix + formatNumber(current) + suffix;

      if (progress < 1) {
        requestAnimationFrame(update);
      } else {
        // Ensure final value is exact
        element.textContent = prefix + formatNumber(target) + suffix;
        // Trigger the pop animation
        element.classList.add('counted');
      }
    };

    requestAnimationFrame(update);
  }
}

// Auto-initialize
const counterAnimator = new AnimatedCounter();

export { AnimatedCounter };
