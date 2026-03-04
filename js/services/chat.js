const Chat = (function() {
    let activeListeners = new Map();

    // ===== ПОЛУЧЕНИЕ ЧАТОВ =====
    async function getUserChats(userId) {
        try {
            if (!Utils.checkFirestore()) return [];
            
            const snapshot = await db.collection('chats')
                .where('participants', 'array-contains', userId)
                .orderBy('lastMessageAt', 'desc')
                .get();
            
            const chats = [];
            for (const doc of snapshot.docs) {
                const chat = doc.data();
                const otherId = chat.participants.find(id => id !== userId);
                
                if (otherId) {
                    const userDoc = await db.collection('users').doc(otherId).get();
                    const user = userDoc.exists ? userDoc.data() : { name: 'Пользователь' };
                    
                    chats.push({
                        id: doc.id,
                        ...chat,
                        partnerId: otherId,
                        partnerName: user.name,
                        partnerRole: user.role,
                        unreadCount: chat.unreadCount?.[userId] || 0
                    });
                }
            }
            
            return chats;
        } catch (error) {
            console.error('Ошибка загрузки чатов:', error);
            return [];
        }
    }

    // ===== ПОДПИСКА НА СООБЩЕНИЯ =====
    function subscribeToMessages(chatId, callback) {
        if (!Utils.checkFirestore()) return null;
        
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
                snapshot.forEach(doc => messages.push({ id: doc.id, ...doc.data() }));
                callback(messages);
            }, (error) => {
                console.error('Ошибка подписки на сообщения:', error);
                Utils.showError('Не удалось загрузить сообщения');
            });
        
        activeListeners.set(chatId, unsubscribe);
        return unsubscribe;
    }

    // ===== ОТПИСКА =====
    function unsubscribeFromChat(chatId) {
        if (activeListeners.has(chatId)) {
            activeListeners.get(chatId)();
            activeListeners.delete(chatId);
        }
    }

    // ===== ОТПРАВКА СООБЩЕНИЯ =====
    async function sendMessage(chatId, text, files = []) {
        try {
            if (!Utils.checkFirestore()) return { success: false, error: 'Firestore недоступен' };
            if (!Auth.isAuthenticated()) throw new Error('Необходимо авторизоваться');

            const user = Auth.getUser();
            
            // Загружаем файлы
            const fileUrls = [];
            for (const file of files) {
                if (file.size > 10 * 1024 * 1024) {
                    Utils.showNotification('❌ Файл слишком большой (макс 10MB)', 'warning');
                    continue;
                }
                
                const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
                const storageRef = storage.ref(`chat_files/${chatId}/${fileName}`);
                await storageRef.put(file);
                const url = await storageRef.getDownloadURL();
                
                fileUrls.push({
                    name: file.name,
                    url: url,
                    type: file.type,
                    size: file.size
                });
            }

            // Отправляем сообщение
            const message = {
                senderId: user.uid,
                senderName: Auth.getUserData()?.name || 'Пользователь',
                text: text || '',
                files: fileUrls,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            };

            await db.collection('chats').doc(chatId)
                .collection('messages')
                .add(message);

            // Обновляем информацию о чате
            const chatDoc = await db.collection('chats').doc(chatId).get();
            if (chatDoc.exists) {
                const chat = chatDoc.data();
                const otherId = chat.participants.find(id => id !== user.uid);
                
                await db.collection('chats').doc(chatId).update({
                    lastMessage: text || '📎 Файл',
                    lastMessageAt: firebase.firestore.FieldValue.serverTimestamp(),
                    [`unreadCount.${otherId}`]: firebase.firestore.FieldValue.increment(1)
                });
            }

            return { success: true };
        } catch (error) {
            console.error('Ошибка отправки сообщения:', error);
            Utils.showNotification(`❌ ${error.message}`, 'error');
            return { success: false, error: error.message };
        }
    }

    // ===== ОТМЕТКА О ПРОЧТЕНИИ =====
    async function markAsRead(chatId) {
        try {
            if (!Utils.checkFirestore() || !Auth.isAuthenticated()) return;
            
            const user = Auth.getUser();
            await db.collection('chats').doc(chatId).update({
                [`unreadCount.${user.uid}`]: 0
            });
        } catch (error) {
            console.error('Ошибка отметки о прочтении:', error);
        }
    }

    // ===== ПОЛУЧЕНИЕ СООБЩЕНИЙ (однократно) =====
    async function getMessages(chatId, limit = 50) {
        try {
            if (!Utils.checkFirestore()) return [];
            
            const snapshot = await db.collection('chats').doc(chatId)
                .collection('messages')
                .orderBy('timestamp', 'desc')
                .limit(limit)
                .get();
            
            const messages = [];
            snapshot.forEach(doc => messages.push({ id: doc.id, ...doc.data() }));
            
            return messages.reverse(); // от старых к новым
        } catch (error) {
            console.error('Ошибка загрузки сообщений:', error);
            return [];
        }
    }

    // Публичное API
    return {
        getUserChats,
        subscribeToMessages,
        unsubscribeFromChat,
        sendMessage,
        markAsRead,
        getMessages
    };
})();

window.Chat = Chat;