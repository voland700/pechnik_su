const initialized = new WeakSet<HTMLElement>();

export function initFeaturedProductsTabs(root: ParentNode = document) {
  const instances = Array.from(root.querySelectorAll<HTMLElement>('[data-featured-tabs]'));
  if (root instanceof HTMLElement && root.matches('[data-featured-tabs]')) instances.unshift(root);
  for (const instance of instances) {
    if (initialized.has(instance)) continue;
    const navigation = instance.querySelector<HTMLElement>('[role="tablist"]');
    const tabs = Array.from(instance.querySelectorAll<HTMLButtonElement>('[data-featured-tab]'));
    const panels = Array.from(instance.querySelectorAll<HTMLElement>('[data-featured-panel]'));
    if (!navigation || !tabs.length || tabs.length !== panels.length) continue;
    initialized.add(instance);
    const activate = (index: number, focus = false) => {
      tabs.forEach((tab, i) => {
        const active = i === index;
        tab.classList.toggle('active', active);
        tab.setAttribute('aria-selected', String(active));
        tab.tabIndex = active ? 0 : -1;
        panels[i].hidden = !active;
        panels[i].classList.toggle('behold', active);
      });
      const tab = tabs[index];
      if (focus) tab.focus({ preventScroll: true });
      // Scroll only the navigation; never move the document vertically.
      const bounds = navigation.getBoundingClientRect();
      const rect = tab.getBoundingClientRect();
      const padding = 4;
      const delta = rect.left < bounds.left + padding ? rect.left - bounds.left - padding
        : rect.right > bounds.right - padding ? rect.right - bounds.right + padding : 0;
      if (delta) navigation.scrollBy({ left: delta, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    };
    navigation.addEventListener('click', event => {
      const tab = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('[data-featured-tab]') : null;
      const index = tab ? tabs.indexOf(tab) : -1;
      if (index >= 0) activate(index);
    });
    navigation.addEventListener('keydown', event => {
      const index = tabs.indexOf(event.target as HTMLButtonElement);
      if (index < 0) return;
      const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length
        : event.key === 'ArrowLeft' ? (index - 1 + tabs.length) % tabs.length
        : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : -1;
      if (next < 0) return;
      event.preventDefault();
      activate(next, true);
    });
    activate(Math.max(0, tabs.findIndex(tab => tab.getAttribute('aria-selected') === 'true')));
  }
}
