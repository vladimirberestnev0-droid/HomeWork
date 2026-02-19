// ===== sw.js =====
// Service Worker с офлайн режимом и кэшированием

const CACHE_NAME = 'workhom-v3';
const API_CACHE_NAME = 'workhom-api-v1';

const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/masters.html',
    '/client.html',
    '/chat.html',
    '/offline.html',
    '/css/main.css',
    '/js/core/constants.js',
    '/js/core/helpers.js',
    '/js/core/firebase.js',
    '/js/services/auth.js',
    '/js/services/orders.js',
    '/manifest.json',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css'
];

// Установка
self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(STATIC_ASSETS))
            .then(() => console.log('✅ Кэш загружен'))
    );
});

// Активация
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME && key !== API_CACHE_NAME)
                    .map(key => caches.delete(key))
            );
        }).then(() => self.clients.claim())
    );
});

// Стратегия: Stale-While-Revalidate для статики
// Network First для API
// Cache First для изображений
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // API запросы - сначала сеть, потом кэш
    if (url.pathname.startsWith('/api/') || 
        url.hostname.includes('firestore') ||
        url.hostname.includes('firebase')) {
        
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    const clone = response.clone();
                    caches.open(API_CACHE_NAME).then(cache => {
                        cache.put(event.request, clone);
                    });
                    return response;
                })
                .catch(() => caches.match(event.request))
        );
        return;
    }

    // Изображения - сначала кэш, потом сеть
    if (event.request.url.match(/\.(jpg|jpeg|png|gif|svg|webp)$/)) {
        event.respondWith(
            caches.match(event.request).then(response => {
                return response || fetch(event.request).then(networkResponse => {
                    const clone = networkResponse.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, clone);
                    });
                    return networkResponse;
                });
            })
        );
        return;
    }

    // HTML страницы - сначала сеть, при ошибке офлайн
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request)
                .catch(() => {
                    return caches.match('/offline.html');
                })
        );
        return;
    }

    // Всё остальное - Stale-While-Revalidate
    event.respondWith(
        caches.match(event.request).then(cached => {
            const fetchPromise = fetch(event.request)
                .then(networkResponse => {
                    if (networkResponse.status === 200) {
                        const clone = networkResponse.clone();
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(event.request, clone);
                        });
                    }
                    return networkResponse;
                })
                .catch(() => {
                    console.log('Офлайн режим для:', event.request.url);
                });

            return cached || fetchPromise;
        })
    );
});

// Фоновая синхронизация
self.addEventListener('sync', event => {
    if (event.tag === 'sync-orders') {
        event.waitUntil(syncOrders());
    }
    if (event.tag === 'sync-messages') {
        event.waitUntil(syncMessages());
    }
});

// Push уведомления
self.addEventListener('push', event => {
    const data = event.data.json();
    
    const options = {
        body: data.body,
        icon: '/icons/icon-192x192.png',
        badge: '/icons/badge.png',
        vibrate: [200, 100, 200],
        data: data,
        actions: [
            { action: 'open', title: '🔗 Открыть' },
            { action: 'close', title: '❌ Закрыть' }
        ]
    };

    event.waitUntil(
        self.registration.showNotification(data.title || 'ВоркХом', options)
    );
});

// Клик по уведомлению
self.addEventListener('notificationclick', event => {
    event.notification.close();
    
    if (event.action === 'open') {
        const url = event.notification.data.url || '/';
        event.waitUntil(
            clients.openWindow(url)
        );
    }
});

// Синхронизация заказов в офлайне
async function syncOrders() {
    const db = await openIndexedDB();
    const offlineOrders = await db.getAll('offlineOrders');
    
    for (const order of offlineOrders) {
        try {
            const response = await fetch('/api/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(order)
            });
            
            if (response.ok) {
                await db.delete('offlineOrders', order.id);
            }
        } catch (error) {
            console.error('Ошибка синхронизации заказа:', error);
        }
    }
}

// Синхронизация сообщений
async function syncMessages() {
    const db = await openIndexedDB();
    const offlineMessages = await db.getAll('offlineMessages');
    
    for (const msg of offlineMessages) {
        try {
            const response = await fetch(`/api/chats/${msg.chatId}/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(msg)
            });
            
            if (response.ok) {
                await db.delete('offlineMessages', msg.id);
            }
        } catch (error) {
            console.error('Ошибка синхронизации сообщения:', error);
        }
    }
}

// IndexedDB для офлайн данных
function openIndexedDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('WorkhomOffline', 1);
        
        request.onupgradeneeded = event => {
            const db = event.target.result;
            db.createObjectStore('offlineOrders', { keyPath: 'id' });
            db.createObjectStore('offlineMessages', { keyPath: 'id' });
        };
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}