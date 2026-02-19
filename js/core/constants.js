// ===== js/core/constants.js =====
// Глобальные константы проекта

// Роли пользователей
const USER_ROLE = {
    CLIENT: 'client',
    MASTER: 'master',
    ADMIN: 'admin'
};

// Статусы заказов
const ORDER_STATUS = {
    OPEN: 'open',
    IN_PROGRESS: 'in_progress',
    COMPLETED: 'completed'
};

// Настройки пагинации
const PAGINATION = {
    ORDERS_PER_PAGE: 20,
    MASTERS_PER_PAGE: 10,
    MESSAGES_PER_PAGE: 50,
    RESPONSES_PER_PAGE: 20
};

// ID администратора
const ADMIN_UID = "dUUNkDJbXmN3efOr3JPKOyBrc8M2";

// Цвета для уведомлений и тем
const COLORS = {
    accent: '#E67A4B',
    success: '#00A86B',
    warning: '#FFB020',
    danger: '#DC3545',
    info: '#0984e3'
};

// Категории заказов
const ORDER_CATEGORIES = [
    'Сантехника',
    'Электрика',
    'Отделочные работы',
    'Мебель',
    'Окна и двери',
    'Бытовой ремонт',
    'Клининг',
    'Ремонт техники'
];

// Иконки для категорий
const CATEGORY_ICONS = {
    'Сантехника': 'fa-wrench',
    'Электрика': 'fa-bolt',
    'Отделочные работы': 'fa-paint-roller',
    'Мебель': 'fa-couch',
    'Окна и двери': 'fa-window-maximize',
    'Бытовой ремонт': 'fa-tools',
    'Клининг': 'fa-broom',
    'Ремонт техники': 'fa-gear'
};

// Экспортируем всё в глобальную область
window.USER_ROLE = USER_ROLE;
window.ORDER_STATUS = ORDER_STATUS;
window.PAGINATION = PAGINATION;
window.ADMIN_UID = ADMIN_UID;
window.COLORS = COLORS;
window.ORDER_CATEGORIES = ORDER_CATEGORIES;
window.CATEGORY_ICONS = CATEGORY_ICONS;

console.log('✅ Constants loaded');