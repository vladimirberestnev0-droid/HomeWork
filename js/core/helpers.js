// ===== js/core/helpers.js =====
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ (ВЕРСИЯ 2.0)

const Helpers = (function() {
    // Экранирование HTML
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

    // Форматирование даты
    function formatDate(timestamp) {
        if (!timestamp) return 'только что';
        try {
            const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
            const now = new Date();
            const diff = now - date;
            
            if (diff < 60000) return 'только что';
            if (diff < 3600000) return Math.floor(diff/60000) + ' мин назад';
            if (diff < 86400000) return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
            return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
        } catch (e) {
            return 'недавно';
        }
    }

    // Показ уведомления
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
        
        const notification = document.createElement('div');
        notification.className = 'notification animate-slide-in';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: white;
            border-left: 4px solid ${colors[type]};
            padding: 16px 24px;
            border-radius: 12px;
            box-shadow: 0 12px 30px rgba(0,0,0,0.15);
            z-index: 10000;
            min-width: 300px;
            max-width: 400px;
        `;
        
        notification.innerHTML = `
            <div style="display: flex; align-items: center; gap: 12px;">
                <i class="fas ${icons[type]}" style="color: ${colors[type]}; font-size: 20px;"></i>
                <span style="flex: 1;">${escapeHtml(message)}</span>
                <span class="notification-close" style="cursor: pointer; opacity: 0.5;">×</span>
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
        
        document.body.appendChild(notification);
        
        notification.querySelector('.notification-close').onclick = () => {
            notification.remove();
        };
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'slideOut 0.3s ease forwards';
                setTimeout(() => notification.remove(), 300);
            }
        }, duration);
    }

    // Показ ошибки
    function showError(message, error = null) {
        if (error) console.error(error);
        showNotification(message, 'error');
    }

    // Валидация цены
    function validatePrice(price) {
        return price && !isNaN(price) && price >= 500 && price <= 1000000;
    }

    // Валидация телефона
    function validatePhone(phone) {
        return /^(\+7|8)[\s(]?(\d{3})[\s)]?[\s-]?(\d{3})[\s-]?(\d{2})[\s-]?(\d{2})$/.test(phone);
    }

    // Валидация email
    function validateEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    // Получение иконки категории
    function getCategoryIcon(category) {
        return window.CATEGORY_ICONS[category] || 'fa-tag';
    }

    // Склонение слов
    function pluralize(count, words) {
        const cases = [2, 0, 1, 1, 1, 2];
        return words[(count % 100 > 4 && count % 100 < 20) ? 2 : cases[Math.min(count % 10, 5)]];
    }

    // Задержка
    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Копирование в буфер
    function copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            showNotification('✅ Скопировано!', 'success');
        }).catch(() => {
            showNotification('❌ Ошибка копирования', 'error');
        });
    }

    // Сохранение в localStorage с TTL
    function setStorage(key, value, ttl = null) {
        try {
            const item = {
                value,
                timestamp: Date.now(),
                ttl
            };
            localStorage.setItem(key, JSON.stringify(item));
        } catch (e) {
            console.error('Ошибка сохранения в localStorage:', e);
        }
    }

    // Чтение из localStorage с проверкой TTL
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

    // Форматирование цены
    function formatPrice(price) {
        return new Intl.NumberFormat('ru-RU').format(price) + ' ₽';
    }

    // Обрезка текста
    function truncate(text, length = 100) {
        if (!text) return '';
        return text.length > length ? text.substring(0, length) + '...' : text;
    }

    // Генерация ID
    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substring(2);
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
        getStorage,
        formatPrice,
        truncate,
        generateId,
        safeReload
    };
})();

window.Helpers = Helpers;