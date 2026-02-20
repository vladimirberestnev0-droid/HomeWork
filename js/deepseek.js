// ===== deepseek.js — РАБОЧАЯ ВЕРСИЯ С PROXYAPI =====

// Состояние чата
let deepSeekVisible = false;
let failedAttempts = 0;
const MAX_FAILED_ATTEMPTS = 3;

// ===== ВАЖНО! СЮДА ВСТАВЬ НОВЫЙ КЛЮЧ =====
const CONFIG = {
    API_URL: 'https://openai.api.proxyapi.ru/v1/chat/completions',
    API_KEY: 'sk-or-v1-sk-dktm7dKCFrBGNaAkn6Z7Y0SA55lNYsqY',  // ← ВСТАВЬ НОВЫЙ КЛЮЧ!
    MODEL: 'openrouter/deepseek/deepseek-chat'
};

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
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 секунд

        const response = await fetch(CONFIG.API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${CONFIG.API_KEY}`
            },
            body: JSON.stringify({
                model: CONFIG.MODEL,
                messages: [
                    {
                        role: 'system',
                        content: 'Ты — бро-помощник на сайте ВоркХом. Ты общаешься неформально, с юмором, используешь слова типа "бро", "короче", "слушай". Ты помогаешь с поиском мастеров, советами по ремонту, ценами. Ты позитивный и энергичный!'
                    },
                    {
                        role: 'user',
                        content: message
                    }
                ],
                temperature: 0.9,
                max_tokens: 500
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`Ошибка HTTP: ${response.status}`);
        }

        const data = await response.json();
        
        // Проверяем структуру ответа
        let reply = '';
        if (data.choices && data.choices[0] && data.choices[0].message) {
            reply = data.choices[0].message.content;
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
            addMessage('Бро, таймаут... Сервер долго думает. Попробуй ещё раз! ⏱️', 'bro');
        } else if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
            addMessage('⛔ Бот не отвечает. Загляни позже!', 'bro');
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