(function() {
    // Параметры URL
    const urlParams = new URLSearchParams(window.location.search);
    const chatIdParam = urlParams.get('chatId');

    // Состояние
    let chatId = null;
    let chatData = null;
    let partnerId = null;
    let partnerName = '';
    let selectedFiles = [];
    let unsubscribeMessages = null;
    let unsubscribeAuth = null; // для отписки от Auth
    let lastMessageTime = 0;
    let messageCount = 0;

    // DOM элементы
    const $ = (id) => document.getElementById(id);

    // Инициализация
    document.addEventListener('DOMContentLoaded', async () => {
        console.log('🚀 Chat.js загружен, chatId:', chatIdParam);
        
        if (!chatIdParam) {
            Utils.showNotification('❌ Не указан ID чата', 'error');
            setTimeout(() => window.location.href = '/HomeWork/', 2000);
            return;
        }

        chatId = chatIdParam;

        // Ждём авторизацию
        const isAuthed = await waitForAuth();
        
        if (!isAuthed) {
            Utils.showNotification('❌ Требуется авторизация', 'warning');
            setTimeout(() => window.location.href = '/HomeWork/', 2000);
            return;
        }

        const loaded = await loadChatData();
        if (!loaded) return;

        initEventListeners();
    });

    // Ожидание авторизации (ИСПРАВЛЕНО)
    function waitForAuth() {
        return new Promise((resolve) => {
            // Если уже авторизован
            if (Auth.isAuthenticated()) {
                resolve(true);
                return;
            }
            
            let timeoutId = null;
            let unsubscribe = null;
            
            // Подписываемся на изменения
            unsubscribe = Auth.onAuthChange(function listener(state) {
                if (state.isAuthenticated) {
                    // Отписываемся
                    if (typeof unsubscribe === 'function') {
                        unsubscribe();
                    }
                    if (timeoutId) clearTimeout(timeoutId);
                    resolve(true);
                }
            });
            
            // Таймаут на случай проблем
            timeoutId = setTimeout(() => {
                if (typeof unsubscribe === 'function') {
                    unsubscribe();
                }
                console.log('⏳ Таймаут ожидания авторизации');
                resolve(false);
            }, 5000);
        });
    }

    // Загрузка данных чата
    async function loadChatData() {
        try {
            if (!Utils.checkFirestore()) {
                console.error('Firestore недоступен');
                return false;
            }

            const user = Auth.getUser();
            if (!user) {
                console.error('Пользователь не найден');
                return false;
            }

            console.log('🔍 Загружаем чат:', chatId);

            // Загружаем чат
            const chatDoc = await db.collection('chats').doc(chatId).get();
            
            if (!chatDoc.exists) {
                console.error('Чат не найден:', chatId);
                Utils.showNotification('❌ Чат не найден', 'error');
                
                // Пробуем восстановить по формату
                if (chatId.startsWith('chat_')) {
                    const parts = chatId.replace('chat_', '').split('_');
                    if (parts.length === 2) {
                        const [orderId, masterId] = parts;
                        await tryRestoreChat(orderId, masterId, user.uid);
                        return true;
                    }
                }
                
                setTimeout(() => window.location.href = '/HomeWork/', 2000);
                return false;
            }

            chatData = chatDoc.data();
            console.log('✅ Чат загружен:', chatData);

            // Проверяем, является ли пользователь участником
            if (!chatData.participants || !chatData.participants.includes(user.uid)) {
                console.error('Нет доступа к чату');
                Utils.showNotification('❌ У вас нет доступа к этому чату', 'error');
                setTimeout(() => window.location.href = '/HomeWork/', 2000);
                return false;
            }

            // Определяем собеседника
            partnerId = chatData.participants.find(id => id !== user.uid);
            
            if (partnerId) {
                const partnerDoc = await db.collection('users').doc(partnerId).get();
                if (partnerDoc.exists) {
                    const partner = partnerDoc.data();
                    partnerName = partner.name || 'Пользователь';
                    const partnerRole = partner.role === 'master' ? 'Мастер' : 'Клиент';
                    
                    const nameEl = $('chatPartnerName');
                    if (nameEl) nameEl.textContent = partnerName;
                    
                    const roleEl = $('chatPartnerRole');
                    if (roleEl) roleEl.textContent = partnerRole;
                }
            }

            // Закреплённый заказ
            if (chatData.orderId && chatData.orderTitle) {
                const pinned = $('pinnedOrder');
                if (pinned) {
                    pinned.classList.remove('d-none');
                    const titleEl = $('pinnedTitle');
                    if (titleEl) titleEl.textContent = chatData.orderTitle;
                    const priceEl = $('pinnedPrice');
                    if (priceEl) priceEl.textContent = chatData.selectedPrice || '—';
                }
            }

            // Отмечаем сообщения как прочитанные
            try {
                await Chat.markAsRead(chatId);
            } catch (e) {
                console.warn('Не удалось отметить прочитанное:', e);
            }

            // Подписываемся на сообщения
            subscribeToMessages();

            return true;
        } catch (error) {
            console.error('❌ Ошибка загрузки чата:', error);
            Utils.showNotification('❌ Ошибка загрузки чата', 'error');
            return false;
        }
    }

    // Восстановление чата
    async function tryRestoreChat(orderId, masterId, userId) {
        try {
            console.log('🔄 Пытаемся восстановить чат:', { orderId, masterId, userId });
            
            // Проверяем заказ
            const orderDoc = await db.collection('orders').doc(orderId).get();
            if (!orderDoc.exists) {
                Utils.showNotification('❌ Заказ не найден', 'error');
                return false;
            }
            
            const order = orderDoc.data();
            
            // Проверяем, что пользователь имеет отношение к заказу
            if (order.clientId !== userId && order.selectedMasterId !== userId) {
                Utils.showNotification('❌ У вас нет прав на этот чат', 'error');
                return false;
            }
            
            // Создаём чат заново
            const newChatId = `chat_${orderId}_${masterId}`;
            const chatRef = db.collection('chats').doc(newChatId);
            
            await chatRef.set({
                participants: [order.clientId, masterId],
                orderId: orderId,
                orderTitle: order.title || 'Заказ',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastMessageAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastMessage: '✅ Чат восстановлен',
                status: 'active',
                unreadCount: {
                    [order.clientId]: 0,
                    [masterId]: 0
                }
            });
            
            // Добавляем системное сообщение
            await chatRef.collection('messages').add({
                senderId: 'system',
                senderName: 'Система',
                text: '✅ Чат восстановлен. Можете продолжать общение.',
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                type: 'system'
            });
            
            chatId = newChatId;
            chatData = (await chatRef.get()).data();
            
            console.log('✅ Чат восстановлен');
            
            // Перезагружаем страницу с новым chatId
            window.location.href = `/HomeWork/chat.html?chatId=${newChatId}`;
            return true;
        } catch (error) {
            console.error('❌ Ошибка восстановления чата:', error);
            return false;
        }
    }

    // Подписка на сообщения
    function subscribeToMessages() {
        if (!chatId) return;
        
        // Отписываемся от предыдущей подписки
        if (unsubscribeMessages && typeof unsubscribeMessages === 'function') {
            unsubscribeMessages();
        }
        
        unsubscribeMessages = Chat.subscribeToMessages(chatId, (messages) => {
            displayMessages(messages);
            
            // Отмечаем как прочитанные при получении новых
            Chat.markAsRead(chatId).catch(e => console.warn('Ошибка отметки:', e));
        });
    }

    // Отображение сообщений
    function displayMessages(messages) {
        const messagesArea = $('messagesArea');
        if (!messagesArea) return;

        if (!messages || messages.length === 0) {
            messagesArea.innerHTML = `
                <div class="empty-chat">
                    <i class="fas fa-comments"></i>
                    <h5>Нет сообщений</h5>
                    <p>Напишите первое сообщение</p>
                </div>
            `;
            return;
        }

        messagesArea.innerHTML = messages.map(msg => createMessageElement(msg)).join('');
        
        // Скролл вниз
        setTimeout(() => {
            messagesArea.scrollTop = messagesArea.scrollHeight;
        }, 100);
    }

    // Создание элемента сообщения
    function createMessageElement(message) {
        const user = Auth.getUser();
        const isSent = message.senderId === user?.uid;
        
        let filesHtml = '';
        if (message.files?.length > 0) {
            filesHtml = '<div class="d-flex flex-column gap-2 mt-2">';
            message.files.forEach(file => {
                if (file.type?.startsWith('image/')) {
                    filesHtml += `<img src="${file.url}" class="message-image" onclick="window.open('${file.url}')" loading="lazy">`;
                } else {
                    filesHtml += `
                        <a href="${file.url}" target="_blank" class="message-file">
                            <i class="fas fa-file me-2"></i>${file.name}
                        </a>`;
                }
            });
            filesHtml += '</div>';
        }

        const time = message.timestamp ? Utils.formatDate(message.timestamp) : 'только что';

        return `
            <div class="message ${isSent ? 'sent' : 'received'}">
                <div class="message-bubble">
                    ${message.text ? Utils.escapeHtml(message.text) : ''}
                    ${filesHtml}
                </div>
                <div class="message-time">${time}</div>
            </div>
        `;
    }

    // Отправка сообщения
    async function sendMessage() {
        const input = $('messageInput');
        const text = input?.value.trim();

        if ((!text || text === '') && selectedFiles.length === 0) return;

        // Антиспам
        const now = Date.now();
        if (now - lastMessageTime < 1000) {
            Utils.showNotification('❌ Слишком часто', 'warning');
            return;
        }
        messageCount++;
        if (messageCount > 30) {
            Utils.showNotification('❌ Превышен лимит сообщений', 'warning');
            return;
        }
        lastMessageTime = now;

        // Модерация
        if (text && window.Moderation) {
            const modResult = Moderation.check(text, 'chat_message');
            if (!modResult.isValid) {
                Utils.showNotification(`❌ ${modResult.reason}`, 'warning');
                return;
            }
        }

        const result = await Chat.sendMessage(chatId, text || '', selectedFiles);
        
        if (result.success) {
            if (input) input.value = '';
            selectedFiles = [];
            updateFilePreview();
        }
    }

    // Обработка файлов
    function handleFileSelect(files) {
        if (!files) return;
        
        for (let file of files) {
            if (file.size > 10 * 1024 * 1024) {
                Utils.showNotification('❌ Файл слишком большой (макс 10MB)', 'warning');
                continue;
            }
            selectedFiles.push(file);
        }
        updateFilePreview();
    }

    function updateFilePreview() {
        const preview = $('filePreview');
        if (!preview) return;
        
        if (selectedFiles.length === 0) {
            preview.classList.add('d-none');
            preview.innerHTML = '';
            return;
        }
        
        preview.classList.remove('d-none');
        preview.innerHTML = selectedFiles.map((file, index) => `
            <div class="file-preview-item">
                <i class="fas ${file.type.startsWith('image/') ? 'fa-image' : 'fa-file'}"></i>
                <span>${file.name.length > 20 ? file.name.substring(0, 17) + '...' : file.name}</span>
                <span class="remove-file" onclick="window.removeFile(${index})">×</span>
            </div>
        `).join('');
    }

    window.removeFile = (index) => {
        selectedFiles.splice(index, 1);
        updateFilePreview();
    };

    // Очистка
    function cleanup() {
        if (unsubscribeMessages && typeof unsubscribeMessages === 'function') {
            unsubscribeMessages();
        }
        if (unsubscribeAuth && typeof unsubscribeAuth === 'function') {
            unsubscribeAuth();
        }
    }

    // Инициализация обработчиков
    function initEventListeners() {
        const attachBtn = $('attachButton');
        const fileInput = $('fileInput');
        const sendBtn = $('sendButton');
        const msgInput = $('messageInput');

        if (attachBtn && fileInput) {
            attachBtn.addEventListener('click', () => fileInput.click());
        }
        
        if (fileInput) {
            fileInput.addEventListener('change', (e) => handleFileSelect(e.target.files));
        }
        
        if (sendBtn) {
            sendBtn.addEventListener('click', sendMessage);
        }
        
        if (msgInput) {
            msgInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                }
            });
        }

        window.addEventListener('beforeunload', cleanup);
    }
})();