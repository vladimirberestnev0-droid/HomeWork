// ============================================
// КОМПОНЕНТ НИЖНЕЙ НАВИГАЦИИ
// ============================================

const BottomNav = (function() {
    // Защита от повторных инициализаций
    if (window.__BOTTOM_NAV_INITIALIZED__) {
        return window.BottomNav;
    }

    // ===== ПРИВАТНЫЕ ПЕРЕМЕННЫЕ =====
    let initialized = false;
    let navElement = null;
    let navItems = [];
    let lastClickTime = 0;

    // ===== ИНИЦИАЛИЗАЦИЯ =====
    function init() {
        if (initialized) return;
        
        navElement = document.querySelector('.bottom-nav');
        if (!navElement) {
            console.warn('⚠️ Нижняя навигация не найдена');
            return;
        }
        
        navItems = document.querySelectorAll('.nav-item');
        
        console.log('📱 Нижняя навигация инициализирована');
        
        // Показываем навигацию только на мобилках/планшетах
        checkScreenSize();
        window.addEventListener('resize', debounce(checkScreenSize, 150));
        
        highlightActive();
        setupListeners();
        
        // Подписываемся на изменения авторизации
        Auth.onAuthChange(() => {
            updateNavVisibility();
        });
        
        // Подписываемся на непрочитанные сообщения
        document.addEventListener('unread-changed', (e) => {
            updateUnreadBadge(e.detail.count);
        });
        
        initialized = true;
    }
    
    // ===== ПРОВЕРКА РАЗМЕРА ЭКРАНА =====
    function checkScreenSize() {
        if (!navElement) return;
        
        if (window.innerWidth < 992) {
            navElement.style.display = 'flex';
            document.body.style.paddingBottom = 'var(--mobile-nav-height)';
        } else {
            navElement.style.display = 'none';
            document.body.style.paddingBottom = '0';
        }
    }
    
    // ===== ПОДСВЕТКА АКТИВНОГО ПУНКТА =====
    function highlightActive() {
        const currentPath = window.location.pathname;
        
        navItems.forEach(item => {
            item.classList.remove('active');
            
            const page = item.dataset.page;
            
            if (page === 'home' && (currentPath.includes('index.html') || currentPath === '/HomeWork/')) {
                item.classList.add('active');
            } else if (page === 'orders' && (currentPath.includes('client.html') || currentPath.includes('orders'))) {
                item.classList.add('active');
            } else if (page === 'profile' && (currentPath.includes('master.html') || currentPath.includes('profile'))) {
                item.classList.add('active');
            } else if (page === 'search' && currentPath.includes('search.html')) {
                item.classList.add('active');
            } else if (page === 'favorites' && currentPath.includes('favorites.html')) {
                item.classList.add('active');
            }
        });
    }
    
    // ===== ОБНОВЛЕНИЕ ВИДИМОСТИ =====
    function updateNavVisibility() {
        const isAuth = Auth.isAuthenticated();
        const isMaster = Auth.isMaster();
        
        navItems.forEach(item => {
            const page = item.dataset.page;
            
            // Показываем/скрываем пункты в зависимости от роли
            if (page === 'orders') {
                item.style.display = isAuth && !isMaster ? 'flex' : 'none';
            } else if (page === 'profile') {
                item.style.display = isAuth ? 'flex' : 'none';
            } else {
                item.style.display = 'flex'; // Главная и поиск всегда видны
            }
        });
    }
    
    // ===== ОБНОВЛЕНИЕ БЕЙДЖА НЕПРОЧИТАННЫХ =====
    function updateUnreadBadge(count) {
        const profileItem = document.querySelector('.nav-item[data-page="profile"]');
        if (!profileItem) return;
        
        let badge = profileItem.querySelector('.unread-badge');
        
        if (count > 0) {
            if (!badge) {
                badge = document.createElement('span');
                badge.className = 'unread-badge';
                profileItem.appendChild(badge);
            }
            badge.textContent = count > 99 ? '99+' : count;
        } else {
            if (badge) badge.remove();
        }
    }
    
    // ===== НАСТРОЙКА ОБРАБОТЧИКОВ =====
    function setupListeners() {
        navItems.forEach(item => {
            item.addEventListener('click', function(e) {
                e.preventDefault();
                
                // Защита от двойного клика
                const now = Date.now();
                if (now - lastClickTime < 500) return;
                lastClickTime = now;
                
                const page = this.dataset.page;
                
                // Анимация клика
                animateClick(this);
                
                // Обработка навигации
                handleNavigation(page);
            });
        });
    }
    
    // ===== АНИМАЦИЯ КЛИКА =====
    function animateClick(element) {
        element.style.transform = 'scale(0.9)';
        setTimeout(() => {
            element.style.transform = '';
        }, 200);
    }
    
    // ===== ОБРАБОТКА НАВИГАЦИИ =====
    function handleNavigation(page) {
        const state = Auth.getAuthState();
        
        switch(page) {
            case 'home':
                window.location.href = '/HomeWork/';
                break;
                
            case 'search':
                if (window.location.pathname.includes('index.html') || window.location.pathname === '/HomeWork/') {
                    document.querySelector('.search-bar')?.scrollIntoView({ 
                        behavior: 'smooth',
                        block: 'center'
                    });
                } else {
                    window.location.href = '/HomeWork/';
                }
                break;
                
            case 'favorites':
                if (state.isAuthenticated) {
                    Utils.showInfo('⭐ Избранное появится soon!');
                } else {
                    AuthUI.showLoginModal();
                }
                break;
                
            case 'orders':
                if (state.isAuthenticated) {
                    if (state.isClient) {
                        window.location.href = '/HomeWork/client.html';
                    } else if (state.isMaster) {
                        window.location.href = '/HomeWork/master.html';
                    } else {
                        window.location.href = '/HomeWork/';
                    }
                } else {
                    AuthUI.showLoginModal();
                }
                break;
                
            case 'profile':
                if (state.isAuthenticated) {
                    if (state.isClient) {
                        window.location.href = '/HomeWork/client.html';
                    } else if (state.isMaster) {
                        window.location.href = '/HomeWork/master.html';
                    } else if (state.isAdmin) {
                        window.location.href = '/HomeWork/admin.html';
                    } else {
                        window.location.href = '/HomeWork/';
                    }
                } else {
                    AuthUI.showLoginModal();
                }
                break;
        }
    }
    
    // ===== DEBOUNCE =====
    function debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }
    
    // ===== ПУБЛИЧНОЕ API =====
    const api = {
        init,
        highlightActive
    };

    window.__BOTTOM_NAV_INITIALIZED__ = true;
    
    return Object.freeze(api);
})();

// Автоинициализация
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        BottomNav.init();
    }, 800);
});

window.BottomNav = BottomNav;