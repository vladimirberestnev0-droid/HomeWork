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
                    
                    // Показываем сообщение
                    const message = document.createElement('div');
                    message.style.cssText = `
                        position: fixed;
                        top: 20px;
                        left: 50%;
                        transform: translateX(-50%);
                        background: #DC3545;
                        color: white;
                        padding: 15px 25px;
                        border-radius: 8px;
                        z-index: 10000;
                        text-align: center;
                    `;
                    message.innerHTML = `
                        <i class="fas fa-exclamation-triangle me-2"></i>
                        Слишком много перенаправлений. <br>
                        <button onclick="window.location.href='/HomeWork/'" 
                                style="margin-top:10px; background:white; color:#DC3545; border:none; padding:5px 15px; border-radius:5px;">
                            На главную
                        </button>
                    `;
                    document.body.appendChild(message);
                    
                    window.stop();
                    return;
                }
                sessionStorage.setItem(REDIRECT_KEY, JSON.stringify(data));
            } else {
                sessionStorage.setItem(REDIRECT_KEY, JSON.stringify({ count: 1, timestamp: now }));
            }
        } catch {
            sessionStorage.setItem(REDIRECT_KEY, JSON.stringify({ count: 1, timestamp: now }));
        }
    } else {
        sessionStorage.setItem(REDIRECT_KEY, JSON.stringify({ count: 1, timestamp: now }));
    }

    console.log('✅ Redirect protection initialized');
})();