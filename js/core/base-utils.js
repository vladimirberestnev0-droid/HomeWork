// ===== js/core/base-utils.js =====
// ЕДИНСТВЕННЫЙ файл с утилитами (helpers.js удалить!)

const Utils = (function() {
    // Приватные переменные
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
     * Валидация email
     */
    function validateEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    /**
     * Валидация телефона (Россия)
     */
    function validatePhone(phone) {
        return /^(\+7|8)[\s(]?(\d{3})[\s)]?[\s-]?(\d{3})[\s-]?(\d{2})[\s-]?(\d{2})$/.test(phone);
    }

    /**
     * Валидация цены
     */
    function validatePrice(price) {
        return price && !isNaN(price) && price >= 500 && price <= 1000000;
    }

    // ===== РАБОТА С ДАТАМИ =====

    /**
     * Безопасное получение даты из Timestamp
     */
    function safeGetDate(timestamp) {
        if (!timestamp) return new Date();
        try {
            if (timestamp.toDate) return timestamp.toDate();
            if (timestamp instanceof Date) return timestamp;
            if (typeof timestamp === 'string') {
                const date = new Date(timestamp);
                return isNaN(date.getTime()) ? new Date() : date;
            }
            if (typeof timestamp === 'number') {
                const date = new Date(timestamp);
                return isNaN(date.getTime()) ? new Date() : date;
            }
            return new Date();
        } catch (e) {
            console.warn('Ошибка преобразования даты:', e);
            return new Date();
        }
    }

    /**
     * Форматирование даты
     */
    function formatDate(timestamp, format = 'full') {
        const date = safeGetDate(timestamp);
        const now = new Date();
        const diff = now - date;

        if (diff < 60000) return 'только что';
        if (diff < 3600000) return Math.floor(diff / 60000) + ' мин назад';
        
        if (format === 'short') {
            if (diff < 86400000 && date.getDate() === now.getDate()) {
                return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
            }
            if (diff < 172800000 && date.getDate() === now.getDate() - 1) {
                return 'вчера ' + date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
            }
            return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
        }

        return date.toLocaleString('ru-RU', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    // ===== ФОРМАТИРОВАНИЕ =====

    /**
     * Форматирование денег
     */
    function formatMoney(amount) {
        return new Intl.NumberFormat('ru-RU', {
            style: 'currency',
            currency: 'RUB',
            minimumFractionDigits: 0
        }).format(amount || 0);
    }

    /**
     * Плюрализация
     */
    function pluralize(count, words) {
        const cases = [2, 0, 1, 1, 1, 2];
        return words[(count % 100 > 4 && count % 100 < 20) ? 2 : cases[Math.min(count % 10, 5)]];
    }

    /**
     * Обрезка текста
     */
    function truncate(text, length = 100) {
        if (!text) return '';
        return text.length > length ? text.substring(0, length) + '...' : text;
    }

    /**
     * Получение иконки категории
     */
    function getCategoryIcon(category) {
        const icons = window.CATEGORY_ICONS || {
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

    // ===== УВЕДОМЛЕНИЯ =====

    /**
     * Показать уведомление
     */
    function showNotification(message, type = 'info', duration = 3000) {
        const colors = {
            success: '#00A86B',
            error: '#DC3545',
            warning: '#FFB020',
            info: '#E67A4B'
        };

        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-bell'
        };

        // Создаем контейнер если нет
        if (!notificationContainer) {
            notificationContainer = document.createElement('div');
            notificationContainer.id = 'notification-container';
            notificationContainer.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                display: flex;
                flex-direction: column;
                gap: 10px;
                pointer-events: none;
            `;
            document.body.appendChild(notificationContainer);
        }

        const notification = document.createElement('div');
        notification.className = 'notification animate__animated animate__fadeInRight';
        notification.style.cssText = `
            background: white;
            border-left: 4px solid ${colors[type]};
            padding: 16px 24px;
            border-radius: 12px;
            box-shadow: 0 12px 30px rgba(0,0,0,0.15);
            min-width: 300px;
            max-width: 400px;
            pointer-events: auto;
            position: relative;
            overflow: hidden;
            margin-bottom: 10px;
        `;

        notification.innerHTML = `
            <div style="display: flex; align-items: center; gap: 12px;">
                <i class="fas ${icons[type]}" style="color: ${colors[type]}; font-size: 20px;"></i>
                <span style="flex: 1;">${escapeHtml(message)}</span>
                <span class="notification-close" style="cursor: pointer; opacity: 0.5; font-size: 20px;">×</span>
            </div>
            <div class="notification-progress" style="
                position: absolute;
                bottom: 0;
                left: 0;
                height: 3px;
                background: ${colors[type]};
                width: 100%;
                animation: progress ${duration}ms linear forwards;
            "></div>
        `;

        notificationContainer.appendChild(notification);

        // Закрытие по клику
        notification.querySelector('.notification-close').onclick = () => {
            notification.remove();
        };

        // Автозакрытие
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'fadeOutRight 0.3s ease forwards';
                setTimeout(() => notification.remove(), 300);
            }
        }, duration);

        return notification;
    }

    /**
     * Показать ошибку
     */
    function showError(message, error = null) {
        if (error) console.error(error);
        showNotification(message, 'error');
    }

    // ===== ПРОВЕРКИ =====

    /**
     * Проверка инициализации Firestore
     */
    function checkFirestore() {
        if (typeof db === 'undefined' || !db) {
            console.error('❌ Firestore не инициализирован!');
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

    /**
     * Проверка прав мастера
     */
    function isMaster() {
        return checkAuth() && Auth.isMaster && Auth.isMaster();
    }

    /**
     * Проверка прав клиента
     */
    function isClient() {
        return checkAuth() && Auth.isClient && Auth.isClient();
    }

    /**
     * Проверка прав админа
     */
    function isAdmin() {
        return checkAuth() && Auth.isAdmin && Auth.isAdmin();
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
            console.error('Ошибка сохранения в localStorage:', e);
            return false;
        }
    }

    /**
     * Чтение из localStorage с проверкой TTL
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
            console.error('Ошибка чтения из localStorage:', e);
            return defaultValue;
        }
    }

    /**
     * Удаление из localStorage
     */
    function removeStorage(key) {
        localStorage.removeItem(key);
    }

    // ===== РАБОТА С СЕССИЕЙ =====

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

    // ===== ГЕНЕРАЦИЯ =====

    /**
     * Генерация ID
     */
    function generateId(prefix = '') {
        return prefix + Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
    }

    /**
     * Копирование в буфер
     */
    function copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            showNotification('✅ Скопировано!', 'success');
        }).catch(() => {
            showNotification('❌ Ошибка копирования', 'error');
        });
    }

    /**
     * Задержка
     */
    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Дебаунс
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
     * Троттлинг
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
     * Безопасная перезагрузка страницы с защитой от циклов
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
            showNotification('Не удалось загрузить страницу. Попробуйте позже.', 'error');
        }
    }

    // Публичное API
    return {
        // Безопасность
        escapeHtml,
        validateEmail,
        validatePhone,
        validatePrice,

        // Даты
        safeGetDate,
        formatDate,

        // Форматирование
        formatMoney,
        pluralize,
        truncate,
        getCategoryIcon,

        // Уведомления
        showNotification,
        showError,

        // Проверки
        checkFirestore,
        checkAuth,
        isMaster,
        isClient,
        isAdmin,

        // Хранилище
        setStorage,
        getStorage,
        removeStorage,

        // Сессия
        getSessionId,

        // Генерация
        generateId,
        copyToClipboard,
        delay,
        debounce,
        throttle,
        safeReload
    };
})();

// Глобальный доступ
window.Utils = Utils;

// Для обратной совместимости (на время переходного периода)
window.Helpers = Utils;

console.log('✅ Utils loaded');