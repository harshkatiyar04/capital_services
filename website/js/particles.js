/* ================================================================
   CAPITAL SERVICES — Particle Effect
   Ambient floating particles for hero sections
   ================================================================ */

class ParticleField {
  constructor(canvasId = 'particles-canvas', options = {}) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;

    this.ctx = this.canvas.getContext('2d');
    this.particles = [];
    this.mouse = { x: -1000, y: -1000 };
    this.animationId = null;

    this.config = {
      count: options.count || 60,
      color: options.color || '245, 166, 35',
      maxSize: options.maxSize || 3,
      speed: options.speed || 0.3,
      connectDistance: options.connectDistance || 120,
      mouseRadius: options.mouseRadius || 150,
      ...options
    };

    this.init();
  }

  init() {
    this.resize();
    this.createParticles();
    this.addEventListeners();
    this.animate();
  }

  resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.canvas.width = rect.width;
    this.canvas.height = rect.height;
  }

  createParticles() {
    this.particles = [];
    for (let i = 0; i < this.config.count; i++) {
      this.particles.push({
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height,
        size: Math.random() * this.config.maxSize + 0.5,
        speedX: (Math.random() - 0.5) * this.config.speed,
        speedY: (Math.random() - 0.5) * this.config.speed,
        opacity: Math.random() * 0.5 + 0.1,
      });
    }
  }

  addEventListeners() {
    window.addEventListener('resize', () => {
      this.resize();
      this.createParticles();
    });

    this.canvas.parentElement.addEventListener('mousemove', (e) => {
      const rect = this.canvas.parentElement.getBoundingClientRect();
      this.mouse.x = e.clientX - rect.left;
      this.mouse.y = e.clientY - rect.top;
    });

    this.canvas.parentElement.addEventListener('mouseleave', () => {
      this.mouse.x = -1000;
      this.mouse.y = -1000;
    });
  }

  animate() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.particles.forEach((p, i) => {
      // Move
      p.x += p.speedX;
      p.y += p.speedY;

      // Wrap around edges
      if (p.x > this.canvas.width) p.x = 0;
      if (p.x < 0) p.x = this.canvas.width;
      if (p.y > this.canvas.height) p.y = 0;
      if (p.y < 0) p.y = this.canvas.height;

      // Mouse interaction — gentle push
      const dx = this.mouse.x - p.x;
      const dy = this.mouse.y - p.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < this.config.mouseRadius) {
        const angle = Math.atan2(dy, dx);
        const force = (this.config.mouseRadius - dist) / this.config.mouseRadius;
        p.x -= Math.cos(angle) * force * 1.5;
        p.y -= Math.sin(angle) * force * 1.5;
      }

      // Draw particle
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      this.ctx.fillStyle = `rgba(${this.config.color}, ${p.opacity})`;
      this.ctx.fill();

      // Connect nearby particles
      for (let j = i + 1; j < this.particles.length; j++) {
        const p2 = this.particles[j];
        const d = Math.sqrt(
          (p.x - p2.x) ** 2 + (p.y - p2.y) ** 2
        );

        if (d < this.config.connectDistance) {
          const alpha = (1 - d / this.config.connectDistance) * 0.15;
          this.ctx.beginPath();
          this.ctx.moveTo(p.x, p.y);
          this.ctx.lineTo(p2.x, p2.y);
          this.ctx.strokeStyle = `rgba(${this.config.color}, ${alpha})`;
          this.ctx.lineWidth = 0.5;
          this.ctx.stroke();
        }
      }
    });

    this.animationId = requestAnimationFrame(() => this.animate());
  }

  destroy() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
  }
}

// Auto-initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('particles-canvas');
  if (canvas) {
    window.particleField = new ParticleField('particles-canvas');
  }
});

export { ParticleField };
