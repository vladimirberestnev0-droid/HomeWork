// ===== js/services/chat.js =====
// ЛОГИКА ЧАТОВ (УЛУЧШЕННАЯ ВЕРСИЯ)

const Chats = (function() {
    // Приватные переменные
    let activeListeners = new Map();
    let typingTimeouts = {};

    // Создание чата
    async function create(orderId, masterId, clientId) {
        try {
            const chatId = `chat_${orderId}_${masterId}`;
            const chatRef = db.collection('chats').doc(chatId);
            
            const chatDoc = await chatRef.get();
            
            if (!chatDoc.exists) {
                await chatRef.set({
                    orderId: orderId,
                    masterId: masterId,
                    clientId: clientId,
                    participants: [masterId, clientId],
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    lastMessage: '',
                    lastSenderId: null,
                    unreadCount: {
                        [masterId]: 0,
                        [clientId]: 0
                    }
                });
                console.log('✅ Чат создан:', chatId);
            }
            
            return chatId;
            
        } catch (error) {
            console.error('❌ Ошибка создания чата:', error);
            throw error;
        }
    }

    // Отправка сообщения
    async function sendMessage(chatId, text, files = []) {
        try {
            const user = Auth.getUser();
            if (!user) throw new Error('Необходимо авторизоваться');

            // Проверка модерации
            if (text) {
                const modResult = Moderation.check(text, 'chat_message');
                if (!modResult.isValid) {
                    throw new Error(modResult.reason || 'Сообщение не прошло модерацию');
                }
            }

            const messageData = {
                text: Helpers.escapeHtml(text || ''),
                senderId: user.uid,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                read: false
            };

            // Загрузка файлов
            if (files.length > 0) {
                const fileUrls = [];
                
                for (const file of files) {
                    if (file.size > FILE_LIMITS.MAX_SIZE) {
                        throw new Error('Файл слишком большой (макс 10MB)');
                    }
                    
                    const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}_${file.name}`;
                    const storageRef = storage.ref(`chat_files/${chatId}/${fileName}`);
                    
                    await storageRef.put(file);
                    const url = await storageRef.getDownloadURL();
                    
                    fileUrls.push({
                        url: url,
                        name: file.name,
                        type: file.type,
                        size: file.size
                    });
                }
                
                messageData.files = fileUrls;
            }

            // Сохраняем сообщение
            const messageRef = await db.collection('chats').doc(chatId)
                .collection('messages')
                .add(messageData);

            // Обновляем информацию о чате
            const chatDoc = await db.collection('chats').doc(chatId).get();
            const chat = chatDoc.data();
            const partnerId = chat.masterId === user.uid ? chat.clientId : chat.masterId;

            await db.collection('chats').doc(chatId).update({
                lastMessage: text || '[Файл]',
                lastSenderId: user.uid,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                [`unreadCount.${partnerId}`]: firebase.firestore.FieldValue.increment(1)
            });

            return { success: true, messageId: messageRef.id };
            
        } catch (error) {
            console.error('Ошибка отправки сообщения:', error);
            Helpers.showNotification(`❌ ${error.message}`, 'error');
            return { success: false, error: error.message };
        }
    }

    // Подписка на сообщения
    function listenToMessages(chatId, callback) {
        if (!chatId || typeof callback !== 'function') return;

        if (activeListeners.has(chatId)) {
            activeListeners.get(chatId)();
        }

        const unsubscribe = db.collection('chats').doc(chatId)
            .collection('messages')
            .orderBy('timestamp', 'asc')
            .onSnapshot((snapshot) => {
                const messages = [];
                snapshot.forEach(doc => {
                    messages.push({
                        id: doc.id,
                        ...doc.data()
                    });
                });
                
                callback(messages);
                
                markAsRead(chatId, messages);
            }, (error) => {
                console.error('Ошибка слушателя сообщений:', error);
            });

        activeListeners.set(chatId, unsubscribe);
        return unsubscribe;
    }

    // Отметка прочитанных
    async function markAsRead(chatId, messages) {
        try {
            const user = Auth.getUser();
            if (!user) return;

            const batch = db.batch();
            let hasUnread = false;

            messages.forEach(msg => {
                if (!msg.read && msg.senderId !== user.uid) {
                    const msgRef = db.collection('chats').doc(chatId)
                        .collection('messages').doc(msg.id);
                    batch.update(msgRef, { read: true });
                    hasUnread = true;
                }
            });

            if (hasUnread) {
                await batch.commit();
                await db.collection('chats').doc(chatId).update({
                    [`unreadCount.${user.uid}`]: 0
                });
            }
            
        } catch (error) {
            console.error('Ошибка отметки прочитанных:', error);
        }
    }

    // Индикатор печати
    function setupTypingIndicator(chatId) {
        const user = Auth.getUser();
        if (!user) return;

        const typingRef = db.collection('chats').doc(chatId)
            .collection('typing').doc(user.uid);

        const input = document.getElementById('messageInput');
        if (!input) return;

        input.addEventListener('input', () => {
            typingRef.set({
                isTyping: true,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });

            clearTimeout(typingTimeouts[user.uid]);
            typingTimeouts[user.uid] = setTimeout(() => {
                typingRef.delete();
            }, 2000);
        });
    }

    // Слушатель печати
    function listenToTyping(chatId, callback) {
        const user = Auth.getUser();
        if (!user) return;

        db.collection('chats').doc(chatId).get().then(chatDoc => {
            if (!chatDoc.exists) return;
            
            const chat = chatDoc.data();
            const partnerId = chat.masterId === user.uid ? chat.clientId : chat.masterId;

            db.collection('chats').doc(chatId)
                .collection('typing').doc(partnerId)
                .onSnapshot((doc) => {
                    callback(doc.exists && doc.data().isTyping);
                });
        }).catch(error => {
            console.error('Ошибка в listenToTyping:', error);
        });
    }

    // Получение чатов пользователя
    async function getUserChats() {
        try {
            const user = Auth.getUser();
            if (!user) return [];

            const snapshot = await db.collection('chats')
                .where('participants', 'array-contains', user.uid)
                .orderBy('updatedAt', 'desc')
                .get();

            const chats = [];
            
            for (const doc of snapshot.docs) {
                const chat = doc.data();
                const partnerId = chat.masterId === user.uid ? chat.clientId : chat.masterId;
                
                const partnerDoc = await db.collection('users').doc(partnerId).get();
                const partner = partnerDoc.exists ? partnerDoc.data() : null;
                
                // Получаем последнее сообщение
                const lastMsgSnapshot = await db.collection('chats').doc(doc.id)
                    .collection('messages')
                    .orderBy('timestamp', 'desc')
                    .limit(1)
                    .get();
                
                const lastMessage = lastMsgSnapshot.empty ? null : lastMsgSnapshot.docs[0].data();
                
                chats.push({
                    id: doc.id,
                    ...chat,
                    partner: partner,
                    lastMessage: lastMessage
                });
            }

            return chats;
            
        } catch (error) {
            console.error('Ошибка загрузки чатов:', error);
            return [];
        }
    }

    // Количество непрочитанных
    async function getUnreadCount() {
        try {
            const user = Auth.getUser();
            if (!user) return 0;

            const snapshot = await db.collection('chats')
                .where('participants', 'array-contains', user.uid)
                .get();

            let total = 0;
            snapshot.forEach(doc => {
                const chat = doc.data();
                total += chat.unreadCount?.[user.uid] || 0;
            });

            return total;
            
        } catch (error) {
            console.error('Ошибка получения непрочитанных:', error);
            return 0;
        }
    }

    // Отписка от всех
    function unsubscribeAll() {
        activeListeners.forEach(unsubscribe => unsubscribe());
        activeListeners.clear();
    }

    // Публичное API
    return {
        create,
        sendMessage,
        listenToMessages,
        getUserChats,
        getUnreadCount,
        setupTypingIndicator,
        listenToTyping,
        unsubscribeAll
    };
})();

window.Chats = Chats;