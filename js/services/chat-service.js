// ============================================
// СЕРВИС ЧАТА (ИСПРАВЛЕНО: утечки памяти, очистка подписок)
// ============================================
const Chat = (function() {
    if (window.__CHAT_INITIALIZED__) return window.Chat;

    // Антиспам
    const spamPrevention = new Map();
    let activeListeners = new Map(); // Map<chatId, { unsubscribe: Function, count: number }>
    let currentUserUnreadSub = null;
    let notificationPermission = false;
    let cleanupTimer = null;

    // ===== ВСПОМОГАТЕЛЬНЫЕ =====
    function getUserSafe() {
        try { return Auth?.getUser(); } 
        catch (e) { return null; }
    }

    function getUserDataSafe() {
        try { return Auth?.getUserData(); } 
        catch (e) { return null; }
    }

    // ===== УВЕДОМЛЕНИЯ =====
    async function requestNotificationPermission() {
        if (!('Notification' in window)) return false;

        if (Notification.permission === 'granted') {
            notificationPermission = true;
            return true;
        }

        if (Notification.permission !== 'denied') {
            try {
                const permission = await Notification.requestPermission();
                notificationPermission = permission === 'granted';
                return notificationPermission;
            } catch (error) {
                console.error('Ошибка запроса разрешения:', error);
                return false;
            }
        }
        return false;
    }

    function showBrowserNotification(title, options = {}) {
        if (!notificationPermission && Notification.permission !== 'granted') return null;

        try {
            const defaultOptions = {
                icon: '/HomeWork/icons/icon-192x192.png',
                badge: '/HomeWork/icons/icon-72x72.png',
                vibrate: [200, 100, 200],
                silent: false,
                ...options
            };
            return new Notification(title, defaultOptions);
        } catch (error) {
            console.error('Ошибка показа уведомления:', error);
            return null;
        }
    }

    // ===== ПОЛУЧЕНИЕ ЧАТОВ ПОЛЬЗОВАТЕЛЯ =====
    async function getUserChats(userId, options = {}) {
        try {
            const cacheKey = `chats_${userId}`;

            if (!options.forceRefresh && window.Cache) {
                const cached = Cache.get(cacheKey);
                if (cached) {
                    console.log(`📦 Чаты из кэша для ${userId}`);
                    return cached;
                }
            }

            const result = await DataService.getUserChats(userId, {
                limit: options.limit || 50
            });

            const chats = [];

            for (const chat of result.items) {
                const otherId = chat.participants.find(id => id !== userId);
                if (!otherId) continue;

                try {
                    // Получаем данные партнера (из кэша если есть)
                    let user = null;
                    if (window.Cache) {
                        user = Cache.get(`user_${otherId}`);
                    }

                    if (!user) {
                        user = await DataService.getUser(otherId) || { name: 'Пользователь' };
                        if (window.Cache && user) {
                            Cache.set(`user_${otherId}`, user, Cache.TTL.LONG);
                        }
                    }

                    chats.push({
                        id: chat.id,
                        ...chat,
                        partnerId: otherId,
                        partnerName: user.name || 'Пользователь',
                        partnerRole: user.role || 'client',
                        unreadCount: chat.unreadCount?.[userId] || 0,
                        lastMessage: chat.lastMessage || 'Нет сообщений',
                        lastMessageAt: chat.lastMessageAt?.toDate?.() || new Date(),
                        createdAt: chat.createdAt?.toDate?.() || new Date()
                    });
                } catch (userError) {
                    console.error('Ошибка загрузки данных партнёра:', userError);
                    chats.push({
                        id: chat.id,
                        ...chat,
                        partnerId: otherId,
                        partnerName: 'Пользователь',
                        partnerRole: 'client',
                        unreadCount: chat.unreadCount?.[userId] || 0
                    });
                }
            }

            if (window.Cache) {
                Cache.set(cacheKey, chats, Cache.TTL.MEDIUM);
            }

            return chats;
        } catch (error) {
            console.error('❌ Ошибка загрузки чатов:', error);
            return [];
        }
    }

    // ===== ПОЛУЧЕНИЕ ЧАТА ПО ID =====
    async function getChat(chatId, forceRefresh = false) {
        try {
            const cacheKey = `chat_${chatId}`;

            if (!forceRefresh && window.Cache) {
                const cached = Cache.get(cacheKey);
                if (cached) return cached;
            }

            const chat = await DataService.getChat(chatId);

            if (chat && window.Cache) {
                Cache.set(cacheKey, chat, Cache.TTL.MEDIUM);
            }

            return chat;
        } catch (error) {
            console.error('❌ Ошибка загрузки чата:', error);
            return null;
        }
    }

    // ===== ПРОВЕРКА ДОСТУПА =====
    async function checkAccess(chatId, userId) {
        try {
            const chat = await getChat(chatId);
            if (!chat) return false;
            return chat.participants && chat.participants.includes(userId);
        } catch (error) {
            console.error('Ошибка проверки доступа:', error);
            return false;
        }
    }

    // ===== ПОДПИСКА НА СООБЩЕНИЯ (ИСПРАВЛЕНО) =====
    function subscribeToMessages(chatId, callback) {
        // Если уже есть подписка, отписываемся
        if (activeListeners.has(chatId)) {
            const listenerData = activeListeners.get(chatId);
            if (listenerData && typeof listenerData.unsubscribe === 'function') {
                try {
                    listenerData.unsubscribe();
                } catch (error) {
                    console.error(`Ошибка отписки от чата ${chatId}:`, error);
                }
            }
            activeListeners.delete(chatId);
        }

        const user = getUserSafe();
        if (!user) {
            console.warn('⚠️ Нет пользователя для подписки');
            return null;
        }

        // Создаём новую подписку
        const unsubscribe = DataService.subscribeToMessages(
            chatId,
            (messages) => {
                callback(messages);

                // Кэшируем
                if (window.Cache) {
                    Cache.set(`messages_${chatId}`, messages, Cache.TTL.SHORT);
                }

                // Проверяем новые сообщения от других
                const hasNewFromOthers = messages.some(msg => 
                    msg.senderId !== 'system' && 
                    msg.senderId !== user.uid && 
                    !msg.read
                );

                if (hasNewFromOthers && document.hidden) {
                    const lastMsg = messages[messages.length - 1];
                    showBrowserNotification('Новое сообщение', {
                        body: `${lastMsg.senderName || 'Пользователь'}: ${lastMsg.text || '📎 Файл'}`,
                        data: { chatId, messageId: lastMsg.id },
                        tag: `chat-${chatId}`,
                        renotify: true
                    });

                    document.dispatchEvent(new CustomEvent('new-message', {
                        detail: { chatId, message: lastMsg }
                    }));
                }
            },
            (error) => {
                console.error('❌ Ошибка подписки на сообщения:', error);
                Utils?.showError?.('Не удалось загрузить сообщения');
                callback([]);
            }
        );

        // Сохраняем счётчик ссылок для отслеживания
        activeListeners.set(chatId, {
            unsubscribe,
            count: 1,
            createdAt: Date.now()
        });

        // Запускаем автоматическую очистку старых подписок
        scheduleCleanup();

        return unsubscribe;
    }

    // ===== ОТПИСКА (ИСПРАВЛЕНО) =====
    function unsubscribeFromChat(chatId) {
        if (activeListeners.has(chatId)) {
            const listenerData = activeListeners.get(chatId);
            
            // Уменьшаем счётчик ссылок
            if (listenerData.count > 1) {
                listenerData.count--;
                activeListeners.set(chatId, listenerData);
                return;
            }
            
            // Если это последняя ссылка - отписываемся
            if (listenerData && typeof listenerData.unsubscribe === 'function') {
                try {
                    listenerData.unsubscribe();
                } catch (error) {
                    console.error(`Ошибка отписки от чата ${chatId}:`, error);
                }
            }
            
            activeListeners.delete(chatId);
        }
    }

    // ===== ПЛАНОВАЯ ОЧИСТКА ПОДПИСОК (ИСПРАВЛЕНО) =====
    function scheduleCleanup() {
        if (cleanupTimer) {
            clearTimeout(cleanupTimer);
        }
        
        cleanupTimer = setTimeout(() => {
            cleanupStaleListeners();
            cleanupTimer = null;
        }, 5 * 60 * 1000); // Каждые 5 минут
    }

    function cleanupStaleListeners() {
        const now = Date.now();
        const STALE_TIME = 30 * 60 * 1000; // 30 минут
        
        activeListeners.forEach((listenerData, chatId) => {
            // Если подписка висит больше 30 минут и на неё нет ссылок - удаляем
            if (listenerData.count === 0 && (now - listenerData.createdAt) > STALE_TIME) {
                if (listenerData.unsubscribe) {
                    try {
                        listenerData.unsubscribe();
                    } catch (error) {
                        console.error(`Ошибка очистки подписки ${chatId}:`, error);
                    }
                }
                activeListeners.delete(chatId);
            }
        });
    }

    // ===== ОТПРАВКА СООБЩЕНИЯ =====
    async function sendMessage(chatId, text, files = []) {
        try {
            const user = getUserSafe();
            const userData = getUserDataSafe();

            if (!user || !userData) {
                return { success: false, error: 'Необходимо авторизоваться' };
            }

            // Проверка статуса чата
            const chat = await DataService.getChat(chatId);
            if (!chat) return { success: false, error: 'Чат не найден' };

            if (chat.status === 'completed') {
                return { success: false, error: 'Чат закрыт после завершения заказа' };
            }

            // Антиспам
            const now = Date.now();
            const lastMsg = spamPrevention.get(user.uid) || 0;
            if (now - lastMsg < CONFIG.app.limits.messageCooldown) {
                return { success: false, error: 'Слишком часто' };
            }
            spamPrevention.set(user.uid, now);
            setTimeout(() => spamPrevention.delete(user.uid), CONFIG.app.limits.messageCooldown);

            // Валидация текста
            if (text && text.length > CONFIG.app.limits.maxMessageLength) {
                return { success: false, error: `Сообщение слишком длинное (макс ${CONFIG.app.limits.maxMessageLength} символов)` };
            }

            // Модерация
            if (text && window.Moderation) {
                const modResult = Moderation.check(text, 'chat_message');
                if (!modResult.isValid) {
                    return { success: false, error: modResult.reason || 'Текст не прошел модерацию' };
                }
            }

            // Загрузка файлов
            const fileUrls = [];
            if (files && files.length > 0) {
                const uploadResult = await UploadService.uploadMultiple(
                    files,
                    `chat_files/${chatId}`,
                    {
                        maxSize: CONFIG.app.limits.maxFileSize,
                        maxFiles: 10,
                        onFileProgress: (index, progress, fileName) => {
                            console.log(`📎 Загрузка ${fileName}: ${progress.toFixed(1)}%`);
                        }
                    }
                );

                fileUrls.push(...uploadResult.success.map(r => ({
                    name: r.name,
                    url: r.url,
                    type: r.type,
                    size: r.size
                })));

                if (uploadResult.failed.length > 0) {
                    uploadResult.failed.forEach(f => {
                        Utils?.showWarning?.(`Не удалось загрузить ${f.file}: ${f.error}`);
                    });
                }
            }

            if (!text && fileUrls.length === 0) {
                return { success: false, error: 'Нет содержимого для отправки' };
            }

            const otherId = chat.participants.find(id => id !== user.uid);

            // Отправляем сообщение
            const messageResult = await DataService.sendMessage(chatId, {
                senderId: user.uid,
                senderName: userData.name || 'Пользователь',
                text: text?.trim() || '',
                files: fileUrls,
                read: false,
                type: fileUrls.length > 0 ? (fileUrls[0].type?.startsWith('image/') ? 'image' : 'file') : 'text'
            });

            // Обновляем чат
            await DataService.updateChat(chatId, {
                lastMessage: text || (fileUrls.length > 0 ? '📎 Файл' : ''),
                [`unreadCount.${otherId}`]: firebase.firestore.FieldValue.increment(1)
            });

            // Инвалидируем кэш
            if (window.Cache) {
                Cache.remove(`chats_${user.uid}`);
                if (otherId) Cache.remove(`chats_${otherId}`);
                Cache.remove(`messages_${chatId}`);
            }

            return { success: true, files: fileUrls };
        } catch (error) {
            console.error('❌ Ошибка отправки сообщения:', error);
            Utils?.showError?.(error.message || 'Ошибка отправки');
            return { success: false, error: error.message };
        }
    }

    // ===== ОТМЕТКА О ПРОЧТЕНИИ =====
    async function markAsRead(chatId) {
        try {
            const user = getUserSafe();
            if (!user) return false;

            // Получаем все непрочитанные сообщения от других
            const messagesResult = await DataService.getMessages(chatId, { limit: 100 });
            
            const unreadFromOthers = messagesResult.items.filter(msg => 
                !msg.read && msg.senderId !== user.uid
            );

            if (unreadFromOthers.length === 0) return true;

            // Обновляем каждое сообщение
            const batch = DataService.batch();
            
            unreadFromOthers.forEach(msg => {
                const msgRef = firebase.firestore()
                    .collection('chats').doc(chatId)
                    .collection('messages').doc(msg.id);
                batch.update(msgRef, { read: true });
            });

            batch.update(
                firebase.firestore().collection('chats').doc(chatId),
                { [`unreadCount.${user.uid}`]: 0 }
            );

            await batch.commit();

            // Инвалидируем кэш
            if (window.Cache) {
                Cache.remove(`messages_${chatId}`);
                Cache.remove(`chats_${user.uid}`);
            }

            return true;
        } catch (error) {
            console.error('❌ Ошибка отметки о прочтении:', error);
            return false;
        }
    }

    // ===== ПОЛУЧЕНИЕ СООБЩЕНИЙ =====
    async function getMessages(chatId, limit = 50, before = null, forceRefresh = false) {
        try {
            const cacheKey = `messages_${chatId}_${limit}_${before || ''}`;

            if (!forceRefresh && !before && window.Cache) {
                const cached = Cache.get(cacheKey);
                if (cached) return cached;
            }

            const result = await DataService.getMessages(chatId, {
                limit,
                startAfter: before
            });

            const messages = result.items;

            if (!before && window.Cache) {
                Cache.set(cacheKey, messages, Cache.TTL.SHORT);
            }

            return messages;
        } catch (error) {
            console.error('❌ Ошибка загрузки сообщений:', error);
            return [];
        }
    }

    // ===== ПОЛУЧЕНИЕ НЕПРОЧИТАННЫХ =====
    async function getUnreadCount(userId) {
        try {
            const cacheKey = `unread_${userId}`;

            if (window.Cache) {
                const cached = Cache.get(cacheKey);
                if (cached !== null) return cached;
            }

            const result = await DataService.getUserChats(userId);
            
            let total = 0;
            result.items.forEach(chat => {
                total += chat.unreadCount?.[userId] || 0;
            });

            if (window.Cache) {
                Cache.set(cacheKey, total, Cache.TTL.SHORT);
            }

            return total;
        } catch (error) {
            console.error('Ошибка получения непрочитанных:', error);
            return 0;
        }
    }

    // ===== ПОДПИСКА НА НЕПРОЧИТАННЫЕ =====
    function subscribeToUnread(userId, callback) {
        if (currentUserUnreadSub) {
            currentUserUnreadSub();
            currentUserUnreadSub = null;
        }

        const constraints = [
            { type: 'where', field: 'participants', operator: 'array-contains', value: userId }
        ];

        currentUserUnreadSub = DataService.subscribeToCollection(
            'chats',
            constraints,
            (chats) => {
                let total = 0;
                chats.forEach(chat => {
                    total += chat.unreadCount?.[userId] || 0;
                });
                callback(total);

                // Инвалидируем кэш
                if (window.Cache) {
                    Cache.remove(`chats_${userId}`);
                    Cache.remove(`unread_${userId}`);
                }
            },
            (error) => {
                console.error('Ошибка подписки на непрочитанные:', error);
                callback(0);
            }
        );

        return currentUserUnreadSub;
    }

    // ===== УДАЛЕНИЕ СООБЩЕНИЯ =====
    async function deleteMessage(chatId, messageId) {
        try {
            const user = getUserSafe();
            if (!user) return { success: false, error: 'Не авторизован' };

            const messages = await getMessages(chatId, 1, messageId, true);
            const message = messages[0];

            if (!message) return { success: false, error: 'Сообщение не найдено' };

            if (message.senderId !== user.uid) {
                return { success: false, error: 'Нельзя удалить чужое сообщение' };
            }

            const messageDate = message.timestamp instanceof Date ? message.timestamp : new Date(message.timestamp);
            const hoursDiff = (Date.now() - messageDate) / (1000 * 60 * 60);

            if (hoursDiff > 24) {
                return { success: false, error: 'Нельзя удалить сообщение старше 24 часов' };
            }

            const msgRef = firebase.firestore()
                .collection('chats').doc(chatId)
                .collection('messages').doc(messageId);

            await msgRef.update({
                deleted: true,
                text: '[сообщение удалено]',
                files: []
            });

            if (window.Cache) {
                Cache.remove(`messages_${chatId}`);
            }

            return { success: true };
        } catch (error) {
            console.error('❌ Ошибка удаления сообщения:', error);
            return { success: false, error: error.message };
        }
    }

    // ===== ИНИЦИАЛИЗАЦИЯ =====
    function init() {
        requestNotificationPermission();

        if (window.Auth) {
            Auth.onAuthChange((state) => {
                if (!state.isAuthenticated) {
                    cleanup();
                }
            });
        }

        console.log('✅ Chat сервис загружен');
    }

    // ===== ОЧИСТКА (ИСПРАВЛЕНО) =====
    function cleanup() {
        // Отписываемся от всех активных чатов
        activeListeners.forEach((listenerData, chatId) => {
            try { 
                if (listenerData.unsubscribe) {
                    listenerData.unsubscribe();
                }
            } catch (error) { 
                console.error(`Ошибка отписки от чата ${chatId}:`, error); 
            }
        });
        activeListeners.clear();

        if (currentUserUnreadSub) {
            try { 
                currentUserUnreadSub(); 
            } catch (error) { 
                console.error('Ошибка отписки от непрочитанных:', error); 
            }
            currentUserUnreadSub = null;
        }

        if (cleanupTimer) {
            clearTimeout(cleanupTimer);
            cleanupTimer = null;
        }

        spamPrevention.clear();
    }

    const api = {
        init,
        getUserChats,
        getChat,
        subscribeToMessages,
        unsubscribeFromChat,
        sendMessage,
        markAsRead,
        getMessages,
        deleteMessage,
        checkAccess,
        getUnreadCount,
        subscribeToUnread,
        cleanup,
        requestNotificationPermission,
        showBrowserNotification
    };

    window.__CHAT_INITIALIZED__ = true;
    console.log('✅ Chat сервис загружен (исправленная версия)');

    return Object.freeze(api);
})();

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => Chat.init(), 1000);
});

window.Chat = Chat;