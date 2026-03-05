(function() {
    // Перехват синхронных ошибок
    window.addEventListener('error', function(event) {
        console.error('❌ Ошибка:', event.error || event.message);
        
        // Не показываем уведомления для некоторых ошибок
        if (event.message?.includes('ResizeObserver') || 
            event.message?.includes('NetworkError')) {
            return;
        }
        
        Utils.showError('Произошла ошибка. Мы уже работаем над этим.');
    });

    // Перехват Promise rejections
    window.addEventListener('unhandledrejection', function(event) {
        console.error('❌ Unhandled Rejection:', event.reason);
        
        if (event.reason?.code === 'permission-denied') {
            Utils.showError('Нет доступа');
        } else if (event.reason?.code?.startsWith('auth/')) {
            // Ошибки авторизации обрабатываются в auth.js
        } else {
            Utils.showError('Ошибка соединения');
        }
    });

    // Мониторинг онлайн статуса
    window.addEventListener('online', () => {
        Utils.showNotification('🟢 Соединение восстановлено', 'success');
    });

    window.addEventListener('offline', () => {
        Utils.showNotification('🔴 Нет соединения', 'warning');
    });

    console.log('✅ Error Handler loaded');
})();