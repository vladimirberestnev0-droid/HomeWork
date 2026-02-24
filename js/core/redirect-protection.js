// ===== js/core/redirect-protection.js =====
// Единая защита от бесконечных редиректов - ОДИН РАЗ ДЛЯ ВСЕХ СТРАНИЦ

(function() {
    const REDIRECT_KEY = 'last_redirect';
    const MAX_REDIRECTS = 3;
    const TIME_WINDOW = 5000; // 5 секунд

    // Проверяем, не было ли уже инициализации
    if (window._redirectProtectionInitialized) {
        return;
    }
    window._redirectProtectionInitialized = true;

    const now = Date.now();
    const lastRedirect = sessionStorage.getItem(REDIRECT_KEY);

    if (lastRedirect) {
        try {
            const data = JSON.parse(lastRedirect);
            if (now - data.timestamp < TIME_WINDOW) {
                data.count++;
                if (data.count > MAX_REDIRECTS) {
                    console.error('⚠️ Обнаружен бесконечный редирект!');
                    
                    // Показываем красивое сообщение
                    showRedirectError();
                    
                    // Останавливаем выполнение
                    window.stop();
                    return;
                }
                sessionStorage.setItem(REDIRECT_KEY, JSON.stringify(data));
            } else {
                sessionStorage.setItem(REDIRECT_KEY, JSON.stringify({ count: 1, timestamp: now }));
            }
        } catch (e) {
            // Если данные повреждены, начинаем заново
            sessionStorage.setItem(REDIRECT_KEY, JSON.stringify({ count: 1, timestamp: now }));
        }
    } else {
        sessionStorage.setItem(REDIRECT_KEY, JSON.stringify({ count: 1, timestamp: now }));
    }

    function showRedirectError() {
        // Проверяем, не показывали ли уже
        if (document.getElementById('redirect-error-message')) return;
        
        const message = document.createElement('div');
        message.id = 'redirect-error-message';
        message.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: #DC3545;
            color: white;
            padding: 20px 30px;
            border-radius: 15px;
            box-shadow: 0 10px 30px rgba(220,53,69,0.3);
            z-index: 10000;
            text-align: center;
            max-width: 400px;
            animation: slideDown 0.3s ease;
        `;
        message.innerHTML = `
            <i class="fas fa-exclamation-triangle fa-2x mb-3"></i>
            <h5 class="mb-2">Слишком много перенаправлений!</h5>
            <p class="mb-3">Проверьте подключение к интернету или обратитесь в поддержку</p>
            <button onclick="window.location.href='/HomeWork/'" 
                    style="background: white; color: #DC3545; border: none; padding: 8px 20px; border-radius: 30px; font-weight: 600; cursor: pointer;">
                На главную
            </button>
        `;
        document.body.appendChild(message);
    }

    console.log('✅ Redirect protection initialized');
})();