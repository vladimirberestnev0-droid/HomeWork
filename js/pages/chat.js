// ===== chat.js =====
// ПРЕМИУМ ЧАТ С ГОЛОСОВЫМИ, ФАЙЛАМИ И ЭМОДЗИ

(function() {
    // ===== СОСТОЯНИЕ =====
    const urlParams = new URLSearchParams(window.location.search);
    const orderId = urlParams.get('orderId');
    const masterId = urlParams.get('masterId');
    
    let chatId = null;
    let orderData = null;
    let partnerId = null;
    let partnerRole = null;
    let partnerName = null;
    let selectedFiles = [];
    let mediaRecorder = null;
    let audioChunks = [];
    let recordingInterval = null;
    let recordingSeconds = 0;
    let unsubscribeMessages = null;
    let unsubscribeTyping = null;
    let unsubscribeStatus = null;
    let typingTimeout = null;
    
    // Кэш для пользователей
    const userCache = new Map();
    
    // Эмодзи для панели
    const EMOJIS = ['😊', '😂', '❤️', '👍', '🔥', '🎉', '🤔', '😢', '😡', '👋', '✅', '❌', '⭐', '💰', '🔨', '🛠️', '🚗', '📦', '⏰', '📍'];

    // ===== БЕЗОПАСНЫЕ HELPERЫ =====
    const safeHelpers = {
        escapeHtml: (text) => {
            if (!text) return '';
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        },
        formatDate: (timestamp) => {
            if (!timestamp) return 'только что';
            try {
                const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
                const now = new Date();
                const diff = now - date;
                
                // Сегодня
                if (diff < 86400000 && date.getDate() === now.getDate()) {
                    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
                }
                // Вчера
                if (diff < 172800000 && date.getDate() === now.getDate() - 1) {
                    return 'вчера ' + date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
                }
                // Старше
                return date.toLocaleString('ru-RU', { 
                    day: 'numeric', 
                    month: 'short', 
                    hour: '2-digit', 
                    minute: '2-digit' 
                });
            } catch {
                return 'недавно';
            }
        },
        showNotification: (msg, type = 'info') => {
            const notification = document.createElement('div');
            notification.className = `alert alert-${type} position-fixed top-0 end-0 m-3 animate__animated animate__fadeInRight`;
            notification.style.zIndex = '9999';
            notification.style.minWidth = '300px';
            notification.style.boxShadow = '0 10px 30px rgba(0,0,0,0.2)';
            notification.innerHTML = msg;
            document.body.appendChild(notification);
            
            setTimeout(() => {
                notification.classList.add('animate__fadeOutRight');
                setTimeout(() => notification.remove(), 500);
            }, 3000);
        }
    };

    const $ = (id) => document.getElementById(id);

    // ===== ПРОВЕРКА FIREBASE =====
    function checkFirebase() {
        if (typeof firebase === 'undefined' || typeof db === 'undefined') {
            console.error('❌ Firebase не инициализирован');
            safeHelpers.showNotification('❌ Ошибка подключения', 'error');
            return false;
        }
        return true;
    }

    // ===== ЗАГРУЗКА ПОЛЬЗОВАТЕЛЯ С КЭШЕМ =====
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

    // ===== ЗАГРУЗКА ДАННЫХ ЗАКАЗА =====
    async function loadOrderData() {
        try {
            if (!checkFirebase()) return;
            
            const user = Auth.getUser();
            if (!user) return;
            
            const orderDoc = await db.collection('orders').doc(orderId).get();
            if (!orderDoc.exists) {
                safeHelpers.showNotification('❌ Заказ не найден', 'error');
                setTimeout(() => window.location.href = '/HomeWork/', 2000);
                return;
            }

            orderData = { id: orderDoc.id, ...orderDoc.data() };
            
            // Определяем собеседника
            if (orderData.clientId === user.uid) {
                // Мы клиент
                partnerId = masterId;
                partnerRole = 'Мастер';
                
                const masterData = await getUserWithCache(masterId);
                partnerName = masterData?.name || 'Мастер';
                chatId = `chat_${orderId}_${partnerId}`;
            } else {
                // Мы мастер
                partnerId = orderData.clientId;
                partnerRole = 'Клиент';
                partnerName = orderData.clientName || 'Клиент';
                chatId = `chat_${orderId}_${user.uid}`;
            }

            // Обновляем UI
            const partnerNameEl = $('chatPartnerName');
            if (partnerNameEl) partnerNameEl.innerText = partnerName;
            
            const partnerRoleEl = $('chatPartnerRole');
            if (partnerRoleEl) partnerRoleEl.innerHTML = `${partnerRole} <span class="online-status" id="onlineStatus"></span>`;
            
            const orderInfoEl = $('orderInfo');
            if (orderInfoEl) {
                orderInfoEl.innerHTML = `📋 ${orderData.title || 'Заказ'} · ${orderData.price || 0} ₽`;
            }
            
            // Показываем закрепленный заказ
            const pinnedOrder = $('pinnedOrder');
            if (orderData && pinnedOrder) {
                $('pinnedTitle').innerText = orderData.title || 'Заказ';
                $('pinnedPrice').innerText = orderData.price || '0';
                $('pinnedAddress').innerText = orderData.address || 'Адрес не указан';
                pinnedOrder.classList.remove('hidden');
            }
            
            // Быстрые ответы только для мастеров
            const quickReplies = $('quickReplies');
            if (quickReplies) {
                if (Auth.isMaster?.()) {
                    quickReplies.classList.remove('hidden');
                } else {
                    quickReplies.classList.add('hidden');
                }
            }
            
        } catch (error) {
            console.error('❌ Ошибка загрузки заказа:', error);
            safeHelpers.showNotification('❌ Ошибка загрузки данных', 'error');
        }
    }

    // ===== ИНИЦИАЛИЗАЦИЯ ЧАТА =====
    async function initializeChat() {
        try {
            if (!checkFirebase() || !chatId) return;
            
            const user = Auth.getUser();
            if (!user) return;
            
            // Создаем или получаем чат
            const chatRef = db.collection('chats').doc(chatId);
            const chatDoc = await chatRef.get();
            
            if (!chatDoc.exists) {
                await chatRef.set({
                    participants: [user.uid, partnerId],
                    orderId: orderId,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    lastMessageAt: firebase.firestore.FieldValue.serverTimestamp(),
                    lastMessage: 'Чат создан'
                });
            }
            
            // Подписываемся на сообщения
            if (unsubscribeMessages) unsubscribeMessages();
            unsubscribeMessages = chatRef.collection('messages')
                .orderBy('timestamp', 'asc')
                .onSnapshot((snapshot) => {
                    const messages = [];
                    snapshot.forEach(doc => messages.push(doc.data()));
                    displayMessages(messages);
                }, (error) => {
                    console.error('❌ Ошибка подписки на сообщения:', error);
                });
            
            // Подписываемся на печатание
            if (unsubscribeTyping) unsubscribeTyping();
            unsubscribeTyping = chatRef.collection('typing').doc(partnerId)
                .onSnapshot((doc) => {
                    const typing = doc.data();
                    const indicator = $('typingIndicator');
                    if (indicator) {
                        indicator.classList.toggle('hidden', !typing?.isTyping);
                    }
                });
            
            // Проверяем онлайн статус
            checkOnlineStatus();
            
        } catch (error) {
            console.error('❌ Ошибка инициализации чата:', error);
        }
    }

    // ===== ПРОВЕРКА ОНЛАЙН СТАТУСА =====
    function checkOnlineStatus() {
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
            }, (error) => {
                console.error('❌ Ошибка отслеживания статуса:', error);
            });
    }

    // ===== ОТОБРАЖЕНИЕ СООБЩЕНИЙ =====
    function displayMessages(messages) {
        const messagesArea = $('messagesArea');
        if (!messagesArea) return;
        
        if (messages.length === 0) {
            messagesArea.innerHTML = `
                <div class="empty-chat">
                    <i class="fas fa-comments"></i>
                    <h3>Начните диалог</h3>
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

    // ===== СОЗДАНИЕ ЭЛЕМЕНТА СООБЩЕНИЯ =====
    function createMessageElement(message) {
        const user = Auth.getUser();
        const div = document.createElement('div');
        div.className = `message ${message.senderId === user?.uid ? 'sent' : 'received'}`;
        
        // Файлы
        let filesHtml = '';
        if (message.files?.length > 0) {
            filesHtml = '<div class="message-files">';
            message.files.forEach(file => {
                if (file.type?.startsWith('image/')) {
                    filesHtml += `<img src="${file.url}" class="message-image" onclick="window.open('${file.url}')" title="${file.name}" loading="lazy">`;
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
        
        const time = safeHelpers.formatDate(message.timestamp);
        
        div.innerHTML = `
            <div class="message-bubble">
                ${message.text ? safeHelpers.escapeHtml(message.text) : ''}
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
            safeHelpers.showNotification('❌ Чат не инициализирован', 'error');
            return;
        }
        
        if ((!text || text === '') && selectedFiles.length === 0) return;
        
        // Модерация текста
        if (text && window.Moderation) {
            const modResult = Moderation.check(text, 'chat_message');
            if (!modResult.isValid) {
                safeHelpers.showNotification(`❌ ${modResult.reason}`, 'warning');
                return;
            }
        }
        
        try {
            if (!checkFirebase()) return;
            
            const user = Auth.getUser();
            if (!user) return;
            
            // Загружаем файлы
            const filePromises = selectedFiles.map(async (file) => {
                const fileName = `${Date.now()}_${file.name}`;
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
                text: text || '',
                files: files,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            await db.collection('chats').doc(chatId)
                .collection('messages')
                .add(message);
            
            // Обновляем последнее сообщение в чате
            await db.collection('chats').doc(chatId).update({
                lastMessage: text || '📎 Файл',
                lastMessageAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            // Очищаем
            input.value = '';
            selectedFiles = [];
            updateFilePreview();
            
            // Отправляем уведомление собеседнику (если есть FCM)
            if (window.Messaging) {
                await Messaging.sendNotification(partnerId, {
                    title: 'Новое сообщение',
                    body: text || 'Файл',
                    data: { chatId, orderId }
                });
            }
            
        } catch (error) {
            console.error('❌ Ошибка отправки:', error);
            safeHelpers.showNotification('❌ Ошибка при отправке', 'error');
        }
    }

    // ===== ОТПРАВКА ТИПИНГ ИНДИКАТОРА =====
    async function sendTyping() {
        if (!chatId || !checkFirebase()) return;
        
        const user = Auth.getUser();
        if (!user) return;
        
        const typingRef = db.collection('chats').doc(chatId)
            .collection('typing').doc(user.uid);
        
        await typingRef.set({
            isTyping: true,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        if (typingTimeout) clearTimeout(typingTimeout);
        
        typingTimeout = setTimeout(async () => {
            await typingRef.delete();
            typingTimeout = null;
        }, 3000);
    }

    // ===== ОБРАБОТКА ВЫБОРА ФАЙЛОВ =====
    function handleFileSelect(files) {
        if (!files) return;
        
        for (let file of files) {
            if (file.size > 10 * 1024 * 1024) {
                safeHelpers.showNotification('❌ Файл слишком большой (макс 10MB)', 'warning');
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
            console.error('❌ Ошибка доступа к микрофону:', error);
            safeHelpers.showNotification('❌ Нет доступа к микрофону', 'error');
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

    // ===== ЭМОДЗИ ПАНЕЛЬ =====
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
                input.value += emoji;
                input.focus();
                panel.classList.add('hidden');
            };
            panel.appendChild(btn);
        });
        
        document.querySelector('.chat-container').appendChild(panel);
    }

    // ===== ПОКАЗ ДЕТАЛЕЙ ЗАКАЗА =====
    window.showOrderDetails = function() {
        const modal = new bootstrap.Modal($('orderDetailsModal'));
        
        const content = $('orderDetailsContent');
        if (content && orderData) {
            content.innerHTML = `
                <div class="order-detail-item">
                    <div class="order-detail-icon"><i class="fas fa-tag"></i></div>
                    <div class="order-detail-info">
                        <div class="order-detail-label">Название</div>
                        <div class="order-detail-value">${safeHelpers.escapeHtml(orderData.title || 'Не указано')}</div>
                    </div>
                </div>
                <div class="order-detail-item">
                    <div class="order-detail-icon"><i class="fas fa-align-left"></i></div>
                    <div class="order-detail-info">
                        <div class="order-detail-label">Описание</div>
                        <div class="order-detail-value">${safeHelpers.escapeHtml(orderData.description || 'Нет описания')}</div>
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
                        <div class="order-detail-value">${safeHelpers.escapeHtml(orderData.address || 'Не указан')}</div>
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
                    <div class="order-detail-icon"><i class="fas fa-clock"></i></div>
                    <div class="order-detail-info">
                        <div class="order-detail-label">Создан</div>
                        <div class="order-detail-value">${safeHelpers.formatDate(orderData.createdAt)}</div>
                    </div>
                </div>
            `;
        }
        
        modal.show();
    };

    // ===== ОЧИСТКА ПРИ ВЫХОДЕ =====
    function cleanup() {
        if (unsubscribeMessages) unsubscribeMessages();
        if (unsubscribeTyping) unsubscribeTyping();
        if (unsubscribeStatus) unsubscribeStatus();
        if (recordingInterval) clearInterval(recordingInterval);
        if (typingTimeout) clearTimeout(typingTimeout);
    }

    // ===== ИНИЦИАЛИЗАЦИЯ ОБРАБОТЧИКОВ =====
    function initEventListeners() {
        // Загрузка файлов
        const attachButton = $('attachButton');
        const fileInput = $('fileInput');
        
        attachButton?.addEventListener('click', () => fileInput.click());
        fileInput?.addEventListener('change', (e) => handleFileSelect(e.target.files));

        // Голосовые сообщения
        $('voiceButton')?.addEventListener('click', startRecording);

        // Эмодзи
        $('emojiButton')?.addEventListener('click', toggleEmojiPanel);

        // Отправка сообщения
        $('sendButton')?.addEventListener('click', sendMessage);
        
        const messageInput = $('messageInput');
        messageInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
        
        messageInput?.addEventListener('input', () => {
            if (chatId) sendTyping();
        });

        // Быстрые ответы
        document.querySelectorAll('.quick-reply-btn').forEach(btn => {
            btn.addEventListener('click', function() {
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

        // Видеозвонок
        $('videoCallBtn')?.addEventListener('click', () => {
            safeHelpers.showNotification('🎥 Видеозвонки скоро будут доступны', 'info');
        });

        // Аудиозвонок
        $('voiceCallBtn')?.addEventListener('click', () => {
            safeHelpers.showNotification('📞 Аудиозвонки скоро будут доступны', 'info');
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

        // Закрытие панели эмодзи при клике вне
        document.addEventListener('click', (e) => {
            const panel = $('emojiPanel');
            const btn = $('emojiButton');
            if (panel && !panel.contains(e.target) && !btn?.contains(e.target)) {
                panel.classList.add('hidden');
            }
        });

        // Очистка при выходе
        window.addEventListener('beforeunload', cleanup);
    }

    // ===== ЗАПУСК =====
    document.addEventListener('DOMContentLoaded', () => {
        if (!orderId || !masterId) {
            safeHelpers.showNotification('❌ Не указан заказ или мастер', 'error');
            setTimeout(() => window.location.href = '/HomeWork/', 2000);
            return;
        }

        // Проверяем авторизацию
        if (!window.Auth) {
            safeHelpers.showNotification('❌ Ошибка авторизации', 'error');
            return;
        }

        Auth.onAuthChange(async (state) => {
            if (state.isAuthenticated) {
                await loadOrderData();
                await initializeChat();
            } else {
                safeHelpers.showNotification('❌ Требуется авторизация', 'warning');
                setTimeout(() => window.location.href = '/HomeWork/', 2000);
            }
        });

        initEventListeners();
        
        // Загружаем сохраненную тему
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