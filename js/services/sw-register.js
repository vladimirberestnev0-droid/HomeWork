// ===== sw-register.js =====
// Регистрация Service Worker для PWA и уведомлений

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/HomeWork/firebase-messaging-sw.js')
            .then(registration => {
                console.log('✅ Service Worker зарегистрирован:', registration.scope);
                
                // Проверка обновлений
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    console.log('🔄 Обновление Service Worker...');
                    
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            // Новая версия доступна
                            if (confirm('Доступна новая версия приложения. Обновить?')) {
                                newWorker.postMessage({ action: 'skipWaiting' });
                            }
                        }
                    });
                });
            })
            .catch(error => {
                console.error('❌ Ошибка регистрации Service Worker:', error);
            });

        // Обработка сообщений от service worker
        navigator.serviceWorker.addEventListener('message', event => {
            if (event.data && event.data.type === 'version_updated') {
                window.location.reload();
            }
        });
    });
}