// ============================================
// КОМПОНЕНТ ДЕСКТОПНОЙ НАВИГАЦИИ
// ============================================

const DesktopNav = (function() {
    if (window.__DESKTOP_NAV_INITIALIZED__) {
        return window.DesktopNav;
    }

    let initialized = false;
    let navElement = null;
    let lastClickTime = 0;
    const CLICK_COOLDOWN = 500;

    function init() {
        if (initialized) return;
        
        navElement = document.querySelector('.desktop-nav');
        if (!navElement) {
            console.log('ℹ️ Десктопная навигация не найдена (возможно мобильная версия)');
            return;
        }
        
        console.log('💻 Десктопная навигация инициализирована');
        
        updateNavVisibility();
        setupListeners();
        
        if (window.Auth) {
            Auth.onAuthChange(() => {
                updateNavVisibility();
            });
        }
        
        initialized = true;
    }
    
    function updateNavVisibility() {
        if (!window.Auth) return;
        
        const state = Auth.getAuthState();
        const isAuth = state.isAuthenticated;
        const isMaster = state.isMaster;
        const isClient = state.isClient;
        
        // Элементы навигации
        const authBtn = document.getElementById('desktopAuthBtn');
        const createBtn = document.getElementById('desktopCreateBtn');
        const chatsLink = document.getElementById('desktopNavChats');
        const mastersLink = document.getElementById('desktopNavMasters');
        const ordersLink = document.getElementById('desktopNavOrders');
        
        if (!isAuth) {
            // ГОСТЬ
            if (authBtn) {
                authBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i><span>Войти</span>';
                authBtn.classList.remove('requires-auth');
            }
            
            if (chatsLink) {
                chatsLink.style.display = 'none';
            }
            
            if (createBtn) {
                createBtn.style.display = 'flex';
                createBtn.innerHTML = '<i class="fas fa-plus-circle"></i><span>Создать заказ</span>';
            }
            
            if (mastersLink) {
                mastersLink.style.display = 'flex';
            }
            
            if (ordersLink) {
                ordersLink.innerHTML = '<i class="fas fa-clipboard-list"></i><span>Заказы</span>';
            }
            
        } else if (isMaster) {
            // МАСТЕР
            if (authBtn) {
                authBtn.innerHTML = `<i class="fas fa-user-circle"></i><span>${state.userData?.name || 'Профиль'}</span>`;
            }
            
            if (chatsLink) {
                chatsLink.style.display = 'flex';
                chatsLink.href = '/HomeWork/masters.html?tab=chats';
                chatsLink.innerHTML = '<i class="fas fa-comments"></i><span>Чаты</span>';
            }
            
            if (createBtn) {
                createBtn.style.display = 'none';
            }
            
            if (ordersLink) {
                ordersLink.href = '/HomeWork/masters.html';
                ordersLink.innerHTML = '<i class="fas fa-reply"></i><span>Отклики</span>';
            }
            
        } else if (isClient) {
            // КЛИЕНТ
            if (authBtn) {
                authBtn.innerHTML = `<i class="fas fa-user-circle"></i><span>${state.userData?.name || 'Профиль'}</span>`;
            }
            
            if (chatsLink) {
                chatsLink.style.display = 'flex';
                chatsLink.href = '/HomeWork/client.html?tab=chats';
                chatsLink.innerHTML = '<i class="fas fa-comments"></i><span>Чаты</span>';
            }
            
            if (createBtn) {
                createBtn.style.display = 'flex';
                createBtn.innerHTML = '<i class="fas fa-plus-circle"></i><span>Создать заказ</span>';
            }
            
            if (ordersLink) {
                ordersLink.href = '/HomeWork/client.html';
                ordersLink.innerHTML = '<i class="fas fa-clipboard-list"></i><span>Мои заказы</span>';
            }
        }
        
        highlightActive();
    }
    
    function highlightActive() {
        const currentPath = window.location.pathname;
        
        const navItems = document.querySelectorAll('.desktop-nav-item');
        navItems.forEach(item => {
            item.classList.remove('active');
            
            const href = item.getAttribute('href');
            if (!href) return;
            
            if (currentPath.includes('index.html') || currentPath === '/HomeWork/') {
                if (item.id === 'desktopNavHome' || item.id === 'desktopNavOrders') {
                    item.classList.add('active');
                }
            } else if (currentPath.includes('client.html') && item.id === 'desktopNavOrders') {
                item.classList.add('active');
            } else if (currentPath.includes('masters.html') && item.id === 'desktopNavMasters') {
                item.classList.add('active');
            } else if (currentPath.includes('chat.html') && item.id === 'desktopNavChats') {
                item.classList.add('active');
            }
        });
    }
    
    function setupListeners() {
        const authBtn = document.getElementById('desktopAuthBtn');
        const createBtn = document.getElementById('desktopCreateBtn');
        const chatsLink = document.getElementById('desktopNavChats');
        
        if (authBtn) {
            authBtn.addEventListener('click', (e) => {
                e.preventDefault();
                
                const now = Date.now();
                if (now - lastClickTime < CLICK_COOLDOWN) return;
                lastClickTime = now;
                
                if (!Auth.isAuthenticated()) {
                    AuthUI.showLoginModal();
                } else {
                    if (Auth.isClient()) {
                        window.location.href = '/HomeWork/client.html';
                    } else if (Auth.isMaster()) {
                        window.location.href = '/HomeWork/masters.html';
                    }
                }
            });
        }
        
        if (createBtn) {
            createBtn.addEventListener('click', (e) => {
                e.preventDefault();
                
                const now = Date.now();
                if (now - lastClickTime < CLICK_COOLDOWN) return;
                lastClickTime = now;
                
                if (!Auth.isAuthenticated()) {
                    AuthUI.showLoginModal();
                    Utils.showInfo('Войдите, чтобы создать заказ');
                } else if (Auth.isClient()) {
                    window.location.href = '/HomeWork/client.html?tab=new';
                } else {
                    Utils.showWarning('Мастера не могут создавать заказы');
                }
            });
        }
        
        if (chatsLink) {
            chatsLink.addEventListener('click', (e) => {
                if (!Auth.isAuthenticated()) {
                    e.preventDefault();
                    AuthUI.showLoginModal();
                    Utils.showInfo('Войдите, чтобы открыть чаты');
                }
            });
        }
        
        // Подсветка активного пункта
        document.querySelectorAll('.desktop-nav-item[href]').forEach(item => {
            item.addEventListener('click', function(e) {
                if (this.getAttribute('href').startsWith('#')) {
                    e.preventDefault();
                }
            });
        });
    }
    
    const api = {
        init,
        updateNavVisibility
    };

    window.__DESKTOP_NAV_INITIALIZED__ = true;
    
    return Object.freeze(api);
})();

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        DesktopNav.init();
    }, 900);
});

window.DesktopNav = DesktopNav;