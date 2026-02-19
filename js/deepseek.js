// Состояние чата
let deepSeekVisible = false;
let failedAttempts = 0;
const MAX_FAILED_ATTEMPTS = 3;

function toggleDeepSeekChat() {
    const chat = document.getElementById('deepseek-chat-window');
    deepSeekVisible = !deepSeekVisible;
    chat.classList.toggle('hidden', !deepSeekVisible);
}

async function sendToDeepSeek() {
    const input = document.getElementById('deepseek-input');
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
        addMessage('⛔ Бот временно недоступен. Загляни позже!', 'bro');
        return;
    }

    try {
        const API_URL = 'https://home-work-deep.vercel.app/api/deepseek';

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // Таймаут 5 секунд

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages: [{ role: 'user', content: message }]
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error('Ошибка сети');
        }

        const data = await response.json();
        const reply = data.choices[0].message.content;

        hideTypingIndicator();
        addMessage(reply, 'bro');
        
        // Сброс счётчика при успехе
        failedAttempts = 0;

    } catch (error) {
        console.error('DeepSeek error:', error);
        failedAttempts++;
        
        hideTypingIndicator();
        
        if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
            addMessage('⛔ Бот не отвечает. Попробуй позже.', 'bro');
        } else {
            addMessage('Ой, бро, что-то сломалось... Давай позже? 😅', 'bro');
        }
    }
}

function addMessage(text, sender) {
    const container = document.getElementById('deepseek-messages');
    const msgDiv = document.createElement('div');
    msgDiv.className = `deepseek-message ${sender === 'bro' ? 'bro-message' : 'user-message'}`;
    msgDiv.textContent = text;
    container.appendChild(msgDiv);
    container.scrollTop = container.scrollHeight;
}

function showTypingIndicator() {
    const container = document.getElementById('deepseek-messages');
    const typingDiv = document.createElement('div');
    typingDiv.id = 'typing-indicator';
    typingDiv.className = 'deepseek-message bro-message';
    typingDiv.textContent = 'Бро печатает...';
    container.appendChild(typingDiv);
}

function hideTypingIndicator() {
    const typing = document.getElementById('typing-indicator');
    if (typing) typing.remove();
}

// Закрытие по клику вне окна
window.addEventListener('click', function(e) {
    const chat = document.getElementById('deepseek-chat-window');
    const button = document.getElementById('deepseek-bro-button');
    if (deepSeekVisible && !chat.contains(e.target) && !button.contains(e.target)) {
        toggleDeepSeekChat();
    }
});