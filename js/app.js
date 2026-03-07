// ============================================
// ГЛАВНЫЙ ФАЙЛ ПРИЛОЖЕНИЯ - ОРКЕСТРАТОР (УЛУЧШЕННЫЙ + ОЖИДАНИЕ ДАННЫХ)
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
            await initPage();  // теперь ждём инициализацию стора
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

    // ===== НОВАЯ ФУНКЦИЯ: Ожидание инициализации стора =====
    function waitForStoreInitialization(timeout = 3000) {
        return new Promise((resolve) => {
            // Если стора нет, сразу резолвим
            if (!window.AppStore) {
                resolve();
                return;
            }

            // Если уже инициализирован
            if (AppStore.getState().isInitialized) {
                resolve();
                return;
            }

            console.log('⏳ Ожидание инициализации стора...');
            
            // Подписываемся на изменение isInitialized
            const unsubscribe = AppStore.subscribe('app-init-waiter', ['isInitialized'], (state) => {
                if (state.isInitialized) {
                    unsubscribe();
                    console.log('✅ Стор инициализирован');
                    resolve();
                }
            });

            // Таймаут на случай ошибки
            setTimeout(() => {
                unsubscribe();
                console.warn('⚠️ Таймаут ожидания стора');
                resolve(); // Всё равно продолжаем
            }, timeout);
        });
    }

    async function initPage() {
        console.log('📄 Инициализация страницы...');

        // Ждём инициализацию стора (ЭЛЕГАНТНОЕ РЕШЕНИЕ)
        await waitForStoreInitialization();

        const path = window.location.pathname;
        const page = getCurrentPage(path);

        if (page.requiresAuth) {
            // 1. Получаем состояние из стора (теперь оно точное!)
            const state = window.AppStore ? AppStore.getState() : Auth.getAuthState();
            
            if (!state.isAuthenticated) {
                console.log('🚫 Не авторизован, редирект на главную');
                sessionStorage.setItem('redirectAfterLogin', window.location.href);
                window.location.href = '/HomeWork/';
                return;
            }

            // 2. Ждём загрузки данных пользователя (если нужно)
            if (window.Auth && typeof Auth.waitForData === 'function') {
                try {
                    await Auth.waitForData(5000);
                } catch (error) {
                    console.warn('⚠️ Ошибка ожидания данных:', error);
                }
            }

            // 3. Получаем обновлённое состояние с загруженными данными
            const updatedState = window.AppStore ? AppStore.getState() : Auth.getAuthState();

            // 4. Проверяем допустимую роль
            if (page.allowedRoles && !page.allowedRoles.includes(updatedState.role)) {
                console.log('🚫 Доступ запрещён для роли:', updatedState.role);
                showAccessDenied();
                return;
            }
            
            console.log('✅ Доступ разрешён для роли:', updatedState.role);
        }

        // 5. Вызываем специфичную для страницы функцию загрузки данных (если есть)
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

    // ===== ГЛОБАЛЬНЫЕ ОБРАБОТЧИКИ =====
    function initGlobalHandlers() {
        // Перехват ссылок для SPA-подобной навигации
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

        // ГЛОБАЛЬНЫЙ ОБРАБОТЧИК ДЛЯ КНОПКИ ТЕМЫ
        document.addEventListener('click', (e) => {
            const themeToggle = e.target.closest('#themeToggle');
            if (!themeToggle) return;
            
            e.preventDefault();
            
            if (window.Auth && typeof Auth.toggleTheme === 'function') {
                Auth.toggleTheme();
            } else {
                const isDark = document.body.classList.toggle('dark-theme');
                localStorage.setItem('theme', isDark ? 'dark' : 'light');
                
                document.querySelectorAll('#themeToggle i').forEach(icon => {
                    icon.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
                });
                
                document.dispatchEvent(new CustomEvent('theme-changed', { 
                    detail: { isDark } 
                }));
            }
        });

        // Мониторинг онлайн статуса
        window.addEventListener('online', () => {
            if (window.AppStore) {
                AppStore.setState({ isOnline: true });
            }
            if (window.Utils) {
                Utils.showSuccess('🟢 Соединение восстановлено');
            }
        });

        window.addEventListener('offline', () => {
            if (window.AppStore) {
                AppStore.setState({ isOnline: false });
            }
            if (window.Utils) {
                Utils.showWarning('🔴 Нет соединения');
            }
        });

        // Сохраняем тему при загрузке
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'light') {
            document.body.classList.remove('dark-theme');
            document.querySelectorAll('#themeToggle i').forEach(icon => {
                icon.className = 'fas fa-moon';
            });
        } else if (savedTheme === 'dark') {
            document.body.classList.add('dark-theme');
            document.querySelectorAll('#themeToggle i').forEach(icon => {
                icon.className = 'fas fa-sun';
            });
        }
    }

    const api = {
        init
    };

    window.__APP_INITIALIZED__ = true;

    return Object.freeze(api);
})();

document.addEventListener('DOMContentLoaded', () => App.init());

window.App = App;