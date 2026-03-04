// ============================================
// СЕРВИС ЧАТА С КЭШИРОВАНИЕМ
// ============================================

const Chat = (function() {
    // Защита от повторных инициализаций
    if (window.__CHAT_INITIALIZED__) {
        return window.Chat;
    }

    // ===== ПРИВАТНЫЕ ПЕРЕМЕННЫЕ =====
    let activeListeners = new Map();
    let spamPrevention = new Map();
    let notificationPermission = false;
    
    // Кэш для чатов
    const chatsCache = new Map();
    const messagesCache = new Map();
    const CHAT_CACHE_TTL = 5 * 60 * 1000; // 5 минут
    const MESSAGES_CACHE_TTL = 2 * 60 * 1000; // 2 минуты

    // ===== РАБОТА С КЭШЕМ ЧАТОВ =====
    function getChatsFromCache(userId) {
        const cached = chatsCache.get(userId);
        if (!cached) return null;
        
        if (Date.now() - cached.timestamp > CHAT_CACHE_TTL) {
            chatsCache.delete(userId);
            return null;
        }
        
        return cached.data;
    }

    function setChatsToCache(userId, chats) {
        chatsCache.set(userId, {
            data: chats,
            timestamp: Date.now()
        });
    }

    function getMessagesFromCache(chatId) {
        const cached = messagesCache.get(chatId);
        if (!cached) return null;
        
        if (Date.now() - cached.timestamp > MESSAGES_CACHE_TTL) {
            messagesCache.delete(chatId);
            return null;
        }
        
        return cached.data;
    }

    function setMessagesToCache(chatId, messages) {
        messagesCache.set(chatId, {
            data: messages,
            timestamp: Date.now()
        });
    }

    function clearChatsCache(userId) {
        if (userId) {
            chatsCache.delete(userId);
        } else {
            chatsCache.clear();
        }
    }

    function clearMessagesCache(chatId) {
        if (chatId) {
            messagesCache.delete(chatId);
        } else {
            messagesCache.clear();
        }
    }

    // ===== ИНИЦИАЛИЗАЦИЯ =====
    function init() {
        requestNotificationPermission();
        console.log('✅ Chat сервис загружен (с кэшированием)');
    }

    // ===== УВЕДОМЛЕНИЯ =====
    async function requestNotificationPermission() {
        if (!('Notification' in window)) {
            console.log('Браузер не поддерживает уведомления');
            return false;
        }
        
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
        if (!notificationPermission && Notification.permission !== 'granted') {
            return null;
        }
        
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
            if (!Utils.checkFirebase()) return [];
            
            // Проверяем кэш
            const cached = getChatsFromCache(userId);
            if (cached && !options.forceRefresh) {
                console.log(`📦 Чаты из кэша для ${userId}`);
                return cached;
            }
            
            const snapshot = await db.collection('chats')
                .where('participants', 'array-contains', userId)
                .orderBy('lastMessageAt', 'desc')
                .limit(options.limit || 50)
                .get();
            
            const chats = [];
            
            for (const doc of snapshot.docs) {
                const chat = doc.data();
                const otherId = chat.participants.find(id => id !== userId);
                
                if (otherId) {
                    try {
                        const userDoc = await db.collection('users').doc(otherId).get();
                        const user = userDoc.exists ? userDoc.data() : { name: 'Пользователь' };
                        
                        chats.push({
                            id: doc.id,
                            ...chat,
                            partnerId: otherId,
                            partnerName: user.name || 'Пользователь',
                            partnerRole: user.role || 'client',
                            partnerAvatar: user.avatar || null,
                            unreadCount: chat.unreadCount?.[userId] || 0,
                            lastMessage: chat.lastMessage || 'Нет сообщений',
                            lastMessageAt: chat.lastMessageAt?.toDate?.() || new Date(),
                            createdAt: chat.createdAt?.toDate?.() || new Date()
                        });
                    } catch (userError) {
                        console.error('Ошибка загрузки данных партнёра:', userError);
                        chats.push({
                            id: doc.id,
                            ...chat,
                            partnerId: otherId,
                            partnerName: 'Пользователь',
                            partnerRole: 'client',
                            unreadCount: chat.unreadCount?.[userId] || 0
                        });
                    }
                }
            }
            
            // Сохраняем в кэш
            setChatsToCache(userId, chats);
            
            return chats;
            
        } catch (error) {
            console.error('❌ Ошибка загрузки чатов:', error);
            return [];
        }
    }

    // ===== ПОЛУЧЕНИЕ ЧАТА ПО ID =====
    async function getChat(chatId, forceRefresh = false) {
        try {
            if (!Utils.checkFirebase()) return null;
            
            // Проверяем кэш (для чатов используем chatsCache с префиксом)
            const cacheKey = `chat_${chatId}`;
            if (!forceRefresh) {
                const cached = Utils.getMemoryCache?.(cacheKey);
                if (cached) return cached;
            }
            
            const doc = await db.collection('chats').doc(chatId).get();
            if (!doc.exists) return null;
            
            const chatData = { id: doc.id, ...doc.data() };
            
            // Сохраняем в кэш
            Utils.setMemoryCache?.(cacheKey, chatData, 300000);
            
            return chatData;
        } catch (error) {
            console.error('❌ Ошибка загрузки чата:', error);
            return null;
        }
    }

    // ===== ПОДПИСКА НА СООБЩЕНИЯ =====
    function subscribeToMessages(chatId, callback) {
        if (!Utils.checkFirebase()) return null;
        
        // Отписываемся от предыдущей подписки
        if (activeListeners.has(chatId)) {
            activeListeners.get(chatId)();
            activeListeners.delete(chatId);
        }
        
        const unsubscribe = db.collection('chats').doc(chatId)
            .collection('messages')
            .orderBy('timestamp', 'asc')
            .onSnapshot((snapshot) => {
                const messages = [];
                let hasNewFromOthers = false;
                
                snapshot.forEach(doc => {
                    const data = doc.data();
                    const message = {
                        id: doc.id,
                        ...data,
                        timestamp: data.timestamp?.toDate?.() || new Date()
                    };
                    messages.push(message);
                    
                    if (data.senderId !== 'system' && 
                        data.senderId !== Auth.getUser()?.uid &&
                        !data.read) {
                        hasNewFromOthers = true;
                    }
                });
                
                callback(messages);
                
                // Сохраняем в кэш
                setMessagesToCache(chatId, messages);
                
                if (hasNewFromOthers && document.hidden) {
                    const lastMsg = messages[messages.length - 1];
                    if (lastMsg && lastMsg.senderId !== Auth.getUser()?.uid) {
                        showBrowserNotification('Новое сообщение', {
                            body: `${lastMsg.senderName || 'Пользователь'}: ${lastMsg.text || '📎 Файл'}`,
                            data: { chatId, messageId: lastMsg.id },
                            tag: `chat-${chatId}`,
                            renotify: true
                        });
                    }
                }
            }, (error) => {
                console.error('❌ Ошибка подписки на сообщения:', error);
                Utils.showError('Не удалось загрузить сообщения');
                callback([]);
            });
        
        activeListeners.set(chatId, unsubscribe);
        return unsubscribe;
    }

    // ===== ОТПИСКА ОТ ЧАТА =====
    function unsubscribeFromChat(chatId) {
        if (activeListeners.has(chatId)) {
            activeListeners.get(chatId)();
            activeListeners.delete(chatId);
        }
    }

    // ===== ОТПРАВКА СООБЩЕНИЯ =====
    async function sendMessage(chatId, text, files = []) {
        try {
            if (!Utils.checkFirebase()) return { success: false, error: 'Firestore недоступен' };
            if (!Auth.isAuthenticated()) throw new Error('Необходимо авторизоваться');

            const user = Auth.getUser();
            const userData = Auth.getUserData();
            
            const now = Date.now();
            const lastMsg = spamPrevention.get(user.uid) || 0;
            if (now - lastMsg < CONFIG.app.limits.messageCooldown) {
                return { success: false, error: 'Слишком часто' };
            }
            spamPrevention.set(user.uid, now);
            setTimeout(() => spamPrevention.delete(user.uid), CONFIG.app.limits.messageCooldown);

            if (text && text.length > CONFIG.app.limits.maxMessageLength) {
                return { success: false, error: `Сообщение слишком длинное (макс ${CONFIG.app.limits.maxMessageLength} символов)` };
            }

            if (text && window.Moderation) {
                const modResult = Moderation.check(text, 'chat_message');
                if (!modResult.isValid) {
                    return { success: false, error: modResult.reason || 'Текст не прошел модерацию' };
                }
            }

            const fileUrls = [];
            if (files && files.length > 0) {
                for (const file of files) {
                    if (file.size > CONFIG.app.limits.maxFileSize) {
                        Utils.showWarning(`Файл ${file.name} слишком большой (макс 25MB)`);
                        continue;
                    }
                    
                    try {
                        const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
                        const storageRef = storage.ref(`chat_files/${chatId}/${fileName}`);
                        
                        const task = storageRef.put(file);
                        
                        task.on('state_changed', (snapshot) => {
                            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                            console.log(`Загрузка ${file.name}: ${progress.toFixed(0)}%`);
                        });

                        await task;
                        const url = await storageRef.getDownloadURL();
                        
                        fileUrls.push({
                            name: file.name,
                            url: url,
                            type: file.type,
                            size: file.size,
                            contentType: file.type
                        });
                    } catch (uploadError) {
                        console.error('Ошибка загрузки файла:', uploadError);
                        Utils.showWarning(`Не удалось загрузить ${file.name}`);
                    }
                }
            }

            if (!text && fileUrls.length === 0) {
                return { success: false, error: 'Нет содержимого для отправки' };
            }

            const chatDoc = await db.collection('chats').doc(chatId).get();
            if (!chatDoc.exists) {
                return { success: false, error: 'Чат не найден' };
            }
            
            const chatData = chatDoc.data();
            const otherId = chatData.participants.find(id => id !== user.uid);

            const message = {
                senderId: user.uid,
                senderName: userData?.name || 'Пользователь',
                text: text?.trim() || '',
                files: fileUrls,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                read: false,
                type: fileUrls.length > 0 ? (fileUrls[0].type?.startsWith('image/') ? 'image' : 'file') : 'text'
            };

            await db.collection('chats').doc(chatId)
                .collection('messages')
                .add(message);

            const updateData = {
                lastMessage: text || (fileUrls.length > 0 ? '📎 Файл' : ''),
                lastMessageAt: firebase.firestore.FieldValue.serverTimestamp(),
                [`unreadCount.${otherId}`]: firebase.firestore.FieldValue.increment(1)
            };

            if (!chatData.lastMessageAt) {
                updateData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            }

            await db.collection('chats').doc(chatId).update(updateData);
            
            // Очищаем кэш чатов для обоих участников
            clearChatsCache(user.uid);
            if (otherId) {
                clearChatsCache(otherId);
            }

            return { success: true, files: fileUrls };
            
        } catch (error) {
            console.error('❌ Ошибка отправки сообщения:', error);
            Utils.showError(error.message || 'Ошибка отправки');
            return { success: false, error: error.message };
        }
    }

    // ===== ОТМЕТКА О ПРОЧТЕНИИ =====
    async function markAsRead(chatId) {
        try {
            if (!Utils.checkFirebase() || !Auth.isAuthenticated()) return false;
            
            const user = Auth.getUser();
            
            const snapshot = await db.collection('chats').doc(chatId)
                .collection('messages')
                .where('read', '==', false)
                .where('senderId', '!=', user.uid)
                .get();
            
            const batch = db.batch();
            snapshot.forEach(doc => {
                batch.update(doc.ref, { read: true });
            });
            
            await batch.commit();
            
            await db.collection('chats').doc(chatId).update({
                [`unreadCount.${user.uid}`]: 0
            });
            
            // Очищаем кэш для этого чата
            clearMessagesCache(chatId);
            
            return true;
        } catch (error) {
            console.error('❌ Ошибка отметки о прочтении:', error);
            return false;
        }
    }

    // ===== ПОЛУЧЕНИЕ СООБЩЕНИЙ (однократно) =====
    async function getMessages(chatId, limit = 50, before = null, forceRefresh = false) {
        try {
            if (!Utils.checkFirebase()) return [];
            
            // Проверяем кэш
            if (!forceRefresh && !before) {
                const cached = getMessagesFromCache(chatId);
                if (cached) {
                    console.log(`📦 Сообщения из кэша для ${chatId}`);
                    return cached;
                }
            }
            
            let query = db.collection('chats').doc(chatId)
                .collection('messages')
                .orderBy('timestamp', 'desc');
            
            if (before) {
                query = query.startAfter(before);
            }
            
            query = query.limit(limit);
            
            const snapshot = await query.get();
            
            const messages = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                messages.push({
                    id: doc.id,
                    ...data,
                    timestamp: data.timestamp?.toDate?.() || new Date()
                });
            });
            
            const reversedMessages = messages.reverse();
            
            // Сохраняем в кэш только полную загрузку (без before)
            if (!before) {
                setMessagesToCache(chatId, reversedMessages);
            }
            
            return reversedMessages;
            
        } catch (error) {
            console.error('❌ Ошибка загрузки сообщений:', error);
            return [];
        }
    }

    // ===== ЗАГРУЗКА СТАРЫХ СООБЩЕНИЙ (пагинация) =====
    async function loadMoreMessages(chatId, lastMessageId, limit = 20) {
        try {
            if (!Utils.checkFirebase()) return [];
            
            const lastMsgDoc = await db.collection('chats').doc(chatId)
                .collection('messages')
                .doc(lastMessageId)
                .get();
            
            if (!lastMsgDoc.exists) return [];
            
            const snapshot = await db.collection('chats').doc(chatId)
                .collection('messages')
                .orderBy('timestamp', 'desc')
                .startAfter(lastMsgDoc)
                .limit(limit)
                .get();
            
            const messages = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                messages.push({
                    id: doc.id,
                    ...data,
                    timestamp: data.timestamp?.toDate?.() || new Date()
                });
            });
            
            return messages.reverse();
            
        } catch (error) {
            console.error('❌ Ошибка загрузки старых сообщений:', error);
            return [];
        }
    }

    // ===== УДАЛЕНИЕ СООБЩЕНИЯ =====
    async function deleteMessage(chatId, messageId) {
        try {
            if (!Utils.checkFirebase() || !Auth.isAuthenticated()) {
                return { success: false, error: 'Не авторизован' };
            }
            
            const user = Auth.getUser();
            const messageRef = db.collection('chats').doc(chatId)
                .collection('messages')
                .doc(messageId);
            
            const messageDoc = await messageRef.get();
            
            if (!messageDoc.exists) {
                return { success: false, error: 'Сообщение не найдено' };
            }
            
            const message = messageDoc.data();
            
            if (message.senderId !== user.uid) {
                return { success: false, error: 'Нельзя удалить чужое сообщение' };
            }
            
            const messageDate = message.timestamp?.toDate?.() || new Date();
            const hoursDiff = (Date.now() - messageDate) / (1000 * 60 * 60);
            
            if (hoursDiff > 24) {
                return { success: false, error: 'Нельзя удалить сообщение старше 24 часов' };
            }
            
            await messageRef.update({
                deleted: true,
                text: '[сообщение удалено]',
                files: []
            });
            
            // Очищаем кэш сообщений
            clearMessagesCache(chatId);
            
            return { success: true };
            
        } catch (error) {
            console.error('❌ Ошибка удаления сообщения:', error);
            return { success: false, error: error.message };
        }
    }

    // ===== ПРОВЕРКА ДОСТУПА К ЧАТУ =====
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

    // ===== ПОЛУЧЕНИЕ НЕПРОЧИТАННЫХ =====
    async function getUnreadCount(userId) {
        try {
            if (!Utils.checkFirebase()) return 0;
            
            const snapshot = await db.collection('chats')
                .where('participants', 'array-contains', userId)
                .get();
            
            let total = 0;
            snapshot.forEach(doc => {
                const chat = doc.data();
                total += chat.unreadCount?.[userId] || 0;
            });
            
            return total;
            
        } catch (error) {
            console.error('Ошибка получения непрочитанных:', error);
            return 0;
        }
    }

    // ===== ПОДПИСКА НА НЕПРОЧИТАННЫЕ =====
    function subscribeToUnread(userId, callback) {
        if (!Utils.checkFirebase()) return null;
        
        const unsubscribe = db.collection('chats')
            .where('participants', 'array-contains', userId)
            .onSnapshot((snapshot) => {
                let total = 0;
                snapshot.forEach(doc => {
                    const chat = doc.data();
                    total += chat.unreadCount?.[userId] || 0;
                });
                callback(total);
                
                // При изменении непрочитанных, очищаем кэш чатов
                clearChatsCache(userId);
            }, (error) => {
                console.error('Ошибка подписки на непрочитанные:', error);
                callback(0);
            });
        
        return unsubscribe;
    }

    // ===== ОЧИСТКА =====
    function cleanup() {
        activeListeners.forEach((unsubscribe, chatId) => {
            try {
                unsubscribe();
            } catch (error) {
                console.error(`Ошибка отписки от чата ${chatId}:`, error);
            }
        });
        activeListeners.clear();
        spamPrevention.clear();
        chatsCache.clear();
        messagesCache.clear();
    }

    // ===== ПУБЛИЧНОЕ API =====
    const api = {
        init,
        getUserChats,
        getChat,
        subscribeToMessages,
        unsubscribeFromChat,
        sendMessage,
        markAsRead,
        getMessages,
        loadMoreMessages,
        deleteMessage,
        checkAccess,
        getUnreadCount,
        subscribeToUnread,
        cleanup,
        
        // Методы для кэша
        clearChatsCache,
        clearMessagesCache,
        
        // Уведомления
        requestNotificationPermission,
        showBrowserNotification
    };

    window.__CHAT_INITIALIZED__ = true;
    console.log('✅ Chat сервис загружен (с кэшированием)');
    
    return Object.freeze(api);
})();

// Автоинициализация
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        Chat.init();
    }, 1000);
});

window.Chat = Chat;