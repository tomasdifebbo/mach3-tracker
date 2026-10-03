// Service Worker para Notificações Push PWA do Mach3 Tracker
const CACHE_NAME = 'mach3-tracker-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Manipulador do evento de Push recebido do servidor
self.addEventListener('push', (event) => {
  let data = {
    title: '🔔 Corte Concluído - Mach3 Tracker',
    body: 'Um trabalho de corte acabou de ser finalizado.',
    url: '/history'
  };

  if (event.data) {
    try {
      data = event.data.json();
    } catch (err) {
      data.body = event.data.text();
    }
  }

  const title = data.title || '🔔 Corte Concluído - Mach3 Tracker';
  const options = {
    body: data.body || 'Corte finalizado na máquina.',
    icon: data.icon || '/icon-192.png',
    badge: data.badge || '/icon-192.png',
    vibrate: [300, 100, 300, 100, 400],
    data: {
      url: data.url || '/history'
    },
    tag: data.tag || 'mach3-job-completed',
    renotify: true,
    requireInteraction: true,
    actions: [
      { action: 'open_dashboard', title: 'Ver Painel' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Ação ao clicar na notificação
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = (event.notification.data && event.notification.data.url) 
    ? event.notification.data.url 
    : '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Se houver alguma aba aberta, foca nela
      for (const client of clientList) {
        if (client.url && client.url.includes(self.location.origin) && 'focus' in client) {
          if ('navigate' in client && targetUrl !== '/') {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      // Se não houver aba aberta, abre uma nova janela/app
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
