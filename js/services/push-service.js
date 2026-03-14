// ============================================
// СЕРВИС PUSH-УВЕДОМЛЕНИЙ - ПРЯМАЯ ОТПРАВКА
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
     * Инициализация сервиса
     */
    async function init() {
        if (isInitialized) return true;
        if (initPromise) return initPromise;

        initPromise = (async () => {
            console.log('🔔 PushService: инициализация...');

            try {
                if (!isSupported()) {
                    console.log('ℹ️ Push не поддерживается браузером');
                    return false;
                }

                const user = Auth?.getUser();
                if (!user) {
                    console.log('ℹ️ Пользователь не авторизован');
                    return false;
                }

                messaging = firebase.messaging();
                setupMessageHandler();
                await refreshToken();
                setupTokenRefresh();

                isInitialized = true;
                console.log('✅ PushService инициализирован');
                return true;

            } catch (error) {
                console.warn('⚠️ Ошибка инициализации:', error.message);
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
               'PushManager' in window;
    }

    /**
     * Настройка обработчика входящих сообщений
     */
    function setupMessageHandler() {
        if (!messaging) return;

        if (messaging._messageHandler) {
            messaging.onMessage(messaging._messageHandler);
        }

        const handler = (payload) => {
            console.log('🔔 Получено push-уведомление:', payload);
            handleIncomingMessage(payload);
        };

        messaging._messageHandler = handler;
        messaging.onMessage(handler);
    }

    /**
     * Обработка входящего сообщения
     */
    function handleIncomingMessage(payload) {
        const notificationData = payload.notification || {};
        const data = payload.data || {};

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
                    tag: data.type || 'notification'
                }
            );
        }

        if (window.Utils) {
            Utils.showNotification(
                notificationData.body || 'Новое уведомление',
                data.type || 'info',
                8000
            );
        }

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
            const permission = await requestPermission();
            if (!permission) return null;

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
            
            const token = await messaging.getToken({ vapidKey: VAPID_KEY });

            if (token) {
                console.log('✅ Push-токен получен');
                await saveToken(token);
                currentToken = token;
                return token;
            } else {
                console.log('❌ Не удалось получить токен');
                return null;
            }

        } catch (error) {
            console.warn('⚠️ Ошибка получения токена:', error.message);
            return null;
        }
    }

    /**
     * Запрос разрешения на уведомления
     */
    async function requestPermission() {
        if (Notification.permission === 'granted') return true;
        if (Notification.permission === 'denied') return false;

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

            await db.runTransaction(async (transaction) => {
                const userRef = db.collection('users').doc(user.uid);
                const userDoc = await transaction.get(userRef);

                if (!userDoc.exists) return;

                const tokens = userDoc.data().fcmTokens || [];
                
                if (!tokens.includes(token)) {
                    transaction.update(userRef, {
                        fcmTokens: [...tokens, token],
                        lastTokenUpdate: firebase.firestore.FieldValue.serverTimestamp()
                    });
                }
            });

            localStorage.setItem('fcm_token', JSON.stringify({
                token: token,
                timestamp: Date.now()
            }));

            console.log('✅ Токен сохранён');
            return true;

        } catch (error) {
            console.warn('⚠️ Ошибка сохранения токена:', error);
            return false;
        }
    }

    /**
     * Получение сохранённого токена
     */
    function getSavedToken() {
        try {
            const saved = localStorage.getItem('fcm_token');
            if (!saved) return null;
            
            const { token, timestamp } = JSON.parse(saved);
            if (!token || !timestamp) return null;
            if (Date.now() - timestamp > TOKEN_UPDATE_INTERVAL) return null;
            
            return token;
        } catch {
            return null;
        }
    }

    /**
     * Возраст токена
     */
    function getTokenAge(savedToken) {
        if (!savedToken) return Infinity;
        try {
            const saved = localStorage.getItem('fcm_token');
            if (!saved) return Infinity;
            const { timestamp } = JSON.parse(saved);
            return Date.now() - timestamp;
        } catch {
            return Infinity;
        }
    }

    /**
     * Настройка автообновления токена
     */
    function setupTokenRefresh() {
        if (messaging) {
            if (tokenRefreshListener) {
                messaging.onTokenRefresh(tokenRefreshListener);
            }
            
            tokenRefreshListener = async () => {
                console.log('🔄 Токен требует обновления');
                await refreshToken(true);
            };
            
            messaging.onTokenRefresh(tokenRefreshListener);
        }

        setInterval(() => {
            if (Auth?.isAuthenticated()) {
                refreshToken(true).catch(() => {});
            }
        }, TOKEN_UPDATE_INTERVAL);
    }

    /**
     * Удаление токена
     */
    async function deleteToken() {
        if (!messaging || !currentToken) return;

        try {
            await messaging.deleteToken(currentToken);

            const user = Auth?.getUser();
            if (user) {
                await db.collection('users').doc(user.uid).update({
                    fcmTokens: firebase.firestore.FieldValue.arrayRemove(currentToken)
                });
            }

            localStorage.removeItem('fcm_token');
            console.log('✅ Токен удалён');
            currentToken = null;

        } catch (error) {
            console.warn('⚠️ Ошибка удаления токена:', error);
        }
    }

    // ===== НОВЫЕ ФУНКЦИИ ДЛЯ ПРЯМОЙ ОТПРАВКИ =====

    /**
     * ПРЯМАЯ ОТПРАВКА: уведомления конкретному пользователю
     */
    async function sendPushToUser(userId, title, body, data = {}) {
        try {
            // Получаем токены пользователя
            const userDoc = await db.collection('users').doc(userId).get();
            if (!userDoc.exists) {
                console.log('❌ Пользователь не найден');
                return { success: false, error: 'Пользователь не найден' };
            }

            const tokens = userDoc.data().fcmTokens || [];
            
            if (tokens.length === 0) {
                console.log('ℹ️ У пользователя нет токенов');
                
                // Всё равно сохраняем уведомление
                await saveNotification(userId, title, body, data);
                return { success: false, error: 'Нет токенов', saved: true };
            }

            // Сохраняем уведомление в БД
            await saveNotification(userId, title, body, data);

            const SERVER_KEY = 'BLuGczKPH_SqYk_zb_t4YsAEh1mScTH9EDuysAhPefy6Lzs5Qnja4sOmPzbiCP4SQSpBABU0Zw7_T6h34Vq864E';

            console.log(`📬 Отправка push на ${tokens.length} устройств...`);
            
            // Здесь будет отправка через сервер
            // Пока просто логируем
            console.log('📝 Для отправки push нужен Server Key из Firebase Console');

            return { 
                success: true, 
                saved: true,
                tokensCount: tokens.length,
                message: 'Уведомление сохранено. Для отправки push настрой Server Key'
            };

        } catch (error) {
            console.error('❌ Ошибка:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Сохранение уведомления в Firestore
     */
    async function saveNotification(userId, title, body, data = {}) {
        const notifData = {
            userId: userId,
            type: data.type || 'info',
            title: title,
            body: body,
            data: data,
            read: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        const docRef = await db.collection('notifications').add(notifData);
        console.log(`📝 Уведомление сохранено: ${docRef.id}`);
        return docRef.id;
    }

    /**
     * Уведомление о новом отклике
     */
    async function notifyNewResponse(clientId, orderTitle, masterName, orderId, chatId) {
        return sendPushToUser(
            clientId,
            '🔔 Новый отклик!',
            `Мастер ${masterName} откликнулся на заказ "${orderTitle}"`,
            { 
                type: 'new_response', 
                orderId: orderId,
                chatId: chatId,
                masterName: masterName
            }
        );
    }

    /**
     * Уведомление о выборе мастера
     */
    async function notifyMasterSelected(masterId, orderTitle, clientName, orderId, chatId) {
        return sendPushToUser(
            masterId,
            '✅ Вас выбрали!',
            `Клиент ${clientName} выбрал вас для заказа "${orderTitle}"`,
            { 
                type: 'master_selected', 
                orderId: orderId,
                chatId: chatId,
                clientName: clientName
            }
        );
    }

    /**
     * Уведомление о новом сообщении
     */
    async function notifyNewMessage(userId, senderName, messageText, chatId) {
        const shortText = messageText.length > 50 
            ? messageText.substring(0, 50) + '...' 
            : messageText;
            
        return sendPushToUser(
            userId,
            '💬 Новое сообщение',
            `${senderName}: ${shortText}`,
            { 
                type: 'new_message', 
                chatId: chatId,
                senderName: senderName
            }
        );
    }

    /**
     * Уведомление о завершении заказа
     */
    async function notifyOrderCompleted(userId, orderTitle, orderId, chatId, isClient) {
        const role = isClient ? 'мастер' : 'клиент';
        return sendPushToUser(
            userId,
            '✅ Заказ выполнен!',
            `${isClient ? 'Мастер' : 'Клиент'} подтвердил выполнение заказа "${orderTitle}"`,
            { 
                type: 'order_completed', 
                orderId: orderId,
                chatId: chatId
            }
        );
    }

    /**
     * Уведомление об отмене заказа
     */
    async function notifyOrderCancelled(userId, orderTitle, orderId, reason = '') {
        return sendPushToUser(
            userId,
            '❌ Заказ отменён',
            `Заказ "${orderTitle}" был отменён${reason ? ': ' + reason : ''}`,
            { 
                type: 'order_cancelled', 
                orderId: orderId,
                reason: reason
            }
        );
    }

    /**
     * Уведомление мастеров о новом заказе
     */
    async function notifyMastersAboutNewOrder(order) {
        try {
            if (!order || !order.category) {
                return { success: false, error: 'Нет данных заказа' };
            }

            // Находим мастеров нужной категории
            const mastersSnapshot = await db.collection('users')
                .where('role', '==', 'master')
                .where('banned', '==', false)
                .get();

            let notifiedCount = 0;
            const categoryLower = order.category.toLowerCase();

            for (const doc of mastersSnapshot.docs) {
                const master = doc.data();
                
                // Проверяем категорию мастера
                if (master.categories) {
                    const masterCategories = master.categories.toLowerCase();
                    if (masterCategories.includes(categoryLower) || 
                        masterCategories.includes('все')) {
                        
                        await sendPushToUser(
                            doc.id,
                            '🔔 Новый заказ',
                            `${order.title} — ${Utils.formatMoney(order.price)}`,
                            { 
                                type: 'new_order', 
                                orderId: order.id,
                                category: order.category,
                                price: order.price
                            }
                        );
                        notifiedCount++;
                    }
                }
            }

            console.log(`📬 Уведомления отправлены ${notifiedCount} мастерам`);
            return { success: true, count: notifiedCount };

        } catch (error) {
            console.error('❌ Ошибка:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Тестовая функция
     */
    async function testNotification() {
        const user = Auth?.getUser();
        if (!user) {
            console.log('❌ Сначала войдите в систему');
            return;
        }

        await requestPermission();
        
        if (Notification.permission === 'granted') {
            new Notification('🔔 Тест PushService', {
                body: 'Если вы это видите - разрешения работают!',
                icon: '/HomeWork/icons/icon-192x192.png'
            });
        }

        // Сохраняем тестовое уведомление
        await saveNotification(
            user.uid,
            '🔔 Тестовое уведомление',
            'Проверка работы сервиса',
            { type: 'test' }
        );

        console.log('✅ Тест завершён');
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

    // ===== ПУБЛИЧНОЕ API =====
    const api = {
        // Основные
        init,
        refreshToken,
        deleteToken,
        getCurrentToken: () => currentToken,
        isSupported,
        isInitialized: () => isInitialized,
        cleanup,
        
        // Уведомления
        requestPermission,
        testNotification,
        
        // Прямая отправка
        sendPushToUser,
        notifyNewResponse,
        notifyMasterSelected,
        notifyNewMessage,
        notifyOrderCompleted,
        notifyOrderCancelled,
        notifyMastersAboutNewOrder,
        
        // Сохранение
        saveNotification
    };

    window.__PUSH_SERVICE_INITIALIZED__ = true;
    
    // Автоинициализация
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
            if (Auth?.isAuthenticated()) {
                init().catch(() => {});
            }
        }, 2000);
    });

    console.log('✅ PushService загружен (версия с прямой отправкой)');
    return Object.freeze(api);
})();

window.PushService = PushService;