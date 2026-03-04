// Ждём, пока CONFIG загрузится
(function() {
    // Если CONFIG ещё нет, ждём
    if (typeof CONFIG === 'undefined') {
        console.error('❌ CONFIG не загружен! Проверь порядок скриптов');
        return;
    }

    if (typeof firebase === 'undefined') {
        console.error('❌ Firebase SDK не загружен!');
        return;
    }

    try {
        if (!firebase.apps.length) {
            firebase.initializeApp(CONFIG.firebase);
        }

        // Глобальные ссылки
        window.db = firebase.firestore();
        window.auth = firebase.auth();
        window.storage = firebase.storage();

        // Настройки Firestore
        window.db.settings({
            ignoreUndefinedProperties: true
        });

        // Persistence (опционально)
        window.db.enablePersistence({ synchronizeTabs: true })
            .catch(err => {
                if (err.code === 'failed-precondition') {
                    console.warn('⚠️ Множественные вкладки, persistence отключен');
                }
            });

        console.log('✅ Firebase инициализирован');
    } catch (error) {
        console.error('❌ Ошибка инициализации Firebase:', error);
    }
})();