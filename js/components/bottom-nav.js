// ============================================
// КОМПОНЕНТ НИЖНЕЙ НАВИГАЦИИ (С ЧАТАМИ И ЛОУДЕРОМ)
// ============================================

const BottomNav = (function() {
    if (window.__BOTTOM_NAV_INITIALIZED__) {
        return window.BottomNav;
    }

    let initialized = false;
    let navElement = null;
    let navItems = [];
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
        
        console.log('📱 Нижняя навигация инициализирована');
        
        checkScreenSize();
        window.addEventListener('resize', debounce(checkScreenSize, 150));
        
        updateNavVisibility();
        setupListeners();
        
        if (window.Auth) {
            Auth.onAuthChange(() => {
                updateNavVisibility();
            });
        }
        
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
    
    function updateNavVisibility() {
        if (!window.Auth) return;
        
        const state = Auth.getAuthState();
        const isAuth = state.isAuthenticated;
        const isMaster = state.isMaster;
        const isClient = state.isClient;
        
        navItems.forEach(item => {
            const page = item.dataset.page;
            item.style.display = 'none';
            
            if (!isAuth) {
                switch(page) {
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
                switch(page) {
                    case 'home':
                    case 'search':
                    case 'chats':
                    case 'profile':
                        item.style.display = 'flex';
                        break;
                    case 'orders':
                        if (!window.CONFIG || !CONFIG.isCurrentPage('master')) {
                            item.style.display = 'flex';
                        }
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
                switch(page) {
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
        navItems.forEach(item => {
            item.classList.remove('active');
            const page = item.dataset.page;
            
            if (window.CONFIG) {
                if (page === 'home' && CONFIG.isCurrentPage('home')) {
                    item.classList.add('active');
                } else if (page === 'orders' && (CONFIG.isCurrentPage('client') || CONFIG.isCurrentPage('master'))) {
                    item.classList.add('active');
                } else if (page === 'profile' && (CONFIG.isCurrentPage('client') || CONFIG.isCurrentPage('master') || CONFIG.isCurrentPage('admin'))) {
                    item.classList.add('active');
                } else if (page === 'chats' && window.location.search.includes('tab=chats')) {
                    item.classList.add('active');
                } else if (page === 'create-order' && window.location.search.includes('tab=new')) {
                    item.classList.add('active');
                }
            } else {
                const currentPath = window.location.pathname;
                
                if (page === 'home' && (currentPath.includes('index.html') || currentPath === '/HomeWork/')) {
                    item.classList.add('active');
                } else if (page === 'orders' && (currentPath.includes('client.html') || currentPath.includes('master.html'))) {
                    item.classList.add('active');
                } else if (page === 'profile' && (currentPath.includes('client.html') || currentPath.includes('master.html') || currentPath.includes('admin.html'))) {
                    item.classList.add('active');
                } else if (page === 'chats' && window.location.search.includes('tab=chats')) {
                    item.classList.add('active');
                }
            }
        });
    }
    
    function updateChatBadge(count) {
        const chatItem = document.querySelector('.nav-item[data-page="chats"]');
        if (!chatItem) return;
        
        let badge = chatItem.querySelector('.chat-badge');
        
        if (count > 0) {
            if (!badge) {
                badge = document.createElement('span');
                badge.className = 'chat-badge';
                chatItem.appendChild(badge);
            }
            badge.textContent = count > 99 ? '99+' : count;
        } else {
            if (badge) badge.remove();
        }
    }
    
    function setupListeners() {
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
    
    function navigateWithLoader(urlKey, params = {}, text = 'Загрузка...') {
        if (!window.CONFIG) {
            console.warn('⚠️ CONFIG не загружен, используем прямой URL');
            if (window.Loader) {
                Loader.navigateTo(urlKey, text);
            } else {
                window.location.href = urlKey;
            }
            return;
        }
        
        const url = CONFIG.getUrl(urlKey, params);
        
        if (window.Loader) {
            Loader.navigateTo(url, text);
        } else {
            window.location.href = url;
        }
    }
    
    function handleNavigation(page) {
        if (!window.Auth || !window.AuthUI) {
            console.warn('Auth не загружен');
            return;
        }
        
        const state = Auth.getAuthState();
        
        switch(page) {
            case 'home':
                navigateWithLoader('home', {}, '🏠 На главную...');
                break;
                
            case 'search':
                if (state.isMaster) {
                    navigateWithLoader('home', { focus: 'search' }, '🔍 Поиск...');
                } else {
                    navigateWithLoader('home', {}, '🏠 На главную...');
                }
                break;
                
            case 'chats':
                if (state.isAuthenticated) {
                    if (state.isClient) {
                        navigateWithLoader('client', { tab: 'chats' }, '💬 Загружаем чаты...');
                    } else if (state.isMaster) {
                        navigateWithLoader('master', { tab: 'chats' }, '💬 Загружаем чаты...');
                    }
                } else {
                    AuthUI.showLoginModal();
                }
                break;
                
            case 'create-order':
                handleCreateOrder();
                break;
                
            case 'orders':
                if (state.isAuthenticated) {
                    if (state.isClient) {
                        navigateWithLoader('client', {}, '📋 Мои заказы...');
                    } else if (state.isMaster) {
                        navigateWithLoader('master', {}, '📋 Отклики...');
                    }
                } else {
                    AuthUI.showLoginModal();
                }
                break;
                
            case 'profile':
                if (state.isAuthenticated) {
                    if (state.isClient) {
                        navigateWithLoader('client', {}, '👤 Профиль...');
                    } else if (state.isMaster) {
                        navigateWithLoader('master', {}, '👤 Профиль...');
                    } else if (state.isAdmin) {
                        navigateWithLoader('admin', {}, '👤 Админка...');
                    }
                } else {
                    AuthUI.showLoginModal();
                }
                break;
        }
    }
    
    function handleCreateOrder() {
        const state = Auth.getAuthState();
        
        if (!state.isAuthenticated) {
            AuthUI.showLoginModal();
            return;
        }
        
        if (state.isClient) {
            if (window.CONFIG && CONFIG.isCurrentPage('client')) {
                document.dispatchEvent(new CustomEvent('switch-client-tab', { 
                    detail: { tab: 'new' } 
                }));
            } else {
                navigateWithLoader('client', { tab: 'new' }, '➕ Создание заказа...');
            }
        } else if (state.isMaster) {
            Utils.showInfo('🔍 Найдите заказ в поиске и откликнитесь');
            navigateWithLoader('home', { focus: 'search' }, '🔍 Поиск...');
        }
    }
    
    function debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }
    
    const api = {
        init,
        updateNavVisibility,
        highlightActive,
        navigateWithLoader
    };

    window.__BOTTOM_NAV_INITIALIZED__ = true;
    
    return Object.freeze(api);
})();

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        BottomNav.init();
    }, 800);
});

window.BottomNav = BottomNav;