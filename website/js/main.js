/* ================================================================
   CAPITAL SERVICES — Main JS
   Navigation, scroll effects, global functionality
   ================================================================ */

import { initTestimonialsCarousel } from './testimonials-carousel.js';
import { initChatbot } from './chatbot.js';

document.addEventListener('DOMContentLoaded', () => {
  initNavbar();
  initMobileNav();
  initSmoothScroll();
  initChatbot();
  setActiveNavLink();
  initTestimonialsCarousel();
});

/* ── Sticky Navbar ── */
function initNavbar() {
  const navbar = document.querySelector('.navbar');
  if (!navbar) return;

  let lastScrollY = 0;
  let ticking = false;

  function updateNavbar() {
    const scrollY = window.scrollY;
    
    if (scrollY > 60) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }

    lastScrollY = scrollY;
    ticking = false;
  }

  updateNavbar();

  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(updateNavbar);
      ticking = true;
    }
  }, { passive: true });
}

/* ── Mobile Navigation ── */
function initMobileNav() {
  const hamburger = document.querySelector('.hamburger');
  const mobileNav = document.querySelector('.mobile-nav');
  if (!hamburger || !mobileNav) return;

  hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('active');
    mobileNav.classList.toggle('active');
    document.body.style.overflow = mobileNav.classList.contains('active') ? 'hidden' : '';
  });

  // Close on link click
  mobileNav.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      hamburger.classList.remove('active');
      mobileNav.classList.remove('active');
      document.body.style.overflow = '';
    });
  });
}

/* ── Smooth Scroll for anchor links ── */
function scrollToHashTarget(hash, behavior) {
  const id = decodeURIComponent((hash || '').replace(/^#/, ''));
  if (!id) return false;
  const target = document.getElementById(id);
  if (!target) return false;
  const y = target.getBoundingClientRect().top + window.scrollY - 120;
  window.scrollTo({ top: Math.max(0, y), behavior });
  return true;
}

function initSmoothScroll() {
  document.querySelectorAll('a[href*="#"]').forEach((anchor) => {
    anchor.addEventListener('click', (e) => {
      const href = anchor.getAttribute('href') || '';
      const hashIndex = href.indexOf('#');
      if (hashIndex < 0) return;
      const hash = href.slice(hashIndex);
      if (hash === '#') return;
      const path = href.slice(0, hashIndex);
      const page = location.pathname.split('/').pop() || 'index.html';
      const samePage = !path || path === page || path === location.pathname;
      if (!samePage || !document.getElementById(hash.slice(1))) return;
      e.preventDefault();
      scrollToHashTarget(hash, 'smooth');
      history.pushState(null, '', hash);
    });
  });

  window.addEventListener('load', () => {
    const id = decodeURIComponent((location.hash || '').replace(/^#/, ''));
    const target = id && document.getElementById(id);
    if (!target) return;
    const place = () => scrollToHashTarget(location.hash, 'auto');
    place();
    let ticks = 0;
    const timer = setInterval(() => {
      ticks += 1;
      const top = target.getBoundingClientRect().top;
      if (Math.abs(top - 120) > 40) place();
      if (ticks >= 8) clearInterval(timer);
    }, 200);
  });
}

/* ── Set Active Nav Link ── */
function setActiveNavLink() {
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  const navLinks = document.querySelectorAll('.navbar .nav-link, .mobile-nav .nav-link');

  navLinks.forEach(link => {
    const href = link.getAttribute('href');
    if (href === currentPage || (currentPage === '' && href === 'index.html') || (currentPage === 'index.html' && href === 'index.html')) {
      link.classList.add('active');
    }
  });
}

/* ── Export for module usage ── */
export { initNavbar, initMobileNav, initChatbot };
