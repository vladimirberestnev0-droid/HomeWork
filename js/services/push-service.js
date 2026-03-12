// ============================================
// СЕРВИС PUSH-УВЕДОМЛЕНИЙ (FCM) - ЭЛЕГАНТНАЯ ВЕРСИЯ
// ============================================

const PushService = (function() {
    if (window.__PUSH_SERVICE_INITIALIZED__) return window.PushService;

    let messaging = null;
    let currentToken = null;
    let isInitialized = false;
    let initPromise = null;
    let tokenRefreshListener = null;
    
    // Константы
    const VAPID_KEY = 'BKeLz4hFmUOzOZyJX3vLQzB6wX9xY8vU7tS6rQ5pN4mL3kI2jH1gF0eD9cB8aA7z';
    const TOKEN_UPDATE_INTERVAL = 7 * 24 * 60 * 60 * 1000; // Обновляем раз в неделю

    /**
     * Элегантная инициализация с защитой от повторных вызовов
     */
    async function init() {
        // Если уже инициализировано или инициализация в процессе
        if (isInitialized) return true;
        if (initPromise) return initPromise;

        initPromise = (async () => {
            console.log('🔔 PushService: инициализация...');

            try {
                // Проверяем поддержку браузером
                if (!isSupported()) {
                    console.log('ℹ️ Push-уведомления не поддерживаются браузером');
                    return false;
                }

                // Проверяем авторизацию
                const user = Auth?.getUser();
                if (!user) {
                    console.log('ℹ️ PushService: пользователь не авторизован');
                    return false;
                }

                // Получаем messaging
                messaging = firebase.messaging();

                // Настраиваем обработчик входящих сообщений
                setupMessageHandler();

                // Получаем или обновляем токен
                await refreshToken();

                // Настраиваем автоматическое обновление токена
                setupTokenRefresh();

                isInitialized = true;
                console.log('✅ PushService инициализирован');
                return true;

            } catch (error) {
                // Элегантно обрабатываем ошибки, не ломая приложение
                if (error.code === 'messaging/unsupported-browser') {
                    console.log('ℹ️ Этот браузер не поддерживает push-уведомления');
                } else if (error.code === 'messaging/permission-blocked') {
                    console.log('ℹ️ Разрешения на уведомления заблокированы');
                } else if (error.code === 'messaging/notifications-blocked') {
                    console.log('ℹ️ Уведомления заблокированы в настройках');
                } else {
                    console.warn('⚠️ Ошибка инициализации PushService:', error.message);
                }
                return false;
            } finally {
                initPromise = null;
            }
        })();

        return initPromise;
    }

    /**
     * Проверка поддержки браузером
     */
    function isSupported() {
        return 'Notification' in window && 
               'serviceWorker' in navigator && 
               'PushManager' in window &&
               firebase?.messaging?.isSupported?.();
    }

    /**
     * Настройка обработчика входящих сообщений
     */
    function setupMessageHandler() {
        if (!messaging) return;

        // Убираем предыдущий обработчик, если был
        if (messaging._messageHandler) {
            messaging.onMessage(messaging._messageHandler);
        }

        // Создаём новый обработчик
        const handler = (payload) => {
            console.log('🔔 Получено push-уведомление (активное приложение):', payload);
            
            // Элегантно показываем уведомление через наш UI
            handleIncomingMessage(payload);
        };

        // Сохраняем для возможной очистки
        messaging._messageHandler = handler;
        messaging.onMessage(handler);
    }

    /**
     * Обработка входящего сообщения
     */
    function handleIncomingMessage(payload) {
        const notificationData = payload.notification || {};
        const data = payload.data || {};

        // Показываем через наш центр уведомлений
        if (window.Notifications) {
            Notifications.showBrowserNotification(
                notificationData.title || 'СВОЙ МАСТЕР 86',
                {
                    body: notificationData.body || 'Новое уведомление',
                    data: data,
                    icon: '/HomeWork/icons/icon-192x192.png',
                    badge: '/HomeWork/icons/icon-72x72.png',
                    vibrate: [200, 100, 200],
                    requireInteraction: true,
                    silent: false,
                    tag: data.type || 'notification',
                    renotify: true
                }
            );
        }

        // Также показываем тост
        if (window.Utils) {
            Utils.showNotification(
                notificationData.body || 'Новое уведомление',
                data.type || 'info',
                8000
            );
        }

        // Диспатчим событие для обновления UI
        document.dispatchEvent(new CustomEvent('push-received', {
            detail: { payload }
        }));
    }

    /**
     * Получение/обновление токена
     */
    async function refreshToken(force = false) {
        if (!messaging) return null;

        try {
            // Проверяем разрешения
            const permission = await requestPermission();
            if (!permission) return null;

            // Проверяем, нужно ли обновлять токен
            if (!force) {
                const savedToken = getSavedToken();
                const tokenAge = getTokenAge(savedToken);
                
                if (savedToken && tokenAge < TOKEN_UPDATE_INTERVAL) {
                    console.log('🔔 Используем существующий токен');
                    currentToken = savedToken;
                    return currentToken;
                }
            }

            console.log('🔔 Получаем новый push-токен...');
            
            // Получаем новый токен
            const token = await messaging.getToken({ vapidKey: VAPID_KEY });

            if (token) {
                console.log('✅ Push-токен получен');
                
                // Сохраняем токен
                await saveToken(token);
                
                currentToken = token;
                return token;
            } else {
                console.log('❌ Не удалось получить токен');
                return null;
            }

        } catch (error) {
            // Элегантно обрабатываем ошибки
            if (error.code === 'messaging/unknown') {
                console.log('ℹ️ Push-уведомления не поддерживаются в этом браузере');
            } else {
                console.warn('⚠️ Ошибка получения токена:', error.message);
            }
            return null;
        }
    }

    /**
     * Запрос разрешения на уведомления
     */
    async function requestPermission() {
        if (Notification.permission === 'granted') {
            return true;
        }

        if (Notification.permission === 'denied') {
            console.log('ℹ️ Уведомления заблокированы пользователем');
            return false;
        }

        try {
            const permission = await Notification.requestPermission();
            return permission === 'granted';
        } catch (error) {
            console.warn('⚠️ Ошибка запроса разрешения:', error);
            return false;
        }
    }

    /**
     * Сохранение токена в Firestore
     */
    async function saveToken(token) {
        try {
            const user = Auth?.getUser();
            if (!user) return false;

            // Используем транзакцию для безопасного обновления
            await db.runTransaction(async (transaction) => {
                const userRef = db.collection('users').doc(user.uid);
                const userDoc = await transaction.get(userRef);

                if (!userDoc.exists) return;

                const tokens = userDoc.data().fcmTokens || [];
                
                // Добавляем токен, если его ещё нет
                if (!tokens.includes(token)) {
                    transaction.update(userRef, {
                        fcmTokens: [...tokens, token],
                        lastTokenUpdate: firebase.firestore.FieldValue.serverTimestamp()
                    });
                }
            });

            // Сохраняем в localStorage для быстрого доступа
            try {
                localStorage.setItem('fcm_token', JSON.stringify({
                    token: token,
                    timestamp: Date.now()
                }));
            } catch (e) {
                // Игнорируем ошибки localStorage
            }

            console.log('✅ Токен сохранён в профиле');
            return true;

        } catch (error) {
            console.warn('⚠️ Ошибка сохранения токена:', error);
            return false;
        }
    }

    /**
     * Получение сохранённого токена из localStorage
     */
    function getSavedToken() {
        try {
            const saved = localStorage.getItem('fcm_token');
            if (!saved) return null;
            
            const { token, timestamp } = JSON.parse(saved);
            if (!token || !timestamp) return null;
            
            // Проверяем, не просрочен ли токен
            if (Date.now() - timestamp > TOKEN_UPDATE_INTERVAL) {
                return null;
            }
            
            return token;
        } catch (e) {
            return null;
        }
    }

    /**
     * Получение возраста токена
     */
    function getTokenAge(savedToken) {
        if (!savedToken) return Infinity;
        
        try {
            const saved = localStorage.getItem('fcm_token');
            if (!saved) return Infinity;
            
            const { timestamp } = JSON.parse(saved);
            return Date.now() - timestamp;
        } catch (e) {
            return Infinity;
        }
    }

    /**
     * Настройка автоматического обновления токена
     */
    function setupTokenRefresh() {
        // Слушаем события обновления токена от Firebase
        if (messaging) {
            if (tokenRefreshListener) {
                messaging.onTokenRefresh(tokenRefreshListener);
            }
            
            tokenRefreshListener = async () => {
                console.log('🔄 Токен FCM требует обновления');
                await refreshToken(true);
            };
            
            messaging.onTokenRefresh(tokenRefreshListener);
        }

        // Также обновляем раз в неделю на всякий случай
        setInterval(() => {
            if (Auth?.isAuthenticated()) {
                refreshToken(true).catch(() => {});
            }
        }, TOKEN_UPDATE_INTERVAL);
    }

    /**
     * Удаление токена (при выходе)
     */
    async function deleteToken() {
        if (!messaging || !currentToken) return;

        try {
            // Удаляем токен из Firebase
            await messaging.deleteToken(currentToken);

            // Удаляем из Firestore
            const user = Auth?.getUser();
            if (user) {
                await db.collection('users').doc(user.uid).update({
                    fcmTokens: firebase.firestore.FieldValue.arrayRemove(currentToken)
                });
            }

            // Удаляем из localStorage
            try {
                localStorage.removeItem('fcm_token');
            } catch (e) {
                // Игнорируем
            }

            console.log('✅ Токен удалён');
            currentToken = null;

        } catch (error) {
            console.warn('⚠️ Ошибка удаления токена:', error);
        }
    }

    /**
     * Отправка уведомления конкретному пользователю
     * (через Cloud Function - должна быть реализована на бэкенде)
     */
    async function notifyUser(userId, notification) {
        try {
            // Сохраняем уведомление в Firestore
            // Cloud Function отправит push
            const docRef = await db.collection('notifications').add({
                userId: userId,
                type: notification.type || 'info',
                title: notification.title || 'Уведомление',
                body: notification.body || '',
                data: notification.data || {},
                read: false,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            console.log(`📬 Уведомление сохранено для ${userId}`, docRef.id);
            return { success: true, id: docRef.id };

        } catch (error) {
            console.error('❌ Ошибка сохранения уведомления:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Отправка уведомлений мастерам о новом заказе
     */
    async function notifyMastersAboutNewOrder(order) {
        try {
            if (!order || !order.category) return { success: false };

            // Находим мастеров нужной категории
            const mastersSnapshot = await db.collection('users')
                .where('role', '==', 'master')
                .where('banned', '==', false)
                .get();

            const notifications = [];
            const categoryLower = order.category.toLowerCase();

            mastersSnapshot.forEach(doc => {
                const master = doc.data();
                
                // Проверяем категорию мастера (если есть)
                if (master.categories) {
                    const masterCategories = master.categories.toLowerCase();
                    if (masterCategories.includes(categoryLower) || 
                        masterCategories.includes('все')) {
                        
                        notifications.push({
                            userId: doc.id,
                            type: 'new_order',
                            title: '🔔 Новый заказ',
                            body: `${order.title || 'Заказ'} — ${Utils.formatMoney(order.price)}`,
                            data: { 
                                orderId: order.id,
                                category: order.category,
                                price: order.price,
                                click_action: 'open_order'
                            },
                            read: false,
                            createdAt: firebase.firestore.FieldValue.serverTimestamp()
                        });
                    }
                }
            });

            // Сохраняем батчем
            if (notifications.length > 0) {
                const batch = db.batch();
                notifications.forEach(notif => {
                    const ref = db.collection('notifications').doc();
                    batch.set(ref, notif);
                });
                await batch.commit();
                
                console.log(`📬 Отправлено ${notifications.length} уведомлений мастерам`);
                return { success: true, count: notifications.length };
            }

            return { success: true, count: 0 };

        } catch (error) {
            console.error('❌ Ошибка при уведомлении мастеров:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Очистка ресурсов
     */
    function cleanup() {
        if (tokenRefreshListener && messaging) {
            messaging.onTokenRefresh(tokenRefreshListener);
            tokenRefreshListener = null;
        }
        
        if (messaging && messaging._messageHandler) {
            messaging.onMessage(messaging._messageHandler);
            delete messaging._messageHandler;
        }
        
        isInitialized = false;
        currentToken = null;
    }

    // Публичное API
    const api = {
        init,
        refreshToken,
        deleteToken,
        notifyUser,
        notifyMastersAboutNewOrder,
        getCurrentToken: () => currentToken,
        isSupported,
        isInitialized: () => isInitialized,
        cleanup
    };

    window.__PUSH_SERVICE_INITIALIZED__ = true;
    
    // Элегантно инициализируем после загрузки страницы
    document.addEventListener('DOMContentLoaded', () => {
        // Ждём немного и проверяем авторизацию
        setTimeout(() => {
            if (Auth?.isAuthenticated()) {
                init().catch(() => {});
            }
        }, 2000);
    });

    console.log('✅ PushService загружен');
    return Object.freeze(api);
})();

window.PushService = PushService;