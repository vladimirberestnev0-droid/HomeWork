/**
 * firebase.js - Инициализация Firebase (ФИНАЛЬНАЯ ВЕРСИЯ)
 * - Добавлен await в retry
 * - Улучшена обработка ошибок
 * - Graceful degradation
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

    if (typeof CONFIG === 'undefined') {
        console.warn('⚠️ CONFIG не загружен, ожидаем...');
        
        waitForConfig().then(() => {
            console.log('✅ CONFIG загружен, продолжаем инициализацию');
            initFirebase();
        }).catch(() => {
            console.error('❌ CONFIG не загрузился за отведённое время');
            // Не показываем фатальную ошибку, работаем без Firebase
            window._firebaseInitialized = true;
            document.dispatchEvent(new CustomEvent('firebase-initialized', { 
                detail: { success: false, error: 'config_timeout' }
            }));
        });
        
        return;
    }

    initFirebase();

    function waitForConfig() {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            
            const check = () => {
                if (typeof CONFIG !== 'undefined') {
                    resolve();
                    return;
                }
                
                if (Date.now() - startTime > CONFIG_TIMEOUT) {
                    reject(new Error('CONFIG timeout'));
                    return;
                }
                
                setTimeout(check, 100);
            };
            
            check();
        });
    }

    function isPrivateMode() {
        return new Promise((resolve) => {
            const testKey = 'test_private_mode_' + Date.now();
            try {
                localStorage.setItem(testKey, '1');
                localStorage.removeItem(testKey);
                resolve(false);
            } catch (e) {
                resolve(true);
            }
        });
    }

    async function initFirebase() {
        try {
            if (typeof firebase === 'undefined') {
                throw new Error('Firebase SDK не загружен! Проверьте подключение скриптов');
            }

            console.log('🔥 Firebase SDK загружен, версия:', firebase.SDK_VERSION);

            // Инициализация приложения
            if (!firebase.apps.length) {
                console.log('📦 Инициализация Firebase с конфигом:', {
                    projectId: CONFIG.firebase.projectId,
                    authDomain: CONFIG.firebase.authDomain
                });
                
                firebase.initializeApp(CONFIG.firebase);
                console.log('✅ Firebase приложение инициализировано');
            } else {
                console.log('✅ Firebase приложение уже существует');
            }

            // Глобальные ссылки
            window.db = firebase.firestore();
            window.auth = firebase.auth();
            window.storage = firebase.storage();

            // Настройки Firestore
            window.db.settings({
                ignoreUndefinedProperties: true,
                merge: true,
                cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED
            });

            // Проверка private mode
            const privateMode = await isPrivateMode();
            
            if (privateMode) {
                console.log('🔒 Private mode detected, persistence disabled');
                persistenceEnabled = false;
            } else {
                // Пытаемся включить persistence
                await enablePersistenceWithRetry();
            }

            // Настройки Auth
            try {
                await window.auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
                console.log('✅ Auth persistence включен');
            } catch (err) {
                console.warn('⚠️ Ошибка настройки persistence auth:', err.message);
            }

            // Обработчики сети
            setupNetworkHandlers();

            // Отмечаем успешную инициализацию
            window._firebaseInitialized = true;
            firebaseInitialized = true;
            
            // Событие для других скриптов
            document.dispatchEvent(new CustomEvent('firebase-initialized', { 
                detail: { 
                    success: true,
                    persistenceEnabled,
                    db: !!window.db,
                    auth: !!window.auth,
                    storage: !!window.storage
                }
            }));
            
            console.log('✅ Firebase инициализирован успешно');
            console.log('📊 Доступные сервисы:', {
                db: !!window.db,
                auth: !!window.auth,
                storage: !!window.storage,
                persistence: persistenceEnabled
            });

        } catch (error) {
            console.error('❌ Критическая ошибка инициализации Firebase:', error);
            
            window._firebaseInitialized = true;
            firebaseInitialized = false;
            
            document.dispatchEvent(new CustomEvent('firebase-initialized', { 
                detail: { 
                    success: false, 
                    error: error.message,
                    code: error.code
                }
            }));
            
            // Не показываем фатальную ошибку, работаем в ограниченном режиме
        }
    }

    async function enablePersistenceWithRetry() {
        // Первая попытка - с synchronizeTabs
        try {
            await window.db.enablePersistence({ synchronizeTabs: true });
            console.log('✅ Firestore persistence включен (с синхронизацией)');
            persistenceEnabled = true;
            return;
        } catch (err) {
            console.warn('⚠️ Первая попытка persistence не удалась:', err.code || err.message);
            
            // Обрабатываем разные типы ошибок
            if (err.code === 'failed-precondition') {
                console.log('ℹ️ Множественные вкладки открыты - persistence работает ограниченно');
                persistenceEnabled = false;
                return;
            }
            
            if (err.code === 'unimplemented') {
                console.log('ℹ️ Браузер не поддерживает persistence');
                persistenceEnabled = false;
                return;
            }
            
            // Внутренняя ошибка Firebase SDK - пробуем без synchronizeTabs
            if (err.message && err.message.includes('INTERNAL ASSERTION FAILED')) {
                console.warn('⚠️ Внутренняя ошибка Firebase SDK, пробуем без synchronizeTabs...');
                
                try {
                    // ✅ ВАЖНО: добавляем await!
                    await window.db.enablePersistence({ synchronizeTabs: false });
                    console.log('✅ Persistence включен (без синхронизации вкладок)');
                    persistenceEnabled = true;
                    return;
                } catch (retryErr) {
                    console.warn('⚠️ Не удалось включить persistence даже без синхронизации:', retryErr.message);
                    persistenceEnabled = false;
                }
            } else {
                // Другая ошибка
                console.warn('⚠️ Ошибка включения persistence:', err.message);
                persistenceEnabled = false;
            }
        }
    }

    function setupNetworkHandlers() {
        // Включаем сеть
        firebase.firestore().enableNetwork()
            .then(() => console.log('🌐 Firestore сеть включена'))
            .catch(err => console.warn('⚠️ Ошибка включения сети:', err));

        // Обработчики онлайн/офлайн
        window.addEventListener('online', () => {
            console.log('🌐 Соединение восстановлено');
            if (window.db && firebaseInitialized) {
                firebase.firestore().enableNetwork()
                    .then(() => {
                        if (window.Utils) {
                            Utils.showNotification('🟢 Соединение восстановлено', 'success');
                        }
                    })
                    .catch(err => console.error('Ошибка включения сети:', err));
            }
        });

        window.addEventListener('offline', () => {
            console.log('🌐 Соединение потеряно');
            if (window.db && firebaseInitialized) {
                firebase.firestore().disableNetwork()
                    .then(() => {
                        if (window.Utils) {
                            Utils.showNotification('🔴 Нет соединения', 'warning');
                        }
                    })
                    .catch(err => console.error('Ошибка отключения сети:', err));
            }
        });
    }

    // Экспорт хелперов
    window.FirebaseHelpers = {
        isOnline: () => navigator.onLine,
        enableNetwork: () => firebaseInitialized ? firebase.firestore().enableNetwork() : Promise.reject('Firebase not initialized'),
        disableNetwork: () => firebaseInitialized ? firebase.firestore().disableNetwork() : Promise.reject('Firebase not initialized'),
        waitForConfig,
        isPersistenceEnabled: () => persistenceEnabled,
        isPrivateMode,
        isInitialized: () => firebaseInitialized
    };

})();