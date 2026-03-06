/**
 * firebase.js - Инициализация Firebase (ЭЛЕГАНТНАЯ ВЕРСИЯ)
 * - Минимум попыток, максимум эффективности
 * - Чистая обработка ошибок
 * - Без лишних костылей
 */

(function() {
    if (window._firebaseInitialized) {
        console.log('✅ Firebase уже инициализирован');
        return;
    }

    console.log('🚀 Запуск инициализации Firebase...');

    const CONFIG_TIMEOUT = 5000;
    let persistenceEnabled = false;
    let firebaseInitialized = false;

    // ===== ЕДИНСТВЕННАЯ ТОЧКА ВХОДА =====
    if (typeof CONFIG === 'undefined') {
        waitForConfig().then(initFirebase).catch(handleConfigError);
        return;
    }

    initFirebase();

    // ===== ПРОСТЫЕ ВСПОМОГАТЕЛЬНЫЕ =====
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

    function isPrivateMode() {
        return new Promise((resolve) => {
            try {
                localStorage.setItem('test', '1');
                localStorage.removeItem('test');
                resolve(false);
            } catch {
                resolve(true);
            }
        });
    }

    // ===== ЭЛЕГАНТНАЯ ИНИЦИАЛИЗАЦИЯ =====
    async function initFirebase() {
        try {
            // Проверка SDK
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

            // Настройки Firestore
            window.db.settings({
                ignoreUndefinedProperties: true,
                cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED
            });

            // Persistence - ОДНА попытка, без ретраев
            if (!await isPrivateMode()) {
                await enablePersistence();
            }

            // Auth persistence
            try {
                await window.auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
                console.log('✅ Auth persistence');
            } catch (err) {
                console.warn('⚠️ Auth persistence error:', err.message);
            }

            // Сеть
            setupNetworkHandlers();

            // Успех
            window._firebaseInitialized = true;
            firebaseInitialized = true;
            
            document.dispatchEvent(new CustomEvent('firebase-initialized', { 
                detail: { success: true, persistenceEnabled }
            }));
            
            console.log('✅ Firebase готов', { persistence: persistenceEnabled });

        } catch (error) {
            console.error('❌ Ошибка Firebase:', error.message);
            
            window._firebaseInitialized = true;
            firebaseInitialized = false;
            
            document.dispatchEvent(new CustomEvent('firebase-initialized', { 
                detail: { success: false, error: error.message }
            }));
        }
    }

    // ===== PERSISTENCE - МАКСИМАЛЬНО ПРОСТО =====
    async function enablePersistence() {
        try {
            // Только один вариант - без synchronizeTabs
            await window.db.enablePersistence({ synchronizeTabs: false });
            console.log('✅ Firestore persistence включен');
            persistenceEnabled = true;
        } catch (err) {
            // Просто логируем и продолжаем работу
            const reasons = {
                'failed-precondition': 'множественные вкладки',
                'unimplemented': 'браузер не поддерживает'
            };
            console.log(`ℹ️ Persistence не включен: ${reasons[err.code] || err.message}`);
            persistenceEnabled = false;
        }
    }

    // ===== СЕТЬ - ПРОСТЫЕ ОБРАБОТЧИКИ =====
    function setupNetworkHandlers() {
        // Включаем сеть
        firebase.firestore().enableNetwork()
            .then(() => console.log('🌐 Сеть включена'))
            .catch(() => {});

        // Обработчики онлайн/офлайн
        window.addEventListener('online', () => {
            if (!firebaseInitialized) return;
            firebase.firestore().enableNetwork()
                .then(() => Utils?.showSuccess?.('🟢 Соединение восстановлено'))
                .catch(() => {});
        });

        window.addEventListener('offline', () => {
            if (!firebaseInitialized) return;
            firebase.firestore().disableNetwork()
                .then(() => Utils?.showWarning?.('🔴 Нет соединения'))
                .catch(() => {});
        });
    }

    // ===== ХЕЛПЕРЫ =====
    window.FirebaseHelpers = {
        isOnline: () => navigator.onLine,
        enableNetwork: () => firebaseInitialized ? firebase.firestore().enableNetwork() : Promise.reject(),
        disableNetwork: () => firebaseInitialized ? firebase.firestore().disableNetwork() : Promise.reject(),
        isPersistenceEnabled: () => persistenceEnabled,
        isInitialized: () => firebaseInitialized
    };

})();