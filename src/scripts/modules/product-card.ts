import { PRODUCT_QUANTITY_MAX } from '../../types/product';

const initialized = new WeakSet<HTMLFormElement>();

export function normalizeQuantity(value: string): number {
  if (!/^\d+$/.test(value)) return 1;
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(PRODUCT_QUANTITY_MAX, Math.max(1, number)) : 1;
}

/** Call again after CMS/AJAX insertion; existing forms keep their handlers. */
export function initProductCards(root: ParentNode = document) {
  const forms = Array.from(root.querySelectorAll<HTMLFormElement>('[data-product-form]'));
  if (root instanceof HTMLFormElement && root.matches('[data-product-form]')) forms.unshift(root);
  for (const form of forms) {
    if (initialized.has(form)) continue;
    const input = form.querySelector<HTMLInputElement>('[name="quantity"]');
    if (!input) continue;
    initialized.add(form);
    // Browser validation must not prevent normalization in the submit handler.
    form.noValidate = true;
    const enabled = () => form.dataset.purchaseEnabled === 'true' && !input.disabled;
    const normalize = () => { input.value = String(normalizeQuantity(input.value)); };
    input.addEventListener('change', normalize);
    input.addEventListener('blur', normalize);
    form.addEventListener('click', (event) => {
      const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('[data-quantity-step]') : null;
      if (!button || button.disabled || !enabled()) return;
      input.value = String(Math.min(PRODUCT_QUANTITY_MAX, Math.max(1, normalizeQuantity(input.value) + Number(button.dataset.quantityStep))));
    });
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!enabled()) return;
      normalize();
      const productId = new FormData(form).get('productId');
      form.dispatchEvent(new CustomEvent('product-card:demo-submit', {
        bubbles: true, detail: { productId: String(productId ?? ''), quantity: Number(input.value) },
      }));
    });
  }
}
