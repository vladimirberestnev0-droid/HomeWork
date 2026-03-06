// ============================================
// Service Worker для PWA - ПОЛНАЯ РАБОЧАЯ ВЕРСИЯ
// ============================================

const CACHE_NAME = 'svoy-master-v1';
const BASE_PATH = '/HomeWork/';

// Ресурсы для кэширования при установке
const STATIC_ASSETS = [
    BASE_PATH,
    BASE_PATH + 'index.html',
    BASE_PATH + 'client.html',
    BASE_PATH + 'masters.html',
    BASE_PATH + 'chat.html',
    BASE_PATH + 'admin.html',
    BASE_PATH + 'offline.html',
    BASE_PATH + 'manifest.json',
    BASE_PATH + 'icons/icon-72x72.png',
    BASE_PATH + 'icons/icon-96x96.png',
    BASE_PATH + 'icons/icon-128x128.png',
    BASE_PATH + 'icons/icon-144x144.png',
    BASE_PATH + 'icons/icon-152x152.png',
    BASE_PATH + 'icons/icon-192x192.png',
    BASE_PATH + 'icons/icon-384x384.png',
    BASE_PATH + 'icons/icon-512x512.png',
    BASE_PATH + 'css/main.css',
    BASE_PATH + 'css/theme/theme-aurora.css',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css',
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap'
];

// ============================================
// УСТАНОВКА - кэшируем статику
// ============================================
self.addEventListener('install', (event) => {
    console.log('🔄 Service Worker: установка...');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('📦 Кэширование статических ресурсов...');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => {
                console.log('✅ Service Worker установлен');
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('❌ Ошибка кэширования:', error);
            })
    );
});

// ============================================
// АКТИВАЦИЯ - очищаем старые кэши
// ============================================
self.addEventListener('activate', (event) => {
    console.log('🔄 Service Worker: активация...');
    
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('🗑️ Удаление старого кэша:', cacheName);
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
// СТРАТЕГИЯ КЭШИРОВАНИЯ: Stale-While-Revalidate
// ============================================
self.addEventListener('fetch', (event) => {
    // Игнорируем запросы не к нашему приложению
    if (!event.request.url.includes('HomeWork') && 
        !event.request.url.startsWith('https://cdn.') &&
        !event.request.url.startsWith('https://fonts.')) {
        return;
    }

    // Игнорируем запросы к Firebase (они идут напрямую)
    if (event.request.url.includes('firebase')) {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then((cachedResponse) => {
                // Возвращаем кэшированный ответ сразу
                const fetchPromise = fetch(event.request)
                    .then((networkResponse) => {
                        // Обновляем кэш новым ответом
                        if (networkResponse && networkResponse.status === 200) {
                            const responseToCache = networkResponse.clone();
                            caches.open(CACHE_NAME)
                                .then((cache) => {
                                    cache.put(event.request, responseToCache);
                                });
                        }
                        return networkResponse;
                    })
                    .catch((error) => {
                        console.log('📴 Офлайн режим, используем кэш для:', event.request.url);
                        
                        // Если запрос на страницу - показываем offline.html
                        if (event.request.mode === 'navigate') {
                            return caches.match(BASE_PATH + 'offline.html');
                        }
                        
                        return cachedResponse;
                    });

                return cachedResponse || fetchPromise;
            })
    );
});

// ============================================
// ПУШ-УВЕДОМЛЕНИЯ
// ============================================
self.addEventListener('push', (event) => {
    console.log('📬 Получено push-уведомление:', event);
    
    let data = {};
    
    try {
        data = event.data?.json() || {};
    } catch (e) {
        try {
            data = { body: event.data?.text() || '' };
        } catch (e2) {
            data = {};
        }
    }

    const title = data.title || 'СВОЙ МАСТЕР 86';
    const options = {
        body: data.body || 'Новое уведомление',
        icon: '/HomeWork/icons/icon-192x192.png',
        badge: '/HomeWork/icons/icon-72x72.png',
        vibrate: [200, 100, 200],
        data: data.data || {},
        actions: data.actions || [
            {
                action: 'open',
                title: 'Открыть'
            },
            {
                action: 'close',
                title: 'Закрыть'
            }
        ],
        tag: data.tag || 'default',
        renotify: true,
        requireInteraction: true,
        silent: false
    };

    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

// ============================================
// КЛИК ПО УВЕДОМЛЕНИЮ
// ============================================
self.addEventListener('notificationclick', (event) => {
    console.log('🔔 Клик по уведомлению:', event);
    
    event.notification.close();

    if (event.action === 'close') {
        return;
    }

    let url = '/HomeWork/';
    
    if (event.notification.data) {
        if (event.notification.data.chatId) {
            url = `/HomeWork/chat.html?chatId=${event.notification.data.chatId}`;
        } else if (event.notification.data.orderId) {
            url = `/HomeWork/client.html?order=${event.notification.data.orderId}`;
        } else if (event.notification.data.url) {
            url = event.notification.data.url;
        }
    }

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                // Если уже есть открытое окно - фокусируем его
                for (const client of clientList) {
                    if (client.url.includes('/HomeWork/') && 'focus' in client) {
                        client.postMessage({
                            type: 'NOTIFICATION_CLICK',
                            data: event.notification.data
                        });
                        return client.focus();
                    }
                }
                // Иначе открываем новое
                if (clients.openWindow) {
                    return clients.openWindow(url);
                }
            })
    );
});

// ============================================
// ЗАКРЫТИЕ УВЕДОМЛЕНИЙ
// ============================================
self.addEventListener('notificationclose', (event) => {
    console.log('🚫 Уведомление закрыто:', event);
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
    console.log('📨 Фоновое сообщение:', payload);
    
    const notificationTitle = payload.notification?.title || 'СВОЙ МАСТЕР 86';
    const notificationOptions = {
        body: payload.notification?.body || 'Новое уведомление',
        icon: '/HomeWork/icons/icon-192x192.png',
        badge: '/HomeWork/icons/icon-72x72.png',
        data: payload.data,
        vibrate: [200, 100, 200],
        requireInteraction: true,
        silent: false
    };

    return self.registration.showNotification(notificationTitle, notificationOptions);
});

// ============================================
// ОБРАБОТКА СООБЩЕНИЙ ОТ КЛИЕНТА
// ============================================
self.addEventListener('message', (event) => {
    console.log('💬 Сообщение от клиента:', event.data);
    
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

console.log('✅ Service Worker полностью загружен и готов к работе!');