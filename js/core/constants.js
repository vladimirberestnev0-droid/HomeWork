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

// Настройки файлов
const FILE_LIMITS = {
    MAX_SIZE: 10 * 1024 * 1024, // 10MB
    MAX_PHOTOS_PER_ORDER: 5,
    ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
};

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

// Цвета для бейджей статусов
const STATUS_COLORS = {
    'open': { bg: '#F9E2D9', text: '#E67A4B' },
    'in_progress': { bg: '#E3F2FD', text: '#0984e3' },
    'completed': { bg: '#E3F2E9', text: '#00A86B' }
};

// Настройки кэширования
const CACHE_CONFIG = {
    ORDERS_TTL: 5 * 60 * 1000, // 5 минут
    USERS_TTL: 10 * 60 * 1000, // 10 минут
    CHATS_TTL: 30 * 1000 // 30 секунд
};

// Экспортируем всё в глобальную область
window.USER_ROLE = USER_ROLE;
window.ORDER_STATUS = ORDER_STATUS;
window.PAGINATION = PAGINATION;
window.ADMIN_UID = ADMIN_UID;
window.COLORS = COLORS;
window.ORDER_CATEGORIES = ORDER_CATEGORIES;
window.FILE_LIMITS = FILE_LIMITS;
window.CATEGORY_ICONS = CATEGORY_ICONS;
window.STATUS_COLORS = STATUS_COLORS;
window.CACHE_CONFIG = CACHE_CONFIG;