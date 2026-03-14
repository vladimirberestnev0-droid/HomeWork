// ============================================
// СЕРВИС ЧАТА - ПОЛНАЯ ВЕРСИЯ С ПОДДЕРЖКОЙ УДАЛЕНИЯ И PUSH
// ============================================

const Chat = (function() {
    if (window.__CHAT_INITIALIZED__) return window.Chat;

    // Антиспам
    const spamPrevention = new Map();
    let notificationPermission = false;

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
            return new Notification(title, {
                icon: '/HomeWork/icons/icon-192x192.png',
                badge: '/HomeWork/icons/icon-72x72.png',
                vibrate: [200, 100, 200],
                ...options
            });
        } catch (error) {
            console.error('Ошибка показа уведомления:', error);
            return null;
        }
    }

    // ===== ПОЛУЧЕНИЕ ЧАТОВ ПОЛЬЗОВАТЕЛЯ (С ФИЛЬТРАЦИЕЙ УДАЛЕННЫХ) =====
    async function getUserChats(userId, options = {}) {
        try {
            const cacheKey = `chats_${userId}`;
            if (!options.forceRefresh && Cache?.get) {
                const cached = Cache.get(cacheKey);
                if (cached) return cached;
            }

            const result = await DataService.getUserChats(userId, {
                limit: options.limit || 50
            });

            const chats = [];
            for (const chat of result.items) {
                // Пропускаем чаты, которые пользователь удалил (Пункт 18)
                if (chat.deletedFor && chat.deletedFor[userId]) {
                    continue;
                }
                
                const otherId = chat.participants.find(id => id !== userId);
                if (!otherId) continue;

                let user = Cache?.get(`user_${otherId}`);
                if (!user) {
                    user = await DataService.getUser(otherId) || { name: 'Пользователь' };
                    Cache?.set(`user_${otherId}`, user, Cache.TTL?.LONG);
                }

                // Получаем информацию о заказе для чата (Пункт 1)
                let orderTitle = chat.orderTitle || 'Заказ';
                let orderPrice = chat.orderPrice;
                
                if (chat.orderId && !orderTitle) {
                    try {
                        const order = await DataService.getOrder(chat.orderId);
                        if (order) {
                            orderTitle = order.title || 'Заказ';
                            orderPrice = order.price;
                        }
                    } catch (e) {
                        console.warn('Не удалось загрузить заказ для чата', e);
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
                    createdAt: chat.createdAt?.toDate?.() || new Date(),
                    orderTitle: orderTitle,
                    orderPrice: orderPrice
                });
            }

            // Сортируем по последнему сообщению
            chats.sort((a, b) => b.lastMessageAt - a.lastMessageAt);

            Cache?.set(cacheKey, chats, Cache.TTL?.MEDIUM);
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
            if (!forceRefresh && Cache?.get) {
                const cached = Cache.get(cacheKey);
                if (cached) return cached;
            }

            const chat = await DataService.getChat(chatId);
            if (chat && Cache?.set) {
                Cache.set(cacheKey, chat, Cache.TTL?.MEDIUM);
            }
            return chat;
        } catch (error) {
            console.error('❌ Ошибка загрузки чата:', error);
            return null;
        }
    }

    // ===== ПРОВЕРКА ДОСТУПА =====
    async function checkAccess(chatId, userId) {
        const chat = await getChat(chatId);
        return chat?.participants?.includes(userId) || false;
    }

    // ===== ПОДПИСКА НА СООБЩЕНИЯ =====
    function subscribeToMessages(chatId, callback) {
        const user = getUserSafe();
        if (!user) {
            console.warn('⚠️ Нет пользователя для подписки');
            return null;
        }

        return DataService.subscribeToMessages(
            chatId,
            (messages) => {
                callback(messages);
                Cache?.set(`messages_${chatId}`, messages, Cache.TTL?.SHORT);

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
                console.error('❌ Ошибка подписки:', error);
                Utils?.showError?.('Не удалось загрузить сообщения');
                callback([]);
            }
        );
    }

    // ===== ОТПРАВКА СООБЩЕНИЯ =====
    async function sendMessage(chatId, text, files = []) {
        try {
            const user = getUserSafe();
            const userData = getUserDataSafe();

            if (!user || !userData) {
                return { success: false, error: 'Необходимо авторизоваться' };
            }

            const chat = await DataService.getChat(chatId);
            if (!chat) return { success: false, error: 'Чат не найден' };
            if (chat.status === 'completed') {
                return { success: false, error: 'Чат закрыт после завершения заказа' };
            }

            // Антиспам
            const now = Date.now();
            const lastMsg = spamPrevention.get(user.uid) || 0;
            if (now - lastMsg < (CONFIG?.app?.limits?.messageCooldown || 1000)) {
                return { success: false, error: 'Слишком часто' };
            }
            spamPrevention.set(user.uid, now);
            setTimeout(() => spamPrevention.delete(user.uid), 1000);

            if (text?.length > (CONFIG?.app?.limits?.maxMessageLength || 5000)) {
                return { success: false, error: `Максимум ${CONFIG?.app?.limits?.maxMessageLength || 5000} символов` };
            }

            if (text && Moderation?.check) {
                const modResult = Moderation.check(text, 'chat_message');
                if (!modResult.isValid) {
                    return { success: false, error: modResult.reason || 'Текст не прошел модерацию' };
                }
            }

            // Загрузка файлов
            const fileUrls = [];
            if (files?.length > 0) {
                const uploadResult = await UploadService.uploadMultiple(
                    files,
                    `chat_files/${chatId}`,
                    {
                        maxSize: CONFIG?.app?.limits?.maxFileSize || 25 * 1024 * 1024,
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

                uploadResult.failed.forEach(f => {
                    Utils?.showWarning?.(`Не удалось загрузить ${f.file}: ${f.error}`);
                });
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
                lastMessageAt: firebase.firestore.FieldValue.serverTimestamp(),
                [`unreadCount.${otherId}`]: (chat.unreadCount?.[otherId] || 0) + 1
            });

            // Отправляем push-уведомление о новом сообщении (Пункт 21)
            if (window.PushService && otherId) {
                PushService.notifyNewMessage(
                    otherId,
                    userData.name || 'Пользователь',
                    text || (fileUrls.length > 0 ? '📎 Файл' : ''),
                    chatId
                ).catch(err => console.warn('⚠️ Ошибка push:', err));
            }

            Cache?.remove(`chats_${user.uid}`);
            if (otherId) Cache?.remove(`chats_${otherId}`);
            Cache?.remove(`messages_${chatId}`);

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

            const messages = await DataService.getMessages(chatId, { limit: 100 });
            const unreadFromOthers = messages.items.filter(msg => 
                !msg.read && msg.senderId !== user.uid
            );

            if (unreadFromOthers.length === 0) return true;

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
            Cache?.remove(`messages_${chatId}`);
            Cache?.remove(`chats_${user.uid}`);
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
            if (!forceRefresh && !before && Cache?.get) {
                const cached = Cache.get(cacheKey);
                if (cached) return cached;
            }

            const result = await DataService.getMessages(chatId, { limit, startAfter: before });
            
            if (!before && Cache?.set) {
                Cache.set(cacheKey, result.items, Cache.TTL?.SHORT);
            }
            return result.items;
        } catch (error) {
            console.error('❌ Ошибка загрузки сообщений:', error);
            return [];
        }
    }

    // ===== ПОЛУЧЕНИЕ НЕПРОЧИТАННЫХ =====
    async function getUnreadCount(userId) {
        try {
            const cacheKey = `unread_${userId}`;
            if (Cache?.get) {
                const cached = Cache.get(cacheKey);
                if (cached !== null) return cached;
            }

            const result = await DataService.getUserChats(userId);
            let total = 0;
            result.items.forEach(chat => {
                // Не учитываем удаленные чаты
                if (!chat.deletedFor || !chat.deletedFor[userId]) {
                    total += chat.unreadCount?.[userId] || 0;
                }
            });

            Cache?.set(cacheKey, total, Cache.TTL?.SHORT);
            return total;
        } catch (error) {
            console.error('Ошибка получения непрочитанных:', error);
            return 0;
        }
    }

    // ===== ПОДПИСКА НА НЕПРОЧИТАННЫЕ =====
    function subscribeToUnread(userId, callback) {
        const constraints = [
            { type: 'where', field: 'participants', operator: 'array-contains', value: userId }
        ];

        return DataService.subscribeToCollection(
            'chats',
            constraints,
            (chats) => {
                let total = 0;
                chats.forEach(chat => {
                    // Не учитываем удаленные чаты
                    if (!chat.deletedFor || !chat.deletedFor[userId]) {
                        total += chat.unreadCount?.[userId] || 0;
                    }
                });
                callback(total);
                Cache?.remove(`chats_${userId}`);
                Cache?.remove(`unread_${userId}`);
            },
            (error) => {
                console.error('Ошибка подписки на непрочитанные:', error);
                callback(0);
            }
        );
    }

    // ===== УДАЛЕНИЕ ЧАТА ДЛЯ ПОЛЬЗОВАТЕЛЯ (НОВОЕ - Пункт 18) =====
    async function deleteChatForUser(chatId, userId) {
        try {
            const chatRef = db.collection('chats').doc(chatId);
            
            await chatRef.update({
                [`deletedFor.${userId}`]: true,
                [`hiddenAt.${userId}`]: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            // Очищаем кэш
            Cache?.remove(`chats_${userId}`);
            Cache?.remove(`unread_${userId}`);
            
            return { success: true };
        } catch (error) {
            console.error('❌ Ошибка удаления чата:', error);
            return { success: false, error: error.message };
        }
    }

    // ===== БЛОКИРОВКА ПОЛЬЗОВАТЕЛЯ (ДЛЯ ЧАТА) =====
    async function blockUser(userId, blockedUserId) {
        try {
            const userRef = db.collection('users').doc(userId);
            
            await userRef.update({
                [`blockedUsers.${blockedUserId}`]: true,
                [`blockedAt.${blockedUserId}`]: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            return { success: true };
        } catch (error) {
            console.error('❌ Ошибка блокировки пользователя:', error);
            return { success: false, error: error.message };
        }
    }

    // ===== ПРОВЕРКА БЛОКИРОВКИ =====
    async function isBlocked(userId, otherUserId) {
        try {
            const userDoc = await db.collection('users').doc(userId).get();
            if (!userDoc.exists) return false;
            
            return userDoc.data().blockedUsers?.[otherUserId] === true;
        } catch (error) {
            console.error('❌ Ошибка проверки блокировки:', error);
            return false;
        }
    }

    // ===== ЖАЛОБА НА СООБЩЕНИЕ =====
    async function reportMessage(chatId, messageId, reason = '') {
        try {
            const user = getUserSafe();
            if (!user) return { success: false, error: 'Не авторизован' };

            await db.collection('reports').add({
                chatId,
                messageId,
                reporterId: user.uid,
                reason: reason || 'Нарушение правил',
                status: 'pending',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            Utils?.showSuccess?.('✅ Жалоба отправлена модератору');
            return { success: true };
        } catch (error) {
            console.error('❌ Ошибка отправки жалобы:', error);
            return { success: false, error: error.message };
        }
    }

    // ===== ИНИЦИАЛИЗАЦИЯ =====
    function init() {
        requestNotificationPermission();
        console.log('✅ Chat сервис загружен (полная версия с удалением чатов)');
    }

    // ===== ПУБЛИЧНОЕ API =====
    const api = {
        init,
        getUserChats,
        getChat,
        subscribeToMessages,
        sendMessage,
        markAsRead,
        getMessages,
        checkAccess,
        getUnreadCount,
        subscribeToUnread,
        deleteChatForUser,      // НОВЫЙ МЕТОД (Пункт 18)
        blockUser,               // НОВЫЙ МЕТОД
        isBlocked,               // НОВЫЙ МЕТОД
        reportMessage,           // НОВЫЙ МЕТОД
        requestNotificationPermission,
        showBrowserNotification
    };

    window.__CHAT_INITIALIZED__ = true;
    console.log('✅ Chat сервис загружен');
    return Object.freeze(api);
})();

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => Chat.init(), 1000);
});

window.Chat = Chat;