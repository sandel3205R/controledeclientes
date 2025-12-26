// Service Worker for Push Notifications
// Version 3.0.0 - Fixed for correct scope and push handling
const SW_VERSION = '3.0.0';

self.addEventListener('install', function(event) {
  console.log('[SW Push] Installing version:', SW_VERSION);
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  console.log('[SW Push] Activating version:', SW_VERSION);
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', function(event) {
  console.log('[SW Push] Push event received!');
  
  let data = {
    title: '⚠️ Vencimento Próximo',
    body: 'Você tem clientes com assinatura expirando!',
    icon: '/logo.jpg',
    badge: '/pwa-192x192.png',
    url: '/clients',
    tag: 'expiration-alert',
    clients: [],
    daysRemaining: 0,
    totalAmount: 0,
    test: false
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      data = { ...data, ...parsed };
      console.log('[SW Push] Parsed data:', data);
    } catch (e) {
      console.error('[SW Push] Error parsing push data:', e);
      try {
        data.body = event.data.text();
      } catch (e2) {
        console.error('[SW Push] Error getting text:', e2);
      }
    }
  }

  // Build notification title based on urgency
  let title = data.title;
  let urgency = 'normal';
  
  if (data.test) {
    title = '🧪 Teste de Notificação';
    urgency = 'test';
  } else if (data.daysRemaining === 0) {
    title = '🔴 Vencido Hoje!';
    urgency = 'critical';
  } else if (data.daysRemaining === 1) {
    title = '🟠 Vencimento Amanhã!';
    urgency = 'high';
  } else if (data.daysRemaining <= 3) {
    title = `⚠️ Vencimento em ${data.daysRemaining} dias`;
    urgency = 'medium';
  }

  const options = {
    body: data.body,
    icon: data.icon || '/logo.jpg',
    badge: data.badge || '/pwa-192x192.png',
    vibrate: urgency === 'critical' ? [200, 100, 200, 100, 200] : [100, 50, 100],
    tag: data.tag || 'expiration-alert',
    renotify: true,
    requireInteraction: urgency === 'critical' || urgency === 'high',
    data: {
      url: data.url || '/clients',
      clients: data.clients || [],
      daysRemaining: data.daysRemaining,
      urgency: urgency
    },
    actions: [
      { 
        action: 'view', 
        title: '👁️ Ver Detalhes'
      },
      { 
        action: 'dismiss', 
        title: '❌ Fechar'
      }
    ]
  };

  console.log('[SW Push] Showing notification:', title, options);

  event.waitUntil(
    self.registration.showNotification(title, options)
      .then(() => {
        console.log('[SW Push] Notification shown successfully!');
        // Update badge count
        if ('setAppBadge' in navigator) {
          const count = data.clients?.length || 1;
          navigator.setAppBadge(count).catch(err => console.log('[SW Push] Badge error:', err));
        }
      })
      .catch(err => {
        console.error('[SW Push] Failed to show notification:', err);
      })
  );
});

self.addEventListener('notificationclick', function(event) {
  console.log('[SW Push] Notification clicked:', event.action);
  
  event.notification.close();

  // Clear badge on interaction
  if ('clearAppBadge' in navigator) {
    navigator.clearAppBadge().catch(() => {});
  }

  if (event.action === 'dismiss') {
    return;
  }

  const urlToOpen = event.notification.data?.url || '/clients';
  const fullUrl = new URL(urlToOpen, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // Check if there's already a window open
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.navigate(fullUrl).then(() => client.focus());
        }
      }
      // Open a new window if none exists
      if (self.clients.openWindow) {
        return self.clients.openWindow(fullUrl);
      }
    })
  );
});

self.addEventListener('notificationclose', function(event) {
  console.log('[SW Push] Notification closed');
});

// Message handler for diagnostics
self.addEventListener('message', function(event) {
  console.log('[SW Push] Message received:', event.data);
  
  if (event.data && event.data.type === 'PING') {
    event.ports[0].postMessage({ type: 'PONG', version: SW_VERSION });
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: SW_VERSION });
  }
});

console.log('[SW Push] Service Worker loaded, version:', SW_VERSION);
