// ===== CHAT.JS — ВСЯ ЛОГИКА ЧАТОВ =====

const Chats = (function() {
    // Приватные переменные
    let activeListeners = new Map();
    let typingTimeouts = {};

    /**
     * Создание нового чата (доступно сразу после отклика)
     */
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
            } else {
                console.log('📝 Чат уже существует:', chatId);
            }
            
            return chatId;
            
        } catch (error) {
            console.error('❌ Ошибка создания чата:', error);
            throw error;
        }
    }

    /**
     * Отправка сообщения
     */
    async function sendMessage(chatId, text, files = []) {
        try {
            const user = Auth.getUser();
            if (!user) throw new Error('Необходимо авторизоваться');

            const messageData = {
                text: Utils.escapeHtml(text || ''),
                senderId: user.uid,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                read: false
            };

            // Если есть файлы, загружаем их
            if (files.length > 0) {
                const fileUrls = [];
                
                for (const file of files) {
                    if (file.size > 10 * 1024 * 1024) {
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
            const partnerId = await getPartnerId(chatId);
            await db.collection('chats').doc(chatId).update({
                lastMessage: text || '[Файл]',
                lastSenderId: user.uid,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                [`unreadCount.${partnerId}`]: firebase.firestore.FieldValue.increment(1)
            });

            return { success: true, messageId: messageRef.id };
            
        } catch (error) {
            console.error('Ошибка отправки сообщения:', error);
            Utils.showNotification(`❌ ${error.message}`, 'error');
            return { success: false, error: error.message };
        }
    }

    /**
     * Получение ID собеседника
     */
    async function getPartnerId(chatId) {
        try {
            const chatDoc = await db.collection('chats').doc(chatId).get();
            if (!chatDoc.exists) return null;
            
            const chat = chatDoc.data();
            const user = Auth.getUser();
            
            if (!user) return null;
            
            return chat.masterId === user.uid ? chat.clientId : chat.masterId;
            
        } catch (error) {
            console.error('Ошибка получения ID собеседника:', error);
            return null;
        }
    }

    /**
     * Подписка на сообщения чата
     */
    function listenToMessages(chatId, callback) {
        if (!chatId || typeof callback !== 'function') return;

        // Отписываемся от предыдущего слушателя
        if (activeListeners.has(chatId)) {
            activeListeners.get(chatId)();
        }

        // Создаем новый слушатель
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
                
                // Отмечаем сообщения как прочитанные
                markAsRead(chatId, messages);
            }, (error) => {
                console.error('Ошибка слушателя сообщений:', error);
            });

        activeListeners.set(chatId, unsubscribe);
        return unsubscribe;
    }

    /**
     * Отметка сообщений как прочитанных
     */
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
                
                // Сбрасываем счетчик непрочитанных
                await db.collection('chats').doc(chatId).update({
                    [`unreadCount.${user.uid}`]: 0
                });
            }
            
        } catch (error) {
            console.error('Ошибка отметки прочитанных:', error);
        }
    }

    /**
     * Индикатор печати
     */
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

    /**
     * Слушатель индикатора печати собеседника
     */
    function listenToTyping(chatId, callback) {
        const user = Auth.getUser();
        if (!user) return;

        // Получаем ID собеседника
        getPartnerId(chatId).then(partnerId => {
            if (!partnerId) return;

            // Слушаем только документ собеседника
            return db.collection('chats').doc(chatId)
                .collection('typing').doc(partnerId)
                .onSnapshot((doc) => {
                    if (doc.exists && doc.data().isTyping) {
                        callback(true);
                    } else {
                        callback(false);
                    }
                });
        }).catch(error => {
            console.error('Ошибка в listenToTyping:', error);
        });
    }

    /**
     * Получение списка чатов пользователя
     */
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
                
                // Получаем информацию о собеседнике
                const partnerDoc = await db.collection('users').doc(partnerId).get();
                const partner = partnerDoc.exists ? partnerDoc.data() : null;
                
                chats.push({
                    id: doc.id,
                    ...chat,
                    partner: partner
                });
            }

            return chats;
            
        } catch (error) {
            console.error('Ошибка загрузки чатов:', error);
            return [];
        }
    }

    /**
     * Отписка от всех слушателей
     */
    function unsubscribeAll() {
        activeListeners.forEach(unsubscribe => unsubscribe());
        activeListeners.clear();
    }

    // Публичное API
    return {
        create,
        sendMessage,
        getPartnerId,
        listenToMessages,
        getUserChats,
        setupTypingIndicator,
        listenToTyping,
        unsubscribeAll
    };
})();

window.Chats = Chats;