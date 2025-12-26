// Service Worker for Push Notifications with Actions
const SW_VERSION = '2.0.0';

self.addEventListener('install', function(event) {
  console.log('[SW] Installing version:', SW_VERSION);
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  console.log('[SW] Activating version:', SW_VERSION);
  event.waitUntil(clients.claim());
});

self.addEventListener('push', function(event) {
  console.log('[SW] Push received:', event);
  
  let data = {
    title: '⚠️ Vencimento Próximo',
    body: 'Você tem clientes com assinatura expirando!',
    icon: '/logo.jpg',
    badge: '/pwa-192x192.png',
    url: '/clients',
    tag: 'expiration-alert',
    clients: [],
    daysRemaining: 0,
    totalAmount: 0
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      data = { ...data, ...parsed };
    } catch (e) {
      console.error('[SW] Error parsing push data:', e);
    }
  }

  // Build notification title based on urgency
  let title = data.title;
  let urgency = 'normal';
  
  if (data.daysRemaining === 0) {
    title = '🔴 Vencido Hoje!';
    urgency = 'critical';
  } else if (data.daysRemaining === 1) {
    title = '🟠 Vencimento Amanhã!';
    urgency = 'high';
  } else if (data.daysRemaining <= 3) {
    title = `⚠️ Vencimento em ${data.daysRemaining} dias`;
    urgency = 'medium';
  }

  // Build body with client details
  let body = data.body;
  if (data.totalAmount > 0) {
    body += ` - R$ ${data.totalAmount.toFixed(2).replace('.', ',')}`;
  }

  const options = {
    body: body,
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
        title: '👁️ Ver Detalhes',
        icon: '/pwa-192x192.png'
      },
      { 
        action: 'dismiss', 
        title: '❌ Dispensar',
        icon: '/pwa-192x192.png'
      }
    ]
  };

  // Add sound for critical notifications (via vibration pattern)
  if (urgency === 'critical') {
    options.silent = false;
  }

  event.waitUntil(
    self.registration.showNotification(title, options)
      .then(() => {
        // Update badge count
        if ('setAppBadge' in navigator) {
          const count = data.clients?.length || 1;
          navigator.setAppBadge(count).catch(console.error);
        }
      })
  );
});

self.addEventListener('notificationclick', function(event) {
  console.log('[SW] Notification clicked:', event.action);
  
  event.notification.close();

  // Clear badge on interaction
  if ('clearAppBadge' in navigator) {
    navigator.clearAppBadge().catch(console.error);
  }

  if (event.action === 'dismiss') {
    return;
  }

  const urlToOpen = event.notification.data?.url || '/clients';
  const fullUrl = new URL(urlToOpen, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // Check if there's already a window open
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.navigate(fullUrl).then(() => client.focus());
        }
      }
      // Open a new window if none exists
      if (clients.openWindow) {
        return clients.openWindow(fullUrl);
      }
    })
  );
});

// Handle notification close
self.addEventListener('notificationclose', function(event) {
  console.log('[SW] Notification closed');
});

// Periodic background sync for checking expirations (when supported)
self.addEventListener('periodicsync', function(event) {
  if (event.tag === 'check-expirations') {
    console.log('[SW] Periodic sync: check-expirations');
    event.waitUntil(checkExpirations());
  }
});

async function checkExpirations() {
  // This would typically call the edge function to check expirations
  console.log('[SW] Checking expirations in background...');
}
