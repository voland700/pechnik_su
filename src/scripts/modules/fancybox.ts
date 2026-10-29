import { Fancybox } from '@fancyapps/ui/dist/fancybox/';
let bound = false;
export function initFancybox() {
  if (bound || !document.querySelector('[data-fancybox]')) return;
  Fancybox.bind('[data-fancybox]', {});
  bound = true;
}
