// Проверяем, загружен ли Firebase
if (typeof firebase === 'undefined') {
    console.error('❌ Firebase SDK не загружен!');
} else {
    // Проверяем, не инициализирован ли уже Firebase
    if (!firebase.apps.length) {
        firebase.initializeApp(CONFIG.firebase);
    }

    // Глобальные ссылки
    if (typeof window.db === 'undefined') {
        window.db = firebase.firestore();
        window.auth = firebase.auth();
        window.storage = firebase.storage();

        // Настройки Firestore
        window.db.settings({
            ignoreUndefinedProperties: true
        });

        // Включаем persistence для offline режима
        window.db.enablePersistence({ synchronizeTabs: true })
            .catch(err => {
                if (err.code === 'failed-precondition') {
                    console.warn('⚠️ Множественные вкладки, persistence отключен');
                } else if (err.code === 'unimplemented') {
                    console.warn('⚠️ Браузер не поддерживает persistence');
                }
            });
        
        console.log('✅ Firebase инициализирован');
    }
}