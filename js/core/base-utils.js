// ============================================
// УНИВЕРСАЛЬНЫЕ УТИЛИТЫ
// ============================================

const Utils = (function() {
    // Защита от повторных инициализаций
    if (window.__UTILS_INITIALIZED__) {
        return window.Utils;
    }

    // ===== ПРИВАТНЫЕ ПЕРЕМЕННЫЕ =====
    let notificationContainer = null;

    // ===== БЕЗОПАСНОСТЬ =====
    
    /**
     * Экранирование HTML
     */
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Экранирование для атрибутов
     */
    function escapeAttr(text) {
        if (!text) return '';
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    // ===== ВАЛИДАЦИЯ =====

    /**
     * Валидация email
     */
    function validateEmail(email) {
        if (!email) return false;
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(String(email).toLowerCase());
    }

    /**
     * Валидация телефона (Россия)
     */
    function validatePhone(phone) {
        if (!phone) return true; // Необязательное поле
        const re = /^(\+7|8)[\s(]?(\d{3})[\s)]?[\s-]?(\d{3})[\s-]?(\d{2})[\s-]?(\d{2})$/;
        return re.test(String(phone).replace(/\s+/g, ''));
    }

    /**
     * Валидация цены
     */
    function validatePrice(price) {
        if (!price && price !== 0) return false;
        const num = Number(price);
        return !isNaN(num) && num >= 500 && num <= 1000000;
    }

    /**
     * Валидация имени
     */
    function validateName(name) {
        if (!name) return false;
        return name.length >= 2 && name.length <= 50;
    }

    /**
     * Валидация пароля
     */
    function validatePassword(password) {
        if (!password) return false;
        return password.length >= 6;
    }

    // ===== РАБОТА С ДАТАМИ =====

    /**
     * Безопасное получение даты
     */
    function safeGetDate(timestamp) {
        if (!timestamp) return new Date();
        
        try {
            // Firestore Timestamp
            if (timestamp?.toDate) {
                return timestamp.toDate();
            }
            // Date объект
            if (timestamp instanceof Date) {
                return timestamp;
            }
            // Строка или число
            const date = new Date(timestamp);
            return isNaN(date.getTime()) ? new Date() : date;
        } catch (e) {
            console.warn('Ошибка преобразования даты:', e);
            return new Date();
        }
    }

    /**
     * Форматирование даты
     */
    function formatDate(timestamp, format = 'short') {
        const date = safeGetDate(timestamp);
        const now = new Date();
        const diff = now - date;
        const isToday = date.toDateString() === now.toDateString();
        const isYesterday = date.toDateString() === new Date(now - 86400000).toDateString();

        // Только что
        if (diff < 60000) return 'только что';
        
        // Минуты назад
        if (diff < 3600000) {
            const minutes = Math.floor(diff / 60000);
            return `${minutes} ${pluralize(minutes, ['минута', 'минуты', 'минут'])} назад`;
        }
        
        // Сегодня
        if (isToday) {
            return date.toLocaleTimeString('ru-RU', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
        }
        
        // Вчера
        if (isYesterday) {
            return 'вчера ' + date.toLocaleTimeString('ru-RU', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
        }
        
        // Короткий формат
        if (format === 'short') {
            return date.toLocaleDateString('ru-RU', { 
                day: 'numeric', 
                month: 'short' 
            });
        }
        
        // Полный формат
        return date.toLocaleString('ru-RU', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    /**
     * Получить возраст (для отзывов)
     */
    function getTimeAgo(timestamp) {
        const date = safeGetDate(timestamp);
        const now = new Date();
        const diff = now - date;
        
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        const months = Math.floor(days / 30);
        const years = Math.floor(months / 12);
        
        if (years > 0) return `${years} ${pluralize(years, ['год', 'года', 'лет'])} назад`;
        if (months > 0) return `${months} ${pluralize(months, ['месяц', 'месяца', 'месяцев'])} назад`;
        if (days > 0) return `${days} ${pluralize(days, ['день', 'дня', 'дней'])} назад`;
        if (hours > 0) return `${hours} ${pluralize(hours, ['час', 'часа', 'часов'])} назад`;
        if (minutes > 0) return `${minutes} ${pluralize(minutes, ['минута', 'минуты', 'минут'])} назад`;
        return 'только что';
    }

    // ===== ФОРМАТИРОВАНИЕ =====

    /**
     * Форматирование денег
     */
    function formatMoney(amount) {
        if (amount === undefined || amount === null) return '0 ₽';
        
        try {
            return new Intl.NumberFormat('ru-RU', {
                style: 'currency',
                currency: 'RUB',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
            }).format(amount);
        } catch (e) {
            return `${amount} ₽`;
        }
    }

    /**
     * Плюрализация
     */
    function pluralize(count, words) {
        const cases = [2, 0, 1, 1, 1, 2];
        return words[
            (count % 100 > 4 && count % 100 < 20) ? 2 : 
            cases[Math.min(count % 10, 5)]
        ];
    }

    /**
     * Обрезка текста
     */
    function truncate(text, length = 100, suffix = '...') {
        if (!text) return '';
        if (text.length <= length) return text;
        return text.substring(0, length).trim() + suffix;
    }

    /**
     * Номер телефона в красивый формат
     */
    function formatPhone(phone) {
        if (!phone) return '';
        
        // Очищаем от всего кроме цифр
        const cleaned = String(phone).replace(/\D/g, '');
        
        // Проверяем длину
        if (cleaned.length === 11) {
            if (cleaned.startsWith('8')) {
                return `8 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7, 9)}-${cleaned.slice(9, 11)}`;
            }
            if (cleaned.startsWith('7')) {
                return `+7 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7, 9)}-${cleaned.slice(9, 11)}`;
            }
        }
        
        return phone;
    }

    // ===== РАБОТА С КАТЕГОРИЯМИ =====

    /**
     * Получение иконки категории
     */
    function getCategoryIcon(category) {
        const cat = window.ORDER_CATEGORIES?.find(c => c.id === category);
        return cat?.icon || 'fa-tag';
    }

    /**
     * Получение цвета категории
     */
    function getCategoryColor(category) {
        const cat = window.ORDER_CATEGORIES?.find(c => c.id === category);
        return cat?.color || '#2CD5C4';
    }

    /**
     * Получение названия категории
     */
    function getCategoryName(category) {
        const cat = window.ORDER_CATEGORIES?.find(c => c.id === category);
        return cat?.name || category || 'Услуга';
    }

    // ===== РАБОТА С АДРЕСАМИ =====

    /**
     * Извлечение города из адреса
     */
    function extractCity(address) {
        if (!address) return 'другой';
        
        const addressLower = address.toLowerCase();
        const cities = window.CITIES || [];
        
        for (const city of cities) {
            if (city.id !== 'all' && addressLower.includes(city.name.toLowerCase())) {
                return city.name.toLowerCase();
            }
        }
        
        return 'другой';
    }

    // ===== УВЕДОМЛЕНИЯ =====

    /**
     * Показать уведомление
     */
    function showNotification(message, type = 'info', duration = 5000) {
        // Цвета и иконки
        const config = {
            success: { color: '#00A86B', icon: 'fa-check-circle', bg: 'rgba(0, 168, 107, 0.1)' },
            error: { color: '#DC3545', icon: 'fa-exclamation-circle', bg: 'rgba(220, 53, 69, 0.1)' },
            warning: { color: '#FFB020', icon: 'fa-exclamation-triangle', bg: 'rgba(255, 176, 32, 0.1)' },
            info: { color: '#2CD5C4', icon: 'fa-bell', bg: 'rgba(44, 213, 196, 0.1)' }
        };

        const cfg = config[type] || config.info;

        // Создаём контейнер если нет
        if (!window._notificationContainer) {
            window._notificationContainer = document.createElement('div');
            window._notificationContainer.className = 'notification-container';
            document.body.appendChild(window._notificationContainer);
        }

        // Создаём уведомление
        const toast = document.createElement('div');
        toast.className = `notification-toast ${type}`;
        
        toast.innerHTML = `
            <div class="notification-icon ${type}">
                <i class="fas ${cfg.icon}"></i>
            </div>
            <div class="notification-message">${escapeHtml(message)}</div>
            <button class="notification-close" onclick="this.parentElement.remove()">×</button>
        `;

        window._notificationContainer.appendChild(toast);

        // Автоудаление
        const timeout = setTimeout(() => {
            if (toast.parentNode) {
                toast.style.animation = 'notificationSlideOut 0.3s ease';
                setTimeout(() => toast.remove(), 300);
            }
        }, duration);

        // При наведении не удаляем
        toast.addEventListener('mouseenter', () => clearTimeout(timeout));
        toast.addEventListener('mouseleave', () => {
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.style.animation = 'notificationSlideOut 0.3s ease';
                    setTimeout(() => toast.remove(), 300);
                }
            }, duration);
        });

        return toast;
    }

    /**
     * Показать ошибку
     */
    function showError(message, error = null) {
        if (error) console.error(error);
        showNotification(message, 'error');
    }

    /**
     * Показать успех
     */
    function showSuccess(message) {
        showNotification(message, 'success');
    }

    /**
     * Показать предупреждение
     */
    function showWarning(message) {
        showNotification(message, 'warning');
    }

    /**
     * Показать информацию
     */
    function showInfo(message) {
        showNotification(message, 'info');
    }

    // ===== ПРОВЕРКИ =====

    /**
     * Проверка инициализации Firestore
     */
    function checkFirestore() {
        if (typeof window.db === 'undefined' || !window.db) {
            console.warn('⏳ Firestore не инициализирован');
            return false;
        }
        return true;
    }

    /**
     * Проверка авторизации
     */
    function checkAuth() {
        return !!(window.Auth && Auth.getUser && Auth.getUser());
    }

    // ===== РАБОТА С ХРАНИЛИЩЕМ =====

    /**
     * Сохранение в localStorage с TTL
     */
    function setStorage(key, value, ttl = null) {
        try {
            const item = {
                value,
                timestamp: Date.now(),
                ttl
            };
            localStorage.setItem(key, JSON.stringify(item));
            return true;
        } catch (e) {
            console.error('Ошибка сохранения:', e);
            return false;
        }
    }

    /**
     * Чтение из localStorage
     */
    function getStorage(key, defaultValue = null) {
        try {
            const item = JSON.parse(localStorage.getItem(key));
            if (!item) return defaultValue;

            if (item.ttl && (Date.now() - item.timestamp > item.ttl)) {
                localStorage.removeItem(key);
                return defaultValue;
            }

            return item.value;
        } catch (e) {
            console.error('Ошибка чтения:', e);
            return defaultValue;
        }
    }

    /**
     * Удаление из localStorage
     */
    function removeStorage(key) {
        localStorage.removeItem(key);
    }

    /**
     * Сессионное хранилище
     */
    function setSession(key, value) {
        try {
            sessionStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (e) {
            return false;
        }
    }

    function getSession(key, defaultValue = null) {
        try {
            const value = sessionStorage.getItem(key);
            return value ? JSON.parse(value) : defaultValue;
        } catch (e) {
            return defaultValue;
        }
    }

    // ===== ГЕНЕРАЦИЯ =====

    /**
     * Генерация ID
     */
    function generateId(prefix = '') {
        return prefix + Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
    }

    /**
     * Получение ID сессии
     */
    function getSessionId() {
        let sessionId = sessionStorage.getItem('session_id');
        if (!sessionId) {
            sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            sessionStorage.setItem('session_id', sessionId);
        }
        return sessionId;
    }

    // ===== ВСПОМОГАТЕЛЬНЫЕ =====
    
    /**
     * Debounce
     */
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    /**
     * Throttle
     */
    function throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    /**
     * Копирование в буфер
     */
    function copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            showSuccess('Скопировано!');
        }).catch(() => {
            showError('Ошибка копирования');
        });
    }

    /**
     * Задержка
     */
    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Безопасная перезагрузка
     */
    function safeReload(maxAttempts = 2) {
        const RELOAD_KEY = 'safe_reload_count';
        let count = parseInt(sessionStorage.getItem(RELOAD_KEY) || '0');
        count++;
        
        if (count <= maxAttempts) {
            sessionStorage.setItem(RELOAD_KEY, count);
            window.location.reload();
        } else {
            sessionStorage.removeItem(RELOAD_KEY);
            showError('Не удалось загрузить страницу. Попробуйте позже.');
        }
    }

    // ===== DOM =====

    /**
     * Безопасный querySelector
     */
    function $(selector, context = document) {
        return context.querySelector(selector);
    }

    /**
     * Безопасный querySelectorAll
     */
    function $$(selector, context = document) {
        return Array.from(context.querySelectorAll(selector));
    }

    /**
     * Создание элемента с классами
     */
    function createElement(tag, classes = [], attributes = {}) {
        const el = document.createElement(tag);
        if (classes.length) el.classList.add(...classes);
        Object.entries(attributes).forEach(([key, value]) => {
            if (key === 'text') el.textContent = value;
            else if (key === 'html') el.innerHTML = value;
            else el.setAttribute(key, value);
        });
        return el;
    }

    // ===== АНИМАЦИИ =====

    /**
     * Добавление стилей анимаций
     */
    function addAnimationStyles() {
        if (document.getElementById('utils-animation-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'utils-animation-styles';
        style.textContent = `
            @keyframes notificationSlideIn {
                from {
                    opacity: 0;
                    transform: translateX(30px);
                }
                to {
                    opacity: 1;
                    transform: translateX(0);
                }
            }
            
            @keyframes notificationSlideOut {
                from {
                    opacity: 1;
                    transform: translateX(0);
                }
                to {
                    opacity: 0;
                    transform: translateX(30px);
                }
            }
            
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            
            @keyframes slideUp {
                from {
                    opacity: 0;
                    transform: translateY(20px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
            
            @keyframes pulse {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.05); }
            }
            
            @keyframes spin {
                to { transform: rotate(360deg); }
            }
            
            .fade-in {
                animation: fadeIn 0.3s ease;
            }
            
            .slide-up {
                animation: slideUp 0.3s ease;
            }
            
            .pulse {
                animation: pulse 2s infinite;
            }
            
            .spinner {
                animation: spin 1s linear infinite;
            }
        `;
        document.head.appendChild(style);
    }

    // Инициализация стилей
    addAnimationStyles();

    // Публичное API
    const utils = {
        // Безопасность
        escapeHtml,
        escapeAttr,
        
        // Валидация
        validateEmail,
        validatePhone,
        validatePrice,
        validateName,
        validatePassword,
        
        // Даты
        safeGetDate,
        formatDate,
        getTimeAgo,
        
        // Форматирование
        formatMoney,
        pluralize,
        truncate,
        formatPhone,
        
        // Категории
        getCategoryIcon,
        getCategoryColor,
        getCategoryName,
        
        // Адреса
        extractCity,
        
        // Уведомления
        showNotification,
        showError,
        showSuccess,
        showWarning,
        showInfo,
        
        // Проверки
        checkFirestore,
        checkAuth,
        
        // Хранилище
        setStorage,
        getStorage,
        removeStorage,
        setSession,
        getSession,
        
        // Генерация
        generateId,
        getSessionId,
        
        // Вспомогательные
        debounce,
        throttle,
        copyToClipboard,
        delay,
        safeReload,
        
        // DOM
        $,
        $$,
        createElement
    };

    window.__UTILS_INITIALIZED__ = true;
    console.log('✅ Utils загружены');
    
    return Object.freeze(utils);
})();

// Глобальный доступ
window.Utils = Utils;
window.$ = Utils.$;
window.$$ = Utils.$$;