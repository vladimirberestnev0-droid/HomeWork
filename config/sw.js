// ===== sw.js =====
// Service Worker с офлайн режимом и кэшированием
// ВЕРСИЯ 4.0 — ИСПРАВЛЕННЫЕ ПУТИ К ФАЙЛАМ

const CACHE_NAME = 'workhom-v4';
const API_CACHE_NAME = 'workhom-api-v1';

const STATIC_ASSETS = [
    '/HomeWork/',
    '/HomeWork/index.html',
    '/HomeWork/masters.html',
    '/HomeWork/client.html',
    '/HomeWork/chat.html',
    '/HomeWork/group-chat.html',
    '/HomeWork/admin.html',
    '/HomeWork/offline.html',
    '/HomeWork/404.html',
    '/HomeWork/payment-success.html',
    // ===== ИСПРАВЛЕННЫЕ ПУТИ К CSS =====
    '/HomeWork/css/index.css',           // ✅ вместо main.css
    '/HomeWork/css/dark.css',            // ✅ вместо theme.css
    '/HomeWork/css/animations.css',
    '/HomeWork/css/variables.css',
    // ===== JS ФАЙЛЫ =====
    '/HomeWork/js/core/constants.js',
    '/HomeWork/js/core/helpers.js',
    '/HomeWork/js/core/firebase.js',
    '/HomeWork/js/core/error-handler.js',
    '/HomeWork/js/services/auth.js',
    '/HomeWork/js/services/orders.js',
    '/HomeWork/js/services/chat.js',
    '/HomeWork/js/services/auth-ui.js',
    '/HomeWork/js/pages/index.js',
    '/HomeWork/manifest.json',
    // ===== ВНЕШНИЕ РЕСУРСЫ =====
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css',
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap'
];

// Установка
self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('✅ Кэширование статики...');
                // Используем allSettled, чтобы не проваливать весь кэш из-за одной ошибки
                return Promise.allSettled(
                    STATIC_ASSETS.map(url => 
                        cache.add(url).catch(err => 
                            console.warn(`⚠️ Пропускаем ${url}:`, err.message)
                        )
                    )
                );
            })
            .then(results => {
                const succeeded = results.filter(r => r.status === 'fulfilled').length;
                const failed = results.filter(r => r.status === 'rejected').length;
                console.log(`✅ Кэширование завершено: ${succeeded} OK, ${failed} пропущено`);
            })
    );
});

// Активация — удаляем старые кэши
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME && key !== API_CACHE_NAME)
                    .map(key => {
                        console.log('🗑️ Удаление старого кэша:', key);
                        return caches.delete(key);
                    })
            );
        }).then(() => {
            console.log('✅ Service Worker v4 активирован');
            return self.clients.claim();
        })
    );
});

// Перехват запросов
self.addEventListener('fetch', event => {
    // Игнорируем НЕ-GET запросы
    if (event.request.method !== 'GET') {
        event.respondWith(fetch(event.request));
        return;
    }

    const url = new URL(event.request.url);

    // Игнорируем расширения Chrome, Firebase, Яндекс.Карты
    if (event.request.url.startsWith('chrome-extension://') ||
        event.request.url.includes('firestore.googleapis.com') ||
        event.request.url.includes('firebase') ||
        event.request.url.includes('yandex') ||
        event.request.url.includes('googleapis')) {
        event.respondWith(fetch(event.request));
        return;
    }

    // API запросы — сначала сеть, потом кэш
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

    // Изображения — сначала кэш, потом сеть
    if (event.request.url.match(/\.(jpg|jpeg|png|gif|svg|webp|ico)$/)) {
        event.respondWith(
            caches.match(event.request).then(response => {
                return response || fetch(event.request).then(networkResponse => {
                    const clone = networkResponse.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, clone);
                    });
                    return networkResponse;
                }).catch(() => {
                    // Заглушка для иконок
                    if (event.request.url.includes('icon')) {
                        return new Response('', { status: 204 });
                    }
                });
            })
        );
        return;
    }

    // HTML страницы — сначала сеть, при ошибке офлайн
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request)
                .catch(() => {
                    return caches.match('/HomeWork/offline.html');
                })
        );
        return;
    }

    // Всё остальное — Stale-While-Revalidate
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
                    // Тишина в консоли для офлайн режима
                });

            return cached || fetchPromise;
        })
    );
});

// Push-уведомления
self.addEventListener('push', event => {
    let data = {};
    try {
        data = event.data.json();
    } catch (e) {
        data = { title: 'ВоркХом', body: event.data.text() };
    }
    
    const options = {
        body: data.body || 'Новое уведомление',
        icon: '/HomeWork/icons/icon-192x192.png',
        badge: '/HomeWork/icons/badge.png',
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
        const url = event.notification.data.url || '/HomeWork/';
        event.waitUntil(
            clients.openWindow(url)
        );
    }
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

// Синхронизация заказов
async function syncOrders() {
    try {
        console.log('🔄 Фоновая синхронизация заказов...');
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
    } catch (error) {
        console.error('Ошибка в syncOrders:', error);
    }
}

// Синхронизация сообщений
async function syncMessages() {
    try {
        console.log('🔄 Фоновая синхронизация сообщений...');
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
    } catch (error) {
        console.error('Ошибка в syncMessages:', error);
    }
}

// IndexedDB для офлайн данных
function openIndexedDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('WorkhomOffline', 1);
        
        request.onupgradeneeded = event => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('offlineOrders')) {
                db.createObjectStore('offlineOrders', { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('offlineMessages')) {
                db.createObjectStore('offlineMessages', { keyPath: 'id' });
            }
        };
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}