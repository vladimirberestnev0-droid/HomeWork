// firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Кэширование статики
const CACHE_NAME = 'workhom-v1';
const urlsToCache = [
    '/',
    '/index.html',
    '/masters.html',
    '/client.html',
    '/chat.html',
    '/group-chat.html',
    '/admin.html',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css'
];

// Установка Service Worker
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Кэширование статики');
                return cache.addAll(urlsToCache);
            })
    );
});

// Активация и очистка старого кэша
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.filter(name => name !== CACHE_NAME)
                    .map(name => caches.delete(name))
            );
        })
    );
});

// Стратегия кэширования: сначала сеть, потом кэш
self.addEventListener('fetch', event => {
    event.respondWith(
        fetch(event.request)
            .then(response => {
                // Кэшируем успешные ответы
                if (response.status === 200) {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseClone);
                    });
                }
                return response;
            })
            .catch(() => {
                // Если сеть недоступна, берем из кэша
                return caches.match(event.request);
            })
    );
});

// Firebase Cloud Messaging
firebase.initializeApp({
    apiKey: "AIzaSyCQrxCTXNBS4sEyR_ElZ3dXRkkK9kEYTTQ",
    authDomain: "homework-6a562.firebaseapp.com",
    projectId: "homework-6a562",
    storageBucket: "homework-6a562.firebasestorage.app",
    messagingSenderId: "3651366285",
    appId: "1:3651366285:web:8b1a73dfdf717eb582e1c4"
});

const messaging = firebase.messaging();

// Фоновые уведомления
messaging.onBackgroundMessage((payload) => {
    console.log('Получено фоновое уведомление:', payload);
    
    const notificationTitle = payload.notification?.title || 'ВоркХом';
    const notificationOptions = {
        body: payload.notification?.body || 'Новое уведомление',
        icon: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/svgs/solid/house.svg',
        badge: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/svgs/solid/house.svg',
        data: payload.data,
        actions: [
            { action: 'open', title: '🔗 Открыть' },
            { action: 'close', title: '❌ Закрыть' }
        ],
        vibrate: [200, 100, 200],
        requireInteraction: true,
        silent: false
    };

    return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Клик по уведомлению
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    
    if (event.action === 'open') {
        const urlToOpen = event.notification.data?.url || '/';
        event.waitUntil(clients.openWindow(urlToOpen));
    }
});

// Пуш-уведомления
self.addEventListener('push', (event) => {
    const data = event.data.json();
    
    const options = {
        body: data.body,
        icon: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/svgs/solid/house.svg',
        badge: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/svgs/solid/house.svg',
        data: data,
        actions: data.actions || [
            { action: 'open', title: 'Открыть' }
        ],
        vibrate: [200, 100, 200]
    };

    event.waitUntil(
        self.registration.showNotification(data.title || 'ВоркХом', options)
    );
});