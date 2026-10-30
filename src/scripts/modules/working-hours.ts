const formatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Moscow', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});
export function getWorkingState(date = new Date()): { open: boolean; nextUpdate: number } {
  const parts = formatter.formatToParts(date);
  const value = (type: string) => Number(parts.find(part => part.type === type)?.value ?? 0);
  const seconds = value('hour') * 3600 + value('minute') * 60 + value('second');
  const open = seconds >= 9 * 3600 && seconds < 18 * 3600;
  const boundary = seconds < 9 * 3600 ? 9 * 3600 : seconds < 18 * 3600 ? 18 * 3600 : 33 * 3600;
  return { open, nextUpdate: (boundary - seconds) * 1000 - date.getMilliseconds() + 50 };
}
let initialized = false;
let refresh: (() => void) | undefined;
export function initWorkingHours(): void {
  if (initialized) { refresh?.(); return; }
  initialized = true;
  let timer: ReturnType<typeof setTimeout>;
  const update = () => {
    clearTimeout(timer);
    const { open, nextUpdate } = getWorkingState();
    document.querySelectorAll<HTMLElement>('[data-working-status]').forEach(status => {
      status.textContent = open ? 'Сейчас работаем' : 'Магазин закрыт';
      status.dataset.open = String(open);
      status.hidden = false;
    });
    timer = setTimeout(update, nextUpdate);
  };
  refresh = update;
  document.addEventListener('visibilitychange', () => { if (!document.hidden) update(); });
  window.addEventListener('pageshow', update);
  window.addEventListener('focus', update);
  update();
}
