// ============================================
// СЕРВИС PUSH-УВЕДОМЛЕНИЙ (FCM)
// ============================================

const PushService = (function() {
    if (window.__PUSH_SERVICE_INITIALIZED__) return window.PushService;

    let messaging = null;
    let currentToken = null;
    let isInitialized = false;

    async function init() {
        if (isInitialized) return;
        
        if (!window.firebase || !window.firebase.messaging) {
            console.log('ℹ️ Firebase Messaging не доступен');
            return;
        }

        try {
            messaging = firebase.messaging();
            
            // Обработка входящих сообщений, когда приложение активно
            messaging.onMessage((payload) => {
                console.log('🔔 Получено push-уведомление (активное приложение):', payload);
                
                // Показываем через наш UI
                if (window.Notifications) {
                    const type = payload.data?.type || 'info';
                    const title = payload.notification?.title || 'Уведомление';
                    const body = payload.notification?.body || '';
                    
                    window.Notifications.showBrowserNotification(title, {
                        body: body,
                        data: payload.data,
                        icon: '/HomeWork/icons/icon-192x192.png'
                    });
                    
                    // Также показываем toast
                    Utils.showNotification(body, type);
                }
            });

            // Получаем текущий токен
            await refreshToken();
            
            isInitialized = true;
            console.log('✅ PushService инициализирован');
            
        } catch (error) {
            console.error('❌ Ошибка инициализации PushService:', error);
        }
    }

    async function refreshToken() {
        if (!messaging) return null;

        try {
            // Запрашиваем разрешение, если нужно
            if (Notification.permission !== 'granted') {
                const permission = await Notification.requestPermission();
                if (permission !== 'granted') {
                    console.log('❌ Нет разрешения на уведомления');
                    return null;
                }
            }

            // Получаем токен
            currentToken = await messaging.getToken({
                vapidKey: 'BKeLz4hFmUOzOZyJX3vLQzB6wX9xY8vU7tS6rQ5pN4mL3kI2jH1gF0eD9cB8aA7z' // Ваш VAPID ключ
            });

            if (currentToken) {
                console.log('✅ Push-токен получен');
                
                // Сохраняем токен в Firestore для текущего пользователя
                await saveTokenToUser(currentToken);
                
                return currentToken;
            } else {
                console.log('❌ Не удалось получить токен');
                return null;
            }
        } catch (error) {
            console.error('❌ Ошибка получения токена:', error);
            return null;
        }
    }

    async function saveTokenToUser(token) {
        try {
            const user = Auth.getUser();
            if (!user) return;

            await db.collection('users').doc(user.uid).update({
                fcmTokens: firebase.firestore.FieldValue.arrayUnion(token),
                lastTokenUpdate: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            console.log('✅ Токен сохранён в профиле');
        } catch (error) {
            console.error('❌ Ошибка сохранения токена:', error);
        }
    }

    async function removeToken(token) {
        try {
            const user = Auth.getUser();
            if (!user) return;

            await db.collection('users').doc(user.uid).update({
                fcmTokens: firebase.firestore.FieldValue.arrayRemove(token)
            });
            
            console.log('✅ Токен удалён');
        } catch (error) {
            console.error('❌ Ошибка удаления токена:', error);
        }
    }

    async function deleteToken() {
        if (!messaging || !currentToken) return;

        try {
            await messaging.deleteToken(currentToken);
            await removeToken(currentToken);
            currentToken = null;
            console.log('✅ Токен удалён из системы');
        } catch (error) {
            console.error('❌ Ошибка удаления токена:', error);
        }
    }

    // Отправка уведомления конкретному пользователю (через серверную функцию)
    async function sendToUser(userId, payload) {
        // Это должно вызывать Cloud Function на сервере
        // Для теста пока используем прямую запись в Firestore
        
        try {
            const userDoc = await db.collection('users').doc(userId).get();
            const userData = userDoc.data();
            
            if (userData?.fcmTokens && userData.fcmTokens.length > 0) {
                // Сохраняем уведомление в коллекцию
                await db.collection('notifications').add({
                    userId: userId,
                    ...payload,
                    read: false,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                
                console.log(`📬 Уведомление сохранено для ${userId}`);
            }
        } catch (error) {
            console.error('Ошибка отправки уведомления:', error);
        }
    }

    // Отправка уведомлений мастерам о новом заказе
    async function notifyMastersAboutNewOrder(order) {
        try {
            // Находим мастеров нужной категории
            const mastersSnapshot = await db.collection('users')
                .where('role', '==', 'master')
                .where('banned', '==', false)
                .get();

            const notifications = [];
            
            mastersSnapshot.forEach(doc => {
                const master = doc.data();
                
                // Проверяем, подходит ли мастер по категории
                if (master.categories?.toLowerCase().includes(order.category?.toLowerCase())) {
                    notifications.push({
                        userId: doc.id,
                        type: 'new_order',
                        title: '🔔 Новый заказ',
                        body: `${order.title} — ${Utils.formatMoney(order.price)}`,
                        data: { 
                            orderId: order.id,
                            category: order.category,
                            price: order.price
                        },
                        read: false,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                }
            });

            // Сохраняем все уведомления батчем
            if (notifications.length > 0) {
                const batch = db.batch();
                notifications.forEach(notif => {
                    const ref = db.collection('notifications').doc();
                    batch.set(ref, notif);
                });
                await batch.commit();
                
                console.log(`📬 Отправлено ${notifications.length} уведомлений мастерам`);
            }
            
        } catch (error) {
            console.error('Ошибка при уведомлении мастеров:', error);
        }
    }

    const api = {
        init,
        refreshToken,
        deleteToken,
        sendToUser,
        notifyMastersAboutNewOrder,
        getCurrentToken: () => currentToken,
        isSupported: () => !!window.firebase?.messaging
    };

    window.__PUSH_SERVICE_INITIALIZED__ = true;
    return Object.freeze(api);
})();

document.addEventListener('DOMContentLoaded', () => {
    // Инициализируем после авторизации
    setTimeout(() => {
        if (Auth.isAuthenticated()) {
            PushService.init();
        }
    }, 2000);
});

window.PushService = PushService;