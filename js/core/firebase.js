/**
 * firebase.js - Инициализация Firebase (СТАБИЛЬНАЯ ВЕРСИЯ)
 * - persistence отключён для GitHub Pages
 * - без внутренних ошибок Firebase
 */

(function() {
    if (window._firebaseInitialized) {
        console.log('✅ Firebase уже инициализирован');
        return;
    }

    console.log('🚀 Запуск инициализации Firebase...');

    const CONFIG_TIMEOUT = 5000;
    let firebaseInitialized = false;

    // ===== ОЖИДАНИЕ CONFIG =====
    if (typeof CONFIG === 'undefined') {
        waitForConfig().then(initFirebase).catch(handleConfigError);
        return;
    }

    initFirebase();

    function waitForConfig() {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            
            const check = () => {
                if (typeof CONFIG !== 'undefined') return resolve();
                if (Date.now() - startTime > CONFIG_TIMEOUT) return reject();
                setTimeout(check, 100);
            };
            
            check();
        });
    }

    function handleConfigError() {
        console.error('❌ CONFIG не загрузился');
        window._firebaseInitialized = true;
        document.dispatchEvent(new CustomEvent('firebase-initialized', { 
            detail: { success: false, error: 'config_timeout' }
        }));
    }

    // ===== ОСНОВНАЯ ИНИЦИАЛИЗАЦИЯ =====
    async function initFirebase() {
        try {
            if (typeof firebase === 'undefined') {
                throw new Error('Firebase SDK не загружен');
            }

            console.log('🔥 Firebase SDK', firebase.SDK_VERSION);

            // Инициализация приложения
            if (!firebase.apps.length) {
                firebase.initializeApp(CONFIG.firebase);
                console.log('✅ Приложение инициализировано');
            }

            // Глобальные ссылки
            window.db = firebase.firestore();
            window.auth = firebase.auth();
            window.storage = firebase.storage();

            // Настройки Firestore - БЕЗ persistence
            window.db.settings({
                ignoreUndefinedProperties: true,
                // cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED // НЕ ИСПОЛЬЗУЕМ
            });

            console.log('ℹ️ Persistence отключён (режим GitHub Pages)');

            // Auth persistence - нужно для входа
            try {
                await window.auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
                console.log('✅ Auth persistence включён');
            } catch (err) {
                console.warn('⚠️ Ошибка auth persistence:', err.message);
            }

            // Включаем сеть
            await firebase.firestore().enableNetwork();
            console.log('🌐 Сеть включена');

            // Успех
            window._firebaseInitialized = true;
            firebaseInitialized = true;
            
            document.dispatchEvent(new CustomEvent('firebase-initialized', { 
                detail: { success: true }
            }));
            
            console.log('✅ Firebase готов');

        } catch (error) {
            console.error('❌ Ошибка Firebase:', error.message);
            
            window._firebaseInitialized = true;
            firebaseInitialized = false;
            
            document.dispatchEvent(new CustomEvent('firebase-initialized', { 
                detail: { success: false, error: error.message }
            }));
        }
    }

    // Простые обработчики онлайн/офлайн
    window.addEventListener('online', () => {
        if (firebaseInitialized) {
            firebase.firestore().enableNetwork()
                .then(() => Utils?.showSuccess?.('🟢 Соединение восстановлено'))
                .catch(() => {});
        }
    });

    window.addEventListener('offline', () => {
        if (firebaseInitialized) {
            firebase.firestore().disableNetwork()
                .then(() => Utils?.showWarning?.('🔴 Нет соединения'))
                .catch(() => {});
        }
    });

    window.FirebaseHelpers = {
        isOnline: () => navigator.onLine,
        isInitialized: () => firebaseInitialized
    };

})();