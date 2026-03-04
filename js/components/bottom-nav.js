// ============================================
// КОМПОНЕНТ НИЖНЕЙ НАВИГАЦИИ (С ЧАТАМИ И ЛОУДЕРОМ)
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
        
        console.log('📱 Нижняя навигация с чатами инициализирована');
        
        // Показываем навигацию только на мобилках/планшетах
        checkScreenSize();
        window.addEventListener('resize', debounce(checkScreenSize, 150));
        
        // Первоначальное обновление видимости
        updateNavVisibility();
        setupListeners();
        
        // Подписываемся на изменения авторизации
        if (window.Auth) {
            Auth.onAuthChange(() => {
                updateNavVisibility();
            });
        }
        
        // Подписываемся на непрочитанные сообщения
        document.addEventListener('unread-changed', (e) => {
            updateChatBadge(e.detail.count);
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
    
    // ===== ОБНОВЛЕНИЕ ВИДИМОСТИ ПО РОЛЯМ =====
    function updateNavVisibility() {
        if (!window.Auth) return;
        
        const state = Auth.getAuthState();
        const isAuth = state.isAuthenticated;
        const isMaster = state.isMaster;
        const isClient = state.isClient;
        
        navItems.forEach(item => {
            const page = item.dataset.page;
            
            // По умолчанию скрываем всё
            item.style.display = 'none';
            
            if (!isAuth) {
                // ГОСТЬ - только главная, заявка, профиль (как вход)
                switch(page) {
                    case 'home':
                    case 'create-order':
                    case 'profile':
                        item.style.display = 'flex';
                        break;
                }
                
                // Меняем текст профиля на "Войти"
                if (page === 'profile') {
                    const span = item.querySelector('span:last-child');
                    if (span) span.textContent = 'Войти';
                }
                
            } else if (isMaster) {
                // МАСТЕР - главная, поиск, чаты, отклики, профиль
                switch(page) {
                    case 'home':
                    case 'search':
                    case 'chats':
                    case 'orders':
                    case 'profile':
                        item.style.display = 'flex';
                        break;
                }
                
                // Меняем текст "Заказы" на "Отклики"
                if (page === 'orders') {
                    const span = item.querySelector('span:last-child');
                    if (span) span.textContent = 'Отклики';
                }
                
                // Восстанавливаем текст профиля
                if (page === 'profile') {
                    const span = item.querySelector('span:last-child');
                    if (span) span.textContent = 'Профиль';
                }
                
            } else if (isClient) {
                // КЛИЕНТ - главная, чаты, заявка, заказы, профиль
                switch(page) {
                    case 'home':
                    case 'chats':
                    case 'create-order':
                    case 'orders':
                    case 'profile':
                        item.style.display = 'flex';
                        break;
                }
                
                // Меняем текст "Заказы" на "Мои заказы"
                if (page === 'orders') {
                    const span = item.querySelector('span:last-child');
                    if (span) span.textContent = 'Мои заказы';
                }
                
                // Восстанавливаем текст профиля
                if (page === 'profile') {
                    const span = item.querySelector('span:last-child');
                    if (span) span.textContent = 'Профиль';
                }
            }
        });
        
        // Обновляем подсветку активного пункта
        highlightActive();
    }
    
    // ===== ПОДСВЕТКА АКТИВНОГО ПУНКТА =====
    function highlightActive() {
        const currentPath = window.location.pathname;
        const currentUrl = window.location.href;
        
        navItems.forEach(item => {
            item.classList.remove('active');
            
            const page = item.dataset.page;
            
            if (page === 'home' && (currentPath.includes('index.html') || currentPath === '/HomeWork/')) {
                item.classList.add('active');
            } else if (page === 'orders' && (currentPath.includes('client.html') || currentPath.includes('master.html'))) {
                item.classList.add('active');
            } else if (page === 'profile' && (currentPath.includes('client.html') || currentPath.includes('master.html') || currentPath.includes('admin.html'))) {
                item.classList.add('active');
            } else if (page === 'chats' && currentUrl.includes('tab=chats')) {
                item.classList.add('active');
            }
        });
    }
    
    // ===== ОБНОВЛЕНИЕ БЕЙДЖА ЧАТОВ =====
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
    
    // ===== НАСТРОЙКА ОБРАБОТЧИКОВ =====
    function setupListeners() {
        navItems.forEach(item => {
            item.addEventListener('click', function(e) {
                e.preventDefault();
                
                const now = Date.now();
                if (now - lastClickTime < 500) return;
                lastClickTime = now;
                
                const page = this.dataset.page;
                
                animateClick(this);
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
    
    // ===== ОБРАБОТКА НАВИГАЦИИ С ЛОУДЕРОМ =====
    function handleNavigation(page) {
        if (!window.Auth || !window.AuthUI) {
            console.warn('Auth не загружен');
            return;
        }
        
        const state = Auth.getAuthState();
        
        // Функция для перехода с лоудером
        function navigateWithLoader(url, text) {
            if (window.Loader) {
                Loader.navigateTo(url, text);
            } else {
                window.location.href = url;
            }
        }
        
        switch(page) {
            case 'home':
                navigateWithLoader('/HomeWork/', '🏠 На главную...');
                break;
                
            case 'search':
                // Только для мастера - поиск заказов
                if (state.isMaster) {
                    navigateWithLoader('/HomeWork/?focus=search', '🔍 Поиск...');
                } else {
                    navigateWithLoader('/HomeWork/', '🏠 На главную...');
                }
                break;
                
            case 'chats':
                if (state.isAuthenticated) {
                    // Переходим в кабинет с открытыми чатами
                    if (state.isClient) {
                        navigateWithLoader('/HomeWork/client.html?tab=chats', '💬 Загружаем чаты...');
                    } else if (state.isMaster) {
                        navigateWithLoader('/HomeWork/master.html?tab=chats', '💬 Загружаем чаты...');
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
                        navigateWithLoader('/HomeWork/client.html', '📋 Мои заказы...');
                    } else if (state.isMaster) {
                        navigateWithLoader('/HomeWork/master.html', '📋 Отклики...');
                    }
                } else {
                    AuthUI.showLoginModal();
                }
                break;
                
            case 'profile':
                if (state.isAuthenticated) {
                    if (state.isClient) {
                        navigateWithLoader('/HomeWork/client.html', '👤 Профиль...');
                    } else if (state.isMaster) {
                        navigateWithLoader('/HomeWork/master.html', '👤 Профиль...');
                    } else if (state.isAdmin) {
                        navigateWithLoader('/HomeWork/admin.html', '👤 Админка...');
                    }
                } else {
                    AuthUI.showLoginModal();
                }
                break;
        }
    }
    
    // ===== ОБРАБОТКА КНОПКИ ЗАЯВКИ =====
    function handleCreateOrder() {
        const state = Auth.getAuthState();
        
        if (!state.isAuthenticated) {
            AuthUI.showLoginModal();
            return;
        }
        
        if (state.isClient) {
            // Клиент - создаём заказ
            if (window.location.pathname.includes('client.html')) {
                // Мы уже в кабинете клиента - переключаем на вкладку создания
                document.dispatchEvent(new CustomEvent('switch-client-tab', { 
                    detail: { tab: 'new' } 
                }));
            } else {
                // Переходим в кабинет клиента с параметром
                if (window.Loader) {
                    Loader.navigateTo('/HomeWork/client.html?tab=new', '➕ Создание заказа...');
                } else {
                    window.location.href = '/HomeWork/client.html?tab=new';
                }
            }
        } else if (state.isMaster) {
            // Мастер - поиск заказов
            Utils.showInfo('🔍 Найдите заказ в поиске и откликнитесь');
            if (window.Loader) {
                Loader.navigateTo('/HomeWork/?focus=search', '🔍 Поиск...');
            } else {
                window.location.href = '/HomeWork/?focus=search';
            }
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
        updateNavVisibility,
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