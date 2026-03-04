/**
 * Мобильная навигация (компонент)
 * Подключается на всех страницах и работает без конфликтов
 */
const MobileNav = (function() {
    let initialized = false;

    function init() {
        if (initialized) return;
        initialized = true;

        console.log('📱 Мобильная навигация инициализирована');

        // Загружаем HTML-шаблон
        loadNavTemplate();
    }

    async function loadNavTemplate() {
        try {
            // Проверяем, не вставлена ли уже навигация
            if (document.querySelector('.mobile-bottom-nav')) return;

            // Загружаем HTML-файл компонента
            const response = await fetch('/HomeWork/components/mobile-nav.html');
            const html = await response.text();
            
            // Вставляем в body (в самый конец)
            document.body.insertAdjacentHTML('beforeend', html);
            
            // Инициализируем логику
            setupEventListeners();
        } catch (error) {
            console.error('❌ Ошибка загрузки мобильной навигации:', error);
        }
    }

    function setupEventListeners() {
        const navItems = document.querySelectorAll('.mobile-nav-item');
        const currentPath = window.location.pathname;

        navItems.forEach(item => {
            // Подсветка активного пункта
            if (shouldBeActive(item.dataset.page, currentPath)) {
                item.classList.add('active');
            }

            item.addEventListener('click', handleNavClick);
        });
    }

    function shouldBeActive(page, currentPath) {
        switch (page) {
            case 'home':
                return currentPath.includes('index.html') || currentPath === '/HomeWork/';
            case 'orders':
                return currentPath.includes('client.html');
            case 'masters':
                return currentPath.includes('masters.html');
            default:
                return false;
        }
    }

    function handleNavClick(e) {
        const page = this.dataset.page;
        const currentPath = window.location.pathname;

        // Обработка кнопки "Профиль"
        if (page === 'profile') {
            e.preventDefault();
            
            if (window.Auth && Auth.isAuthenticated()) {
                // Перенаправляем в зависимости от роли
                if (Auth.isClient()) {
                    window.location.href = '/HomeWork/client.html';
                } else if (Auth.isMaster()) {
                    window.location.href = '/HomeWork/masters.html';
                } else {
                    // Если админ или кто-то ещё
                    window.location.href = '/HomeWork/';
                }
            } else {
                // Показываем модалку авторизации
                if (window.AuthUI) {
                    AuthUI.showLoginModal();
                } else {
                    console.warn('AuthUI не загружен');
                }
            }
            return;
        }

        // Если мы уже на этой странице, просто скроллим вверх
        if ((page === 'home' && (currentPath.includes('index.html') || currentPath === '/HomeWork/')) ||
            (page === 'orders' && currentPath.includes('client.html')) ||
            (page === 'masters' && currentPath.includes('masters.html'))) {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }

    // Функция для переключения табов (будет вызываться из страниц)
    function setActiveTab(tabName) {
        const navItems = document.querySelectorAll('.mobile-nav-item');
        navItems.forEach(item => {
            if (item.dataset.page === tabName) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    }

    return {
        init,
        setActiveTab
    };
})();

// Автоинициализация
document.addEventListener('DOMContentLoaded', () => {
    // Ждём немного, чтобы остальные скрипты загрузились
    setTimeout(() => {
        MobileNav.init();
    }, 500);
});

window.MobileNav = MobileNav;