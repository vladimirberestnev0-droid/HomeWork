/**
 * firebase.js - Инициализация Firebase
 * Версия 2.2 с исправленным persistence (убрана лишняя опция)
 */

(function() {
    // Флаг инициализации для предотвращения повторной инициализации
    if (window._firebaseInitialized) {
        console.log('✅ Firebase уже инициализирован');
        return;
    }

    console.log('🚀 Запуск инициализации Firebase...');

    // Проверяем наличие CONFIG
    if (typeof CONFIG === 'undefined') {
        console.error('❌ CONFIG не загружен! Проверьте порядок скриптов');
        
        // Пытаемся загрузить CONFIG если его нет
        const loadConfig = () => {
            return new Promise((resolve) => {
                if (typeof CONFIG !== 'undefined') {
                    resolve();
                    return;
                }
                
                const checkInterval = setInterval(() => {
                    if (typeof CONFIG !== 'undefined') {
                        clearInterval(checkInterval);
                        resolve();
                    }
                }, 100);
                
                setTimeout(() => {
                    clearInterval(checkInterval);
                    console.error('❌ CONFIG не загрузился за 5 секунд');
                }, 5000);
            });
        };
        
        loadConfig().then(() => {
            console.log('✅ CONFIG загружен, продолжаем инициализацию');
            initFirebase();
        });
        
        return;
    }

    // Непосредственно инициализация
    initFirebase();

    function initFirebase() {
        try {
            // Проверяем наличие Firebase SDK
            if (typeof firebase === 'undefined') {
                throw new Error('Firebase SDK не загружен! Проверьте подключение скриптов');
            }

            console.log('🔥 Firebase SDK загружен, версия:', firebase.SDK_VERSION);

            // Инициализация Firebase приложения
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
                merge: true
            });

            // Включаем persistence с правильными опциями (только synchronizeTabs)
            window.db.enablePersistence({ 
                synchronizeTabs: true
            }).then(() => {
                console.log('✅ Firestore persistence включен');
            }).catch(err => {
                if (err.code === 'failed-precondition') {
                    console.warn('⚠️ Множественные вкладки открыты, persistence работает в ограниченном режиме');
                } else if (err.code === 'unimplemented') {
                    console.warn('⚠️ Браузер не поддерживает persistence');
                } else {
                    console.warn('⚠️ Ошибка включения persistence:', err.message);
                }
            });

            // Отмечаем инициализацию
            window._firebaseInitialized = true;
            
            // Событие для других скриптов
            document.dispatchEvent(new CustomEvent('firebase-initialized'));
            
            console.log('✅ Firebase инициализирован успешно');
            console.log('📊 Доступные сервисы:', {
                db: !!window.db,
                auth: !!window.auth,
                storage: !!window.storage
            });

        } catch (error) {
            console.error('❌ Критическая ошибка инициализации Firebase:', error);
            
            // Показываем ошибку пользователю если Utils уже загружен
            if (typeof Utils !== 'undefined' && Utils.showError) {
                Utils.showError('Ошибка подключения к серверу. Обновите страницу.');
            } else {
                // Создаем простой алерт если Utils еще не загружен
                setTimeout(() => {
                    alert('Ошибка подключения к серверу. Пожалуйста, обновите страницу.');
                }, 1000);
            }
        }
    }
})();