// Service Worker for HAGENDA Push Notifications

self.addEventListener('push', (event) => {
  let data = {
    title: 'HAGENDA',
    body: 'Você tem uma nova atualização!',
    icon: '/icon-180.png',
    badge: '/icon-180.png',
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      data = {
        title: parsed.title || data.title,
        body: parsed.body || parsed.message || data.body,
        icon: parsed.icon || data.icon,
        badge: parsed.badge || data.badge,
        tag: parsed.tag,
        data: parsed.data || {}
      };
    } catch (e) {
      // If it is not JSON, use the raw text payload
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon,
    badge: data.badge,
    vibrate: [100, 50, 100],
    data: data.data || {},
    tag: data.tag || 'hagenda-notification',
    actions: [
      { action: 'open', title: 'Abrir HAGENDA' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  // Handle click action
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus on an existing open window/tab
      for (const client of clientList) {
        if ('focus' in client) {
          return client.focus();
        }
      }
      // Or open a new tab if none are open
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
