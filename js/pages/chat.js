/**
 * chat.js — логика страницы чата (ИСПРАВЛЕНО: XSS, Composition Events)
 */

(function() {
    console.log('🚀 Chat page loaded');
    
    // ===== СОСТОЯНИЕ =====
    let currentChatId = null;
    let filesToSend = [];
    let unsubscribeMessages = null;
    let isComposing = false; // Флаг для Composition Events
    let isSending = false; // Флаг для предотвращения двойной отправки
    
    // ===== DOM ЭЛЕМЕНТЫ =====
    const $ = (id) => document.getElementById(id);
    
    // ===== ИНИЦИАЛИЗАЦИЯ =====
    document.addEventListener('DOMContentLoaded', async () => {
        console.log('🚀 Chat page initializing');
        
        // Получаем ID чата из URL
        const urlParams = new URLSearchParams(window.location.search);
        currentChatId = urlParams.get('chatId');
        
        if (!currentChatId) {
            Utils.showError('Чат не найден');
            setTimeout(() => window.history.back(), 2000);
            return;
        }
        
        // Ждём авторизацию
        Auth.onAuthChange(async (state) => {
            if (state.isAuthenticated) {
                await loadChat();
            } else {
                Utils.showError('Необходимо авторизоваться');
                setTimeout(() => window.location.href = '/HomeWork/', 2000);
            }
        });
        
        // Обработчики
        setupEventListeners();
    });
    
    // ===== ЗАГРУЗКА ЧАТА =====
    async function loadChat() {
        try {
            const user = Auth.getUser();
            if (!user) return;
            
            // Проверяем доступ
            const hasAccess = await Chat.checkAccess(currentChatId, user.uid);
            if (!hasAccess) {
                Utils.showError('У вас нет доступа к этому чату');
                setTimeout(() => window.history.back(), 2000);
                return;
            }
            
            // Загружаем данные чата
            const chatData = await Chat.getChat(currentChatId);
            if (!chatData) {
                Utils.showError('Чат не найден');
                return;
            }
            
            // Определяем собеседника
            const otherId = chatData.participants.find(id => id !== user.uid);
            
            // Загружаем данные собеседника
            const userDoc = await db.collection('users').doc(otherId).get();
            const otherUser = userDoc.exists ? userDoc.data() : { name: 'Пользователь' };
            
            const nameEl = $('chatPartnerName');
            if (nameEl) nameEl.textContent = Utils.escapeHtml(otherUser.name || 'Пользователь');
            
            const roleEl = $('chatPartnerRole');
            if (roleEl) roleEl.textContent = otherUser.role === 'master' ? 'Мастер' : 'Клиент';
            
            // Статус онлайн (заглушка)
            const statusEl = $('userStatus');
            if (statusEl) statusEl.className = 'status-dot online';
            
            // Информация о заказе
            if (chatData.orderId) {
                const orderDoc = await db.collection('orders').doc(chatData.orderId).get();
                if (orderDoc.exists) {
                    const order = orderDoc.data();
                    const pinnedOrder = $('pinnedOrder');
                    const pinnedTitle = $('pinnedTitle');
                    const pinnedPrice = $('pinnedPrice');
                    
                    if (pinnedOrder) pinnedOrder.classList.remove('d-none');
                    if (pinnedTitle) pinnedTitle.textContent = Utils.escapeHtml(order.title || 'Заказ');
                    if (pinnedPrice) pinnedPrice.textContent = order.price || 0;
                }
            }
            
            // Подписываемся на сообщения
            if (unsubscribeMessages) {
                unsubscribeMessages();
            }
            
            unsubscribeMessages = Chat.subscribeToMessages(currentChatId, (messages) => {
                renderMessages(messages);
                Chat.markAsRead(currentChatId);
            });
            
        } catch (error) {
            console.error('❌ Ошибка загрузки чата:', error);
            Utils.showError('Не удалось загрузить чат');
        }
    }
    
    // ===== ОТОБРАЖЕНИЕ СООБЩЕНИЙ (ИСПРАВЛЕНО: XSS) =====
    function renderMessages(messages) {
        const container = $('messagesArea');
        if (!container) return;
        
        const user = Auth.getUser();
        if (!user) return;
        
        if (messages.length === 0) {
            container.innerHTML = `
                <div class="empty-chat">
                    <i class="fas fa-comments"></i>
                    <h4>Нет сообщений</h4>
                    <p>Напишите что-нибудь, чтобы начать общение</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = messages.map(msg => {
            const isSent = msg.senderId === user.uid;
            const time = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString('ru-RU', {
                hour: '2-digit',
                minute: '2-digit'
            }) : '';
            
            let content = '';
            
            // Текст сообщения (экранируем)
            if (msg.text) {
                content += `<div class="message-text">${Utils.escapeHtml(msg.text)}</div>`;
            }
            
            // Файлы (экранируем URL и имена)
            if (msg.files && msg.files.length > 0) {
                msg.files.forEach(file => {
                    if (file.type?.startsWith('image/')) {
                        // ИСПРАВЛЕНО: экранируем URL
                        const safeUrl = Utils.escapeAttr(file.url);
                        content += `<img src="${safeUrl}" class="message-image" onclick="window.open('${safeUrl}')" loading="lazy">`;
                    } else {
                        const safeUrl = Utils.escapeAttr(file.url);
                        const safeName = Utils.escapeHtml(file.name);
                        content += `
                            <a href="${safeUrl}" target="_blank" class="message-file">
                                <i class="fas fa-file file-icon"></i>
                                <span class="file-name">${safeName}</span>
                            </a>
                        `;
                    }
                });
            }
            
            return `
                <div class="message ${isSent ? 'sent' : 'received'}">
                    <div class="message-bubble">
                        ${content}
                        <div class="message-time">
                            <span>${time}</span>
                            ${isSent ? `<span class="message-status ${msg.read ? 'read' : 'delivered'}">✓✓</span>` : ''}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        // Скроллим вниз
        container.scrollTop = container.scrollHeight;
    }
    
    // ===== ОТПРАВКА СООБЩЕНИЯ (С ЗАЩИТОЙ) =====
    async function sendMessage() {
        // Защита от двойной отправки
        if (isSending) {
            console.log('⏳ Отправка уже выполняется');
            return;
        }
        
        // Защита от отправки во время ввода иероглифов
        if (isComposing) {
            console.log('⏳ Идёт ввод иероглифов, отправка отложена');
            return;
        }
        
        const input = $('messageInput');
        const text = input?.value.trim();
        
        if (!text && filesToSend.length === 0) return;
        
        isSending = true;
        
        const sendBtn = $('sendButton');
        if (sendBtn) {
            sendBtn.disabled = true;
            sendBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
        }
        
        try {
            const result = await Chat.sendMessage(currentChatId, text, filesToSend);
            
            if (result.success) {
                if (input) input.value = '';
                filesToSend = [];
                
                const preview = $('filePreview');
                if (preview) {
                    preview.innerHTML = '';
                    preview.classList.add('d-none');
                }
            } else {
                Utils.showError(result.error || 'Ошибка отправки');
            }
        } catch (error) {
            console.error('Ошибка отправки:', error);
            Utils.showError('Ошибка отправки');
        } finally {
            isSending = false;
            if (sendBtn) {
                sendBtn.disabled = false;
                sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
            }
        }
    }
    
    // ===== ОБРАБОТКА ФАЙЛОВ =====
    function handleFileSelect(e) {
        const files = Array.from(e.target.files);
        
        // Валидация файлов
        const validFiles = [];
        const errors = [];
        
        files.forEach(file => {
            const validation = UploadService.validateFile(file);
            if (validation.valid) {
                validFiles.push(file);
            } else {
                errors.push(`${file.name}: ${validation.errors.join(', ')}`);
            }
        });
        
        if (errors.length > 0) {
            Utils.showWarning(`Некоторые файлы не прошли проверку:\n${errors.join('\n')}`);
        }
        
        filesToSend = [...filesToSend, ...validFiles];
        
        const preview = $('filePreview');
        if (preview) {
            if (filesToSend.length > 0) {
                preview.innerHTML = filesToSend.map((file, index) => {
                    const safeName = Utils.escapeHtml(file.name);
                    return `
                        <div class="file-preview-item">
                            <i class="fas ${file.type.startsWith('image/') ? 'fa-image' : 'fa-file'} file-preview-icon"></i>
                            <span class="file-preview-name" title="${safeName}">${Utils.truncate(safeName, 20)}</span>
                            <span class="file-preview-remove" onclick="window.removeFile(${index})">×</span>
                        </div>
                    `;
                }).join('');
                preview.classList.remove('d-none');
            } else {
                preview.classList.add('d-none');
                preview.innerHTML = '';
            }
        }
    }
    
    // Глобальная функция для удаления файлов
    window.removeFile = function(index) {
        filesToSend.splice(index, 1);
        
        const preview = $('filePreview');
        if (preview) {
            if (filesToSend.length === 0) {
                preview.classList.add('d-none');
                preview.innerHTML = '';
            } else {
                preview.innerHTML = filesToSend.map((file, i) => {
                    const safeName = Utils.escapeHtml(file.name);
                    return `
                        <div class="file-preview-item">
                            <i class="fas ${file.type.startsWith('image/') ? 'fa-image' : 'fa-file'} file-preview-icon"></i>
                            <span class="file-preview-name" title="${safeName}">${Utils.truncate(safeName, 20)}</span>
                            <span class="file-preview-remove" onclick="window.removeFile(${i})">×</span>
                        </div>
                    `;
                }).join('');
            }
        }
    };
    
    // ===== НАСТРОЙКА ОБРАБОТЧИКОВ (ИСПРАВЛЕНО: Composition Events) =====
    function setupEventListeners() {
        const sendBtn = $('sendButton');
        const input = $('messageInput');
        const attachBtn = $('attachButton');
        const fileInput = $('fileInput');
        
        if (sendBtn) {
            sendBtn.addEventListener('click', sendMessage);
        }
        
        if (input) {
            // Флаги для Composition Events (японский, китайский ввод)
            input.addEventListener('compositionstart', () => {
                isComposing = true;
            });
            
            input.addEventListener('compositionend', () => {
                isComposing = false;
            });
            
            input.addEventListener('keydown', (e) => {
                // Enter без Shift и не во время ввода иероглифов
                if (e.key === 'Enter' && !e.shiftKey && !isComposing) {
                    e.preventDefault();
                    sendMessage();
                }
            });
        }
        
        if (attachBtn && fileInput) {
            attachBtn.addEventListener('click', () => {
                fileInput.click();
            });
            
            fileInput.addEventListener('change', handleFileSelect);
        }
        
        // Очистка при уходе со страницы
        window.addEventListener('beforeunload', () => {
            if (unsubscribeMessages) {
                unsubscribeMessages();
            }
        });
    }
    
    // ===== ОЧИСТКА ПРИ ВЫХОДЕ =====
    window.addEventListener('beforeunload', () => {
        if (unsubscribeMessages) {
            unsubscribeMessages();
        }
    });
    
})();