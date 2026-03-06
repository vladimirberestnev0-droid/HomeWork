/**
 * firebase.js - Инициализация Firebase (ФИНАЛЬНАЯ ОПТИМИЗИРОВАННАЯ ВЕРСИЯ)
 * - Инициализируется только один раз за сессию
 * - Не сбрасывает кэш при переходах между страницами
 * - Адаптируется под окружение (телефон / GitHub Pages)
 */

(function() {
    // ===== ГЛОБАЛЬНЫЙ ФЛАГ (ЗАЩИТА ОТ ПОВТОРНОЙ ИНИЦИАЛИЗАЦИИ) =====
    if (window._firebaseInitialized) {
        console.log('✅ Firebase уже был инициализирован ранее');
        
        // Убеждаемся, что глобальные ссылки существуют (на случай, если скрипт загрузился раньше)
        if (!window.db && firebase && firebase.apps.length) {
            window.db = firebase.firestore();
            window.auth = firebase.auth();
            window.storage = firebase.storage();
        }
        
        // Всё равно диспатчим событие для тех, кто его ждёт
        document.dispatchEvent(new CustomEvent('firebase-initialized', { 
            detail: { success: true, cached: true }
        }));
        return;
    }

    console.log('🚀 Инициализация Firebase (первый запуск)...');

    const CONFIG_TIMEOUT = 5000;
    let firebaseReady = false;

    // ===== ОПРЕДЕЛЕНИЕ ОКРУЖЕНИЯ =====
    function getEnvironment() {
        const hostname = window.location.hostname;
        const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
        const isGitHubPages = hostname.includes('github.io');
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        return {
            isLocal,
            isGitHubPages,
            isMobile,
            // На телефоне и НЕ на GitHub Pages - включаем полный кэш
            useFullCache: isMobile && !isGitHubPages
        };
    }

    const env = getEnvironment();
    console.log('📱 Окружение:', env);

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

            // Инициализация приложения (только если ещё не инициализировано)
            if (!firebase.apps.length) {
                firebase.initializeApp(CONFIG.firebase);
                console.log('✅ Приложение инициализировано');
            } else {
                console.log('ℹ️ Приложение уже было инициализировано');
            }

            // Глобальные ссылки
            window.db = firebase.firestore();
            window.auth = firebase.auth();
            window.storage = firebase.storage();

            // ===== НАСТРОЙКИ FIRESTORE (ТОЛЬКО ОДИН РАЗ) =====
            try {
                // Проверяем, были ли уже применены настройки
                if (!window._firestoreSettingsApplied) {
                    const settings = {
                        ignoreUndefinedProperties: true,
                        experimentalForceLongPolling: env.isGitHubPages || env.isLocal,
                        experimentalAutoDetectLongPolling: false
                    };

                    // Выбираем размер кэша в зависимости от окружения
                    if (env.useFullCache) {
                        settings.cacheSizeBytes = firebase.firestore.CACHE_SIZE_UNLIMITED;
                        console.log('📱 Режим: телефон (полный кэш)');
                    } else {
                        settings.cacheSizeBytes = 1048576; // 1MB - минимум
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

            // Auth persistence - всегда LOCAL
            try {
                await window.auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
                console.log('✅ Auth persistence включён');
            } catch (err) {
                console.warn('⚠️ Ошибка auth persistence:', err.message);
            }

            // Включаем сеть
            try {
                await firebase.firestore().enableNetwork();
                console.log('🌐 Сеть включена');
            } catch (networkError) {
                console.warn('⚠️ Ошибка включения сети:', networkError.message);
            }

            // Успех
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

    // ===== ОБРАБОТЧИКИ СЕТИ =====
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

    // ===== ХЕЛПЕРЫ =====
    window.FirebaseHelpers = {
        isOnline: () => navigator.onLine,
        isInitialized: () => firebaseReady,
        getEnvironment: () => env
    };

})(); 