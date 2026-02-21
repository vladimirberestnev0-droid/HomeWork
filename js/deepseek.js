// ===== deepseek.js — УЛУЧШЕННЫЙ ИИ ПОМОЩНИК =====

// Состояние чата
let deepSeekVisible = false;
let failedAttempts = 0;
const MAX_FAILED_ATTEMPTS = 3;

// Конфигурация (ключи ТОЛЬКО на сервере!)
const CONFIG = {
    // Используем Firebase Functions как прокси
    API_URL: 'https://us-central1-homework-6a562.cloudfunctions.net/deepseekProxy',
    MODEL: 'deepseek-chat',
    TIMEOUT: 15000 // 15 секунд
};

// Функция переключения чата
function toggleDeepSeekChat() {
    const chat = document.getElementById('deepseek-chat-window');
    if (!chat) return;
    
    deepSeekVisible = !deepSeekVisible;
    chat.classList.toggle('hidden', !deepSeekVisible);
    
    // Если открыли - фокус на input
    if (deepSeekVisible) {
        setTimeout(() => {
            document.getElementById('deepseek-input')?.focus();
        }, 300);
    }
}

// Безопасное добавление сообщения
function addMessage(text, sender) {
    const container = document.getElementById('deepseek-messages');
    if (!container) return;
    
    const msgDiv = document.createElement('div');
    msgDiv.className = `deepseek-message ${sender === 'bro' ? 'bro-message' : 'user-message'}`;
    
    // Добавляем иконку для сообщений бота
    if (sender === 'bro') {
        msgDiv.innerHTML = `<i class="fas fa-robot"></i> ${text}`;
    } else {
        msgDiv.innerHTML = `<i class="fas fa-user"></i> ${text}`;
    }
    
    container.appendChild(msgDiv);
    container.scrollTop = container.scrollHeight;
}

// Показать индикатор печати
function showTypingIndicator() {
    const container = document.getElementById('deepseek-messages');
    if (!container) return;
    
    // Удаляем старый индикатор если есть
    hideTypingIndicator();
    
    const typingDiv = document.createElement('div');
    typingDiv.id = 'typing-indicator';
    typingDiv.innerHTML = '<i class="fas fa-robot"></i> ИИ помощник печатает...';
    container.appendChild(typingDiv);
    container.scrollTop = container.scrollHeight;
}

// Скрыть индикатор печати
function hideTypingIndicator() {
    const typing = document.getElementById('typing-indicator');
    if (typing) typing.remove();
}

// Основная функция отправки сообщения
async function sendToDeepSeek() {
    const input = document.getElementById('deepseek-input');
    if (!input) return;
    
    const message = input.value.trim();
    if (!message) return;

    // Добавляем сообщение пользователя
    addMessage(message, 'user');
    input.value = '';

    // Показываем "печатает..."
    showTypingIndicator();

    // Проверяем, не превышен ли лимит ошибок
    if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
        hideTypingIndicator();
        addMessage('⛔ ИИ помощник временно недоступен. Загляните позже или напишите в поддержку!', 'bro');
        return;
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), CONFIG.TIMEOUT);

        // Получаем токен авторизации если пользователь залогинен
        let token = null;
        if (window.Auth && Auth.getUser) {
            const user = Auth.getUser();
            if (user) {
                token = await user.getIdToken();
            }
        }

        const response = await fetch(CONFIG.API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': token ? `Bearer ${token}` : ''
            },
            body: JSON.stringify({
                message: message,
                model: CONFIG.MODEL,
                userId: Auth?.getUser()?.uid || 'anonymous'
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Ошибка HTTP:', response.status, errorText);
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        
        // Проверяем структуру ответа
        let reply = '';
        if (data.choices && data.choices[0] && data.choices[0].message) {
            reply = data.choices[0].message.content;
        } else if (data.reply) {
            reply = data.reply;
        } else if (data.text) {
            reply = data.text;
        } else {
            console.error('Неожиданный ответ API:', data);
            throw new Error('Неверный формат ответа');
        }

        hideTypingIndicator();
        addMessage(reply, 'bro');
        
        // Сброс счётчика при успехе
        failedAttempts = 0;

    } catch (error) {
        console.error('DeepSeek error:', error);
        failedAttempts++;
        
        hideTypingIndicator();
        
        if (error.name === 'AbortError') {
            addMessage('ИИ помощник долго думает... Попробуйте ещё раз или задайте вопрос покороче! ⏱️', 'bro');
        } else if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
            addMessage('⛔ ИИ помощник временно не отвечает. Попробуйте позже или напишите в поддержку support@workhom.ru', 'bro');
        } else {
            addMessage('Что-то пошло не так... Давайте попробуем ещё раз? 😅', 'bro');
        }
    }
}

// Обработка нажатия Enter
function setupDeepSeekEvents() {
    const input = document.getElementById('deepseek-input');
    if (!input) return;
    
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            sendToDeepSeek();
        }
    });
}

// Закрытие по клику вне
window.addEventListener('click', function(e) {
    const chat = document.getElementById('deepseek-chat-window');
    const button = document.getElementById('deepseek-bro-button');
    
    if (!chat || !button) return;
    
    if (deepSeekVisible && !chat.contains(e.target) && !button.contains(e.target)) {
        toggleDeepSeekChat();
    }
});

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', () => {
    setupDeepSeekEvents();
    
    // Добавляем приветственное сообщение если чат пуст
    const container = document.getElementById('deepseek-messages');
    if (container && container.children.length === 0) {
        addMessage('Привет! Я ИИ помощник ВоркХом. Могу помочь подобрать мастера, рассчитать цену или ответить на вопросы о сервисе! 🤖', 'bro');
    }
});

// Экспортируем функции в глобальную область
window.toggleDeepSeekChat = toggleDeepSeekChat;
window.sendToDeepSeek = sendToDeepSeek;