/**
 * Before → worker video → after, shared by every restoration card.
 * The source MP4 is longer than the transition; playback stops at CUTOFF_SEC.
 */
const WORKER_VIDEO =
  'https://res.cloudinary.com/foxrj3tm/video/upload/v1790968850/gemini_generated_video_ec2cad83_gwr_video_mvp.mp4';

const CUTOFF_SEC = 5;
const RESET_MS = 700;

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function canHover() {
  return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
}

function initPerilRestore(root = document) {
  root.querySelectorAll('.peril-card-image').forEach((container) => {
    const overlay = container.querySelector('.peril-worker-overlay');
    const video = container.querySelector('.peril-restore-video');
    if (!overlay || !video) return;

    const src = container.dataset.restoreVideo || WORKER_VIDEO;
    let resetTimer = null;
    let fallbackTimer = null;
    let isActive = false;
    let session = 0;
    let srcReady = false;

    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.loop = false;
    video.controls = false;
    video.setAttribute('muted', '');
    video.setAttribute('playsinline', '');
    video.removeAttribute('controls');
    video.preload = 'none';

    const title = container.closest('.peril-card')?.querySelector('h4')?.textContent?.trim();
    if (!container.hasAttribute('tabindex')) container.tabIndex = 0;
    container.setAttribute('role', 'button');
    container.setAttribute(
      'aria-label',
      title ? `Show restoration for ${title}` : 'Show restoration',
    );

    const ensureSrc = () => {
      if (srcReady) return;
      video.preload = 'metadata';
      video.src = src;
      srcReady = true;
    };

    const clearTimers = () => {
      clearTimeout(resetTimer);
      clearTimeout(fallbackTimer);
      resetTimer = null;
      fallbackTimer = null;
    };

    const stopVideo = () => {
      session += 1;
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.pause();
      try {
        video.currentTime = 0;
      } catch (_) {
        /* ignore until metadata exists */
      }
    };

    const revealAfter = () => {
      if (!isActive || container.classList.contains('show-after')) return;
      video.removeEventListener('timeupdate', onTimeUpdate);
      clearTimeout(fallbackTimer);
      fallbackTimer = null;
      video.pause();
      container.classList.remove('is-animating');
      container.classList.add('show-after');
    };

    function onTimeUpdate() {
      if (!isActive) return;
      if (video.currentTime < CUTOFF_SEC) return;
      video.pause();
      if (video.currentTime > CUTOFF_SEC) {
        try {
          video.currentTime = CUTOFF_SEC;
        } catch (_) {
          /* keep the paused frame */
        }
      }
      revealAfter();
    }

    const start = () => {
      clearTimers();
      if (isActive) return;
      isActive = true;
      container.classList.remove('is-resetting', 'show-after');

      if (prefersReducedMotion()) {
        container.classList.add('show-after');
        return;
      }

      container.classList.add('is-animating');
      ensureSrc();

      const token = ++session;
      video.loop = false;
      video.playbackRate = 1;
      try {
        video.currentTime = 0;
      } catch (_) {
        /* metadata may not be ready yet */
      }

      const onEnded = () => {
        if (token === session) revealAfter();
      };
      video.addEventListener('ended', onEnded, { once: true });
      video.addEventListener('timeupdate', onTimeUpdate);
      const playPromise = video.play();
      if (playPromise && typeof playPromise.then === 'function') {
        playPromise
          .then(() => {
            if (token !== session) {
              video.pause();
              try {
                video.currentTime = 0;
              } catch (_) {}
            }
          })
          .catch(() => {
            if (token === session) revealAfter();
          });
      }

      // Safety only. The real cutoff is video.currentTime, not wall-clock time.
      fallbackTimer = setTimeout(() => {
        if (token === session && isActive && !container.classList.contains('show-after')) {
          revealAfter();
        }
      }, 12000);
    };

    const reset = () => {
      clearTimers();
      container.classList.remove('is-animating', 'show-after');
      stopVideo();
      container.classList.add('is-resetting');
      isActive = false;
      resetTimer = setTimeout(() => {
        container.classList.remove('is-resetting');
      }, RESET_MS);
    };

    container.addEventListener('pointerenter', (event) => {
      if (event.pointerType && event.pointerType !== 'mouse') return;
      if (!canHover()) return;
      start();
    });

    container.addEventListener('pointerleave', (event) => {
      if (event.pointerType && event.pointerType !== 'mouse') return;
      if (!canHover()) return;
      reset();
    });

    container.addEventListener('click', () => {
      if (canHover()) return;
      if (isActive) reset();
      else start();
    });

    container.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        if (isActive) reset();
        else start();
      } else if (event.key === 'Escape' && isActive) {
        reset();
      }
    });

    container.addEventListener('blur', () => {
      if (isActive && document.activeElement !== container) reset();
    });
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => initPerilRestore());
} else {
  initPerilRestore();
}
