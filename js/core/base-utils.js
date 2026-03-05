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
    const memoryCache = new Map();
    const clickPreventionMap = new Map();

    // ===== ПРОВЕРКИ FIREBASE =====
    function checkFirebase() {
        return typeof window.db !== 'undefined' && 
               window.db !== null && 
               typeof window.auth !== 'undefined' && 
               window.auth !== null;
    }

    function checkFirestore() {
        return checkFirebase();
    }

    // ===== ПРОВЕРКА ОНЛАЙН =====
    function isOnline() {
        return navigator.onLine;
    }

    function requireOnline(message = 'Требуется подключение к интернету') {
        if (!isOnline()) {
            showWarning(message);
            return false;
        }
        return true;
    }

    // ===== ЗАЩИТА ОТ ДВОЙНОГО КЛИКА =====
    function preventDoubleClick(button, callback, delay = 1000) {
        if (!button) return;
        
        const now = Date.now();
        const lastClick = clickPreventionMap.get(button) || 0;
        
        if (now - lastClick < delay) {
            console.log('⏳ Защита от двойного клика');
            return;
        }
        
        clickPreventionMap.set(button, now);
        
        // Очищаем через delay
        setTimeout(() => {
            clickPreventionMap.delete(button);
        }, delay);
        
        // Вызываем колбэк
        if (typeof callback === 'function') {
            callback();
        }
    }

    // ===== DEBOUNCE =====
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

    // ===== THROTTLE =====
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

    // ===== РАБОТА С URL =====
    function navigateTo(url, text = 'Переходим...') {
        if (!isOnline()) {
            showWarning('Нет подключения к интернету');
            return;
        }
        
        if (window.Loader) {
            Loader.navigateTo(url, text);
        } else {
            window.location.href = url;
        }
    }

    function getFullUrl(path) {
        if (path.startsWith('http')) return path;
        const base = CONFIG?.getBasePath?.() || '/HomeWork/';
        return base + path.replace(/^\//, '');
    }

    // ===== КЭШИРОВАНИЕ =====
    function setMemoryCache(key, data, ttl = 300000) {
        memoryCache.set(key, {
            data,
            timestamp: Date.now(),
            ttl
        });
        
        setTimeout(() => {
            if (memoryCache.has(key)) {
                const item = memoryCache.get(key);
                if (Date.now() - item.timestamp >= item.ttl) {
                    memoryCache.delete(key);
                }
            }
        }, ttl);
    }

    function getMemoryCache(key) {
        const cached = memoryCache.get(key);
        if (!cached) return null;
        
        if (Date.now() - cached.timestamp > cached.ttl) {
            memoryCache.delete(key);
            return null;
        }
        
        return cached.data;
    }

    function removeMemoryCache(key) {
        memoryCache.delete(key);
    }

    function clearMemoryCache() {
        memoryCache.clear();
    }

    function setPersistentCache(key, data, ttl = 3600000) {
        try {
            if (!isOnline()) return false;
            
            const item = {
                data,
                timestamp: Date.now(),
                ttl
            };
            localStorage.setItem(`cache_${key}`, JSON.stringify(item));
            return true;
        } catch (e) {
            console.warn('⚠️ Ошибка сохранения в localStorage:', e);
            return false;
        }
    }

    function getPersistentCache(key) {
        try {
            const item = localStorage.getItem(`cache_${key}`);
            if (!item) return null;
            
            const { data, timestamp, ttl } = JSON.parse(item);
            if (Date.now() - timestamp > ttl) {
                localStorage.removeItem(`cache_${key}`);
                return null;
            }
            
            return data;
        } catch (e) {
            console.warn('⚠️ Ошибка чтения из localStorage:', e);
            return null;
        }
    }

    function removePersistentCache(key) {
        localStorage.removeItem(`cache_${key}`);
    }

    function clearPersistentCache() {
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith('cache_')) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));
    }

    // ===== БЕЗОПАСНОСТЬ =====
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

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
    function validateEmail(email) {
        if (!email) return false;
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(String(email).toLowerCase());
    }

    function validatePhone(phone) {
        if (!phone) return true;
        const re = /^(\+7|8)[\s(]?(\d{3})[\s)]?[\s-]?(\d{3})[\s-]?(\d{2})[\s-]?(\d{2})$/;
        return re.test(String(phone).replace(/\s+/g, ''));
    }

    function validatePrice(price) {
        if (!price && price !== 0) return false;
        const num = Number(price);
        return !isNaN(num) && num >= 500 && num <= 1000000;
    }

    function validateName(name) {
        if (!name) return false;
        return name.length >= 2 && name.length <= 50;
    }

    function validatePassword(password) {
        if (!password) return false;
        return password.length >= 6;
    }

    // ===== РАБОТА С ДАТАМИ =====
    function safeGetDate(timestamp) {
        if (!timestamp) return new Date();
        
        try {
            if (timestamp?.toDate) {
                return timestamp.toDate();
            }
            if (timestamp instanceof Date) {
                return timestamp;
            }
            const date = new Date(timestamp);
            return isNaN(date.getTime()) ? new Date() : date;
        } catch (e) {
            console.warn('Ошибка преобразования даты:', e);
            return new Date();
        }
    }

    function formatDate(timestamp, format = 'short') {
        const date = safeGetDate(timestamp);
        const now = new Date();
        const diff = now - date;
        const isToday = date.toDateString() === now.toDateString();
        const isYesterday = date.toDateString() === new Date(now - 86400000).toDateString();

        if (diff < 60000) return 'только что';
        
        if (diff < 3600000) {
            const minutes = Math.floor(diff / 60000);
            return `${minutes} ${pluralize(minutes, ['минута', 'минуты', 'минут'])} назад`;
        }
        
        if (isToday) {
            return date.toLocaleTimeString('ru-RU', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
        }
        
        if (isYesterday) {
            return 'вчера ' + date.toLocaleTimeString('ru-RU', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
        }
        
        if (format === 'short') {
            return date.toLocaleDateString('ru-RU', { 
                day: 'numeric', 
                month: 'short' 
            });
        }
        
        return date.toLocaleString('ru-RU', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

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

    function pluralize(count, words) {
        const cases = [2, 0, 1, 1, 1, 2];
        return words[
            (count % 100 > 4 && count % 100 < 20) ? 2 : 
            cases[Math.min(count % 10, 5)]
        ];
    }

    function truncate(text, length = 100, suffix = '...') {
        if (!text) return '';
        if (text.length <= length) return text;
        return text.substring(0, length).trim() + suffix;
    }

    function formatPhone(phone) {
        if (!phone) return '';
        
        const cleaned = String(phone).replace(/\D/g, '');
        
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
    function getCategoryIcon(category) {
        const cat = window.ORDER_CATEGORIES?.find(c => c.id === category);
        return cat?.icon || 'fa-tag';
    }

    function getCategoryColor(category) {
        const cat = window.ORDER_CATEGORIES?.find(c => c.id === category);
        return cat?.color || '#2CD5C4';
    }

    function getCategoryName(category) {
        const cat = window.ORDER_CATEGORIES?.find(c => c.id === category);
        return cat?.name || category || 'Услуга';
    }

    // ===== РАБОТА С АДРЕСАМИ =====
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
    function showNotification(message, type = 'info', duration = 5000) {
        const config = {
            success: { color: '#00A86B', icon: 'fa-check-circle', bg: 'rgba(0, 168, 107, 0.1)' },
            error: { color: '#DC3545', icon: 'fa-exclamation-circle', bg: 'rgba(220, 53, 69, 0.1)' },
            warning: { color: '#FFB020', icon: 'fa-exclamation-triangle', bg: 'rgba(255, 176, 32, 0.1)' },
            info: { color: '#2CD5C4', icon: 'fa-bell', bg: 'rgba(44, 213, 196, 0.1)' }
        };

        const cfg = config[type] || config.info;

        if (!window._notificationContainer) {
            window._notificationContainer = document.createElement('div');
            window._notificationContainer.className = 'notification-container';
            document.body.appendChild(window._notificationContainer);
        }

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

        const timeout = setTimeout(() => {
            if (toast.parentNode) {
                toast.style.animation = 'notificationSlideOut 0.3s ease';
                setTimeout(() => toast.remove(), 300);
            }
        }, duration);

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

    function showError(message, error = null) {
        if (error) console.error(error);
        showNotification(message, 'error');
    }

    function showSuccess(message) {
        showNotification(message, 'success');
    }

    function showWarning(message) {
        showNotification(message, 'warning');
    }

    function showInfo(message) {
        showNotification(message, 'info');
    }

    // ===== ПРОВЕРКИ =====
    function checkAuth() {
        return !!(window.Auth && Auth.getUser && Auth.getUser());
    }

    // ===== РАБОТА С ХРАНИЛИЩЕМ =====
    function setStorage(key, value, ttl = null) {
        return setPersistentCache(key, value, ttl || 3600000);
    }

    function getStorage(key, defaultValue = null) {
        const value = getPersistentCache(key);
        return value !== null ? value : defaultValue;
    }

    function removeStorage(key) {
        removePersistentCache(key);
    }

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
    function generateId(prefix = '') {
        return prefix + Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
    }

    function getSessionId() {
        let sessionId = sessionStorage.getItem('session_id');
        if (!sessionId) {
            sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            sessionStorage.setItem('session_id', sessionId);
        }
        return sessionId;
    }

    // ===== КОПИРОВАНИЕ =====
    function copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            showSuccess('Скопировано!');
        }).catch(() => {
            showError('Ошибка копирования');
        });
    }

    // ===== ЗАДЕРЖКА =====
    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // ===== БЕЗОПАСНАЯ ПЕРЕЗАГРУЗКА =====
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
    function $(selector, context = document) {
        return context.querySelector(selector);
    }

    function $$(selector, context = document) {
        return Array.from(context.querySelectorAll(selector));
    }

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

    // ===== ПУБЛИЧНОЕ API =====
    const utils = {
        // Проверки
        checkFirebase,
        checkFirestore,
        isOnline,
        requireOnline,
        
        // Защита от двойного клика
        preventDoubleClick,
        
        // Кэширование
        setMemoryCache,
        getMemoryCache,
        removeMemoryCache,
        clearMemoryCache,
        setPersistentCache,
        getPersistentCache,
        removePersistentCache,
        clearPersistentCache,
        
        // Навигация
        navigateTo,
        getFullUrl,
        
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
    console.log('✅ Utils загружены (с debounce и offline обработкой)');
    
    return Object.freeze(utils);
})();

// Глобальный доступ
window.Utils = Utils;
window.$ = Utils.$;
window.$$ = Utils.$$;