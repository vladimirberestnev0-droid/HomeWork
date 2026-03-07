/**
 * firebase.js - Инициализация Firebase (СТАБИЛЬНАЯ ВЕРСИЯ ДЛЯ GITHUB PAGES)
 * - Инициализируется только один раз за сессию
 * - Не дёргает enableNetwork/disableNetwork, чтобы избежать внутренних ошибок
 */

(function() {
    if (window._firebaseInitialized) {
        console.log('✅ Firebase уже был инициализирован ранее');
        if (!window.db && firebase && firebase.apps.length) {
            window.db = firebase.firestore();
            window.auth = firebase.auth();
            window.storage = firebase.storage();
        }
        document.dispatchEvent(new CustomEvent('firebase-initialized', { 
            detail: { success: true, cached: true }
        }));
        return;
    }

    console.log('🚀 Инициализация Firebase (первый запуск)...');

    const CONFIG_TIMEOUT = 5000;
    let firebaseReady = false;

    function getEnvironment() {
        const hostname = window.location.hostname;
        const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
        const isGitHubPages = hostname.includes('github.io');
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        return {
            isLocal,
            isGitHubPages,
            isMobile,
            useFullCache: isMobile && !isGitHubPages
        };
    }

    const env = getEnvironment();
    console.log('📱 Окружение:', env);

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

    async function initFirebase() {
        try {
            if (typeof firebase === 'undefined') {
                throw new Error('Firebase SDK не загружен');
            }

            console.log('🔥 Firebase SDK', firebase.SDK_VERSION);

            if (!firebase.apps.length) {
                firebase.initializeApp(CONFIG.firebase);
                console.log('✅ Приложение инициализировано');
            } else {
                console.log('ℹ️ Приложение уже было инициализировано');
            }

            window.db = firebase.firestore();
            window.auth = firebase.auth();
            window.storage = firebase.storage();

            // Настройки Firestore (только один раз)
            try {
                if (!window._firestoreSettingsApplied) {
                    const settings = {
                        ignoreUndefinedProperties: true,
                        experimentalForceLongPolling: env.isGitHubPages || env.isLocal,
                        experimentalAutoDetectLongPolling: false
                    };

                    if (env.useFullCache) {
                        settings.cacheSizeBytes = firebase.firestore.CACHE_SIZE_UNLIMITED;
                        console.log('📱 Режим: телефон (полный кэш)');
                    } else {
                        settings.cacheSizeBytes = 1048576; // 1MB
                        console.log('💻 Режим: GitHub Pages/localhost (минимальный кэш)');
                    }

                    await window.db.settings(settings);
                    window._firestoreSettingsApplied = true;
                    console.log(`✅ Firestore настроен (кэш: ${settings.cacheSizeBytes === firebase.firestore.CACHE_SIZE_UNLIMITED ? 'безлимитный' : '1MB'})`);
                } else {
                    console.log('ℹ️ Настройки Firestore уже были применены ранее');
                }
            } catch (settingsError) {
                console.warn('⚠️ Ошибка настроек Firestore:', settingsError.message);
            }

            // Auth persistence
            try {
                await window.auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
                console.log('✅ Auth persistence включён');
            } catch (err) {
                console.warn('⚠️ Ошибка auth persistence:', err.message);
            }

            // НЕ включаем сеть принудительно — это вызывает внутренние ошибки Firebase на GitHub Pages
            // Сеть уже должна быть активна по умолчанию.

            window._firebaseInitialized = true;
            firebaseReady = true;

            document.dispatchEvent(new CustomEvent('firebase-initialized', { 
                detail: { success: true, env: env }
            }));

            console.log('✅ Firebase полностью готов');

        } catch (error) {
            console.error('❌ Критическая ошибка Firebase:', error.message);
            window._firebaseInitialized = true;
            firebaseReady = false;
            document.dispatchEvent(new CustomEvent('firebase-initialized', { 
                detail: { success: false, error: error.message }
            }));
        }
    }

    // Обработчики сети (оставляем, они не вредят)
    window.addEventListener('online', () => {
        if (firebaseReady && firebase.firestore) {
            firebase.firestore().enableNetwork()
                .then(() => Utils?.showSuccess?.('🟢 Соединение восстановлено'))
                .catch(() => {});
        }
    });

    window.addEventListener('offline', () => {
        if (firebaseReady && firebase.firestore) {
            firebase.firestore().disableNetwork()
                .then(() => Utils?.showWarning?.('🔴 Нет соединения'))
                .catch(() => {});
        }
    });

    window.FirebaseHelpers = {
        isOnline: () => navigator.onLine,
        isInitialized: () => firebaseReady,
        getEnvironment: () => env
    };

})();