/**
 * firebase.js - Инициализация Firebase (УНИВЕРСАЛЬНАЯ ВЕРСИЯ)
 * - Автоматически определяет окружение (GitHub Pages / телефон / localhost)
 * - На телефоне - полный кэш (CACHE_SIZE_UNLIMITED) для офлайн-режима
 * - На GitHub Pages - минимальный кэш (1MB) для избежания ошибок Target ID
 * - На localhost - тоже минимальный кэш для разработки
 */

(function() {
    if (window._firebaseInitialized) {
        console.log('✅ Firebase уже инициализирован');
        return;
    }

    console.log('🚀 Запуск инициализации Firebase...');

    const CONFIG_TIMEOUT = 5000;
    let firebaseInitialized = false;

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

            // Инициализация приложения
            if (!firebase.apps.length) {
                firebase.initializeApp(CONFIG.firebase);
                console.log('✅ Приложение инициализировано');
            }

            // Глобальные ссылки
            window.db = firebase.firestore();
            window.auth = firebase.auth();
            window.storage = firebase.storage();

            // ===== НАСТРОЙКИ FIRESTORE В ЗАВИСИМОСТИ ОТ ОКРУЖЕНИЯ =====
            try {
                const settings = {
                    ignoreUndefinedProperties: true,
                    experimentalForceLongPolling: env.isGitHubPages || env.isLocal, // Важно для GitHub Pages
                    experimentalAutoDetectLongPolling: false
                };

                // Выбираем размер кэша в зависимости от окружения
                if (env.useFullCache) {
                    // Телефон: полный кэш для офлайн-режима
                    settings.cacheSizeBytes = firebase.firestore.CACHE_SIZE_UNLIMITED;
                    console.log('📱 Режим: телефон (полный кэш)');
                } else {
                    // GitHub Pages или localhost: минимальный кэш
                    settings.cacheSizeBytes = 1048576; // 1MB - минимум
                    console.log('💻 Режим: GitHub Pages/localhost (минимальный кэш)');
                }

                await window.db.settings(settings);
                
                console.log(`✅ Firestore настроен (кэш: ${settings.cacheSizeBytes === firebase.firestore.CACHE_SIZE_UNLIMITED ? 'безлимитный' : '1MB'})`);
                
            } catch (settingsError) {
                console.warn('⚠️ Ошибка настроек Firestore:', settingsError.message);
            }

            // Auth persistence - всегда LOCAL для входа
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
            firebaseInitialized = true;
            
            document.dispatchEvent(new CustomEvent('firebase-initialized', { 
                detail: { success: true, env: env }
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
        isInitialized: () => firebaseInitialized,
        getEnvironment: () => env
    };

})();