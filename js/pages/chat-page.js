// ===== CHAT-PAGE.JS — Логика страницы чата =====

(function() {
    // Параметры URL
    const urlParams = new URLSearchParams(window.location.search);
    const orderId = urlParams.get('orderId');
    const masterId = urlParams.get('masterId');

    // Состояние
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

    // Инициализация
    document.addEventListener('DOMContentLoaded', () => {
        if (!orderId || !masterId) {
            alert('Ошибка: не указан заказ или мастер');
            window.location.href = 'index.html';
            return;
        }

        let authChecked = false;
        
        Auth.onAuthChange(async (state) => {
            console.log('🔄 Статус авторизации в чате:', state);
            
            if (!authChecked) {
                authChecked = true;
                
                if (!state.isAuthenticated) {
                    console.log('⏳ Ожидаем авторизацию...');
                    setTimeout(() => {
                        if (!Auth.isAuthenticated()) {
                            console.log('❌ Авторизация не загрузилась, редирект на главную');
                            window.location.href = 'index.html';
                        }
                    }, 2000);
                    return;
                }
            }
            
            if (state.isAuthenticated) {
                await loadOrderData();
                await initializeChat();
                
                // Подписываемся на сообщения
                Chats.listenToMessages(chatId, displayMessages);
                
                // Настраиваем индикатор печати
                Chats.setupTypingIndicator(chatId);
                
                // Слушаем печатание собеседника
                Chats.listenToTyping(chatId, (isTyping) => {
                    const indicator = document.getElementById('typingIndicator');
                    if (indicator) {
                        indicator.classList.toggle('hidden', !isTyping);
                    }
                });
                
                checkOnlineStatus();
            }
        });

        initEventListeners();
    });

    // Загрузка данных заказа
    async function loadOrderData() {
        try {
            const orderDoc = await db.collection('orders').doc(orderId).get();
            if (!orderDoc.exists) {
                alert('Заказ не найден');
                window.location.href = 'index.html';
                return;
            }

            orderData = { id: orderDoc.id, ...orderDoc.data() };
            
            // Определяем собеседника
            const user = Auth.getUser();
            if (orderData.clientId === user.uid) {
                partnerId = masterId;
                partnerRole = 'Мастер';
                
                const masterDoc = await db.collection('users').doc(masterId).get();
                partnerName = masterDoc.exists ? (masterDoc.data().name || 'Мастер') : 'Мастер';
                chatId = `chat_${orderId}_${partnerId}`;
            } else {
                partnerId = orderData.clientId;
                partnerRole = 'Клиент';
                partnerName = orderData.clientName || 'Клиент';
                chatId = `chat_${orderId}_${user.uid}`;
            }

            // Обновляем интерфейс
            document.getElementById('chatPartnerName').innerText = partnerName;
            document.getElementById('chatPartnerRole').innerHTML = `${partnerRole} <span class="online-status"></span>`;
            document.getElementById('orderInfo').innerHTML = `📋 ${orderData.title || 'Заказ'} · ${orderData.price || 0} ₽`;
            
            // Показываем закрепленный заказ
            const pinnedOrder = document.getElementById('pinnedOrder');
            if (orderData) {
                document.getElementById('pinnedTitle').innerText = orderData.title || 'Заказ';
                document.getElementById('pinnedPrice').innerText = orderData.price || '0';
                document.getElementById('pinnedAddress').innerText = orderData.address || 'Адрес не указан';
                pinnedOrder.classList.remove('hidden');
            }
            
            // Быстрые ответы только для мастеров
            const quickReplies = document.getElementById('quickReplies');
            if (Auth.isMaster()) {
                quickReplies.classList.remove('hidden');
                console.log('✅ Быстрые ответы показаны (мастер)');
            } else {
                quickReplies.classList.add('hidden');
                console.log('❌ Быстрые ответы скрыты (клиент)');
            }
            
        } catch (error) {
            console.error('❌ Ошибка загрузки заказа:', error);
            alert('Ошибка загрузки данных заказа');
        }
    }

    // Инициализация чата
    async function initializeChat() {
        try {
            const user = Auth.getUser();
            await Chats.create(orderId, masterId, orderData.clientId);
        } catch (error) {
            console.error('❌ Ошибка инициализации чата:', error);
        }
    }

    // Проверка онлайн статуса
    function checkOnlineStatus() {
        const statusRef = db.collection('status').doc(partnerId);
        
        statusRef.onSnapshot((doc) => {
            const status = doc.data();
            const onlineDot = document.querySelector('.online-status');
            
            if (status && status.online && (Date.now() - status.lastSeen.toDate() < 60000)) {
                onlineDot.style.background = 'var(--success)';
            } else {
                onlineDot.style.background = 'var(--text-soft)';
            }
        });
    }

    // Отображение сообщений
    function displayMessages(messages) {
        const messagesArea = document.getElementById('messagesArea');
        
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
            messagesArea.scrollTop = messagesArea.scrollHeight;
        }, 100);
    }

    // Создание элемента сообщения
    function createMessageElement(message) {
        const user = Auth.getUser();
        const div = document.createElement('div');
        div.className = `message ${message.senderId === user?.uid ? 'sent' : 'received'}`;
        
        let filesHtml = '';
        if (message.files?.length > 0) {
            filesHtml = '<div class="message-files">';
            message.files.forEach(file => {
                if (file.type?.startsWith('image/')) {
                    filesHtml += `<img src="${file.url}" class="message-image" onclick="window.open('${file.url}')" title="${file.name}">`;
                } else if (file.type?.startsWith('audio/')) {
                    filesHtml += `
                        <audio controls style="max-width: 200px;">
                            <source src="${file.url}" type="${file.type}">
                        </audio>
                    `;
                } else {
                    const icon = file.type?.includes('pdf') ? 'fa-file-pdf' :
                               file.type?.includes('word') ? 'fa-file-word' :
                               file.type?.includes('excel') ? 'fa-file-excel' : 'fa-file';
                    filesHtml += `<a href="${file.url}" target="_blank" class="message-file"><i class="fas ${icon}"></i>${file.name}</a>`;
                }
            });
            filesHtml += '</div>';
        }
        
        const time = Utils.formatDate(message.timestamp);
        
        div.innerHTML = `
            <div class="message-bubble">
                ${Utils.escapeHtml(message.text) || ''}
                ${filesHtml}
            </div>
            <div class="message-time">${time}</div>
        `;
        
        return div;
    }

    // Отправка сообщения
    async function sendMessage() {
        const input = document.getElementById('messageInput');
        const text = input.value.trim();
        
        if ((!text || text === '') && selectedFiles.length === 0) return;
        
        // Проверяем модерацию
        if (text) {
            const modResult = Moderation.check(text, 'chat_message');
            if (!modResult.isValid) {
                Utils.showNotification(`❌ ${modResult.reason}`, 'warning');
                return;
            }
        }
        
        await Chats.sendMessage(chatId, text, selectedFiles);
        
        // Очищаем
        input.value = '';
        selectedFiles = [];
        updateFilePreview();
    }

    // Инициализация обработчиков
    function initEventListeners() {
        // Загрузка файлов
        const attachButton = document.getElementById('attachButton');
        const fileInput = document.getElementById('fileInput');

        attachButton?.addEventListener('click', () => fileInput.click());

        fileInput?.addEventListener('change', (e) => {
            handleFileSelect(e.target.files);
        });

        // Голосовые сообщения
        document.getElementById('voiceButton')?.addEventListener('click', startRecording);

        // Отправка по Enter
        document.getElementById('sendButton')?.addEventListener('click', sendMessage);
        document.getElementById('messageInput')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                sendMessage();
            }
        });

        // Быстрые ответы
        document.querySelectorAll('.quick-reply-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                let text = this.dataset.text;
                if (text.includes('[цена]') && orderData?.price) {
                    text = text.replace('[цена]', orderData.price);
                }
                document.getElementById('messageInput').value = text;
                document.getElementById('messageInput').focus();
            });
        });

        // Темная тема
        document.getElementById('themeToggle')?.addEventListener('click', Auth.toggleTheme);
    }

    // Обработка выбора файлов
    function handleFileSelect(files) {
        for (let file of files) {
            if (file.size > 10 * 1024 * 1024) {
                Utils.showNotification('Файл слишком большой (макс 10MB)', 'warning');
                continue;
            }
            selectedFiles.push(file);
        }
        updateFilePreview();
    }

    // Обновление превью файлов
    function updateFilePreview() {
        const filePreview = document.getElementById('filePreview');
        
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
                <span class="remove-file" onclick="removeFile(${index})">×</span>
            `;
            filePreview.appendChild(previewItem);
        });
    }

    // Удаление файла
    window.removeFile = function(index) {
        selectedFiles.splice(index, 1);
        updateFilePreview();
    };

    // Запись голоса
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
            
            // Показываем интерфейс записи
            document.getElementById('voiceRecording').classList.remove('hidden');
            recordingSeconds = 0;
            recordingInterval = setInterval(() => {
                recordingSeconds++;
                const minutes = Math.floor(recordingSeconds / 60);
                const seconds = recordingSeconds % 60;
                document.getElementById('recordingTimer').innerText = 
                    `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            }, 1000);
            
        } catch (error) {
            console.error('❌ Ошибка доступа к микрофону:', error);
            Utils.showNotification('Не удалось получить доступ к микрофону', 'error');
        }
    }

    // Остановка записи
    window.stopRecording = function() {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
            document.getElementById('voiceRecording').classList.add('hidden');
            clearInterval(recordingInterval);
        }
    };

    // Отмена записи
    window.cancelRecording = function() {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
            mediaRecorder.stream.getTracks().forEach(track => track.stop());
        }
        document.getElementById('voiceRecording').classList.add('hidden');
        clearInterval(recordingInterval);
    };

    // Показать детали заказа
    window.showOrderDetails = function() {
        alert(`
            Заказ: ${orderData.title}
            Описание: ${orderData.description || 'Нет'}
            Цена: ${orderData.price} ₽
            Адрес: ${orderData.address}
            Категория: ${orderData.category}
        `);
    };

    // Очистка при выходе
    window.addEventListener('beforeunload', () => {
        Chats.unsubscribeAll();
    });
})();