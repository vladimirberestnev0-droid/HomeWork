// ===== js/core/constants.js =====
// Глобальные константы проекта (БЕЗ городов!)

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
    RESPONSES_PER_PAGE: 20,
    ORDERS_INITIAL: 7,
    ORDERS_LOAD_MORE: 5
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

// Категории заказов с иконками
const ORDER_CATEGORIES = [
    { id: 'all', name: 'Все', icon: 'fa-list-ul' },
    { id: 'Сантехника', name: 'Сантехника', icon: 'fa-wrench' },
    { id: 'Электрика', name: 'Электрика', icon: 'fa-bolt' },
    { id: 'Отделочные работы', name: 'Отделочные работы', icon: 'fa-paint-roller' },
    { id: 'Мебель', name: 'Мебель', icon: 'fa-couch' },
    { id: 'Окна и двери', name: 'Окна и двери', icon: 'fa-window-maximize' },
    { id: 'Бытовой ремонт', name: 'Бытовой ремонт', icon: 'fa-tools' },
    { id: 'Клининг', name: 'Клининг', icon: 'fa-broom' },
    { id: 'Ремонт техники', name: 'Ремонт техники', icon: 'fa-gear' }
];

// Иконки для категорий (для обратной совместимости)
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

// ===== ГОРОДА БОЛЬШЕ НЕ ЗДЕСЬ! =====
// Города загружаются динамически из /HomeWork/config/cities.json

// Функция для загрузки городов
async function loadCities() {
    try {
        const response = await fetch('/HomeWork/config/cities.json');
        if (!response.ok) throw new Error('Failed to load cities');
        const data = await response.json();
        window.CITIES = data.CITIES;
        window.CITIES_BY_DISTRICT = data.CITIES_BY_DISTRICT;
        window.SORTED_CITIES_BY_DISTRICT = data.SORTED_CITIES_BY_DISTRICT;
        console.log(`🏙️ Загружено населенных пунктов: ${window.CITIES?.length || 0}`);
        
        // Инициируем событие для тех, кто ждет загрузки городов
        window.dispatchEvent(new CustomEvent('cities-loaded'));
        
        return data;
    } catch (error) {
        console.error('❌ Ошибка загрузки городов:', error);
        return null;
    }
}

// Экспортируем в глобальную область
window.USER_ROLE = USER_ROLE;
window.ORDER_STATUS = ORDER_STATUS;
window.PAGINATION = PAGINATION;
window.ADMIN_UID = ADMIN_UID;
window.COLORS = COLORS;
window.ORDER_CATEGORIES = ORDER_CATEGORIES;
window.CATEGORY_ICONS = CATEGORY_ICONS;
window.loadCities = loadCities;

console.log('✅ Constants loaded (без городов)');