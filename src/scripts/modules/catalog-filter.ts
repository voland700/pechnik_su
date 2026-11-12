const initialized = new WeakSet<HTMLElement>();

export function initCatalogFilters() {
  document.querySelectorAll<HTMLElement>('[data-catalog-filter]').forEach(root => {
    if (initialized.has(root)) return;
    initialized.add(root);
    const form = root.querySelector<HTMLFormElement>('form')!;
    const dialog = Array.from(document.querySelectorAll<HTMLDialogElement>('[data-filter-dialog]')).find(el => el.dataset.filterDialog === root.id)!;
    // The dialog must be outside the sidebar hidden by the mobile layout.
    document.body.append(dialog);
    const home = document.createComment('catalog-filter home');
    root.before(home);
    const mobile = matchMedia('(max-width: 767.98px)');
    const triggers = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-filter-open]')).filter(el => el.dataset.filterOpen === root.id);
    let opener: HTMLButtonElement | undefined;
    let closing = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let previousOverflow = '';
    const restore = () => {
      clearTimeout(timer);
      closing = false;
      dialog.classList.remove('is-visible');
      document.body.style.overflow = previousOverflow;
      triggers.forEach(el => el.setAttribute('aria-expanded', 'false'));
      if (mobile.matches) opener?.focus();
    };
    const close = (immediate = false) => {
      if (!dialog.open || closing) return;
      closing = true;
      dialog.classList.remove('is-visible');
      const finish = () => dialog.close();
      if (immediate || matchMedia('(prefers-reduced-motion: reduce)').matches) finish();
      else timer = setTimeout(finish, 300);
    };
    const place = () => {
      if (mobile.matches) dialog.querySelector('[data-filter-mount]')!.append(root);
      else {
        close(true);
        home.after(root);
      }
    };
    triggers.forEach(trigger => trigger.addEventListener('click', () => {
      if (!mobile.matches || dialog.open) return;
      opener = trigger;
      previousOverflow = document.body.style.overflow;
      dialog.showModal();
      document.body.style.overflow = 'hidden';
      trigger.setAttribute('aria-expanded', 'true');
      requestAnimationFrame(() => dialog.classList.add('is-visible'));
      dialog.querySelector<HTMLButtonElement>('[data-filter-close]')!.focus();
    }));
    dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
    dialog.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); }
    });
    dialog.addEventListener('close', restore);
    dialog.querySelector('[data-filter-close]')!.addEventListener('click', () => close());
    dialog.addEventListener('click', event => { if (event.target === dialog) close(); });
    root.querySelector('[data-filter-apply]')!.addEventListener('click', () => close());
    form.addEventListener('submit', event => event.preventDefault());
    mobile.addEventListener('change', place);
    place();

    root.querySelectorAll<HTMLButtonElement>('[data-filter-toggle]').forEach(button => {
      const body = document.getElementById(button.getAttribute('aria-controls')!)!;
      button.addEventListener('click', () => {
        const open = button.getAttribute('aria-expanded') !== 'true';
        button.setAttribute('aria-expanded', String(open));
        body.inert = !open;
        body.classList.toggle('is-open', open);
      });
    });

    root.querySelectorAll<HTMLElement>('[data-filter-range]').forEach(range => {
      const numbers = Array.from(range.querySelectorAll<HTMLInputElement>('[data-range-number]'));
      const sliders = Array.from(range.querySelectorAll<HTMLInputElement>('[data-range-slider]'));
      const track = range.querySelector<HTMLElement>('[data-range-track]')!;
      const floor = Number(numbers[0].min), ceiling = Number(numbers[0].max);
      const sync = (index?: number, source?: HTMLInputElement) => {
        let low = Number(numbers[0].value), high = Number(numbers[1].value);
        if (source && index !== undefined) {
          const fallback = index === 0 ? floor : ceiling;
          const value = Math.max(floor, Math.min(ceiling, Number.isFinite(source.valueAsNumber) ? source.valueAsNumber : fallback));
          if (index === 0) low = Math.min(value, high);
          else high = Math.max(value, low);
        }
        numbers[0].value = sliders[0].value = String(low);
        numbers[1].value = sliders[1].value = String(high);
        sliders[0].setAttribute('aria-valuemax', String(high));
        sliders[1].setAttribute('aria-valuemin', String(low));
        const span = ceiling - floor || 1;
        track.style.setProperty('--range-start', `${(low - floor) / span * 100}%`);
        track.style.setProperty('--range-to', `${(high - floor) / span * 100}%`);
        // Keep the lower thumb reachable when both thumbs meet at the maximum.
        sliders[0].style.zIndex = low === ceiling ? '3' : '1';
      };
      numbers.forEach((input, index) => {
        input.addEventListener('change', () => sync(index, input));
        input.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); sync(index, input); } });
      });
      sliders.forEach((input, index) => input.addEventListener('input', () => sync(index, input)));
      form.addEventListener('reset', () => queueMicrotask(() => sync()));
      sync();
    });
  });
}
