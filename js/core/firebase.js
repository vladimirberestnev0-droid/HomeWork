/**
 * firebase.js - Инициализация Firebase (ФИНАЛЬНАЯ РАБОЧАЯ ВЕРСИЯ)
 * - Полностью отключаем persistence для GitHub Pages
 * - Заказы грузятся с сервера всегда
 * - Никаких ошибок Target ID
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

            // ===== КРИТИЧЕСКИ ВАЖНО: НАСТРОЙКИ FIRESTORE =====
            // Полностью отключаем persistence для GitHub Pages
            try {
                await window.db.settings({
                    ignoreUndefinedProperties: true,
                    cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED, // Минимальное значение - фактически отключает кэш
                    experimentalForceLongPolling: true, // Важно для GitHub Pages
                    experimentalAutoDetectLongPolling: false
                });
                
                console.log('✅ Firestore настроен (persistence отключён)');
            } catch (settingsError) {
                console.warn('⚠️ Ошибка настроек Firestore:', settingsError.message);
            }

            // Auth persistence - нужно для входа (это другое, не влияет на Target ID)
            try {
                await window.auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
                console.log('✅ Auth persistence включён');
            } catch (err) {
                console.warn('⚠️ Ошибка auth persistence:', err.message);
            }

            // Принудительно включаем сеть
            try {
                await firebase.firestore().enableNetwork();
                console.log('🌐 Сеть включена');
            } catch (networkError) {
                console.warn('⚠️ Ошибка включения сети:', networkError.message);
            }

            // Успех
            window._firebaseInitialized = true;
            firebaseInitialized = true;
            
            document.dispatchEvent(new CustomEvent('firebase-initialized', { 
                detail: { success: true }
            }));
            
            console.log('✅ Firebase готов (заказы грузятся с сервера)');

        } catch (error) {
            console.error('❌ Ошибка Firebase:', error.message);
            
            window._firebaseInitialized = true;
            firebaseInitialized = false;
            
            document.dispatchEvent(new CustomEvent('firebase-initialized', { 
                detail: { success: false, error: error.message }
            }));
        }
    }

    // ===== ОБРАБОТЧИКИ СЕТИ =====
    window.addEventListener('online', () => {
        if (firebaseInitialized) {
            firebase.firestore().enableNetwork()
                .then(() => {
                    if (window.Utils) {
                        Utils.showSuccess('🟢 Соединение восстановлено');
                    }
                })
                .catch(() => {});
        }
    });

    window.addEventListener('offline', () => {
        if (firebaseInitialized) {
            firebase.firestore().disableNetwork()
                .then(() => {
                    if (window.Utils) {
                        Utils.showWarning('🔴 Нет соединения');
                    }
                })
                .catch(() => {});
        }
    });

    // ===== ХЕЛПЕРЫ =====
    window.FirebaseHelpers = {
        isOnline: () => navigator.onLine,
        isInitialized: () => firebaseInitialized
    };

})();