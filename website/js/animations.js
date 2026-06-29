/* ================================================================
   CAPITAL SERVICES — Scroll Animation Engine
   Intersection Observer-based reveal animations
   ================================================================ */

class ScrollAnimator {
  constructor(options = {}) {
    this.threshold = options.threshold || 0.15;
    this.rootMargin = options.rootMargin || '0px 0px -50px 0px';
    this.init();
  }

  init() {
    this.observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          
          if (entry.target.classList.contains('stagger-children')) {
            entry.target.classList.add('visible');
            Array.from(entry.target.children).forEach(child => {
              child.classList.add('visible');
            });
          }

          // Unobserve after reveal (one-time animation)
          this.observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: this.threshold,
      rootMargin: this.rootMargin
    });

    this.observe();
  }

  observe() {
    const selectors = [
      '.reveal',
      '.reveal-left',
      '.reveal-right',
      '.reveal-scale',
      '.stagger-children'
    ];

    selectors.forEach(selector => {
      document.querySelectorAll(selector).forEach(el => {
        this.observer.observe(el);
      });
    });
  }

  // Call this to add newly created elements to observation
  refresh() {
    this.observe();
  }
}

// Auto-initialize
document.addEventListener('DOMContentLoaded', () => {
  window.scrollAnimator = new ScrollAnimator();
});

export { ScrollAnimator };
