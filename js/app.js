// ============================================
// ГЛАВНЫЙ ФАЙЛ ПРИЛОЖЕНИЯ - ОРКЕСТРАТОР (УЛУЧШЕННЫЙ)
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
            await initPage();
            initGlobalHandlers();

            initialized = true;
            console.log('✅ Приложение готово');

            document.body.classList.remove('app-loading');
            
            if (window.Loader) {
                setTimeout(() => Loader.forceHide(), 100);
            }

        } catch (error) {
            console.error('❌ Ошибка инициализации приложения:', error);
            showFatalError('Не удалось загрузить приложение. Обновите страницу.');
        }
    }

    async function initCore() {
        console.log('📦 Инициализация ядра...');

        if (!window.CONFIG) {
            throw new Error('CONFIG не загружен');
        }

        await waitForFirebase();

        // Ждем готовности DataService (очередь всё равно подхватит, но так надёжнее)
        if (window.DataService) {
            console.log('📦 Ожидание DataService...');
            await window.DataService.ready();
        }

        if (window.Cache) {
            console.log('📦 Cache готов');
        }

        if (window.AppStore) {
            console.log('📦 AppStore готов');
        }

        if (window.Loader) {
            console.log('📦 Loader готов');
        }
    }

    function waitForFirebase() {
        return new Promise((resolve) => {
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
                console.warn('⚠️ Таймаут ожидания Firebase');
                resolve();
            }, 5000);
        });
    }

    function initServices() {
        console.log('🔧 Инициализация сервисов...');
        if (window.Auth) {
            console.log('🔧 Auth готов');
        }
    }

    function initComponents() {
        console.log('🎨 Инициализация компонентов...');

        if (window.ModalManager) {
            ModalManager.init();
        }

        if (window.BottomNav) {
            BottomNav.init();
        }
        if (window.DesktopNav) {
            DesktopNav.init();
        }

        if (window.Notifications) {
            Notifications.init();
        }

        if (window.AuthUI) {
            AuthUI.init();
        }
    }

    async function initPage() {
        console.log('📄 Инициализация страницы...');

        const path = window.location.pathname;
        const page = getCurrentPage(path);

        if (page.requiresAuth) {
            const state = window.AppStore ? AppStore.getState() : Auth.getAuthState();
            
            if (!state.isAuthenticated) {
                sessionStorage.setItem('redirectAfterLogin', window.location.href);
                window.location.href = '/HomeWork/';
                return;
            }

            if (page.allowedRoles && !page.allowedRoles.includes(state.role)) {
                showAccessDenied();
                return;
            }
        }

        if (window.loadPageData) {
            await window.loadPageData();
        }
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
        } else {
            return { name: 'home', requiresAuth: false };
        }
    }

    function showAccessDenied() {
        document.body.innerHTML = `
            <div style="position:fixed; top:0; left:0; right:0; bottom:0; background:var(--aurora-deep, #0B1E33); display:flex; align-items:center; justify-content:center; z-index:9999;">
                <div style="text-align:center; padding:20px; max-width:400px;">
                    <i class="fas fa-exclamation-triangle" style="font-size:64px; color:var(--accent-urgent, #FF8A5C); margin-bottom:20px;"></i>
                    <h3 style="color:white; font-size:24px; margin-bottom:15px;">Доступ запрещён</h3>
                    <p style="color:var(--aurora-text-soft, #B0C4D9); margin-bottom:25px;">У вас нет прав для просмотра этой страницы</p>
                    <a href="/HomeWork/" style="background:var(--aurora-accent, #2CD5C4); color:var(--aurora-deep, #0B1E33); padding:12px 30px; border-radius:60px; text-decoration:none; font-weight:700; display:inline-block;">
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
        `;
        errorDiv.innerHTML = `
            <i class="fas fa-exclamation-triangle me-2"></i>
            ${message}
            <button onclick="location.reload()" style="margin-left:15px; background:white; color:#DC3545; border:none; padding:5px 15px; border-radius:5px; cursor:pointer;">
                <i class="fas fa-sync-alt me-2"></i>Обновить
            </button>
        `;
        document.body.prepend(errorDiv);
    }

    function initGlobalHandlers() {
        document.addEventListener('click', (e) => {
            const link = e.target.closest('a[href]');
            if (!link) return;

            const href = link.getAttribute('href');
            
            if (href.startsWith('http') || 
                href.startsWith('#') || 
                href.startsWith('javascript:') ||
                href.startsWith('tel:') ||
                href.startsWith('mailto:') ||
                link.hasAttribute('data-no-loader')) {
                return;
            }

            e.preventDefault();
            
            if (window.Loader) {
                Loader.navigateTo(href);
            } else {
                window.location.href = href;
            }
        });

        window.addEventListener('online', () => {
            if (window.AppStore) {
                AppStore.setState({ isOnline: true });
            }
            Utils.showSuccess('🟢 Соединение восстановлено');
        });

        window.addEventListener('offline', () => {
            if (window.AppStore) {
                AppStore.setState({ isOnline: false });
            }
            Utils.showWarning('🔴 Нет соединения');
        });
    }

    const api = {
        init
    };

    window.__APP_INITIALIZED__ = true;

    return Object.freeze(api);
})();

document.addEventListener('DOMContentLoaded', () => App.init());

window.App = App;