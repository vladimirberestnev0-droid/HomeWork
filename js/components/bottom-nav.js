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
            } else if (page === 'orders' && currentPath.includes('client.html')) {
                item.classList.add('active');
            } else if (page === 'profile' && currentPath.includes('master.html')) {
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
                        document.querySelector('.search-bar')?.scrollIntoView({ behavior: 'smooth' });
                        break;
                    case 'favorites':
                        if (Auth.isAuthenticated()) {
                            Utils.showNotification('Избранное (демо)', 'info');
                        } else {
                            AuthUI.showLoginModal();
                        }
                        break;
                    case 'orders':
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