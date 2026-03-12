// ============================================
// КОНСТАНТЫ ПРИЛОЖЕНИЯ (РАСШИРЕННАЯ ВЕРСИЯ)
// ============================================

const CONSTANTS = (function() {
    // Защита от повторных инициализаций
    if (window.__CONSTANTS_INITIALIZED__) {
        return window.CONSTANTS;
    }

    // ===== РОЛИ ПОЛЬЗОВАТЕЛЕЙ =====
    const USER_ROLE = {
        CLIENT: 'client',
        MASTER: 'master',
        ADMIN: 'admin',
        
        isValid: (role) => {
            return [USER_ROLE.CLIENT, USER_ROLE.MASTER, USER_ROLE.ADMIN].includes(role);
        },
        
        getDisplayName: (role) => {
            const names = {
                [USER_ROLE.CLIENT]: 'Клиент',
                [USER_ROLE.MASTER]: 'Мастер',
                [USER_ROLE.ADMIN]: 'Администратор'
            };
            return names[role] || 'Пользователь';
        },
        
        getIcon: (role) => {
            const icons = {
                [USER_ROLE.CLIENT]: 'fa-user',
                [USER_ROLE.MASTER]: 'fa-user-tie',
                [USER_ROLE.ADMIN]: 'fa-crown'
            };
            return icons[role] || 'fa-user';
        }
    };

    // ===== СТАТУСЫ ЗАКАЗОВ =====
    const ORDER_STATUS = {
        OPEN: 'open',
        IN_PROGRESS: 'in_progress',
        COMPLETED: 'completed',
        CANCELLED: 'cancelled',
        AWAITING_CONFIRMATION: 'awaiting_confirmation',
        
        isValid: (status) => {
            return [ORDER_STATUS.OPEN, ORDER_STATUS.IN_PROGRESS, 
                    ORDER_STATUS.COMPLETED, ORDER_STATUS.CANCELLED,
                    ORDER_STATUS.AWAITING_CONFIRMATION].includes(status);
        },
        
        getDisplayName: (status) => {
            const names = {
                [ORDER_STATUS.OPEN]: 'Активен',
                [ORDER_STATUS.IN_PROGRESS]: 'В работе',
                [ORDER_STATUS.COMPLETED]: 'Завершён',
                [ORDER_STATUS.CANCELLED]: 'Отменён',
                [ORDER_STATUS.AWAITING_CONFIRMATION]: 'Ожидает подтверждения'
            };
            return names[status] || status;
        },
        
        getBadgeClass: (status) => {
            const classes = {
                [ORDER_STATUS.OPEN]: 'bg-primary',
                [ORDER_STATUS.IN_PROGRESS]: 'bg-warning text-dark',
                [ORDER_STATUS.COMPLETED]: 'bg-success',
                [ORDER_STATUS.CANCELLED]: 'bg-secondary',
                [ORDER_STATUS.AWAITING_CONFIRMATION]: 'bg-info text-dark'
            };
            return classes[status] || 'bg-secondary';
        },
        
        getIcon: (status) => {
            const icons = {
                [ORDER_STATUS.OPEN]: 'fa-clock',
                [ORDER_STATUS.IN_PROGRESS]: 'fa-spinner fa-spin',
                [ORDER_STATUS.COMPLETED]: 'fa-check-circle',
                [ORDER_STATUS.CANCELLED]: 'fa-times-circle',
                [ORDER_STATUS.AWAITING_CONFIRMATION]: 'fa-hourglass-half'
            };
            return icons[status] || 'fa-question';
        }
    };

    // ===== КАТЕГОРИИ ЗАКАЗОВ =====
    const ORDER_CATEGORIES = [
        { id: 'all', name: 'Все', icon: 'fa-list-ul', color: '#2CD5C4' },
        { id: 'Архитектор', name: 'Архитектор', icon: 'fa-draw-polygon', color: '#9370DB' },
        { id: 'Бытовой ремонт', name: 'Бытовой ремонт', icon: 'fa-tools', color: '#9D65C9' },
        { id: 'Вентиляция', name: 'Вентиляция', icon: 'fa-wind', color: '#98D8C8' },
        { id: 'Водоснабжение', name: 'Вода', icon: 'fa-water', color: '#00CED1' },
        { id: 'Вывоз мусора', name: 'Вывоз мусора', icon: 'fa-trash', color: '#696969' },
        { id: 'Гипсокартон', name: 'Гипсокартон', icon: 'fa-layer-group', color: '#D3D3D3' },
        { id: 'Декорирование', name: 'Декор', icon: 'fa-palette', color: '#DB7093' },
        { id: 'Дизайн интерьера', name: 'Дизайн', icon: 'fa-pencil-ruler', color: '#FF69B4' },
        { id: '3D-визуализация', name: '3D', icon: 'fa-cubes', color: '#20B2AA' },
        { id: 'Клининг', name: 'Клининг', icon: 'fa-broom', color: '#FFB347' },
        { id: 'Компьютерная помощь', name: 'IT', icon: 'fa-laptop', color: '#2F4F4F' },
        { id: 'Кровельные работы', name: 'Кровля', icon: 'fa-home', color: '#8B4513' },
        { id: 'Ландшафтный дизайн', name: 'Ландшафт', icon: 'fa-tree', color: '#2E8B57' },
        { id: 'Малярные работы', name: 'Покраска', icon: 'fa-paint-brush', color: '#FFA07A' },
        { id: 'Мелкий ремонт', name: 'Мелкий ремонт', icon: 'fa-screwdriver', color: '#A9A9A9' },
        { id: 'Мебель', name: 'Мебель', icon: 'fa-couch', color: '#FF8A5C' },
        { id: 'Отделочные работы', name: 'Отделка', icon: 'fa-paint-roller', color: '#6BCB77' },
        { id: 'Отопление', name: 'Отопление', icon: 'fa-radiator', color: '#CD5C5C' },
        { id: 'Окна и двери', name: 'Окна/Двери', icon: 'fa-window-maximize', color: '#4D96FF' },
        { id: 'Паркетные работы', name: 'Паркет', icon: 'fa-wood', color: '#DEB887' },
        { id: 'Потолки', name: 'Потолки', icon: 'fa-arrow-up', color: '#B0C4DE' },
        { id: 'Разнорабочий', name: 'Разнорабочий', icon: 'fa-hard-hat', color: '#8B7E66' },
        { id: 'Ремонт техники', name: 'Ремонт техники', icon: 'fa-gear', color: '#6C757D' },
        { id: 'Ремонт под ключ', name: 'Под ключ', icon: 'fa-key', color: '#CD5C5C' },
        { id: 'Сантехника', name: 'Сантехника', icon: 'fa-wrench', color: '#FF6B6B' },
        { id: 'Сборка мебели', name: 'Сборка', icon: 'fa-chair', color: '#8B4513' },
        { id: 'Сварочные работы', name: 'Сварка', icon: 'fa-welding', color: '#708090' },
        { id: 'Услуги грузчиков', name: 'Грузчики', icon: 'fa-people-carry', color: '#B8860B' },
        { id: 'Утепление', name: 'Утепление', icon: 'fa-temperature-low', color: '#87CEEB' },
        { id: 'Укладка плитки', name: 'Плитка', icon: 'fa-border-all', color: '#4682B4' },
        { id: 'Электрика', name: 'Электрика', icon: 'fa-bolt', color: '#FFD93D' }
    ];

    // ===== КАТЕГОРИИ ДЛЯ ПОРТФОЛИО (НОВЫЕ) =====
    const PORTFOLIO_CATEGORIES = [
        { id: 'all', name: 'Все работы', icon: 'fa-images', color: '#2CD5C4' },
        { id: 'sanitary', name: 'Сантехника', icon: 'fa-wrench', color: '#FF6B6B' },
        { id: 'electric', name: 'Электрика', icon: 'fa-bolt', color: '#FFD93D' },
        { id: 'repair', name: 'Ремонт', icon: 'fa-tools', color: '#9D65C9' },
        { id: 'assembly', name: 'Сборка', icon: 'fa-chair', color: '#8B4513' },
        { id: 'finishing', name: 'Отделка', icon: 'fa-paint-roller', color: '#6BCB77' },
        { id: 'design', name: 'Дизайн', icon: 'fa-pencil-ruler', color: '#FF69B4' },
        { id: 'other', name: 'Другое', icon: 'fa-tag', color: '#6c757d' }
    ];

    // ===== ИКОНКИ ДЛЯ КАТЕГОРИЙ =====
    const CATEGORY_ICONS = ORDER_CATEGORIES.reduce((acc, cat) => {
        if (cat.id !== 'all') acc[cat.id] = cat.icon;
        return acc;
    }, {});

    // ===== ГОРОДА =====
    const CITIES = [
        { id: 'all', name: 'Все города' },
        { id: 'nyagan', name: 'Нягань' },
        { id: 'surgut', name: 'Сургут' },
        { id: 'khanty-mansiysk', name: 'Ханты-Мансийск' },
        { id: 'nefteyugansk', name: 'Нефтеюганск' },
        { id: 'nizhnevartovsk', name: 'Нижневартовск' }
    ];

    // ===== ТИПЫ УВЕДОМЛЕНИЙ =====
    const NOTIFICATION_TYPES = {
        SUCCESS: 'success',
        ERROR: 'error',
        WARNING: 'warning',
        INFO: 'info'
    };

    // ===== ТИПЫ СООБЩЕНИЙ В ЧАТЕ =====
    const MESSAGE_TYPES = {
        TEXT: 'text',
        IMAGE: 'image',
        FILE: 'file',
        SYSTEM: 'system'
    };

    // ===== ЦВЕТА =====
    const COLORS = {
        accent: '#2CD5C4',
        accentUrgent: '#FF8A5C',
        success: '#00A86B',
        warning: '#FFB020',
        danger: '#DC3545',
        info: '#17a2b8'
    };

    // ===== ID АДМИНА =====
    const ADMIN_UID = "dUUNkDJbXmN3efOr3JPKOyBrc8M2";

    // ===== СОБИРАЕМ ВСЁ ВМЕСТЕ =====
    const constants = {
        USER_ROLE,
        ORDER_STATUS,
        ORDER_CATEGORIES,
        CATEGORY_ICONS,
        CITIES,
        NOTIFICATION_TYPES,
        MESSAGE_TYPES,
        COLORS,
        ADMIN_UID,
        PORTFOLIO_CATEGORIES  // ← НОВОЕ
    };

    // Заморозка
    window.__CONSTANTS_INITIALIZED__ = true;
    
    console.log('✅ Константы загружены (расширенная версия)');
    return Object.freeze(constants);
})();

// Глобальный доступ
window.USER_ROLE = CONSTANTS.USER_ROLE;
window.ORDER_STATUS = CONSTANTS.ORDER_STATUS;
window.ORDER_CATEGORIES = CONSTANTS.ORDER_CATEGORIES;
window.CATEGORY_ICONS = CONSTANTS.CATEGORY_ICONS;
window.CITIES = CONSTANTS.CITIES;
window.COLORS = CONSTANTS.COLORS;
window.ADMIN_UID = CONSTANTS.ADMIN_UID;
window.PORTFOLIO_CATEGORIES = CONSTANTS.PORTFOLIO_CATEGORIES;  // ← НОВОЕ
window.CONSTANTS = CONSTANTS;