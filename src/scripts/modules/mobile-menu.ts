const initialized = new WeakSet<HTMLElement>();
export function initMobileMenus(): void {
  document.querySelectorAll<HTMLElement>('[data-header]').forEach(header => {
    if (initialized.has(header)) return;
    const opener = header.querySelector<HTMLButtonElement>('[data-menu-open]');
    const dialog = header.querySelector<HTMLDialogElement>('[data-mobile-menu]');
    const closer = dialog?.querySelector<HTMLButtonElement>('[data-menu-close]');
    if (!opener || !dialog || !closer) return;
    initialized.add(header);
    let scrollY = 0;
    let savedStyle = '';
    let closing = false;
    let closeTimer: ReturnType<typeof setTimeout>;
    const finishClose = () => {
      if (!dialog.open) return;
      clearTimeout(closeTimer);
      dialog.close();
    };
    const close = (immediate = false) => {
      if (!dialog.open || closing) return;
      closing = true;
      if (immediate || window.matchMedia('(prefers-reduced-motion: reduce)').matches) finishClose();
      else {
        dialog.classList.add('is-closing');
        closeTimer = setTimeout(finishClose, 300);
      }
    };
    opener.addEventListener('click', () => {
      if (dialog.open) return;
      scrollY = window.scrollY;
      savedStyle = document.body.style.cssText;
      const gutter = window.innerWidth - document.documentElement.clientWidth;
      const padding = Number.parseFloat(getComputedStyle(document.body).paddingRight) || 0;
      Object.assign(document.body.style, { position: 'fixed', top: `-${scrollY}px`, width: '100%', overflow: 'hidden', paddingRight: `${padding + gutter}px` });
      dialog.showModal();
      opener.setAttribute('aria-expanded', 'true');
      closer.focus();
    });
    closer.addEventListener('click', () => close());
    dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const bounds = dialog.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) close();
    });
    dialog.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.preventDefault(); close(); return; }
      if (event.key !== 'Tab') return;
      const focusable = [...dialog.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), [tabindex="0"]')].filter(element => element.getClientRects().length);
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    });
    dialog.addEventListener('close', () => {
      clearTimeout(closeTimer);
      closing = false;
      dialog.classList.remove('is-closing');
      document.body.style.cssText = savedStyle;
      window.scrollTo({ top: scrollY, behavior: 'instant' });
      opener.setAttribute('aria-expanded', 'false');
      if (opener.getClientRects().length) opener.focus({ preventScroll: true });
    });
    const desktop = window.matchMedia('(min-width: 1200px)');
    desktop.addEventListener('change', event => { if (event.matches) { closing = false; close(true); } });
  });
}
