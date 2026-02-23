// ===== js/services/deepseek.js =====
// ИИ помощник с интеграцией error-handler

const DeepSeek = (function() {
    // Состояние
    let visible = false;
    let failedAttempts = 0;
    
    // DOM элементы
    let chatWindow = null;
    let messagesContainer = null;
    let input = null;
    let button = null;

    // Конфигурация из центрального файла
    const CONFIG = window.CONFIG?.api || {
        deepseek: 'https://us-central1-homework-6a562.cloudfunctions.net/deepseekProxy',
        timeouts: { deepseek: 15000 }
    };

    // ===== ПРИВАТНЫЕ МЕТОДЫ =====

    /**
     * Получение DOM элементов
     */
    function getElements() {
        if (!chatWindow) {
            chatWindow = document.getElementById('deepseek-chat-window');
        }
        if (!messagesContainer) {
            messagesContainer = document.getElementById('deepseek-messages');
        }
        if (!input) {
            input = document.getElementById('deepseek-input');
        }
        if (!button) {
            button = document.getElementById('deepseek-bro-button');
        }
    }

    /**
     * Переключение чата
     */
    function toggleChat() {
        getElements();
        if (!chatWindow) return;

        visible = !visible;
        chatWindow.classList.toggle('hidden', !visible);

        if (visible) {
            setTimeout(() => {
                input?.focus();
            }, 300);
        }
    }

    /**
     * Добавление сообщения
     */
    function addMessage(text, sender) {
        getElements();
        if (!messagesContainer) return;

        const msgDiv = document.createElement('div');
        msgDiv.className = `deepseek-message ${sender === 'bro' ? 'bro-message' : 'user-message'}`;

        const icon = sender === 'bro' ? 'fa-robot' : 'fa-user';
        msgDiv.innerHTML = `<i class="fas ${icon}"></i> ${Utils.escapeHtml(text)}`;

        messagesContainer.appendChild(msgDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    /**
     * Показать индикатор печати
     */
    function showTyping() {
        getElements();
        if (!messagesContainer) return;

        hideTyping();

        const typingDiv = document.createElement('div');
        typingDiv.id = 'deepseek-typing-indicator';
        typingDiv.className = 'deepseek-typing-indicator';
        typingDiv.innerHTML = '<i class="fas fa-robot"></i> ИИ помощник печатает...';
        messagesContainer.appendChild(typingDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    /**
     * Скрыть индикатор печати
     */
    function hideTyping() {
        document.getElementById('deepseek-typing-indicator')?.remove();
    }

    /**
     * Отправка сообщения
     */
    async function sendMessage() {
        getElements();
        if (!input) return;

        const message = input.value.trim();
        if (!message) return;

        // Добавляем сообщение пользователя
        addMessage(message, 'user');
        input.value = '';

        // Показываем индикатор
        showTyping();

        // Проверка лимита ошибок
        if (failedAttempts >= (CONFIG.app?.antispam?.spamThreshold || 3)) {
            hideTyping();
            addMessage('⛔ ИИ помощник временно недоступен. Загляните позже или напишите в поддержку!', 'bro');
            return;
        }

        try {
            const controller = new AbortController();
            const timeout = CONFIG.app?.timeouts?.deepseek || 15000;
            const timeoutId = setTimeout(() => controller.abort(), timeout);

            // Получение токена
            let token = null;
            if (window.Auth && Auth.getUser) {
                const user = Auth.getUser();
                if (user) token = await user.getIdToken();
            }

            const response = await fetch(CONFIG.deepseek, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : ''
                },
                body: JSON.stringify({
                    message: message,
                    userId: Auth?.getUser()?.uid || 'anonymous',
                    sessionId: Utils.getSessionId()
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            // Парсинг ответа
            let reply = data.choices?.[0]?.message?.content || data.reply || data.text || 'Не удалось получить ответ';

            hideTyping();
            addMessage(reply, 'bro');

            // Сброс счетчика при успехе
            failedAttempts = 0;

        } catch (error) {
            console.error('DeepSeek error:', error);

            // Передаем в глобальный обработчик
            if (window.handleError) {
                window.handleError({
                    type: 'DEEPSEEK_ERROR',
                    message: error.message,
                    name: error.name,
                    stack: error.stack,
                    timestamp: new Date().toISOString()
                });
            }

            failedAttempts++;

            hideTyping();

            if (error.name === 'AbortError') {
                addMessage('ИИ помощник долго думает... Попробуйте ещё раз или задайте вопрос покороче! ⏱️', 'bro');
            } else if (failedAttempts >= 3) {
                addMessage('⛔ ИИ помощник временно не отвечает. Попробуйте позже или напишите в поддержку support@workhom.ru', 'bro');
            } else {
                addMessage('Что-то пошло не так... Давайте попробуем ещё раз? 😅', 'bro');
            }
        }
    }

    /**
     * Инициализация обработчиков
     */
    function init() {
        getElements();
        
        if (input) {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    sendMessage();
                }
            });
        }

        // Закрытие по клику вне
        document.addEventListener('click', (e) => {
            getElements();
            if (visible && chatWindow && button && !chatWindow.contains(e.target) && !button.contains(e.target)) {
                toggleChat();
            }
        });

        // Приветственное сообщение
        if (messagesContainer && messagesContainer.children.length === 0) {
            addMessage('Привет! Я ИИ помощник ВоркХом. Могу помочь подобрать мастера, рассчитать цену или ответить на вопросы о сервисе! 🤖', 'bro');
        }

        console.log('✅ DeepSeek initialized');
    }

    // Публичное API
    return {
        toggle: toggleChat,
        send: sendMessage,
        init
    };
})();

// Автоинициализация
document.addEventListener('DOMContentLoaded', () => {
    DeepSeek.init();
});

window.DeepSeek = DeepSeek;
window.toggleDeepSeekChat = DeepSeek.toggle;
window.sendToDeepSeek = DeepSeek.send;