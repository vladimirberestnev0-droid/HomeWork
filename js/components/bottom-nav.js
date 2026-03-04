const BottomNav = (function() {
    let initialized = false;
    
    function init() {
        if (initialized) return;
        initialized = true;
        
        console.log('📱 Нижняя навигация инициализирована');
        
        highlightActive();
        setupListeners();
    }
    
    function highlightActive() {
        const navItems = document.querySelectorAll('.nav-item');
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
            }
        });
    }
    
    function setupListeners() {
        const navItems = document.querySelectorAll('.nav-item');
        
        navItems.forEach(item => {
            item.addEventListener('click', function(e) {
                e.preventDefault();
                const page = this.dataset.page;
                
                switch(page) {
                    case 'home':
                        window.location.href = '/HomeWork/';
                        break;
                    case 'search':
                        // На главной скроллим к поиску, иначе переходим на главную
                        if (window.location.pathname.includes('index.html') || window.location.pathname === '/HomeWork/') {
                            document.querySelector('.search-bar')?.scrollIntoView({ behavior: 'smooth' });
                        } else {
                            window.location.href = '/HomeWork/';
                        }
                        break;
                    case 'favorites':
                        if (Auth.isAuthenticated()) {
                            Utils.showNotification('Избранное (будет позже)', 'info');
                        } else {
                            AuthUI.showLoginModal();
                        }
                        break;
                    case 'orders':
                        if (Auth.isAuthenticated()) {
                            if (Auth.isClient()) {
                                window.location.href = '/HomeWork/client.html';
                            } else if (Auth.isMaster()) {
                                window.location.href = '/HomeWork/master.html';
                            } else {
                                window.location.href = '/HomeWork/';
                            }
                        } else {
                            AuthUI.showLoginModal();
                        }
                        break;
                    case 'profile':
                        if (Auth.isAuthenticated()) {
                            if (Auth.isClient()) {
                                window.location.href = '/HomeWork/client.html';
                            } else if (Auth.isMaster()) {
                                window.location.href = '/HomeWork/master.html';
                            } else {
                                window.location.href = '/HomeWork/';
                            }
                        } else {
                            AuthUI.showLoginModal();
                        }
                        break;
                }
            });
        });
    }
    
    return {
        init,
        highlightActive
    };
})();

document.addEventListener('DOMContentLoaded', () => {
    BottomNav.init();
});

window.BottomNav = BottomNav;