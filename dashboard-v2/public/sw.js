// Service Worker para Notificações Push PWA do Mach3 Tracker
const CACHE_NAME = 'mach3-tracker-v2';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Manipulador do evento de Push recebido do servidor (Alta Prioridade)
self.addEventListener('push', (event) => {
  let data = {
    title: '🔔 Corte Concluído - Mach3 Tracker',
    body: 'Um trabalho de corte acabou de ser finalizado.',
    url: '/history',
    job_id: Date.now()
  };

  if (event.data) {
    try {
      data = event.data.json();
    } catch (err) {
      data.body = event.data.text();
    }
  }

  const title = data.title || '🔔 Corte Concluído - Mach3 Tracker';
  const uniqueTag = data.tag || `mach3-job-${data.job_id || Date.now()}`;

  const options = {
    body: data.body || 'Corte finalizado na máquina.',
    icon: data.icon || '/icon-192.png',
    badge: data.badge || '/icon-192.png',
    // Padrão de vibração dinâmico no estilo WhatsApp / Mensageiro (dois toques rápidos)
    vibrate: [200, 100, 200, 100, 350],
    data: {
      url: data.url || '/history',
      job_id: data.job_id,
      timestamp: data.timestamp || Date.now()
    },
    tag: uniqueTag,
    renotify: true,
    // requireInteraction false permite que o banner desça no topo do Android e retraia sozinho após 4 segundos (estilo WhatsApp)
    requireInteraction: false,
    silent: false,
    actions: [
      { action: 'open_dashboard', title: 'Ver Painel' }
    ]
  };

  // Notifica também qualquer aba aberta para disparar alarme sonoro instantâneo e atualizar os dados
  const notifyClientsPromise = clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
    for (const client of clientList) {
      client.postMessage({
        type: 'MACH3_JOB_COMPLETED',
        payload: data
      });
    }
  });

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, options),
      notifyClientsPromise
    ])
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
      // Se houver alguma aba aberta, foca nela e navega
      for (const client of clientList) {
        if (client.url && client.url.includes(self.location.origin) && 'focus' in client) {
          if ('navigate' in client && targetUrl !== '/') {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      // Se não houver aba aberta, abre uma nova janela/PWA
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// Auto-renovação de subscrição caso o navegador/Android altere o token em segundo plano
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    fetch('/api/push/vapid-public-key')
      .then((res) => res.json())
      .then((keyData) => {
        if (!keyData || !keyData.publicKey) return null;
        return self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: keyData.publicKey
        });
      })
      .then((newSubscription) => {
        if (!newSubscription) return null;
        return fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscription: newSubscription })
        });
      })
      .catch((err) => console.error('[SW] Erro ao renovar token push:', err))
  );
});
