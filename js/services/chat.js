// ===== chat.js =====
// ЧАТ С ПРОВЕРКОЙ ПРАВ И ПРАВИЛЬНЫМИ ПАРАМЕТРАМИ

(function() {
    // ===== ПАРАМЕТРЫ ИЗ URL =====
    const urlParams = new URLSearchParams(window.location.search);
    const chatIdParam = urlParams.get('chatId');
    const orderIdParam = urlParams.get('orderId');
    const masterIdParam = urlParams.get('masterId');
    
    console.log('📋 Параметры чата:', { 
        chatId: chatIdParam, 
        orderId: orderIdParam, 
        masterId: masterIdParam 
    });

    // ===== СОСТОЯНИЕ =====
    let chatId = null;
    let orderData = null;
    let partnerId = null;
    let partnerRole = null;
    let partnerName = null;
    let chatData = null;
    let selectedFiles = [];
    let mediaRecorder = null;
    let audioChunks = [];
    let recordingInterval = null;
    let recordingSeconds = 0;
    let unsubscribeMessages = null;
    let unsubscribeStatus = null;
    let unsubscribeChat = null;
    let messageCount = 0;
    let lastMessageTime = 0;
    
    // Кэш для пользователей
    const userCache = new Map();
    
    // Эмодзи
    const EMOJIS = ['😊', '😂', '❤️', '👍', '🔥', '🎉', '🤔', '😢', '😡', '👋', '✅', '❌', '⭐', '💰', '🔨', '🛠️', '🚗', '📦', '⏰', '📍'];

    const $ = (id) => document.getElementById(id);

    // ===== ПРОВЕРКА FIREBASE =====
    function checkFirebase() {
        if (typeof firebase === 'undefined') {
            console.error('❌ Firebase не загружен');
            return false;
        }
        if (typeof db === 'undefined' || !db) {
            console.error('❌ Firestore не инициализирован');
            return false;
        }
        return true;
    }

    // ===== ЗАГРУЗКА ПОЛЬЗОВАТЕЛЯ =====
    async function getUserWithCache(userId) {
        if (!userId) return null;
        
        if (userCache.has(userId)) {
            const cached = userCache.get(userId);
            if (Date.now() - cached.timestamp < 300000) {
                return cached.data;
            }
        }
        
        try {
            if (!checkFirebase()) return null;
            
            const doc = await db.collection('users').doc(userId).get();
            const data = doc.exists ? doc.data() : null;
            
            userCache.set(userId, {
                data: data,
                timestamp: Date.now()
            });
            
            return data;
        } catch (error) {
            console.error('❌ Ошибка загрузки пользователя:', error);
            return null;
        }
    }

    // ===== ЗАГРУЗКА ДАННЫХ ЧАТА =====
    async function loadChatData() {
        try {
            if (!checkFirebase()) return false;
            
            const user = Auth.getUser();
            if (!user) {
                console.log('❌ Пользователь не авторизован');
                Utils.showNotification('❌ Требуется авторизация', 'warning');
                setTimeout(() => window.location.href = '/HomeWork/', 2000);
                return false;
            }

            // Определяем ID чата
            if (chatIdParam) {
                chatId = chatIdParam;
            } else if (orderIdParam && masterIdParam) {
                chatId = `chat_${orderIdParam}_${masterIdParam}`;
            } else {
                console.error('❌ Не указаны параметры чата');
                Utils.showNotification('❌ Неверная ссылка на чат', 'error');
                setTimeout(() => window.location.href = '/HomeWork/', 2000);
                return false;
            }

            console.log('🔍 Загружаем чат:', chatId);

            // Загружаем данные чата
            const chatDoc = await db.collection('chats').doc(chatId).get();
            
            if (!chatDoc.exists) {
                console.error('❌ Чат не найден:', chatId);
                Utils.showNotification('❌ Чат не найден', 'error');
                
                // Пробуем восстановить чат
                if (orderIdParam && masterIdParam) {
                    const restored = await tryRestoreChat();
                    if (!restored) {
                        setTimeout(() => window.location.href = '/HomeWork/', 2000);
                        return false;
                    }
                } else {
                    setTimeout(() => window.location.href = '/HomeWork/', 2000);
                    return false;
                }
            } else {
                chatData = chatDoc.data();
                console.log('✅ Чат загружен:', chatData);
            }

            // Проверяем, является ли пользователь участником чата
            if (!chatData.participants.includes(user.uid)) {
                console.error('❌ Нет доступа к чату');
                Utils.showNotification('❌ У вас нет доступа к этому чату', 'error');
                setTimeout(() => window.location.href = '/HomeWork/', 2000);
                return false;
            }

            // Загружаем заказ
            if (chatData.orderId) {
                const orderDoc = await db.collection('orders').doc(chatData.orderId).get();
                if (orderDoc.exists) {
                    orderData = { id: orderDoc.id, ...orderDoc.data() };
                    console.log('📦 Заказ загружен:', orderData);
                }
            }

            // Определяем собеседника
            partnerId = chatData.participants.find(id => id !== user.uid);
            if (!partnerId) {
                console.error('❌ Не удалось определить собеседника');
                return false;
            }

            const partnerData = await getUserWithCache(partnerId);
            if (partnerData) {
                partnerRole = partnerData.role === 'master' ? 'Мастер' : 'Клиент';
                partnerName = partnerData.name || (partnerRole === 'Мастер' ? 'Мастер' : 'Клиент');
            } else {
                partnerName = 'Пользователь';
                partnerRole = 'Участник';
            }

            // Подписываемся на обновления
            subscribeToMessages();
            subscribeToStatus();
            subscribeToChatUpdates();

            // Обновляем UI
            updateUI();

            return true;

        } catch (error) {
            console.error('❌ Ошибка загрузки чата:', error);
            Utils.showNotification('❌ Ошибка загрузки чата', 'error');
            return false;
        }
    }

    // ===== ПОПЫТКА ВОССТАНОВИТЬ ЧАТ =====
    async function tryRestoreChat() {
        try {
            console.log('🔄 Пытаемся восстановить чат...');
            
            if (!orderIdParam || !masterIdParam) return false;
            
            const user = Auth.getUser();
            if (!user) return false;

            // Проверяем заказ
            const orderDoc = await db.collection('orders').doc(orderIdParam).get();
            if (!orderDoc.exists) return false;
            
            const order = orderDoc.data();
            
            // Проверяем, что пользователь имеет отношение к заказу
            if (order.clientId !== user.uid && order.selectedMasterId !== user.uid) {
                return false;
            }

            // Создаем чат заново
            const newChatId = `chat_${orderIdParam}_${masterIdParam}`;
            const chatRef = db.collection('chats').doc(newChatId);
            
            await chatRef.set({
                participants: [order.clientId, masterIdParam],
                orderId: orderIdParam,
                orderTitle: order.title || 'Заказ',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastMessageAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastMessage: '✅ Чат восстановлен',
                status: 'active',
                createdBy: order.clientId,
                unreadCount: {
                    [order.clientId]: 0,
                    [masterIdParam]: 0
                },
                settings: {
                    canClientWrite: true,
                    canMasterWrite: true
                }
            });
            
            // Добавляем системное сообщение
            await chatRef.collection('messages').add({
                senderId: 'system',
                senderName: 'Система',
                text: '✅ Чат восстановлен. Можете продолжать общение.',
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                type: 'system',
                systemType: 'chat_restored'
            });

            chatId = newChatId;
            chatData = (await chatRef.get()).data();
            
            console.log('✅ Чат успешно восстановлен');
            return true;

        } catch (error) {
            console.error('❌ Ошибка восстановления чата:', error);
            return false;
        }
    }

    // ===== ПОДПИСКА НА ОБНОВЛЕНИЯ ЧАТА =====
    function subscribeToChatUpdates() {
        if (!checkFirebase() || !chatId) return;
        
        if (unsubscribeChat) unsubscribeChat();
        
        unsubscribeChat = db.collection('chats').doc(chatId)
            .onSnapshot((doc) => {
                if (doc.exists) {
                    chatData = doc.data();
                    updateUI();
                }
            }, (error) => {
                console.error('❌ Ошибка подписки на обновления чата:', error);
            });
    }

    // ===== ПОДПИСКА НА СООБЩЕНИЯ =====
    function subscribeToMessages() {
        if (!checkFirebase() || !chatId) return;
        
        if (unsubscribeMessages) unsubscribeMessages();
        
        unsubscribeMessages = db.collection('chats').doc(chatId)
            .collection('messages')
            .orderBy('timestamp', 'asc')
            .onSnapshot((snapshot) => {
                const messages = [];
                snapshot.forEach(doc => messages.push(doc.data()));
                displayMessages(messages);
            }, (error) => {
                console.error('❌ Ошибка подписки на сообщения:', error);
            });
    }

    // ===== ПОДПИСКА НА СТАТУС =====
    function subscribeToStatus() {
        if (!checkFirebase() || !partnerId) return;
        
        if (unsubscribeStatus) unsubscribeStatus();
        
        unsubscribeStatus = db.collection('status').doc(partnerId)
            .onSnapshot((doc) => {
                const status = doc.data();
                const onlineDot = $('onlineStatus');
                if (!onlineDot) return;
                
                if (status?.online) {
                    const lastSeen = status.lastSeen?.toDate ? status.lastSeen.toDate() : new Date(status.lastSeen);
                    if (Date.now() - lastSeen.getTime() < 60000) {
                        onlineDot.style.background = 'var(--success)';
                        onlineDot.classList.add('online');
                    } else {
                        onlineDot.style.background = 'var(--text-soft)';
                        onlineDot.classList.remove('online');
                    }
                } else {
                    onlineDot.style.background = 'var(--text-soft)';
                    onlineDot.classList.remove('online');
                }
            });
    }

    // ===== ОБНОВЛЕНИЕ UI =====
    function updateUI() {
        const partnerNameEl = $('chatPartnerName');
        if (partnerNameEl) partnerNameEl.innerText = partnerName || 'Загрузка...';
        
        const partnerRoleEl = $('chatPartnerRole');
        if (partnerRoleEl) {
            partnerRoleEl.innerHTML = `${partnerRole || '...'} <span class="online-status" id="onlineStatus"></span>`;
        }
        
        const orderInfoEl = $('orderInfo');
        if (orderInfoEl && orderData) {
            orderInfoEl.innerHTML = `📋 ${orderData.title || 'Заказ'} · ${orderData.price || 0} ₽`;
        }
        
        // Закрепленный заказ
        const pinnedOrder = $('pinnedOrder');
        if (orderData && pinnedOrder) {
            $('pinnedTitle').innerText = orderData.title || 'Заказ';
            $('pinnedPrice').innerText = orderData.price || '0';
            $('pinnedAddress').innerText = orderData.address || 'Адрес не указан';
            pinnedOrder.classList.remove('hidden');
        }
        
        // Права на запись
        const canWrite = checkCanWrite();
        toggleInputState(canWrite);
        
        // Быстрые ответы только для мастеров
        const quickReplies = $('quickReplies');
        if (quickReplies) {
            if (Auth.isMaster?.() && canWrite) {
                quickReplies.classList.remove('hidden');
            } else {
                quickReplies.classList.add('hidden');
            }
        }
        
        // Статус чата
        if (chatData?.status === 'completed') {
            const messagesArea = $('messagesArea');
            if (messagesArea && !document.querySelector('.chat-completed-banner')) {
                const banner = document.createElement('div');
                banner.className = 'alert alert-info mb-0 text-center chat-completed-banner';
                banner.innerHTML = '✅ Заказ выполнен. Чат только для чтения.';
                messagesArea.parentNode.insertBefore(banner, messagesArea);
            }
        }
    }

    // ===== ПРОВЕРКА ПРАВА НА ПИСЬМО =====
    function checkCanWrite() {
        if (orderData?.status === 'completed' || chatData?.status === 'completed') {
            return false;
        }
        
        const user = Auth.getUser();
        if (!user) return false;
        
        if (partnerRole === 'Мастер') {
            return chatData?.settings?.canClientWrite !== false;
        } else {
            return chatData?.settings?.canMasterWrite !== false;
        }
    }

    // ===== БЛОКИРОВКА ВВОДА =====
    function toggleInputState(enabled) {
        const input = $('messageInput');
        const sendBtn = $('sendButton');
        const attachBtn = $('attachButton');
        const voiceBtn = $('voiceButton');
        const emojiBtn = $('emojiButton');
        
        [input, sendBtn, attachBtn, voiceBtn, emojiBtn].forEach(el => {
            if (el) {
                el.disabled = !enabled;
                el.style.opacity = enabled ? '1' : '0.5';
                el.style.pointerEvents = enabled ? 'auto' : 'none';
            }
        });
        
        if (input) {
            input.placeholder = enabled ? 'Напишите сообщение...' : 'Чат закрыт для новых сообщений';
        }
    }

    // ===== ОТОБРАЖЕНИЕ СООБЩЕНИЙ =====
    function displayMessages(messages) {
        const messagesArea = $('messagesArea');
        if (!messagesArea) return;
        
        if (messages.length === 0) {
            messagesArea.innerHTML = `
                <div class="empty-chat">
                    <i class="fas fa-comments"></i>
                    <h3>Нет сообщений</h3>
                    <p>Напишите первое сообщение</p>
                </div>
            `;
            return;
        }

        messagesArea.innerHTML = '';
        messages.forEach(msg => {
            messagesArea.appendChild(createMessageElement(msg));
        });
        
        setTimeout(() => {
            messagesArea.scrollTo({
                top: messagesArea.scrollHeight,
                behavior: 'smooth'
            });
        }, 100);
    }

    // ===== СОЗДАНИЕ СООБЩЕНИЯ =====
    function createMessageElement(message) {
        const user = Auth.getUser();
        const div = document.createElement('div');
        
        // Системное сообщение
        if (message.type === 'system') {
            div.className = 'system-message';
            div.innerHTML = `
                <div class="system-message-content">
                    <i class="fas ${message.systemType === 'master_selected' ? 'fa-handshake' : 'fa-info-circle'}"></i>
                    <span>${Utils.escapeHtml(message.text)}</span>
                </div>
            `;
            return div;
        }
        
        // Обычное сообщение
        div.className = `message ${message.senderId === user?.uid ? 'sent' : 'received'}`;
        
        let filesHtml = '';
        if (message.files?.length > 0) {
            filesHtml = '<div class="message-files">';
            message.files.forEach(file => {
                if (file.type?.startsWith('image/')) {
                    filesHtml += `<img src="${file.url}" class="message-image" onclick="window.open('${file.url}')" loading="lazy">`;
                } else if (file.type?.startsWith('audio/')) {
                    filesHtml += `
                        <audio controls preload="none">
                            <source src="${file.url}" type="${file.type}">
                        </audio>
                    `;
                } else {
                    const icon = file.type?.includes('pdf') ? 'fa-file-pdf' :
                               file.type?.includes('word') ? 'fa-file-word' :
                               file.type?.includes('excel') ? 'fa-file-excel' : 'fa-file';
                    filesHtml += `
                        <a href="${file.url}" target="_blank" class="message-file">
                            <i class="fas ${icon}"></i>${file.name}
                        </a>`;
                }
            });
            filesHtml += '</div>';
        }
        
        const time = Utils.formatDate(message.timestamp);
        
        div.innerHTML = `
            <div class="message-bubble">
                ${message.text ? Utils.escapeHtml(message.text) : ''}
                ${filesHtml}
            </div>
            <div class="message-time">${time}</div>
        `;
        
        return div;
    }

    // ===== ОТПРАВКА СООБЩЕНИЯ =====
    async function sendMessage() {
        const input = $('messageInput');
        const text = input?.value.trim();
        
        if (!chatId) {
            Utils.showNotification('❌ Чат не найден', 'error');
            return;
        }
        
        if (!checkCanWrite()) {
            Utils.showNotification('❌ Чат закрыт для новых сообщений', 'warning');
            return;
        }
        
        if ((!text || text === '') && selectedFiles.length === 0) return;
        
        if (!Utils.checkSpam?.()) {
            // Кастомная проверка спама
            const now = Date.now();
            if (now - lastMessageTime < 1000) {
                Utils.showNotification('❌ Слишком много сообщений', 'warning');
                return false;
            }
            messageCount++;
            if (messageCount > 30) {
                Utils.showNotification('❌ Слишком много сообщений', 'warning');
                return false;
            }
            lastMessageTime = now;
            
            setTimeout(() => {
                messageCount = Math.max(0, messageCount - 10);
            }, 60000);
        }
        
        if (text && window.Moderation) {
            const modResult = Moderation.check(text, 'chat_message');
            if (!modResult.isValid) {
                Utils.showNotification(`❌ ${modResult.reason}`, 'warning');
                return;
            }
        }
        
        try {
            if (!checkFirebase()) return;
            
            const user = Auth.getUser();
            if (!user) return;
            
            // Загружаем файлы
            const filePromises = selectedFiles.map(async (file) => {
                const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
                const storageRef = storage.ref(`chat_files/${chatId}/${fileName}`);
                await storageRef.put(file);
                const url = await storageRef.getDownloadURL();
                return {
                    name: file.name,
                    url: url,
                    type: file.type,
                    size: file.size
                };
            });
            
            const files = await Promise.all(filePromises);
            
            // Отправляем сообщение
            const message = {
                senderId: user.uid,
                senderName: Auth.getUserData()?.name || 'Пользователь',
                text: text || '',
                files: files,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            await db.collection('chats').doc(chatId)
                .collection('messages')
                .add(message);
            
            // Обновляем последнее сообщение
            await db.collection('chats').doc(chatId).update({
                lastMessage: text || '📎 Файл',
                lastMessageAt: firebase.firestore.FieldValue.serverTimestamp(),
                [`unreadCount.${partnerId}`]: firebase.firestore.FieldValue.increment(1)
            });
            
            // Очищаем
            input.value = '';
            selectedFiles = [];
            updateFilePreview();
            
        } catch (error) {
            console.error('❌ Ошибка отправки:', error);
            Utils.showNotification('❌ Ошибка при отправке', 'error');
        }
    }

    // ===== ОБРАБОТКА ФАЙЛОВ =====
    function handleFileSelect(files) {
        if (!checkCanWrite()) {
            Utils.showNotification('❌ Нельзя отправлять файлы', 'warning');
            return;
        }
        
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
        const filePreview = $('filePreview');
        if (!filePreview) return;
        
        if (selectedFiles.length === 0) {
            filePreview.classList.add('hidden');
            filePreview.innerHTML = '';
            return;
        }
        
        filePreview.classList.remove('hidden');
        filePreview.innerHTML = '';
        
        selectedFiles.forEach((file, index) => {
            const previewItem = document.createElement('div');
            previewItem.className = 'file-preview-item';
            
            let icon = 'fa-file';
            if (file.type.startsWith('image/')) icon = 'fa-image';
            else if (file.type.startsWith('audio/')) icon = 'fa-microphone';
            else if (file.type.startsWith('video/')) icon = 'fa-video';
            else if (file.type.includes('pdf')) icon = 'fa-file-pdf';
            
            previewItem.innerHTML = `
                <i class="fas ${icon}"></i>
                <span>${file.name.length > 20 ? file.name.substring(0, 17) + '...' : file.name}</span>
                <span class="remove-file" onclick="window.removeFile(${index})">×</span>
            `;
            filePreview.appendChild(previewItem);
        });
    }

    window.removeFile = function(index) {
        selectedFiles.splice(index, 1);
        updateFilePreview();
    };

    // ===== ЗАПИСЬ ГОЛОСА =====
    async function startRecording() {
        if (!checkCanWrite()) {
            Utils.showNotification('❌ Нельзя отправлять голосовые', 'warning');
            return;
        }
        
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];
            
            mediaRecorder.ondataavailable = event => {
                audioChunks.push(event.data);
            };
            
            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                const audioFile = new File([audioBlob], `voice_${Date.now()}.webm`, { type: 'audio/webm' });
                selectedFiles.push(audioFile);
                updateFilePreview();
                stream.getTracks().forEach(track => track.stop());
            };
            
            mediaRecorder.start();
            
            $('voiceRecording')?.classList.remove('hidden');
            recordingSeconds = 0;
            
            if (recordingInterval) clearInterval(recordingInterval);
            recordingInterval = setInterval(() => {
                recordingSeconds++;
                const minutes = Math.floor(recordingSeconds / 60);
                const seconds = recordingSeconds % 60;
                const timer = $('recordingTimer');
                if (timer) {
                    timer.innerText = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                }
            }, 1000);
            
        } catch (error) {
            console.error('❌ Ошибка микрофона:', error);
            Utils.showNotification('❌ Нет доступа к микрофону', 'error');
        }
    }

    window.stopRecording = function() {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
            $('voiceRecording')?.classList.add('hidden');
            if (recordingInterval) {
                clearInterval(recordingInterval);
                recordingInterval = null;
            }
        }
    };

    window.cancelRecording = function() {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
            mediaRecorder.stream.getTracks().forEach(track => track.stop());
        }
        $('voiceRecording')?.classList.add('hidden');
        if (recordingInterval) {
            clearInterval(recordingInterval);
            recordingInterval = null;
        }
    };

    // ===== ЭМОДЗИ =====
    function toggleEmojiPanel() {
        const panel = $('emojiPanel');
        if (!panel) {
            createEmojiPanel();
        } else {
            panel.classList.toggle('hidden');
        }
    }

    function createEmojiPanel() {
        const panel = document.createElement('div');
        panel.id = 'emojiPanel';
        panel.className = 'emoji-panel hidden';
        
        EMOJIS.forEach(emoji => {
            const btn = document.createElement('span');
            btn.className = 'emoji-item';
            btn.textContent = emoji;
            btn.onclick = () => {
                const input = $('messageInput');
                if (checkCanWrite()) {
                    input.value += emoji;
                    input.focus();
                }
                panel.classList.add('hidden');
            };
            panel.appendChild(btn);
        });
        
        document.querySelector('.chat-container').appendChild(panel);
    }

    // ===== ДЕТАЛИ ЗАКАЗА =====
    window.showOrderDetails = function() {
        if (!orderData) {
            Utils.showNotification('Данные заказа не загружены', 'info');
            return;
        }
        
        const modal = new bootstrap.Modal($('orderDetailsModal'));
        
        const content = $('orderDetailsContent');
        if (content) {
            content.innerHTML = `
                <div class="order-detail-item">
                    <div class="order-detail-icon"><i class="fas fa-tag"></i></div>
                    <div class="order-detail-info">
                        <div class="order-detail-label">Название</div>
                        <div class="order-detail-value">${Utils.escapeHtml(orderData.title || 'Не указано')}</div>
                    </div>
                </div>
                <div class="order-detail-item">
                    <div class="order-detail-icon"><i class="fas fa-align-left"></i></div>
                    <div class="order-detail-info">
                        <div class="order-detail-label">Описание</div>
                        <div class="order-detail-value">${Utils.escapeHtml(orderData.description || 'Нет описания')}</div>
                    </div>
                </div>
                <div class="order-detail-item">
                    <div class="order-detail-icon"><i class="fas fa-ruble-sign"></i></div>
                    <div class="order-detail-info">
                        <div class="order-detail-label">Цена</div>
                        <div class="order-detail-value">${orderData.price || 0} ₽</div>
                    </div>
                </div>
                <div class="order-detail-item">
                    <div class="order-detail-icon"><i class="fas fa-map-marker-alt"></i></div>
                    <div class="order-detail-info">
                        <div class="order-detail-label">Адрес</div>
                        <div class="order-detail-value">${Utils.escapeHtml(orderData.address || 'Не указан')}</div>
                    </div>
                </div>
                <div class="order-detail-item">
                    <div class="order-detail-icon"><i class="fas fa-folder"></i></div>
                    <div class="order-detail-info">
                        <div class="order-detail-label">Категория</div>
                        <div class="order-detail-value">${orderData.category || 'Не указана'}</div>
                    </div>
                </div>
                <div class="order-detail-item">
                    <div class="order-detail-icon"><i class="fas fa-user"></i></div>
                    <div class="order-detail-info">
                        <div class="order-detail-label">Статус</div>
                        <div class="order-detail-value">
                            ${orderData.status === 'open' ? '🔵 Активен' : 
                              orderData.status === 'in_progress' ? '🟢 В работе' : 
                              '✅ Завершен'}
                        </div>
                    </div>
                </div>
            `;
        }
        
        modal.show();
    };

    // ===== ОЧИСТКА =====
    function cleanup() {
        if (unsubscribeMessages) unsubscribeMessages();
        if (unsubscribeStatus) unsubscribeStatus();
        if (unsubscribeChat) unsubscribeChat();
        if (recordingInterval) clearInterval(recordingInterval);
    }

    // ===== ИНИЦИАЛИЗАЦИЯ =====
    function initEventListeners() {
        const attachButton = $('attachButton');
        const fileInput = $('fileInput');
        
        attachButton?.addEventListener('click', () => fileInput.click());
        fileInput?.addEventListener('change', (e) => handleFileSelect(e.target.files));

        $('voiceButton')?.addEventListener('click', startRecording);
        $('emojiButton')?.addEventListener('click', toggleEmojiPanel);
        $('sendButton')?.addEventListener('click', sendMessage);
        
        const messageInput = $('messageInput');
        messageInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        // Быстрые ответы
        document.querySelectorAll('.quick-reply-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                if (!checkCanWrite()) {
                    Utils.showNotification('❌ Нельзя отправлять сообщения', 'warning');
                    return;
                }
                
                let text = this.dataset.text;
                if (text.includes('[цена]') && orderData?.price) {
                    text = text.replace('[цена]', orderData.price);
                }
                if (messageInput) {
                    messageInput.value = text;
                    messageInput.focus();
                }
            });
        });

        // Звонки
        $('videoCallBtn')?.addEventListener('click', () => {
            if (orderData?.status === 'completed') {
                Utils.showNotification('❌ Заказ выполнен', 'warning');
                return;
            }
            Utils.showNotification('🎥 Видеозвонки скоро', 'info');
        });

        $('voiceCallBtn')?.addEventListener('click', () => {
            if (orderData?.status === 'completed') {
                Utils.showNotification('❌ Заказ выполнен', 'warning');
                return;
            }
            Utils.showNotification('📞 Аудиозвонки скоро', 'info');
        });

        // Темная тема
        $('themeToggle')?.addEventListener('click', () => {
            document.body.classList.toggle('dark-theme');
            const icon = $('themeToggle').querySelector('i');
            if (icon) {
                if (document.body.classList.contains('dark-theme')) {
                    icon.classList.remove('fa-moon');
                    icon.classList.add('fa-sun');
                    localStorage.setItem('theme', 'dark');
                } else {
                    icon.classList.remove('fa-sun');
                    icon.classList.add('fa-moon');
                    localStorage.setItem('theme', 'light');
                }
            }
        });

        // Закрытие эмодзи
        document.addEventListener('click', (e) => {
            const panel = $('emojiPanel');
            const btn = $('emojiButton');
            if (panel && !panel.contains(e.target) && !btn?.contains(e.target)) {
                panel.classList.add('hidden');
            }
        });

        window.addEventListener('beforeunload', cleanup);
    }

    // ===== ЗАПУСК =====
    document.addEventListener('DOMContentLoaded', () => {
        if (!window.Auth) {
            console.error('❌ Auth не загружен');
            Utils.showNotification('❌ Ошибка авторизации', 'error');
            return;
        }

        Auth.onAuthChange(async (state) => {
            if (state.isAuthenticated) {
                const loaded = await loadChatData();
                if (!loaded) {
                    console.error('❌ Не удалось загрузить чат');
                }
            } else {
                Utils.showNotification('❌ Требуется авторизация', 'warning');
                setTimeout(() => window.location.href = '/HomeWork/', 2000);
            }
        });

        initEventListeners();
        
        if (localStorage.getItem('theme') === 'dark') {
            document.body.classList.add('dark-theme');
            const icon = $('themeToggle')?.querySelector('i');
            if (icon) {
                icon.classList.remove('fa-moon');
                icon.classList.add('fa-sun');
            }
        }
    });

})();