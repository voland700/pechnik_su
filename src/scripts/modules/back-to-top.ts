let initialized = false;

export function initBackToTop() {
  const button = document.querySelector<HTMLButtonElement>('[data-back-to-top]');
  if (!button || initialized) return;
  initialized = true;

  let scheduled = false;
  const update = () => {
    scheduled = false;
    const distance = document.documentElement.scrollHeight - window.innerHeight;
    button.hidden = distance <= 0 || window.scrollY < distance * 0.5;
  };
  const scheduleUpdate = () => {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(update);
  };

  window.addEventListener('scroll', scheduleUpdate, { passive: true });
  window.addEventListener('resize', scheduleUpdate);
  // Images and expanded content can change the halfway point after page load.
  new ResizeObserver(scheduleUpdate).observe(document.body);
  button.addEventListener('click', () => {
    document.getElementById('main')?.focus({ preventScroll: true });
    window.scrollTo({
      top: 0,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    });
  });
  update();
}
