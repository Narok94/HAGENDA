// Repetition is scheduled on the server, without client timers.
self.addEventListener('push', event => {
  let payload = {};
  try { payload = event.data?.json() || {}; } catch { payload = { body: event.data?.text() }; }
  event.waitUntil(self.registration.showNotification(payload.title || 'HAGENDA', {
    body: payload.body || 'Você tem uma atividade pendente.', icon: '/icon-180.png', badge: '/icon-180.png',
    tag: payload.tag || 'hagenda', renotify: true, data: payload.data || {},
    actions: payload.data?.token ? [{ action: 'confirm', title: 'Confirmar' }, { action: 'snooze', title: 'Adiar' }, { action: 'open', title: 'Abrir' }] : [{ action: 'open', title: 'Abrir' }]
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const data = event.notification.data || {};
  event.waitUntil((async () => {
    if (['confirm', 'snooze'].includes(event.action) && data.token) {
      try {
        const response = await fetch('/api/reminder-action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: event.action, token: data.token }) });
        if (!response.ok) throw new Error('action failed');
        const windows = await clients.matchAll({ type: 'window', includeUncontrolled: true });
        for (const client of windows) client.postMessage({ type: 'reminder-updated' });
        const notifications = await self.registration.getNotifications({ tag: event.notification.tag });
        for (const notification of notifications) notification.close();
        return;
      } catch { /* Open a visible retry flow. */ }
    }
    const url = new URL('/', self.location.origin);
    if (data.id) url.searchParams.set('activity', data.id);
    if (data.date) url.searchParams.set('date', data.date);
    if (data.token) url.hash = new URLSearchParams({ reminderToken: data.token }).toString();
    const windows = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if ('navigate' in client) { await client.navigate(url.href); return client.focus(); }
    }
    return clients.openWindow(url.href);
  })());
});
