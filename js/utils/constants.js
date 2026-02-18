// ===== js/utils/constants.js =====
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

// Экспортируем всё в глобальную область
window.USER_ROLE = USER_ROLE;
window.ORDER_STATUS = ORDER_STATUS;
window.PAGINATION = PAGINATION;
window.ADMIN_UID = ADMIN_UID;
window.COLORS = COLORS;
window.ORDER_CATEGORIES = ORDER_CATEGORIES;
window.FILE_LIMITS = FILE_LIMITS;