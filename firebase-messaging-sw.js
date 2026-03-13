// ============================================
// Service Worker для PWA - ЭЛЕГАНТНАЯ АРХИТЕКТУРА
// Совместимость: GitHub Pages + Firebase
// ============================================

const CACHE_NAME = 'svoy-master-v2';
const BASE_PATH = '/HomeWork/';
const IS_GITHUB_PAGES = self.location.hostname.includes('github.io');

// ===== КОНФИГУРАЦИЯ =====
const CONFIG = {
    baseUrl: self.location.origin + BASE_PATH,
    apiKeys: {
        firebase: {
            apiKey: "AIzaSyCQrxCTXNBS4sEyR_ElZ3dXRkkK9kEYTTQ",
            authDomain: "homework-6a562.firebaseapp.com",
            projectId: "homework-6a562",
            storageBucket: "homework-6a562.appspot.com",
            messagingSenderId: "3651366285",
            appId: "1:3651366285:web:8b1a73dfdf717eb582e1c4"
        }
    },
    cache: {
        core: [
            BASE_PATH + 'offline.html',
            BASE_PATH + 'manifest.json',
            BASE_PATH + 'icons/icon-72x72.png',
            BASE_PATH + 'icons/icon-96x96.png',
            BASE_PATH + 'icons/icon-128x128.png',
            BASE_PATH + 'icons/icon-144x144.png',
            BASE_PATH + 'icons/icon-152x152.png',
            BASE_PATH + 'icons/icon-192x192.png',
            BASE_PATH + 'icons/icon-384x384.png',
            BASE_PATH + 'icons/icon-512x512.png'
        ],
        css: [
            BASE_PATH + 'css/main.css',
            BASE_PATH + 'css/theme/theme-aurora.css'
        ],
        js: [
            BASE_PATH + 'js/core/config.js',
            BASE_PATH + 'js/core/constants.js',
            BASE_PATH + 'js/core/base-utils.js',
            BASE_PATH + 'js/core/store.js',
            BASE_PATH + 'js/core/cache.js',
            BASE_PATH + 'js/core/firebase.js'
        ]
    }
};

// ============================================
// УМНАЯ ЗАГРУЗКА FIREBASE
// ============================================
async function loadFirebaseSDK() {
    try {
        // На GitHub Pages используем fallback-стратегию
        if (IS_GITHUB_PAGES) {
            console.log('📦 GitHub Pages detected: using fallback mode');
            return false;
        }

        // Пытаемся загрузить Firebase SDK
        await Promise.all([
            importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js'),
            importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js')
        ]);
        
        console.log('✅ Firebase SDK loaded successfully');
        return true;
    } catch (error) {
        console.log('⚠️ Firebase SDK load failed, using fallback:', error.message);
        return false;
    }
}

// ============================================
// ИНИЦИАЛИЗАЦИЯ FIREBASE (с защитой)
// ============================================
let messaging = null;
let firebaseAvailable = false;

async function initializeFirebase() {
    firebaseAvailable = await loadFirebaseSDK();
    
    if (firebaseAvailable && typeof firebase !== 'undefined') {
        try {
            firebase.initializeApp(CONFIG.apiKeys.firebase);
            messaging = firebase.messaging();
            
            // Настройка фоновых сообщений
            messaging.onBackgroundMessage(handleBackgroundMessage);
            
            console.log('✅ Firebase Messaging initialized');
        } catch (error) {
            console.log('⚠️ Firebase initialization failed:', error.message);
            firebaseAvailable = false;
        }
    }
}

// ============================================
// ОБРАБОТЧИКИ СООБЩЕНИЙ
// ============================================

// Обработка фоновых сообщений (когда Firebase доступен)
function handleBackgroundMessage(payload) {
    console.log('📨 Background message:', payload);
    
    const notificationTitle = payload.notification?.title || 'СВОЙ МАСТЕР 86';
    const notificationOptions = {
        body: payload.notification?.body || 'Новое уведомление',
        icon: CONFIG.baseUrl + 'icons/icon-192x192.png',
        badge: CONFIG.baseUrl + 'icons/icon-72x72.png',
        data: payload.data || {},
        vibrate: [200, 100, 200],
        requireInteraction: true,
        actions: [
            { action: 'open', title: '🔓 Открыть' },
            { action: 'close', title: '❌ Закрыть' }
        ]
    };

    return self.registration.showNotification(notificationTitle, notificationOptions);
}

// Универсальный обработчик push (работает всегда)
function handlePushEvent(event) {
    let data = {};
    
    try {
        data = event.data?.json() || {};
    } catch {
        data = { 
            body: event.data?.text() || 'Новое уведомление',
            title: 'СВОЙ МАСТЕР 86'
        };
    }

    const title = data.notification?.title || data.title || 'СВОЙ МАСТЕР 86';
    const body = data.notification?.body || data.body || 'Новое уведомление';
    const icon = data.notification?.icon || CONFIG.baseUrl + 'icons/icon-192x192.png';
    
    const options = {
        body: body,
        icon: icon,
        badge: CONFIG.baseUrl + 'icons/icon-72x72.png',
        vibrate: [200, 100, 200],
        data: data.data || data,
        requireInteraction: true,
        actions: [
            { action: 'open', title: '🔓 Открыть' },
            { action: 'close', title: '❌ Закрыть' }
        ],
        tag: data.tag || 'notification',
        renotify: true,
        silent: false
    };

    event.waitUntil(
        self.registration.showNotification(title, options)
    );
}

// ============================================
// УСТАНОВКА
// ============================================
self.addEventListener('install', (event) => {
    console.log('🔄 Service Worker: installing...');
    
    event.waitUntil(
        (async () => {
            const cache = await caches.open(CACHE_NAME);
            
            // Кэшируем основные ресурсы
            await cache.addAll(CONFIG.cache.core);
            
            // Пытаемся закэшировать CSS и JS (но не критично)
            try {
                await cache.addAll(CONFIG.cache.css);
                await cache.addAll(CONFIG.cache.js);
            } catch (error) {
                console.log('⚠️ Non-critical cache error:', error.message);
            }
            
            await self.skipWaiting();
            console.log('✅ Service Worker installed');
        })()
    );
});

// ============================================
// АКТИВАЦИЯ
// ============================================
self.addEventListener('activate', (event) => {
    console.log('🔄 Service Worker: activating...');
    
    event.waitUntil(
        (async () => {
            // Очищаем старые кэши
            const cacheNames = await caches.keys();
            await Promise.all(
                cacheNames
                    .filter(name => name !== CACHE_NAME)
                    .map(name => caches.delete(name))
            );
            
            // Инициализируем Firebase (если получится)
            await initializeFirebase();
            
            await self.clients.claim();
            console.log('✅ Service Worker activated');
        })()
    );
});

// ============================================
// ПЕРЕХВАТ ЗАПРОСОВ (ЭЛЕГАНТНАЯ СТРАТЕГИЯ)
// ============================================
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    
    // Пропускаем запросы не к нашему приложению
    if (!url.pathname.startsWith(BASE_PATH)) {
        return;
    }

    // Пропускаем Firebase и аналитику
    if (url.hostname.includes('googleapis.com') || 
        url.hostname.includes('gstatic.com') ||
        url.hostname.includes('firebase')) {
        return;
    }

    // Стратегия: Stale-While-Revalidate для всего
    event.respondWith(
        caches.open(CACHE_NAME).then(async (cache) => {
            try {
                // Пробуем получить из кэша
                const cachedResponse = await cache.match(event.request);
                
                // Параллельно обновляем кэш
                const fetchPromise = fetch(event.request.clone())
                    .then(networkResponse => {
                        if (networkResponse && networkResponse.status === 200) {
                            cache.put(event.request, networkResponse.clone());
                        }
                        return networkResponse;
                    })
                    .catch(() => null);
                
                // Возвращаем кэш или ждём сеть
                return cachedResponse || fetchPromise;
            } catch (error) {
                // Если всё плохо - показываем офлайн
                if (event.request.mode === 'navigate') {
                    return caches.match(BASE_PATH + 'offline.html');
                }
                return new Response('Offline', { status: 503 });
            }
        })
    );
});

// ============================================
// ОБРАБОТКА PUSH-УВЕДОМЛЕНИЙ
// ============================================
self.addEventListener('push', (event) => {
    console.log('📬 Push received:', event);
    
    // Если Firebase доступен - он сам обработает
    // Если нет - используем универсальный обработчик
    if (!firebaseAvailable || !messaging) {
        handlePushEvent(event);
    }
});

// ============================================
// ОБРАБОТКА КЛИКОВ ПО УВЕДОМЛЕНИЯМ
// ============================================
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const action = event.action;
    const data = event.notification.data || {};

    // Обработка действий
    if (action === 'close') {
        return;
    }

    // Определяем URL для перехода
    let targetUrl = CONFIG.baseUrl;
    
    if (data.chatId) {
        targetUrl = CONFIG.baseUrl + `chat.html?chatId=${data.chatId}`;
    } else if (data.orderId) {
        // Определяем роль по данным или открываем общую страницу
        targetUrl = CONFIG.baseUrl + `client.html?order=${data.orderId}`;
    } else if (data.url) {
        targetUrl = data.url.startsWith('http') ? data.url : CONFIG.baseUrl + data.url;
    }

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then(windowClients => {
                // Ищем существующее окно
                for (let client of windowClients) {
                    if (client.url.includes('/HomeWork/') && 'focus' in client) {
                        client.postMessage({
                            type: 'NOTIFICATION_CLICK',
                            data: data
                        });
                        return client.focus();
                    }
                }
                // Открываем новое
                return clients.openWindow(targetUrl);
            })
    );
});

// ============================================
// ОБРАБОТКА СООБЩЕНИЙ ОТ СТРАНИЦЫ
// ============================================
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data && event.data.type === 'CHECK_VERSION') {
        event.source.postMessage({
            type: 'VERSION_INFO',
            version: CACHE_NAME,
            firebaseAvailable: firebaseAvailable
        });
    }
});

// ============================================
// ПЕРИОДИЧЕСКАЯ СИНХРОНИЗАЦИЯ
// ============================================
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-notifications') {
        event.waitUntil(
            // Здесь можно добавить логику синхронизации
            Promise.resolve()
        );
    }
});

console.log('🎉 Service Worker загружен (элегантная архитектура)');
console.log(`📦 Режим: ${IS_GITHUB_PAGES ? 'GitHub Pages' : 'Production'}`);
console.log(`🔥 Firebase: ${firebaseAvailable ? 'доступен' : 'в режиме fallback'}`);