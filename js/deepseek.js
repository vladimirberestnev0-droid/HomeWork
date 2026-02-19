// Состояние чата
let deepSeekVisible = false;

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

    try {
        const API_URL = 'https://home-work.vercel.app/api/deepseek';
        
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages: [{ role: 'user', content: message }]
            })
        });

        if (!response.ok) {
            throw new Error('Ошибка сети');
        }

        const data = await response.json();
        const reply = data.choices[0].message.content;

        hideTypingIndicator();
        addMessage(reply, 'bro');

    } catch (error) {
        console.error('DeepSeek error:', error);
        hideTypingIndicator();
        addMessage('Ой, бро, что-то сломалось... Давай позже? 😅', 'bro');
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