/* Notifications locales (via le service worker si possible) et pastille sur l'icône */
export const canNotify = () => typeof Notification !== 'undefined';

export async function askPermission() {
  if (!canNotify()) return 'unsupported';
  if (Notification.permission !== 'default') return Notification.permission;
  try { return await Notification.requestPermission(); } catch { return 'denied'; }
}

export async function notify(title, body) {
  if (!canNotify() || Notification.permission !== 'granted') return false;
  const opts = { body, icon: './apple-touch-icon.png', badge: './apple-touch-icon.png', tag: 'fokus-' + title };
  try {
    const reg = await navigator.serviceWorker?.getRegistration?.();
    if (reg) { await reg.showNotification(title, opts); return true; }
    new Notification(title, opts);
    return true;
  } catch { return false; }
}

/* Pastille sur l'icône de l'app (API Badging, si disponible) */
export function setBadge(n) {
  try {
    if (n > 0) navigator.setAppBadge?.(n)?.catch?.(() => {});
    else navigator.clearAppBadge?.()?.catch?.(() => {});
  } catch { /* non supporté */ }
}

/* Vibration courte (Android ; ignorée silencieusement sur iPhone) */
export function buzz(ms = 15) {
  try { navigator.vibrate?.(ms); } catch { /* non supporté */ }
}
