// ============================================
// КОМПОНЕНТ ДЕСКТОПНОЙ НАВИГАЦИИ (ИСПРАВЛЕННАЯ ВЕРСИЯ)
// ============================================
const DesktopNav = (function() {
    if (window.__DESKTOP_NAV_INITIALIZED__) return window.DesktopNav;

    let initialized = false;
    let unsubscribe = null;
    let lastClickTime = 0;
    const CLICK_COOLDOWN = 500;

    function init() {
        if (initialized) return;

        const navElement = document.querySelector('.desktop-nav');
        if (!navElement) {
            console.log('ℹ️ Десктопная навигация не найдена');
            return;
        }

        console.log('💻 Десктопная навигация инициализируется');

        if (window.AppStore) {
            unsubscribe = AppStore.subscribe(
                'desktop-nav',
                ['isAuthenticated', 'isMaster', 'isClient', 'userData'],
                (state) => {
                    updateNavVisibility(state);
                }
            );
        } else {
            if (window.Auth) {
                Auth.onAuthChange((state) => {
                    updateNavVisibility(state);
                });
            }
        }

        setupListeners();
        initialized = true;
    }

    function updateNavVisibility(state) {
        const isAuth = state.isAuthenticated || false;
        const isMaster = state.isMaster || false;
        const isClient = state.isClient || false;
        const userData = state.userData || {};

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
                mastersLink.href = '/HomeWork/masters.html';
            }

            if (ordersLink) {
                ordersLink.innerHTML = '<i class="fas fa-clipboard-list"></i><span>Заказы</span>';
                ordersLink.href = '/HomeWork/client.html';
            }

        } else if (isMaster) {
            // МАСТЕР
            if (authBtn) {
                authBtn.innerHTML = `<i class="fas fa-user-circle"></i><span>${userData.name || 'Профиль'}</span>`;
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
                authBtn.innerHTML = `<i class="fas fa-user-circle"></i><span>${userData.name || 'Профиль'}</span>`;
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
                if (item.id === 'desktopNavHome') {
                    item.classList.add('active');
                }
            } else if (currentPath.includes('client.html') && item.id === 'desktopNavOrders') {
                item.classList.add('active');
            } else if (currentPath.includes('masters.html') && item.id === 'desktopNavMasters') {
                item.classList.add('active');
            } else if (currentPath.includes('chat.html') && item.id === 'desktopNavChats') {
                item.classList.add('active');
            } else if (currentPath.includes('admin.html') && item.id === 'desktopNavOrders') {
                item.classList.add('active');
            }
        });
    }

    function getAuthState() {
        return window.AppStore ? AppStore.getState() : Auth.getAuthState();
    }

    function showAuthModal(message = 'Необходимо авторизоваться') {
        sessionStorage.setItem('redirectAfterLogin', window.location.href);
        
        if (window.ModalManager) {
            ModalManager.show('auth', 'login');
        }
        
        Utils.showInfo(message);
    }

    function handleAuthClick() {
        const state = getAuthState();
        
        if (!state.isAuthenticated) {
            showAuthModal();
        } else {
            if (state.isClient) {
                window.location.href = '/HomeWork/client.html';
            } else if (state.isMaster) {
                window.location.href = '/HomeWork/masters.html';
            }
        }
    }

    function handleCreateClick() {
        const state = getAuthState();
        
        if (!state.isAuthenticated) {
            showAuthModal('Войдите, чтобы создать заказ');
        } else if (state.isClient) {
            window.location.href = '/HomeWork/client.html?tab=new';
        } else {
            Utils.showWarning('Мастера не могут создавать заказы');
        }
    }

    function setupListeners() {
        const authBtn = document.getElementById('desktopAuthBtn');
        const createBtn = document.getElementById('desktopCreateBtn');
        const chatsLink = document.getElementById('desktopNavChats');
        const mastersLink = document.getElementById('desktopNavMasters');
        const ordersLink = document.getElementById('desktopNavOrders');

        if (authBtn) {
            authBtn.addEventListener('click', (e) => {
                e.preventDefault();

                const now = Date.now();
                if (now - lastClickTime < CLICK_COOLDOWN) return;
                lastClickTime = now;

                handleAuthClick();
            });
        }

        if (createBtn) {
            createBtn.addEventListener('click', (e) => {
                e.preventDefault();

                const now = Date.now();
                if (now - lastClickTime < CLICK_COOLDOWN) return;
                lastClickTime = now;

                handleCreateClick();
            });
        }

        if (chatsLink) {
            chatsLink.addEventListener('click', (e) => {
                const state = getAuthState();
                
                if (!state.isAuthenticated) {
                    e.preventDefault();
                    showAuthModal('Войдите, чтобы открыть чаты');
                }
            });
        }

        if (mastersLink) {
            mastersLink.addEventListener('click', (e) => {
                const state = getAuthState();
                
                if (!state.isAuthenticated) {
                    e.preventDefault();
                    showAuthModal('Войдите, чтобы просмотреть мастеров');
                }
            });
        }

        if (ordersLink) {
            ordersLink.addEventListener('click', (e) => {
                const state = getAuthState();
                
                if (!state.isAuthenticated) {
                    e.preventDefault();
                    showAuthModal('Войдите, чтобы просмотреть заказы');
                }
            });
        }
    }

    function destroy() {
        if (unsubscribe) {
            unsubscribe();
            unsubscribe = null;
        }
    }

    const api = {
        init,
        destroy,
        updateNavVisibility
    };

    window.__DESKTOP_NAV_INITIALIZED__ = true;

    return Object.freeze(api);
})();

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => DesktopNav.init(), 900);
});

window.DesktopNav = DesktopNav;