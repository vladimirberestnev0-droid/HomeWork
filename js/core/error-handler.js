// ===== js/core/error-handler.js =====
// Глобальный обработчик ошибок

(function() {
    // Перехват синхронных ошибок
    window.addEventListener('error', function(event) {
        console.error('❌ Глобальная ошибка:', {
            message: event.message,
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno,
            error: event.error
        });
        
        Helpers.showNotification('Произошла ошибка. Мы уже работаем над этим', 'error');
        return false;
    });

    // Перехват Promise rejections
    window.addEventListener('unhandledrejection', function(event) {
        console.error('❌ Необработанный Promise rejection:', event.reason);
        
        // Не показываем уведомление для известных ошибок
        const ignoreErrors = [
            'Необходимо авторизоваться',
            'Только мастера могут откликаться'
        ];
        
        if (!ignoreErrors.includes(event.reason?.message)) {
            Helpers.showNotification('Ошибка при выполнении запроса', 'error');
        }
    });

    // Мониторинг производительности
    if (window.performance) {
        // Замер времени загрузки
        window.addEventListener('load', () => {
            const timing = performance.timing;
            const loadTime = timing.loadEventEnd - timing.navigationStart;
            console.log(`⏱️ Время загрузки: ${loadTime}ms`);
            
            if (loadTime > 3000) {
                console.warn('⚠️ Медленная загрузка страницы');
            }
        });
    }

    // Проверка онлайн статуса
    window.addEventListener('online', () => {
        Helpers.showNotification('🟢 Соединение восстановлено', 'success');
    });

    window.addEventListener('offline', () => {
        Helpers.showNotification('🔴 Нет соединения. Работаем в офлайн режиме', 'warning');
    });

    console.log('✅ Error Handler загружен');
})();