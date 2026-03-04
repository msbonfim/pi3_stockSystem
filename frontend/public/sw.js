// Service Worker para Push Notifications

self.addEventListener('install', (event) => {
  console.log('Service Worker instalado');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker ativado');
  event.waitUntil(clients.claim());
});

// Listener para push notifications
self.addEventListener('push', (event) => {
  console.log('Push event recebido', event);

  let data = {
    title: 'StockSystem',
    body: 'Você tem uma nova notificação',
    icon: '/pwa-192x192.png',
    badge: '/pwa-64x64.png',
  };

  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body || data.message,
    icon: data.icon || '/pwa-192x192.png',
    badge: data.badge || '/pwa-64x64.png',
    data: data.data || {},
    tag: data.tag || 'notification',
    requireInteraction: data.requireInteraction || false,
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'StockSystem', options)
  );
});

// Listener para cliques em notificações
self.addEventListener('notificationclick', (event) => {
  console.log('Notificação clicada', event);

  event.notification.close();

  // Abre ou foca na janela da aplicação
  event.waitUntil(
    clients
      .matchAll({
        type: 'window',
        includeUncontrolled: true,
      })
      .then((clientList) => {
        // Se já existe uma janela aberta, foca nela
        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i];
          if (client.url === '/' && 'focus' in client) {
            return client.focus();
          }
        }
        // Caso contrário, abre uma nova janela
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      })
  );
});

