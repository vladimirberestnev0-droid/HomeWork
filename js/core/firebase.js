/**
 * firebase.js - Инициализация Firebase (ИСПРАВЛЕНО: добавлен retry для internal error)
 */

(function() {
    if (window._firebaseInitialized) {
        console.log('✅ Firebase уже инициализирован');
        return;
    }

    console.log('🚀 Запуск инициализации Firebase...');

    const CONFIG_TIMEOUT = 5000;
    const PERSISTENCE_RETRIES = 2;
    let persistenceEnabled = false;

    if (typeof CONFIG === 'undefined') {
        console.warn('⚠️ CONFIG не загружен, ожидаем...');
        
        waitForConfig().then(() => {
            console.log('✅ CONFIG загружен, продолжаем инициализацию');
            initFirebase();
        }).catch(() => {
            console.error('❌ CONFIG не загрузился за отведённое время');
            showFatalError('Ошибка загрузки конфигурации');
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
            const testKey = 'test_private_mode';
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

            window.db = firebase.firestore();
            window.auth = firebase.auth();
            window.storage = firebase.storage();

            window.db.settings({
                ignoreUndefinedProperties: true,
                merge: true,
                cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED
            });

            const privateMode = await isPrivateMode();
            
            if (privateMode) {
                console.log('🔒 Private mode detected, persistence disabled');
                persistenceEnabled = false;
            } else {
                try {
                    await window.db.enablePersistence({ 
                        synchronizeTabs: true
                    });
                    console.log('✅ Firestore persistence включен');
                    persistenceEnabled = true;
                } catch (err) {
                    handlePersistenceError(err);
                }
            }

            try {
                await window.auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
                console.log('✅ Auth persistence включен');
            } catch (err) {
                console.warn('⚠️ Ошибка настройки persistence auth:', err);
            }

            setupNetworkHandlers();

            window._firebaseInitialized = true;
            
            document.dispatchEvent(new CustomEvent('firebase-initialized', { 
                detail: { persistenceEnabled } 
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
            showFatalError('Ошибка подключения к серверу. Обновите страницу.');
        }
    }

    function handlePersistenceError(err) {
        if (err.code === 'failed-precondition') {
            console.warn('⚠️ Множественные вкладки открыты, persistence в ограниченном режиме');
            persistenceEnabled = false;
        } else if (err.code === 'unimplemented') {
            console.warn('⚠️ Браузер не поддерживает persistence (возможно private mode)');
            persistenceEnabled = false;
        } 
        // 🔥 НОВЫЙ БЛОК ОБРАБОТКИ 🔥
        else if (err.message && err.message.includes('INTERNAL ASSERTION FAILED')) {
            console.warn('⚠️ Внутренняя ошибка Firebase SDK, пробуем без synchronizeTabs...');
            try {
                // Пробуем ещё раз без синхронизации вкладок
                window.db.enablePersistence({ synchronizeTabs: false });
                console.log('✅ Persistence включен (без синхронизации вкладок)');
                persistenceEnabled = true;
            } catch (retryErr) {
                console.warn('⚠️ Не удалось включить persistence даже без синхронизации:', retryErr.message);
                persistenceEnabled = false;
            }
        }
        // 🔥 КОНЕЦ НОВОГО БЛОКА 🔥
        else {
            console.warn('⚠️ Ошибка включения persistence:', err.message);
            persistenceEnabled = false;
        }
    }

    function setupNetworkHandlers() {
        firebase.firestore().enableNetwork()
            .then(() => console.log('🌐 Firestore сеть включена'))
            .catch(err => console.warn('⚠️ Ошибка включения сети:', err));

        window.addEventListener('online', () => {
            console.log('🌐 Соединение восстановлено');
            firebase.firestore().enableNetwork()
                .then(() => {
                    if (window.Utils) {
                        Utils.showNotification('🟢 Соединение восстановлено', 'success');
                    }
                })
                .catch(err => console.error('Ошибка включения сети:', err));
        });

        window.addEventListener('offline', () => {
            console.log('🌐 Соединение потеряно');
            firebase.firestore().disableNetwork()
                .then(() => {
                    if (window.Utils) {
                        Utils.showNotification('🔴 Нет соединения', 'warning');
                    }
                })
                .catch(err => console.error('Ошибка отключения сети:', err));
        });
    }

    function showFatalError(message) {
        if (typeof Utils !== 'undefined' && Utils.showError) {
            Utils.showError(message);
        } else {
            const style = document.createElement('style');
            style.textContent = `
                .fatal-error {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    background: #DC3545;
                    color: white;
                    padding: 15px;
                    text-align: center;
                    z-index: 99999;
                    font-weight: 600;
                    animation: slideDown 0.3s ease;
                }
                @keyframes slideDown {
                    from { transform: translateY(-100%); }
                    to { transform: translateY(0); }
                }
                .fatal-error button {
                    background: white;
                    color: #DC3545;
                    border: none;
                    padding: 8px 20px;
                    border-radius: 30px;
                    margin-left: 15px;
                    cursor: pointer;
                    font-weight: 600;
                }
                .fatal-error button:hover {
                    transform: scale(1.05);
                }
            `;
            document.head.appendChild(style);
            
            const errorDiv = document.createElement('div');
            errorDiv.className = 'fatal-error';
            errorDiv.innerHTML = `
                <i class="fas fa-exclamation-triangle me-2"></i>
                ${message}
                <button onclick="location.reload()">
                    <i class="fas fa-sync-alt me-2"></i>Обновить
                </button>
            `;
            document.body.insertBefore(errorDiv, document.body.firstChild);
        }
    }

    window.FirebaseHelpers = {
        isOnline: () => navigator.onLine,
        enableNetwork: () => firebase.firestore().enableNetwork(),
        disableNetwork: () => firebase.firestore().disableNetwork(),
        waitForConfig,
        isPersistenceEnabled: () => persistenceEnabled,
        isPrivateMode
    };

})();