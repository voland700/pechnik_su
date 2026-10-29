import type { SweetAlertOptions } from 'sweetalert2';
let library: Promise<typeof import('sweetalert2')> | undefined;
export async function notify(options: SweetAlertOptions) {
  library ??= import('sweetalert2/dist/sweetalert2.js');
  const { default: Swal } = await library;
  return Swal.fire({ confirmButtonText: 'Понятно', ...options });
}
const bound = new WeakSet<HTMLButtonElement>();
export function initAlerts(root: ParentNode = document) {
  root.querySelectorAll<HTMLButtonElement>('[data-demo-alert]').forEach((button) => {
    if (bound.has(button)) return;
    button.addEventListener('click', async () => {
      button.disabled = true;
      try {
        await notify({ icon: 'success', title: 'Всё работает', text: 'Локальные ресурсы и модуль уведомлений подключены.' });
      } catch (error) {
        console.error('Notification failed', error);
      } finally { button.disabled = false; }
    });
    bound.add(button);
  });
}
