// ============================================
// redirect-protection.js - ИСПРАВЛЕННАЯ ВЕРСИЯ
// ============================================
(function() {
    const REDIRECT_KEY = 'last_redirect';
    const MAX_REDIRECTS = 15;        // УВЕЛИЧЕНО до 15 (было 3)
    const TIME_WINDOW = 60000;        // УВЕЛИЧЕНО до 60 секунд (было 5)

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
            
            // Если время ещё не вышло
            if (now - data.timestamp < TIME_WINDOW) {
                data.count++;
                
                // Если превышен лимит - показываем предупреждение, но НЕ БЛОКИРУЕМ
                if (data.count > MAX_REDIRECTS) {
                    console.warn('⚠️ Обнаружено много редиректов, но продолжаем работу');
                    
                    // Просто сбрасываем счётчик и продолжаем
                    sessionStorage.setItem(REDIRECT_KEY, JSON.stringify({ 
                        count: 1, 
                        timestamp: now 
                    }));
                    
                    // Не показываем блокирующее сообщение
                    return;
                }
                
                // Сохраняем обновлённый счётчик
                sessionStorage.setItem(REDIRECT_KEY, JSON.stringify(data));
                
            } else {
                // Время вышло - начинаем отсчёт заново
                sessionStorage.setItem(REDIRECT_KEY, JSON.stringify({ 
                    count: 1, 
                    timestamp: now 
                }));
            }
            
        } catch (error) {
            // Ошибка парсинга - начинаем заново
            console.warn('⚠️ Ошибка чтения данных редиректа:', error);
            sessionStorage.setItem(REDIRECT_KEY, JSON.stringify({ 
                count: 1, 
                timestamp: now 
            }));
        }
        
    } else {
        // Первый редирект
        sessionStorage.setItem(REDIRECT_KEY, JSON.stringify({ 
            count: 1, 
            timestamp: now 
        }));
    }

    console.log('✅ Redirect protection initialized (либеральный режим)');
})();