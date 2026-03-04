// ============================================
// СЕРВИС ЧАТА С КЭШИРОВАНИЕМ
// ============================================

const Chat = (function() {
    if (window.__CHAT_INITIALIZED__) return window.Chat;

    let activeListeners = new Map();
    let spamPrevention = new Map();
    let notificationPermission = false;
    
    const chatsCache = new Map();
    const messagesCache = new Map();
    const CHAT_CACHE_TTL = 5 * 60 * 1000;
    const MESSAGES_CACHE_TTL = 2 * 60 * 1000;

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
        chatsCache.set(userId, { data: chats, timestamp: Date.now() });
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
        messagesCache.set(chatId, { data: messages, timestamp: Date.now() });
    }

    function clearChatsCache(userId) {
        if (userId) chatsCache.delete(userId);
        else chatsCache.clear();
    }

    function clearMessagesCache(chatId) {
        if (chatId) messagesCache.delete(chatId);
        else messagesCache.clear();
    }

    function init() {
        requestNotificationPermission();
        console.log('✅ Chat сервис загружен');
    }

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
                silent: false,
                ...options
            });
        } catch (error) {
            return null;
        }
    }

    async function getUserChats(userId, options = {}) {
        try {
            if (!Utils.checkFirebase()) return [];
            
            const cached = getChatsFromCache(userId);
            if (cached && !options.forceRefresh) return cached;
            
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
                            unreadCount: chat.unreadCount?.[userId] || 0,
                            lastMessage: chat.lastMessage || 'Нет сообщений',
                            lastMessageAt: chat.lastMessageAt?.toDate?.() || new Date(),
                            createdAt: chat.createdAt?.toDate?.() || new Date()
                        });
                    } catch (userError) {
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
            
            setChatsToCache(userId, chats);
            return chats;
            
        } catch (error) {
            console.error('❌ Ошибка загрузки чатов:', error);
            return [];
        }
    }

    async function getChat(chatId, forceRefresh = false) {
        try {
            if (!Utils.checkFirebase()) return null;
            
            const cacheKey = `chat_${chatId}`;
            if (!forceRefresh) {
                const cached = Utils.getMemoryCache?.(cacheKey);
                if (cached) return cached;
            }
            
            const doc = await db.collection('chats').doc(chatId).get();
            if (!doc.exists) return null;
            
            const chatData = { id: doc.id, ...doc.data() };
            Utils.setMemoryCache?.(cacheKey, chatData, 300000);
            return chatData;
        } catch (error) {
            console.error('❌ Ошибка загрузки чата:', error);
            return null;
        }
    }

    function subscribeToMessages(chatId, callback) {
        if (!Utils.checkFirebase()) return null;
        
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
                    messages.push({
                        id: doc.id,
                        ...data,
                        timestamp: data.timestamp?.toDate?.() || new Date()
                    });
                    
                    if (data.senderId !== 'system' && 
                        data.senderId !== Auth.getUser()?.uid &&
                        !data.read) {
                        hasNewFromOthers = true;
                    }
                });
                
                callback(messages);
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
                console.error('❌ Ошибка подписки:', error);
                Utils.showError('Не удалось загрузить сообщения');
                callback([]);
            });
        
        activeListeners.set(chatId, unsubscribe);
        return unsubscribe;
    }

    function unsubscribeFromChat(chatId) {
        if (activeListeners.has(chatId)) {
            activeListeners.get(chatId)();
            activeListeners.delete(chatId);
        }
    }

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
                return { success: false, error: `Макс ${CONFIG.app.limits.maxMessageLength} символов` };
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
                        Utils.showWarning(`Не удалось загрузить ${file.name}`);
                    }
                }
            }

            if (!text && fileUrls.length === 0) {
                return { success: false, error: 'Нет содержимого' };
            }

            const chatDoc = await db.collection('chats').doc(chatId).get();
            if (!chatDoc.exists) return { success: false, error: 'Чат не найден' };
            
            const chatData = chatDoc.data();
            const otherId = chatData.participants.find(id => id !== user.uid);

            await db.collection('chats').doc(chatId)
                .collection('messages')
                .add({
                    senderId: user.uid,
                    senderName: userData?.name || 'Пользователь',
                    text: text?.trim() || '',
                    files: fileUrls,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                    read: false,
                    type: fileUrls.length > 0 ? (fileUrls[0].type?.startsWith('image/') ? 'image' : 'file') : 'text'
                });

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
            if (otherId) clearChatsCache(otherId);

            return { success: true, files: fileUrls };
            
        } catch (error) {
            console.error('❌ Ошибка отправки:', error);
            Utils.showError(error.message || 'Ошибка отправки');
            return { success: false, error: error.message };
        }
    }

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
            snapshot.forEach(doc => batch.update(doc.ref, { read: true }));
            await batch.commit();
            
            await db.collection('chats').doc(chatId).update({
                [`unreadCount.${user.uid}`]: 0
            });
            
            clearMessagesCache(chatId);
            return true;
        } catch (error) {
            console.error('❌ Ошибка отметки:', error);
            return false;
        }
    }

    async function getMessages(chatId, limit = 50, before = null, forceRefresh = false) {
        try {
            if (!Utils.checkFirebase()) return [];
            
            if (!forceRefresh && !before) {
                const cached = getMessagesFromCache(chatId);
                if (cached) return cached;
            }
            
            let query = db.collection('chats').doc(chatId)
                .collection('messages')
                .orderBy('timestamp', 'desc')
                .limit(limit);
            
            if (before) query = query.startAfter(before);
            
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
            
            const reversed = messages.reverse();
            if (!before) setMessagesToCache(chatId, reversed);
            return reversed;
            
        } catch (error) {
            console.error('❌ Ошибка загрузки сообщений:', error);
            return [];
        }
    }

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
            if (!messageDoc.exists) return { success: false, error: 'Сообщение не найдено' };
            
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
            console.error('❌ Ошибка удаления:', error);
            return { success: false, error: error.message };
        }
    }

    async function checkAccess(chatId, userId) {
        try {
            const chat = await getChat(chatId);
            return chat?.participants?.includes(userId) || false;
        } catch (error) {
            return false;
        }
    }

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
            return 0;
        }
    }

    function subscribeToUnread(userId, callback) {
        if (!Utils.checkFirebase()) return null;
        
        return db.collection('chats')
            .where('participants', 'array-contains', userId)
            .onSnapshot((snapshot) => {
                let total = 0;
                snapshot.forEach(doc => {
                    const chat = doc.data();
                    total += chat.unreadCount?.[userId] || 0;
                });
                callback(total);
                clearChatsCache(userId);
            }, (error) => callback(0));
    }

    function cleanup() {
        activeListeners.forEach((unsubscribe) => unsubscribe());
        activeListeners.clear();
        spamPrevention.clear();
        chatsCache.clear();
        messagesCache.clear();
    }

    return Object.freeze({
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
    });
})();

document.addEventListener('DOMContentLoaded', () => setTimeout(() => Chat.init(), 1000));
window.Chat = Chat;