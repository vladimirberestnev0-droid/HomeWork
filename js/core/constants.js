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

// ID администратора
const ADMIN_UID = "dUUNkDJbXmN3efOr3JPKOyBrc8M2";

// Категории заказов (РАСШИРЕННЫЙ СПИСОК)
const ORDER_CATEGORIES = [
    { id: 'all', name: 'Все', icon: 'fa-list-ul' },
    { id: 'Сантехника', name: 'Сантехника', icon: 'fa-wrench' },
    { id: 'Электрика', name: 'Электрика', icon: 'fa-bolt' },
    { id: 'Отделочные работы', name: 'Отделочные работы', icon: 'fa-paint-roller' },
    { id: 'Мебель', name: 'Мебель', icon: 'fa-couch' },
    { id: 'Окна и двери', name: 'Окна и двери', icon: 'fa-window-maximize' },
    { id: 'Бытовой ремонт', name: 'Бытовой ремонт', icon: 'fa-tools' },
    { id: 'Клининг', name: 'Клининг', icon: 'fa-broom' },
    { id: 'Ремонт техники', name: 'Ремонт техники', icon: 'fa-gear' },
    { id: 'Дизайн интерьера', name: 'Дизайн интерьера', icon: 'fa-pencil-ruler' },
    { id: 'Ландшафтный дизайн', name: 'Ландшафтный дизайн', icon: 'fa-tree' },
    { id: 'Архитектор', name: 'Архитектор', icon: 'fa-draw-polygon' },
    { id: '3D-визуализация', name: '3D-визуализация', icon: 'fa-cubes' },
    { id: 'Декорирование', name: 'Декорирование', icon: 'fa-palette' },
    { id: 'Ремонт под ключ', name: 'Ремонт под ключ', icon: 'fa-key' },
    { id: 'Сварочные работы', name: 'Сварочные работы', icon: 'fa-welding' },
    { id: 'Кровельные работы', name: 'Кровельные работы', icon: 'fa-home' },
    { id: 'Фундаментные работы', name: 'Фундаментные работы', icon: 'fa-hard-hat' },
    { id: 'Бетонные работы', name: 'Бетонные работы', icon: 'fa-trowel' },
    { id: 'Укладка плитки', name: 'Укладка плитки', icon: 'fa-border-all' },
    { id: 'Паркетные работы', name: 'Паркетные работы', icon: 'fa-wood' },
    { id: 'Потолки', name: 'Потолки', icon: 'fa-arrow-up' },
    { id: 'Гипсокартонные работы', name: 'Гипсокартон', icon: 'fa-layer-group' },
    { id: 'Малярные работы', name: 'Малярные работы', icon: 'fa-paint-brush' },
    { id: 'Штукатурные работы', name: 'Штукатурка', icon: 'fa-brush' },
    { id: 'Утепление', name: 'Утепление', icon: 'fa-temperature-low' },
    { id: 'Вентиляция', name: 'Вентиляция', icon: 'fa-wind' },
    { id: 'Отопление', name: 'Отопление', icon: 'fa-radiator' },
    { id: 'Водоснабжение', name: 'Водоснабжение', icon: 'fa-water' },
    { id: 'Канализация', name: 'Канализация', icon: 'fa-poop' },
    { id: 'Мелкий ремонт', name: 'Мелкий ремонт', icon: 'fa-screwdriver' },
    { id: 'Сборка мебели', name: 'Сборка мебели', icon: 'fa-chair' },
    { id: 'Компьютерная помощь', name: 'Компьютерная помощь', icon: 'fa-laptop' },
    { id: 'Услуги грузчиков', name: 'Грузчики', icon: 'fa-people-carry' },
    { id: 'Вывоз мусора', name: 'Вывоз мусора', icon: 'fa-trash' },
    { id: 'Уборка снега', name: 'Уборка снега', icon: 'fa-snowplow' },
    { id: 'Разнорабочий', name: 'Разнорабочий', icon: 'fa-hard-hat' }
];

// Иконки для категорий (для быстрого доступа)
const CATEGORY_ICONS = ORDER_CATEGORIES.reduce((acc, cat) => {
    if (cat.id !== 'all') acc[cat.id] = cat.icon;
    return acc;
}, {});

// Города (для фильтра)
const CITIES = [
    { id: 'all', name: 'Все города' },
    { id: 'nyagan', name: 'Нягань' },
    { id: 'surgut', name: 'Сургут' },
    { id: 'khanty-mansiysk', name: 'Ханты-Мансийск' },
    { id: 'nefteyugansk', name: 'Нефтеюганск' },
    { id: 'nizhnevartovsk', name: 'Нижневартовск' }
];

// Цвета для уведомлений
const COLORS = {
    accent: '#E67A4B',
    success: '#00A86B',
    warning: '#FFB020',
    danger: '#DC3545',
    info: '#17a2b8'
};

// Экспорт в глобальную область
window.USER_ROLE = USER_ROLE;
window.ORDER_STATUS = ORDER_STATUS;
window.ADMIN_UID = ADMIN_UID;
window.ORDER_CATEGORIES = ORDER_CATEGORIES;
window.CATEGORY_ICONS = CATEGORY_ICONS;
window.CITIES = CITIES;
window.COLORS = COLORS;

console.log('✅ Constants loaded');