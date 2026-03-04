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
    let lastMessageTime = 0;
    let messageCount = 0;

    // DOM элементы
    const $ = (id) => document.getElementById(id);

    // Инициализация
    document.addEventListener('DOMContentLoaded', async () => {
        if (!chatIdParam) {
            Utils.showNotification('❌ Не указан ID чата', 'error');
            setTimeout(() => window.location.href = '/HomeWork/', 2000);
            return;
        }

        chatId = chatIdParam;

        // Ждём авторизацию
        await waitForAuth();

        if (!Auth.isAuthenticated()) {
            Utils.showNotification('❌ Требуется авторизация', 'warning');
            setTimeout(() => window.location.href = '/HomeWork/', 2000);
            return;
        }

        const loaded = await loadChatData();
        if (!loaded) return;

        initEventListeners();
    });

    // Ожидание авторизации
    function waitForAuth() {
        return new Promise((resolve) => {
            if (Auth.isAuthenticated()) {
                resolve();
                return;
            }
            
            const unsubscribe = Auth.onAuthChange((state) => {
                if (state.isAuthenticated) {
                    unsubscribe();
                    resolve();
                }
            });
            
            setTimeout(() => {
                unsubscribe();
                resolve();
            }, 5000);
        });
    }

    // Загрузка данных чата
    async function loadChatData() {
        try {
            if (!Utils.checkFirestore()) return false;

            const user = Auth.getUser();
            if (!user) return false;

            // Загружаем чат
            const chatDoc = await db.collection('chats').doc(chatId).get();
            
            if (!chatDoc.exists) {
                Utils.showNotification('❌ Чат не найден', 'error');
                setTimeout(() => window.location.href = '/HomeWork/', 2000);
                return false;
            }

            chatData = chatDoc.data();

            // Проверяем, является ли пользователь участником
            if (!chatData.participants.includes(user.uid)) {
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
                    
                    $('chatPartnerName').textContent = partnerName;
                    $('chatPartnerRole').textContent = partnerRole;
                }
            }

            // Закреплённый заказ
            if (chatData.orderId && chatData.orderTitle) {
                const pinned = $('pinnedOrder');
                pinned.classList.remove('d-none');
                $('pinnedTitle').textContent = chatData.orderTitle;
                $('pinnedPrice').textContent = chatData.selectedPrice || '—';
            }

            // Отмечаем сообщения как прочитанные
            await Chat.markAsRead(chatId);

            // Подписываемся на сообщения
            subscribeToMessages();

            return true;
        } catch (error) {
            console.error('Ошибка загрузки чата:', error);
            Utils.showNotification('❌ Ошибка загрузки чата', 'error');
            return false;
        }
    }

    // Подписка на сообщения
    function subscribeToMessages() {
        if (unsubscribeMessages) unsubscribeMessages();
        
        unsubscribeMessages = Chat.subscribeToMessages(chatId, (messages) => {
            displayMessages(messages);
            
            // Отмечаем как прочитанные при получении новых
            Chat.markAsRead(chatId);
        });
    }

    // Отображение сообщений
    function displayMessages(messages) {
        const messagesArea = $('messagesArea');
        if (!messagesArea) return;

        if (messages.length === 0) {
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
                    filesHtml += `<img src="${file.url}" class="message-image" onclick="window.open('${file.url}')">`;
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
            input.value = '';
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
                <span class="remove-file" onclick="removeFile(${index})">×</span>
            </div>
        `).join('');
    }

    window.removeFile = (index) => {
        selectedFiles.splice(index, 1);
        updateFilePreview();
    };

    // Очистка
    function cleanup() {
        if (unsubscribeMessages) unsubscribeMessages();
    }

    // Инициализация обработчиков
    function initEventListeners() {
        $('attachButton')?.addEventListener('click', () => $('fileInput').click());
        
        $('fileInput')?.addEventListener('change', (e) => handleFileSelect(e.target.files));
        
        $('sendButton')?.addEventListener('click', sendMessage);
        
        $('messageInput')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        window.addEventListener('beforeunload', cleanup);
    }
})();