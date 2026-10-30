import { initMobileMenus } from './mobile-menu';
import { initWorkingHours } from './working-hours';
export function initHeader(): void {
  initMobileMenus();
  initWorkingHours();
}
