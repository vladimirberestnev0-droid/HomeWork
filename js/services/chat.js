// ============================================
// СЕРВИС ЧАТА С ОПТИМИЗАЦИЕЙ
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
    let currentUserUnreadSub = null;
    
    // Кэш
    const chatsCache = new Map();
    const messagesCache = new Map();
    const CHAT_CACHE_TTL = 5 * 60 * 1000;
    const MESSAGES_CACHE_TTL = 2 * 60 * 1000;

    // ===== ПРОВЕРКИ =====
    function checkFirebase() {
        if (!window.db) {
            console.warn('⏳ Firestore не инициализирован');
            return false;
        }
        return true;
    }

    function getUserSafe() {
        try {
            return Auth?.getUser();
        } catch (e) {
            return null;
        }
    }

    function getUserDataSafe() {
        try {
            return Auth?.getUserData();
        } catch (e) {
            return null;
        }
    }

    // ===== РАБОТА С КЭШЕМ =====
    function setChatsCache(userId, chats) {
        if (!userId) return;
        chatsCache.set(`chats_${userId}`, {
            data: chats,
            timestamp: Date.now()
        });
    }

    function getChatsCache(userId) {
        if (!userId) return null;
        
        const cached = chatsCache.get(`chats_${userId}`);
        if (!cached) return null;
        
        if (Date.now() - cached.timestamp > CHAT_CACHE_TTL) {
            chatsCache.delete(`chats_${userId}`);
            return null;
        }
        return cached.data;
    }

    function setMessagesCache(chatId, messages) {
        if (!chatId) return;
        messagesCache.set(`messages_${chatId}`, {
            data: messages,
            timestamp: Date.now()
        });
    }

    function getMessagesCache(chatId) {
        if (!chatId) return null;
        
        const cached = messagesCache.get(`messages_${chatId}`);
        if (!cached) return null;
        
        if (Date.now() - cached.timestamp > MESSAGES_CACHE_TTL) {
            messagesCache.delete(`messages_${chatId}`);
            return null;
        }
        return cached.data;
    }

    function clearChatsCache(userId) {
        if (userId) {
            chatsCache.delete(`chats_${userId}`);
        } else {
            chatsCache.clear();
        }
    }

    function clearMessagesCache(chatId) {
        if (chatId) {
            messagesCache.delete(`messages_${chatId}`);
        } else {
            messagesCache.clear();
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
        
        console.log('✅ Chat сервис загружен (оптимизированный)');
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
            if (!checkFirebase()) return [];
            
            if (!options.forceRefresh) {
                const cached = getChatsCache(userId);
                if (cached) {
                    console.log(`📦 Чаты из кэша для ${userId}`);
                    return cached;
                }
            }
            
            const snapshot = await db.collection('chats')
                .where('participants', 'array-contains', userId)
                .orderBy('lastMessageAt', 'desc')
                .limit(options.limit || 50)
                .get();
            
            const chats = [];
            const batchSize = 10;
            
            for (let i = 0; i < snapshot.docs.length; i += batchSize) {
                const batch = snapshot.docs.slice(i, i + batchSize);
                const promises = batch.map(async (doc) => {
                    const chat = doc.data();
                    const otherId = chat.participants.find(id => id !== userId);
                    
                    if (!otherId) return null;
                    
                    try {
                        let user = null;
                        if (window.Auth) {
                            const cachedUser = Auth.getUserFromCache?.(otherId);
                            if (cachedUser) {
                                user = cachedUser;
                            }
                        }
                        
                        if (!user) {
                            const userDoc = await db.collection('users').doc(otherId).get();
                            user = userDoc.exists ? userDoc.data() : { name: 'Пользователь' };
                        }
                        
                        return {
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
                        };
                    } catch (userError) {
                        console.error('Ошибка загрузки данных партнёра:', userError);
                        return {
                            id: doc.id,
                            ...chat,
                            partnerId: otherId,
                            partnerName: 'Пользователь',
                            partnerRole: 'client',
                            unreadCount: chat.unreadCount?.[userId] || 0
                        };
                    }
                });
                
                const batchResults = await Promise.all(promises);
                chats.push(...batchResults.filter(Boolean));
            }
            
            setChatsCache(userId, chats);
            return chats;
            
        } catch (error) {
            console.error('❌ Ошибка загрузки чатов:', error);
            return [];
        }
    }

    // ===== ПОЛУЧЕНИЕ ЧАТА ПО ID =====
    async function getChat(chatId, forceRefresh = false) {
        try {
            if (!checkFirebase()) return null;
            
            if (!forceRefresh) {
                const cached = Utils?.getMemoryCache?.(`chat_${chatId}`);
                if (cached) return cached;
            }
            
            const doc = await db.collection('chats').doc(chatId).get();
            if (!doc.exists) return null;
            
            const chatData = { id: doc.id, ...doc.data() };
            
            Utils?.setMemoryCache?.(`chat_${chatId}`, chatData, 300000);
            
            return chatData;
        } catch (error) {
            console.error('❌ Ошибка загрузки чата:', error);
            return null;
        }
    }

    // ===== ПОДПИСКА НА СООБЩЕНИЯ =====
    function subscribeToMessages(chatId, callback) {
        if (!checkFirebase()) return null;
        
        if (activeListeners.has(chatId)) {
            const oldUnsub = activeListeners.get(chatId);
            if (typeof oldUnsub === 'function') {
                oldUnsub();
            }
            activeListeners.delete(chatId);
        }
        
        const user = getUserSafe();
        if (!user) return null;
        
        const unsubscribe = db.collection('chats').doc(chatId)
            .collection('messages')
            .orderBy('timestamp', 'asc')
            .onSnapshot((snapshot) => {
                const messages = [];
                let hasNewFromOthers = false;
                
                snapshot.docChanges().forEach((change) => {
                    const data = change.doc.data();
                    const message = {
                        id: change.doc.id,
                        ...data,
                        timestamp: data.timestamp?.toDate?.() || new Date()
                    };
                    
                    if (change.type === 'added') {
                        messages.push(message);
                        
                        if (data.senderId !== 'system' && 
                            data.senderId !== user.uid &&
                            !data.read) {
                            hasNewFromOthers = true;
                        }
                    }
                });
                
                if (snapshot.docChanges().length > 0) {
                    const allMessages = [];
                    snapshot.forEach(doc => {
                        const data = doc.data();
                        allMessages.push({
                            id: doc.id,
                            ...data,
                            timestamp: data.timestamp?.toDate?.() || new Date()
                        });
                    });
                    
                    callback(allMessages);
                    
                    setMessagesCache(chatId, allMessages);
                }
                
                if (hasNewFromOthers && document.hidden) {
                    const lastMsg = messages[messages.length - 1];
                    if (lastMsg && lastMsg.senderId !== user.uid) {
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
                }
            }, (error) => {
                console.error('❌ Ошибка подписки на сообщения:', error);
                Utils?.showError?.('Не удалось загрузить сообщения');
                callback([]);
            });
        
        activeListeners.set(chatId, unsubscribe);
        return unsubscribe;
    }

    // ===== ОТПИСКА ОТ ЧАТА =====
    function unsubscribeFromChat(chatId) {
        if (activeListeners.has(chatId)) {
            const unsubscribe = activeListeners.get(chatId);
            if (typeof unsubscribe === 'function') {
                unsubscribe();
            }
            activeListeners.delete(chatId);
        }
    }

    // ===== ОТПРАВКА СООБЩЕНИЯ =====
    async function sendMessage(chatId, text, files = []) {
        try {
            if (!checkFirebase()) return { success: false, error: 'Firestore недоступен' };
            
            const user = getUserSafe();
            const userData = getUserDataSafe();
            
            if (!user || !userData) {
                return { success: false, error: 'Необходимо авторизоваться' };
            }

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
                        Utils?.showWarning?.(`Файл ${file.name} слишком большой (макс 25MB)`);
                        continue;
                    }
                    
                    try {
                        const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
                        const storageRef = storage.ref(`chat_files/${chatId}/${fileName}`);
                        
                        await storageRef.put(file);
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
                        Utils?.showWarning?.(`Не удалось загрузить ${file.name}`);
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
                senderName: userData.name || 'Пользователь',
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
            
            clearChatsCache(user.uid);
            if (otherId) {
                clearChatsCache(otherId);
            }
            clearMessagesCache(chatId);

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
            if (!checkFirebase()) return false;
            
            const user = getUserSafe();
            if (!user) return false;
            
            await db.runTransaction(async (transaction) => {
                const messagesRef = db.collection('chats').doc(chatId).collection('messages');
                const snapshot = await messagesRef
                    .where('read', '==', false)
                    .where('senderId', '!=', user.uid)
                    .get();
                
                snapshot.forEach(doc => {
                    transaction.update(doc.ref, { read: true });
                });
                
                transaction.update(db.collection('chats').doc(chatId), {
                    [`unreadCount.${user.uid}`]: 0
                });
            });
            
            clearMessagesCache(chatId);
            clearChatsCache(user.uid);
            
            return true;
        } catch (error) {
            console.error('❌ Ошибка отметки о прочтении:', error);
            return false;
        }
    }

    // ===== ПОЛУЧЕНИЕ СООБЩЕНИЙ =====
    async function getMessages(chatId, limit = 50, before = null, forceRefresh = false) {
        try {
            if (!checkFirebase()) return [];
            
            if (!forceRefresh && !before) {
                const cached = getMessagesCache(chatId);
                if (cached) {
                    return cached;
                }
            }
            
            let query = db.collection('chats').doc(chatId)
                .collection('messages')
                .orderBy('timestamp', 'desc');
            
            if (before) {
                const beforeDoc = await db.collection('chats').doc(chatId)
                    .collection('messages')
                    .doc(before)
                    .get();
                if (beforeDoc.exists) {
                    query = query.startAfter(beforeDoc);
                }
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
            
            if (!before) {
                setMessagesCache(chatId, reversedMessages);
            }
            
            return reversedMessages;
            
        } catch (error) {
            console.error('❌ Ошибка загрузки сообщений:', error);
            return [];
        }
    }

    // ===== ЗАГРУЗКА СТАРЫХ СООБЩЕНИЙ =====
    async function loadMoreMessages(chatId, lastMessageId, limit = 20) {
        return getMessages(chatId, limit, lastMessageId, true);
    }

    // ===== УДАЛЕНИЕ СООБЩЕНИЯ =====
    async function deleteMessage(chatId, messageId) {
        try {
            if (!checkFirebase()) {
                return { success: false, error: 'Firestore недоступен' };
            }
            
            const user = getUserSafe();
            if (!user) {
                return { success: false, error: 'Не авторизован' };
            }
            
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
            if (!checkFirebase()) return 0;
            
            const cacheKey = `unread_${userId}`;
            const cached = Utils?.getMemoryCache?.(cacheKey);
            if (cached) return cached;
            
            const snapshot = await db.collection('chats')
                .where('participants', 'array-contains', userId)
                .get();
            
            let total = 0;
            snapshot.forEach(doc => {
                const chat = doc.data();
                total += chat.unreadCount?.[userId] || 0;
            });
            
            Utils?.setMemoryCache?.(cacheKey, total, 30000);
            
            return total;
            
        } catch (error) {
            console.error('Ошибка получения непрочитанных:', error);
            return 0;
        }
    }

    // ===== ПОДПИСКА НА НЕПРОЧИТАННЫЕ =====
    function subscribeToUnread(userId, callback) {
        if (!checkFirebase()) return null;
        
        if (currentUserUnreadSub) {
            currentUserUnreadSub();
            currentUserUnreadSub = null;
        }
        
        const unsubscribe = db.collection('chats')
            .where('participants', 'array-contains', userId)
            .onSnapshot((snapshot) => {
                let total = 0;
                snapshot.forEach(doc => {
                    const chat = doc.data();
                    total += chat.unreadCount?.[userId] || 0;
                });
                callback(total);
                
                clearChatsCache(userId);
            }, (error) => {
                console.error('Ошибка подписки на непрочитанные:', error);
                callback(0);
            });
        
        currentUserUnreadSub = unsubscribe;
        return unsubscribe;
    }

    // ===== ОЧИСТКА =====
    function cleanup() {
        activeListeners.forEach((unsubscribe, chatId) => {
            try {
                if (typeof unsubscribe === 'function') {
                    unsubscribe();
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
        clearChatsCache,
        clearMessagesCache,
        requestNotificationPermission,
        showBrowserNotification
    };

    window.__CHAT_INITIALIZED__ = true;
    console.log('✅ Chat сервис загружен (оптимизированный)');
    
    return Object.freeze(api);
})();

// Автоинициализация
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        Chat.init();
    }, 1000);
});

window.Chat = Chat;