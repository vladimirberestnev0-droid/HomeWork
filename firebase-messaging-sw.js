// ============================================
// Service Worker для PWA - ИСПРАВЛЕННАЯ ВЕРСИЯ
// ============================================

const CACHE_NAME = 'svoy-master-v1';
const BASE_PATH = '/HomeWork/';

// ===== ТОЛЬКО САМОЕ НУЖНОЕ ДЛЯ СТАРТА =====
const CORE_ASSETS = [
    BASE_PATH + 'offline.html',
    BASE_PATH + 'manifest.json',
    BASE_PATH + 'icons/icon-192x192.png',
    BASE_PATH + 'icons/icon-512x512.png'
];

// ============================================
// УСТАНОВКА - без сложных внешних ресурсов
// ============================================
self.addEventListener('install', (event) => {
    console.log('🔄 Service Worker: установка...');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                return cache.addAll(CORE_ASSETS);
            })
            .then(() => {
                console.log('✅ Service Worker установлен');
                return self.skipWaiting();
            })
            .catch((error) => {
                console.log('⚠️ Ошибка кэширования:', error.message);
                return self.skipWaiting();
            })
    );
});

// ============================================
// АКТИВАЦИЯ
// ============================================
self.addEventListener('activate', (event) => {
    console.log('🔄 Service Worker: активация...');
    
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('✅ Service Worker активирован');
            return self.clients.claim();
        })
    );
});

// ============================================
// СТРАТЕГИЯ КЭШИРОВАНИЯ - Network First
// ============================================
self.addEventListener('fetch', (event) => {
    // Пропускаем запросы не к нашему приложению
    if (!event.request.url.includes('/HomeWork/')) {
        return;
    }

    // Пропускаем запросы к Firebase
    if (event.request.url.includes('firebase')) {
        return;
    }

    // Для HTML страниц - сначала сеть, если нет сети - офлайн
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request)
                .catch(() => caches.match(BASE_PATH + 'offline.html'))
        );
        return;
    }

    // Для статики - кэш, потом сеть
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                return response || fetch(event.request)
                    .then((networkResponse) => {
                        // Кэшируем только успешные ответы с нашего домена
                        if (networkResponse && networkResponse.status === 200) {
                            const responseToCache = networkResponse.clone();
                            caches.open(CACHE_NAME)
                                .then((cache) => {
                                    cache.put(event.request, responseToCache);
                                })
                                .catch(() => {});
                        }
                        return networkResponse;
                    });
            })
    );
});

// ============================================
// ПУШ-УВЕДОМЛЕНИЯ
// ============================================
self.addEventListener('push', (event) => {
    let data = {};
    
    try {
        data = event.data?.json() || {};
    } catch {
        data = { body: event.data?.text() || 'Новое уведомление' };
    }

    const title = data.title || 'СВОЙ МАСТЕР 86';
    const options = {
        body: data.body || 'Новое уведомление',
        icon: '/HomeWork/icons/icon-192x192.png',
        badge: '/HomeWork/icons/icon-72x72.png',
        vibrate: [200, 100, 200],
        data: data.data || {},
        requireInteraction: true
    };

    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

// ============================================
// КЛИК ПО УВЕДОМЛЕНИЮ
// ============================================
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    let url = '/HomeWork/';
    
    if (event.notification.data?.chatId) {
        url = `/HomeWork/chat.html?chatId=${event.notification.data.chatId}`;
    } else if (event.notification.data?.orderId) {
        url = `/HomeWork/client.html?order=${event.notification.data.orderId}`;
    } else if (event.notification.data?.url) {
        url = event.notification.data.url;
    }

    event.waitUntil(
        clients.matchAll({ type: 'window' })
            .then((clientList) => {
                for (const client of clientList) {
                    if (client.url.includes('/HomeWork/') && 'focus' in client) {
                        return client.focus();
                    }
                }
                return clients.openWindow(url);
            })
    );
});

// ============================================
// ФОНОВЫЕ СООБЩЕНИЯ ОТ FIREBASE
// ============================================
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: "AIzaSyCQrxCTXNBS4sEyR_ElZ3dXRkkK9kEYTTQ",
    authDomain: "homework-6a562.firebaseapp.com",
    projectId: "homework-6a562",
    storageBucket: "homework-6a562.appspot.com",
    messagingSenderId: "3651366285",
    appId: "1:3651366285:web:8b1a73dfdf717eb582e1c4"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
    const notificationTitle = payload.notification?.title || 'СВОЙ МАСТЕР 86';
    const notificationOptions = {
        body: payload.notification?.body || 'Новое уведомление',
        icon: '/HomeWork/icons/icon-192x192.png',
        badge: '/HomeWork/icons/icon-72x72.png',
        data: payload.data,
        vibrate: [200, 100, 200]
    };

    return self.registration.showNotification(notificationTitle, notificationOptions);
});

console.log('✅ Service Worker загружен');