// ============================================
// ГЛАВНЫЙ ФАЙЛ ПРИЛОЖЕНИЯ - ЭЛЕГАНТНАЯ ВЕРСИЯ
// ============================================
const App = (function() {
    if (window.__APP_INITIALIZED__) return window.App;

    let initialized = false;

    async function init() {
        if (initialized) return;

        console.log('🚀 Запуск приложения...');
        document.body.classList.add('app-loading');

        try {
            await initCore();
            initServices();
            initComponents();
            
            // Ждём авторизацию (НОВОЕ)
            await waitForAuth();
            
            await initPage();
            initGlobalHandlers();

            initialized = true;
            console.log('✅ Приложение готово');
            document.body.classList.remove('app-loading');
            
            if (window.Loader) {
                setTimeout(() => Loader.forceHide(), 100);
            }

        } catch (error) {
            console.error('❌ Ошибка инициализации:', error);
            showFatalError('Не удалось загрузить приложение. Обновите страницу.');
        }
    }

    async function initCore() {
        console.log('📦 Инициализация ядра...');
        if (!window.CONFIG) throw new Error('CONFIG не загружен');
        
        await waitForFirebase();
        if (window.DataService) await window.DataService.ready();
        
        // ИСПРАВЛЕНО: Правильное ожидание стора без ошибки
        if (window.AppStore) {
            await waitForStore();
        }

        if (window.Loader) console.log('📦 Loader готов');
    }

    function waitForFirebase() {
        return new Promise(resolve => {
            if (window.db && window.auth) {
                resolve();
                return;
            }

            const onFirebaseReady = () => {
                resolve();
                document.removeEventListener('firebase-initialized', onFirebaseReady);
            };

            document.addEventListener('firebase-initialized', onFirebaseReady);
            setTimeout(() => {
                document.removeEventListener('firebase-initialized', onFirebaseReady);
                console.warn('⚠️ Таймаут Firebase');
                resolve();
            }, 5000);
        });
    }

    // НОВОЕ: Отдельная функция ожидания стора
    function waitForStore(timeout = 3000) {
        return new Promise(resolve => {
            // Если уже инициализирован
            if (AppStore.getState().isInitialized) {
                console.log('✅ Стор уже инициализирован');
                resolve();
                return;
            }

            console.log('⏳ Ожидание инициализации стора...');
            
            // СОЗДАЁМ unsubscribe ДО ПОДПИСКИ
            let unsubscribe = null;
            
            // Подписываемся
            unsubscribe = AppStore.subscribe('core-init', ['isInitialized'], function handler(state) {
                if (state.isInitialized) {
                    console.log('✅ Стор инициализирован');
                    if (unsubscribe) {
                        unsubscribe(); // Отписываемся
                    }
                    resolve();
                }
            });

            // Таймаут
            setTimeout(() => {
                if (unsubscribe) {
                    unsubscribe(); // Отписываемся по таймауту
                }
                console.warn('⚠️ Таймаут ожидания стора');
                resolve();
            }, timeout);
        });
    }

    // НОВОЕ: Ожидание авторизации
    function waitForAuth(timeout = 3000) {
        return new Promise(resolve => {
            // Если уже есть пользователь
            if (window.Auth && Auth.getUser()) {
                console.log('✅ Пользователь уже есть');
                resolve();
                return;
            }

            console.log('⏳ Ожидание авторизации...');
            
            // СОЗДАЁМ unsubscribe ДО ПОДПИСКИ
            let unsubscribe = null;
            
            // Подписываемся
            if (window.Auth) {
                unsubscribe = Auth.onAuthChange((state) => {
                    if (state.isAuthenticated || state.user !== null) {
                        console.log('✅ Пользователь авторизовался');
                        if (unsubscribe) {
                            unsubscribe(); // Отписываемся
                        }
                        resolve();
                    }
                });
            }

            // Таймаут
            setTimeout(() => {
                if (unsubscribe) {
                    unsubscribe(); // Отписываемся по таймауту
                }
                console.log('⏳ Таймаут ожидания авторизации');
                resolve();
            }, timeout);
        });
    }

    async function initPage() {
        console.log('📄 Инициализация страницы...');

        const path = window.location.pathname;
        const page = getCurrentPage(path);
        
        // Публичные страницы
        if (!page.requiresAuth) {
            console.log('🌍 Публичная страница');
            return;
        }

        // Получаем состояние
        const state = getAuthState();
        
        console.log('👤 Состояние:', {
            path,
            page: page.name,
            isAuthenticated: state.isAuthenticated,
            role: state.role,
            user: state.user?.email
        });

        // Проверка авторизации
        if (!state.isAuthenticated) {
            console.log('🚫 Требуется авторизация, редирект');
            saveRedirect();
            window.location.href = '/HomeWork/';
            return;
        }

        // Ждём данные пользователя
        if (window.Auth && typeof Auth.waitForData === 'function') {
            try {
                await Auth.waitForData(3000);
            } catch (error) {
                console.warn('⚠️ Ошибка загрузки данных:', error);
            }
        }

        // Проверка роли
        const updatedState = getAuthState();
        if (page.allowedRoles && !page.allowedRoles.includes(updatedState.role)) {
            console.log('🚫 Роль не разрешена:', updatedState.role);
            showAccessDenied();
            return;
        }

        console.log('✅ Доступ разрешён для роли:', updatedState.role);
        
        // Загружаем данные страницы
        if (window.loadPageData) {
            await window.loadPageData();
        }
    }

    function getAuthState() {
        return window.AppStore 
            ? AppStore.getState() 
            : (window.Auth ? Auth.getAuthState() : { isAuthenticated: false });
    }

    function getCurrentPage(path) {
        if (path.includes('client.html')) {
            return { name: 'client', requiresAuth: true, allowedRoles: ['client'] };
        } else if (path.includes('masters.html')) {
            return { name: 'master', requiresAuth: true, allowedRoles: ['master'] };
        } else if (path.includes('chat.html')) {
            return { name: 'chat', requiresAuth: true, allowedRoles: ['client', 'master'] };
        } else if (path.includes('admin.html')) {
            return { name: 'admin', requiresAuth: true, allowedRoles: ['admin'] };
        }
        return { name: 'home', requiresAuth: false };
    }

    function saveRedirect() {
        try {
            sessionStorage.setItem('redirectAfterLogin', window.location.href);
        } catch (e) {
            console.warn('⚠️ Не удалось сохранить redirect');
        }
    }

    function initServices() {
        console.log('🔧 Сервисы готовы');
    }

    function initComponents() {
        console.log('🎨 Компоненты:');
        window.ModalManager?.init();
        window.BottomNav?.init();
        window.DesktopNav?.init();
        window.Notifications?.init();
        window.AuthUI?.init();
    }

    function initGlobalHandlers() {
        // Перехват ссылок
        document.addEventListener('click', (e) => {
            const link = e.target.closest('a[href]');
            if (!link) return;

            const href = link.getAttribute('href');
            if (href?.startsWith('http') || href?.startsWith('#') || 
                href?.startsWith('javascript:') || link.hasAttribute('data-no-loader')) {
                return;
            }

            e.preventDefault();
            window.Loader ? Loader.navigateTo(href) : window.location.href = href;
        });

        // Тема
        document.addEventListener('click', (e) => {
            const themeToggle = e.target.closest('#themeToggle');
            if (!themeToggle) return;
            
            e.preventDefault();
            window.Auth?.toggleTheme?.() || fallbackThemeToggle();
        });

        // Онлайн статус
        window.addEventListener('online', () => {
            window.AppStore?.setState({ isOnline: true });
            window.Utils?.showSuccess('🟢 Соединение восстановлено');
        });

        window.addEventListener('offline', () => {
            window.AppStore?.setState({ isOnline: false });
            window.Utils?.showWarning('🔴 Нет соединения');
        });
    }

    function fallbackThemeToggle() {
        const isDark = document.body.classList.toggle('dark-theme');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        document.querySelectorAll('#themeToggle i').forEach(icon => {
            icon.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
        });
    }

    function showAccessDenied() {
        document.body.innerHTML = `
            <div style="position:fixed; top:0; left:0; right:0; bottom:0; background:#0B1E33; display:flex; align-items:center; justify-content:center; z-index:9999;">
                <div style="text-align:center; padding:20px; max-width:400px;">
                    <i class="fas fa-exclamation-triangle" style="font-size:64px; color:#FF8A5C; margin-bottom:20px;"></i>
                    <h3 style="color:white; font-size:24px; margin-bottom:15px;">Доступ запрещён</h3>
                    <p style="color:#B0C4D9; margin-bottom:25px;">У вас нет прав для просмотра этой страницы</p>
                    <a href="/HomeWork/" style="background:#2CD5C4; color:#0B1E33; padding:12px 30px; border-radius:60px; text-decoration:none; font-weight:700;">
                        <i class="fas fa-home me-2"></i>На главную
                    </a>
                </div>
            </div>
        `;
        window.stop();
    }

    function showFatalError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed; top: 0; left: 0; right: 0;
            background: #DC3545; color: white; padding: 15px;
            text-align: center; z-index: 99999; font-weight: 600;
        `;
        errorDiv.innerHTML = `
            <i class="fas fa-exclamation-triangle me-2"></i>${message}
            <button onclick="location.reload()" style="margin-left:15px; background:white; color:#DC3545; border:none; padding:5px 15px; border-radius:5px;">
                <i class="fas fa-sync-alt me-2"></i>Обновить
            </button>
        `;
        document.body.prepend(errorDiv);
    }

    const api = { init };
    window.__APP_INITIALIZED__ = true;
    return Object.freeze(api);
})();

document.addEventListener('DOMContentLoaded', () => App.init());
window.App = App;