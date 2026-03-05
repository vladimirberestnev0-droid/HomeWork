// ============================================
// ГЛАВНЫЙ ФАЙЛ ПРИЛОЖЕНИЯ - ОРКЕСТРАТОР
// ============================================
const App = (function() {
    if (window.__APP_INITIALIZED__) return window.App;

    let initialized = false;

    async function init() {
        if (initialized) return;

        console.log('🚀 Запуск приложения...');
        
        // Показываем стартовый лоадер
        document.body.classList.add('app-loading');

        try {
            // 1. Инициализация ядра в правильном порядке
            await initCore();

            // 2. Инициализация сервисов
            initServices();

            // 3. Инициализация компонентов UI
            initComponents();

            // 4. Инициализация текущей страницы
            await initPage();

            // 5. Глобальные обработчики
            initGlobalHandlers();

            initialized = true;
            console.log('✅ Приложение готово');

            // Убираем стартовый лоадер
            document.body.classList.remove('app-loading');
            
            // Скрываем глобальный лоадер если он был показан
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

        // CONFIG уже должен быть загружен
        if (!window.CONFIG) {
            throw new Error('CONFIG не загружен');
        }

        // Ждем Firebase
        await waitForFirebase();

        // Инициализируем DataService
        if (window.DataService && window.db && window.storage) {
            DataService.init(window.db, window.storage);
        }

        // Инициализируем Cache (если есть)
        if (window.Cache) {
            console.log('📦 Cache готов');
        }

        // Инициализируем AppStore
        if (window.AppStore) {
            console.log('📦 AppStore готов');
        }

        // Инициализируем Loader
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
                resolve(); // Продолжаем даже без Firebase
            }, 5000);
        });
    }

    function initServices() {
        console.log('🔧 Инициализация сервисов...');

        // Auth уже инициализируется сам
        if (window.Auth) {
            console.log('🔧 Auth готов');
        }

        // Остальные сервисы инициализируются при первом импорте
    }

    function initComponents() {
        console.log('🎨 Инициализация компонентов...');

        // Менеджер модалок
        if (window.ModalManager) {
            ModalManager.init();
        }

        // Навигация
        if (window.BottomNav) {
            BottomNav.init();
        }
        if (window.DesktopNav) {
            DesktopNav.init();
        }

        // Уведомления
        if (window.Notifications) {
            Notifications.init();
        }

        // Auth UI
        if (window.AuthUI) {
            AuthUI.init();
        }
    }

    async function initPage() {
        console.log('📄 Инициализация страницы...');

        const path = window.location.pathname;
        const page = getCurrentPage(path);

        // Проверка доступа для защищенных страниц
        if (page.requiresAuth) {
            const state = window.AppStore ? AppStore.getState() : Auth.getAuthState();
            
            if (!state.isAuthenticated) {
                // Сохраняем намерение и редиректим на главную
                sessionStorage.setItem('redirectAfterLogin', window.location.href);
                window.location.href = '/HomeWork/';
                return;
            }

            if (page.allowedRoles && !page.allowedRoles.includes(state.role)) {
                // Доступ запрещен
                showAccessDenied();
                return;
            }
        }

        // Ждем загрузки данных страницы
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
        // Перехват ссылок для SPA-подобной навигации
        document.addEventListener('click', (e) => {
            const link = e.target.closest('a[href]');
            if (!link) return;

            const href = link.getAttribute('href');
            
            // Не перехватываем внешние ссылки, якоря и специальные ссылки
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

        // Мониторинг онлайн статуса
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

// Автозапуск приложения
document.addEventListener('DOMContentLoaded', () => App.init());

window.App = App;