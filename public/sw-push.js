// Service Worker para Push Notifications
// Versão 4.0.0 - Sistema novo e simplificado
const SW_VERSION = '4.0.0';

console.log('[SW] Service Worker carregado, versão:', SW_VERSION);

// Instalação do Service Worker
self.addEventListener('install', (event) => {
  console.log('[SW] Instalando versão:', SW_VERSION);
  self.skipWaiting();
});

// Ativação do Service Worker
self.addEventListener('activate', (event) => {
  console.log('[SW] Ativando versão:', SW_VERSION);
  event.waitUntil(self.clients.claim());
});

// Recebimento de Push Notification
self.addEventListener('push', (event) => {
  console.log('[SW] Push recebido!');
  
  let data = {
    title: 'Nova Notificação',
    body: 'Você tem uma nova mensagem',
    icon: '/logo.jpg',
    badge: '/pwa-192x192.png',
    url: '/dashboard'
  };

  try {
    if (event.data) {
      const parsed = event.data.json();
      data = { ...data, ...parsed };
      console.log('[SW] Dados do push:', data);
    }
  } catch (e) {
    console.error('[SW] Erro ao parsear dados:', e);
    if (event.data) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/logo.jpg',
    badge: data.badge || '/pwa-192x192.png',
    vibrate: [200, 100, 200],
    tag: 'notification-' + Date.now(),
    renotify: true,
    requireInteraction: true,
    data: {
      url: data.url || '/dashboard'
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
      .then(() => console.log('[SW] Notificação exibida com sucesso!'))
      .catch((err) => console.error('[SW] Erro ao exibir notificação:', err))
  );
});

// Clique na notificação
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notificação clicada');
  event.notification.close();

  const url = event.notification.data?.url || '/dashboard';
  
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});

// Responder a mensagens de diagnóstico
self.addEventListener('message', (event) => {
  if (event.data?.type === 'PING') {
    event.ports[0]?.postMessage({ type: 'PONG', version: SW_VERSION });
  }
});