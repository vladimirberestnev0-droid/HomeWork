// ============================================
// КОМПОНЕНТ НИЖНЕЙ НАВИГАЦИИ (ПОДПИСАН НА STORE)
// ============================================
const BottomNav = (function() {
    if (window.__BOTTOM_NAV_INITIALIZED__) return window.BottomNav;

    let initialized = false;
    let navElement = null;
    let navItems = [];
    let unsubscribe = null;
    let lastClickTime = 0;
    const CLICK_COOLDOWN = 500;

    function init() {
        if (initialized) return;

        navElement = document.querySelector('.bottom-nav');
        if (!navElement) {
            console.warn('⚠️ Нижняя навигация не найдена');
            return;
        }

        navItems = document.querySelectorAll('.nav-item');
        
        console.log('📱 Нижняя навигация инициализируется');

        checkScreenSize();
        window.addEventListener('resize', Utils.debounce(checkScreenSize, 150));

        // Подписка на изменения в Store
        if (window.AppStore) {
            unsubscribe = AppStore.subscribe(
                'bottom-nav',
                ['isAuthenticated', 'isMaster', 'isClient', 'unreadCount'],
                (state) => {
                    updateNavVisibility(state);
                    updateChatBadge(state.unreadCount);
                }
            );
        } else {
            // Fallback
            if (window.Auth) {
                Auth.onAuthChange((state) => {
                    updateNavVisibility(state);
                });
            }
        }

        setupListeners();
        
        // Подписка на события непрочитанных
        document.addEventListener('unread-changed', (e) => {
            updateChatBadge(e.detail.count);
        });

        initialized = true;
    }

    function checkScreenSize() {
        if (!navElement) return;

        if (window.innerWidth < 992) {
            navElement.style.display = 'flex';
            document.body.style.paddingBottom = 'var(--mobile-nav-height, 70px)';
        } else {
            navElement.style.display = 'none';
            document.body.style.paddingBottom = '0';
        }
    }

    function updateNavVisibility(state) {
        const isAuth = state.isAuthenticated || false;
        const isMaster = state.isMaster || false;
        const isClient = state.isClient || false;

        navItems.forEach(item => {
            const page = item.dataset.page;
            item.style.display = 'none';

            if (!isAuth) {
                // Неавторизованный пользователь
                switch (page) {
                    case 'home':
                    case 'create-order':
                    case 'profile':
                        item.style.display = 'flex';
                        break;
                }

                if (page === 'profile') {
                    const span = item.querySelector('span:last-child');
                    if (span) span.textContent = 'Войти';
                }

            } else if (isMaster) {
                // Мастер
                switch (page) {
                    case 'home':
                    case 'search':
                    case 'chats':
                    case 'profile':
                        item.style.display = 'flex';
                        break;
                    case 'orders':
                        item.style.display = 'flex';
                        break;
                }

                if (page === 'orders') {
                    const span = item.querySelector('span:last-child');
                    if (span) span.textContent = 'Отклики';
                }

                if (page === 'profile') {
                    const span = item.querySelector('span:last-child');
                    if (span) span.textContent = 'Профиль';
                }

                if (page === 'create-order') {
                    item.style.display = 'none';
                }

            } else if (isClient) {
                // Клиент
                switch (page) {
                    case 'home':
                    case 'chats':
                    case 'create-order':
                    case 'orders':
                    case 'profile':
                        item.style.display = 'flex';
                        break;
                }

                if (page === 'orders') {
                    const span = item.querySelector('span:last-child');
                    if (span) span.textContent = 'Мои заказы';
                }

                if (page === 'profile') {
                    const span = item.querySelector('span:last-child');
                    if (span) span.textContent = 'Профиль';
                }

                if (page === 'search') {
                    item.style.display = 'none';
                }
            }
        });

        highlightActive();
    }

    function highlightActive() {
        const currentPath = window.location.pathname;

        navItems.forEach(item => {
            item.classList.remove('active');
            const page = item.dataset.page;

            if (page === 'home' && (currentPath.includes('index.html') || currentPath === '/HomeWork/')) {
                item.classList.add('active');
            } else if (page === 'orders' && (currentPath.includes('client.html') || currentPath.includes('masters.html'))) {
                item.classList.add('active');
            } else if (page === 'profile' && (currentPath.includes('client.html') || currentPath.includes('masters.html') || currentPath.includes('admin.html'))) {
                item.classList.add('active');
            } else if (page === 'chats' && window.location.search.includes('tab=chats')) {
                item.classList.add('active');
            } else if (page === 'create-order' && window.location.search.includes('tab=new')) {
                item.classList.add('active');
            }
        });
    }

    function updateChatBadge(count) {
        const chatItem = document.querySelector('.nav-item[data-page="chats"]');
        if (!chatItem) return;

        let badge = chatItem.querySelector('.nav-badge');

        if (count > 0) {
            if (!badge) {
                badge = document.createElement('span');
                badge.className = 'nav-badge';
                chatItem.appendChild(badge);
            }
            badge.textContent = count > 99 ? '99+' : count;
            badge.classList.remove('hidden');
        } else {
            if (badge) badge.classList.add('hidden');
        }
    }

    function setupListeners() {
        // Удаляем старые обработчики и добавляем новые
        navItems.forEach(item => {
            const newItem = item.cloneNode(true);
            item.parentNode.replaceChild(newItem, item);

            newItem.addEventListener('click', function(e) {
                e.preventDefault();

                const now = Date.now();
                if (now - lastClickTime < CLICK_COOLDOWN) return;
                lastClickTime = now;

                const page = this.dataset.page;
                
                animateClick(this);
                handleNavigation(page);
            });
        });

        navItems = document.querySelectorAll('.nav-item');
    }

    function animateClick(element) {
        element.style.transform = 'scale(0.9)';
        setTimeout(() => {
            element.style.transform = '';
        }, 200);
    }

    function handleNavigation(page) {
        const state = window.AppStore ? AppStore.getState() : Auth.getAuthState();

        switch (page) {
            case 'home':
                navigateTo('/HomeWork/', '🏠 На главную...');
                break;

            case 'search':
                navigateTo('/HomeWork/?focus=search', '🔍 Поиск...');
                break;

            case 'chats':
                if (state.isAuthenticated) {
                    if (state.isClient) {
                        navigateTo('/HomeWork/client.html?tab=chats', '💬 Загружаем чаты...');
                    } else if (state.isMaster) {
                        navigateTo('/HomeWork/masters.html?tab=chats', '💬 Загружаем чаты...');
                    }
                } else {
                    ModalManager.show('auth', 'login');
                }
                break;

            case 'create-order':
                handleCreateOrder();
                break;

            case 'orders':
                if (state.isAuthenticated) {
                    if (state.isClient) {
                        navigateTo('/HomeWork/client.html', '📋 Мои заказы...');
                    } else if (state.isMaster) {
                        navigateTo('/HomeWork/masters.html', '📋 Отклики...');
                    }
                } else {
                    ModalManager.show('auth', 'login');
                }
                break;

            case 'profile':
                if (state.isAuthenticated) {
                    if (state.isClient) {
                        navigateTo('/HomeWork/client.html', '👤 Профиль...');
                    } else if (state.isMaster) {
                        navigateTo('/HomeWork/masters.html', '👤 Профиль...');
                    } else if (state.isAdmin) {
                        navigateTo('/HomeWork/admin.html', '👤 Админка...');
                    }
                } else {
                    ModalManager.show('auth', 'login');
                }
                break;
        }
    }

    function handleCreateOrder() {
        const state = window.AppStore ? AppStore.getState() : Auth.getAuthState();

        if (!state.isAuthenticated) {
            ModalManager.show('auth', 'login');
            return;
        }

        if (state.isClient) {
            navigateTo('/HomeWork/client.html?tab=new', '➕ Создание заказа...');
        } else if (state.isMaster) {
            Utils.showInfo('🔍 Найдите заказ в поиске и откликнитесь');
            navigateTo('/HomeWork/?focus=search', '🔍 Поиск...');
        }
    }

    function navigateTo(url, text) {
        if (window.Loader) {
            Loader.navigateTo(url, text);
        } else {
            window.location.href = url;
        }
    }

    // Очистка при выгрузке
    function destroy() {
        if (unsubscribe) {
            unsubscribe();
            unsubscribe = null;
        }
    }

    const api = {
        init,
        destroy,
        highlightActive
    };

    window.__BOTTOM_NAV_INITIALIZED__ = true;

    return Object.freeze(api);
})();

// Автоинициализация
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => BottomNav.init(), 800);
});

window.BottomNav = BottomNav;