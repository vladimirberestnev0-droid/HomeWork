importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Версионирование кэша с датой для автоматического обновления
const CACHE_NAME = 'workhom-v' + new Date().toISOString().split('T')[0].replace(/-/g, ''); // например workhom-v20250321

const urlsToCache = [
    '/',
    '/index.html',
    '/masters.html',
    '/client.html',
    '/chat.html',
    '/group-chat.html',
    '/admin.html',
    '/css/main.css',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css',
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap'
];

self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('✅ Кэширование статики');
                return cache.addAll(urlsToCache);
            })
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.filter(name => name !== CACHE_NAME)
                    .map(name => {
                        console.log('🗑️ Удаление старого кэша:', name);
                        return caches.delete(name);
                    })
            );
        }).then(() => {
            return self.clients.claim();
        })
    );
});

self.addEventListener('fetch', event => {
    // Не кэшируем запросы к API
    if (event.request.url.includes('firestore.googleapis.com') ||
        event.request.url.includes('firebase') ||
        event.request.url.includes('yandex')) {
        event.respondWith(fetch(event.request));
        return;
    }

    event.respondWith(
        caches.open(CACHE_NAME).then(cache => {
            return cache.match(event.request).then(cachedResponse => {
                const fetchPromise = fetch(event.request).then(networkResponse => {
                    if (networkResponse.status === 200) {
                        cache.put(event.request, networkResponse.clone());
                    }
                    return networkResponse;
                }).catch(() => {
                    console.log('🌐 Офлайн режим для:', event.request.url);
                });
                
                return cachedResponse || fetchPromise;
            });
        })
    );
});

firebase.initializeApp({
    apiKey: "AIzaSyCQrxCTXNBS4sEyR_ElZ3dXRkkK9kEYTTQ",
    authDomain: "homework-6a562.firebaseapp.com",
    projectId: "homework-6a562",
    storageBucket: "homework-6a562.firebasestorage.app",
    messagingSenderId: "3651366285",
    appId: "1:3651366285:web:8b1a73dfdf717eb582e1c4"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
    console.log('📨 Фоновое уведомление:', payload);
    
    const notificationTitle = payload.notification?.title || 'ВоркХом';
    const notificationOptions = {
        body: payload.notification?.body || 'Новое уведомление',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/badge.png',
        data: payload.data,
        actions: [
            { action: 'open', title: '🔗 Открыть' },
            { action: 'close', title: '❌ Закрыть' }
        ],
        vibrate: [200, 100, 200],
        requireInteraction: true,
        silent: false,
        tag: 'workhom-notification'
    };

    return self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    
    if (event.action === 'open') {
        const urlToOpen = event.notification.data?.url || '/';
        event.waitUntil(
            clients.matchAll({ type: 'window' }).then(windowClients => {
                for (let client of windowClients) {
                    if (client.url === urlToOpen && 'focus' in client) {
                        return client.focus();
                    }
                }
                return clients.openWindow(urlToOpen);
            })
        );
    }
});