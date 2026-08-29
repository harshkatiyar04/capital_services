/** Tap profile area to flip on touch devices (hover handles desktop). */
export function initTeamFlipCards() {
  if (window.matchMedia('(hover: hover)').matches) return;

  document.querySelectorAll('#team-leads .flip-card').forEach((card) => {
    const inner = card.querySelector('.flip-card-inner');
    if (!inner) return;

    inner.addEventListener('click', () => {
      const open = card.classList.contains('is-flipped');
      document.querySelectorAll('#team-leads .flip-card').forEach((c) => c.classList.remove('is-flipped'));
      if (!open) card.classList.add('is-flipped');
    });
  });
}
