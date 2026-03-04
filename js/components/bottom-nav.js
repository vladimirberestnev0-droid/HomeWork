/**
 * Нижняя навигация — всегда видна, управляет переходами
 */
const BottomNav = (function() {
    let initialized = false;
    
    function init() {
        if (initialized) return;
        initialized = true;
        
        console.log('📱 Нижняя навигация инициализирована');
        
        // Подсвечиваем активный пункт
        highlightActive();
        
        // Добавляем обработчики
        setupListeners();
    }
    
    function highlightActive() {
        const navItems = document.querySelectorAll('.nav-item');
        const currentPath = window.location.pathname;
        
        navItems.forEach(item => {
            const page = item.dataset.page;
            
            // Убираем активный класс у всех
            item.classList.remove('active');
            
            // Подсвечиваем текущую страницу
            if (page === 'home' && (currentPath.includes('index.html') || currentPath === '/HomeWork/')) {
                item.classList.add('active');
            } else if (page === 'orders' && currentPath.includes('client.html')) {
                item.classList.add('active');
            } else if (page === 'profile' && currentPath.includes('master.html')) {
                item.classList.add('active');
            } else if (page === 'search' && currentPath.includes('search.html')) {
                item.classList.add('active');
            } else if (page === 'favorites' && currentPath.includes('favorites.html')) {
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
                        // Пока просто скроллим к поиску
                        document.querySelector('.search-bar')?.scrollIntoView({ behavior: 'smooth' });
                        break;
                    case 'favorites':
                        if (Auth.isAuthenticated()) {
                            // Показываем избранное (заглушка)
                            Utils.showNotification('Избранное будет позже', 'info');
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

// Автоинициализация
document.addEventListener('DOMContentLoaded', () => {
    BottomNav.init();
});

window.BottomNav = BottomNav;