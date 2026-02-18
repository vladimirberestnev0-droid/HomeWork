// ===== UTILS.JS — ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =====

/**
 * Экранирование HTML для защиты от XSS
 * @param {string} text - Входной текст
 * @returns {string} - Безопасный текст
 */
function escapeHtml(text) {
    if (!text) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

/**
 * Форматирование даты
 * @param {Timestamp} timestamp - Firestore Timestamp
 * @returns {string} - Отформатированная дата
 */
function formatDate(timestamp) {
    if (!timestamp) return 'только что';
    
    try {
        const date = timestamp.toDate();
        const now = new Date();
        const diff = now - date;
        
        if (diff < 60000) return 'только что';
        if (diff < 3600000) return Math.floor(diff/60000) + ' мин назад';
        if (diff < 86400000) return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) + 
               ', ' + date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
        return 'недавно';
    }
}

/**
 * Показ уведомления
 * @param {string} message - Текст уведомления
 * @param {string} type - Тип (success, error, warning, info)
 */
function showNotification(message, type = 'info') {
    const colors = {
        success: 'var(--success)',
        error: '#DC3545',
        warning: 'var(--warning)',
        info: 'var(--accent)'
    };
    
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.style.borderLeftColor = colors[type] || colors.info;
    
    let icon = 'fa-bell';
    if (type === 'success') icon = 'fa-check-circle';
    if (type === 'error') icon = 'fa-exclamation-circle';
    if (type === 'warning') icon = 'fa-exclamation-triangle';
    
    notification.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px;">
            <i class="fas ${icon}" style="color: ${colors[type] || colors.info};"></i>
            <span>${escapeHtml(message)}</span>
        </div>
    `;
    
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
}

/**
 * Показ ошибки пользователю
 * @param {string} message - Текст ошибки
 * @param {Error} error - Объект ошибки (для консоли)
 */
function showError(message, error = null) {
    if (error) console.error(error);
    showNotification(message, 'error');
}

/**
 * Валидация цены
 * @param {number} price - Цена
 * @returns {boolean} - Валидна ли
 */
function validatePrice(price) {
    return price && !isNaN(price) && price >= 500 && price <= 1000000;
}

/**
 * Валидация телефона
 * @param {string} phone - Телефон
 * @returns {boolean} - Валиден ли
 */
function validatePhone(phone) {
    const phoneRegex = /^(\+7|8)[\s(]?(\d{3})[\s)]?[\s-]?(\d{3})[\s-]?(\d{2})[\s-]?(\d{2})$/;
    return phoneRegex.test(phone);
}

/**
 * Валидация email
 * @param {string} email - Email
 * @returns {boolean} - Валиден ли
 */
function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Получение иконки для категории
 * @param {string} category - Категория
 * @returns {string} - Класс иконки
 */
function getCategoryIcon(category) {
    const icons = {
        'Сантехника': 'fa-wrench',
        'Электрика': 'fa-bolt',
        'Отделочные работы': 'fa-paint-roller',
        'Мебель': 'fa-couch',
        'Окна и двери': 'fa-window-maximize',
        'Бытовой ремонт': 'fa-tools',
        'Клининг': 'fa-broom',
        'Ремонт техники': 'fa-gear'
    };
    return icons[category] || 'fa-tag';
}

/**
 * Склонение слов
 * @param {number} count - Число
 * @param {string[]} words - Массив слов [1, 2, 5]
 * @returns {string} - Правильное склонение
 */
function pluralize(count, words) {
    const cases = [2, 0, 1, 1, 1, 2];
    return words[(count % 100 > 4 && count % 100 < 20) ? 2 : cases[Math.min(count % 10, 5)]];
}

/**
 * Задержка (для тестов)
 * @param {number} ms - Миллисекунд
 * @returns {Promise} - Промис
 */
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Копирование в буфер обмена
 * @param {string} text - Текст
 */
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showNotification('✅ Скопировано!', 'success');
    }).catch(() => {
        showNotification('❌ Ошибка копирования', 'error');
    });
}

/**
 * Сохранение в localStorage с проверкой
 * @param {string} key - Ключ
 * @param {any} value - Значение
 */
function setStorage(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
        console.error('Ошибка сохранения в localStorage:', e);
    }
}

/**
 * Чтение из localStorage
 * @param {string} key - Ключ
 * @param {any} defaultValue - Значение по умолчанию
 * @returns {any} - Значение
 */
function getStorage(key, defaultValue = null) {
    try {
        const value = localStorage.getItem(key);
        return value ? JSON.parse(value) : defaultValue;
    } catch (e) {
        console.error('Ошибка чтения из localStorage:', e);
        return defaultValue;
    }
}

// Экспортируем все функции в глобальную область
window.Utils = {
    escapeHtml,
    formatDate,
    showNotification,
    showError,
    validatePrice,
    validatePhone,
    validateEmail,
    getCategoryIcon,
    pluralize,
    delay,
    copyToClipboard,
    setStorage,
    getStorage
};