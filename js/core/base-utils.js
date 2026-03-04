/**
 * base-utils.js — универсальные утилиты для всего проекта
 * Версия 3.0 с глобальными функциями для HTML
 */

const Utils = (function() {
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
     * Валидация цены
     */
    function validatePrice(price) {
        return price && !isNaN(price) && price >= 500 && price <= 1000000;
    }

    /**
     * Валидация телефона (Россия)
     */
    function validatePhone(phone) {
        return /^(\+7|8)[\s(]?(\d{3})[\s)]?[\s-]?(\d{3})[\s-]?(\d{2})[\s-]?(\d{2})$/.test(phone);
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
    function formatDate(timestamp, format = 'short') {
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
            'Ремонт техники': 'fa-gear',
            'Дизайн интерьера': 'fa-pencil-ruler',
            'Ремонт под ключ': 'fa-key'
        };
        return icons[category] || 'fa-tag';
    }

    // ===== УВЕДОМЛЕНИЯ =====

    let notificationContainer = null;

    /**
     * Показать уведомление
     */
    function showNotification(message, type = 'info', duration = 3000) {
        const colors = {
            success: '#00A86B',
            error: '#DC3545',
            warning: '#FFB020',
            info: '#2CD5C4'
        };

        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-bell'
        };

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
        notification.className = 'notification';
        notification.style.cssText = `
            background: var(--bg-white);
            border-left: 4px solid ${colors[type]};
            padding: 12px 20px;
            border-radius: 12px;
            box-shadow: var(--shadow-lg);
            min-width: 250px;
            max-width: 350px;
            pointer-events: auto;
            display: flex;
            align-items: center;
            gap: 12px;
            animation: slideIn 0.3s ease;
            color: var(--text-primary);
        `;

        notification.innerHTML = `
            <i class="fas ${icons[type]}" style="color: ${colors[type]}; font-size: 1.2rem;"></i>
            <span style="flex: 1;">${escapeHtml(message)}</span>
            <span style="cursor: pointer; opacity: 0.5; font-size: 1.2rem;" onclick="this.parentElement.remove()">×</span>
        `;

        notificationContainer.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, duration);
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

    // ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =====
    
    /**
     * Debounce — ограничивает частоту вызова функции
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
     * Throttle — пропускает вызовы не чаще чем раз в указанный интервал
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
     * Копирование в буфер обмена
     */
    function copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            showNotification('✅ Скопировано!', 'success');
        }).catch(() => {
            showNotification('❌ Ошибка копирования', 'error');
        });
    }

    /**
     * Задержка (промис)
     */
    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
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
        validateEmail,
        validatePhone,
        validatePrice,
        safeGetDate,
        formatDate,
        formatMoney,
        pluralize,
        truncate,
        getCategoryIcon,
        showNotification,
        showError,
        checkFirestore,
        checkAuth,
        setStorage,
        getStorage,
        removeStorage,
        generateId,
        getSessionId,
        debounce,
        throttle,
        copyToClipboard,
        delay,
        safeReload
    };
})();

// ===== ГЛОБАЛЬНЫЕ ФУНКЦИИ ДЛЯ HTML =====

/**
 * Глобальные переменные состояния
 */
window.currentOrderId = null;
window.currentMasterId = null;
window.currentClientId = null;
window.currentRating = 0;
window.selectedFiles = [];
window.currentFilter = 'all';
window._authUnsubscribe = null;
window._messagesUnsubscribe = null;

/**
 * Удаление файла из превью
 */
window.removeFile = function(index) {
    if (window.selectedFiles && Array.isArray(window.selectedFiles)) {
        window.selectedFiles.splice(index, 1);
        updateFilePreview();
    }
};

/**
 * Обновление превью файлов
 */
window.updateFilePreview = function() {
    const preview = document.getElementById('filePreview');
    if (!preview) return;
    
    if (!window.selectedFiles || window.selectedFiles.length === 0) {
        preview.classList.add('d-none');
        preview.innerHTML = '';
        return;
    }
    
    preview.classList.remove('d-none');
    preview.innerHTML = window.selectedFiles.map((file, index) => {
        const icon = file.type && file.type.startsWith('image/') ? 'fa-image' : 'fa-file';
        const fileName = file.name.length > 20 ? file.name.substring(0, 17) + '...' : file.name;
        return `
            <div class="file-preview-item">
                <i class="fas ${icon}"></i>
                <span>${Utils.escapeHtml(fileName)}</span>
                <span class="remove-file" onclick="window.removeFile(${index})">×</span>
            </div>
        `;
    }).join('');
};

/**
 * Просмотр заказа
 */
window.viewOrder = function(orderId) {
    Utils.showNotification('👀 Просмотр заказа будет доступен позже', 'info');
};

/**
 * Показать/скрыть отклики
 */
window.toggleResponses = function(orderId) {
    const el = document.getElementById(`responses-${orderId}`);
    if (el) {
        const isHidden = el.style.display === 'none' || el.style.display === '';
        el.style.display = isHidden ? 'block' : 'none';
        
        // Находим кнопку по data-атрибуту или тексту
        const btns = document.querySelectorAll('button');
        for (let btn of btns) {
            if (btn.textContent.includes('Отклики') && btn.textContent.includes(orderId.substring(0, 8))) {
                const icon = btn.querySelector('i');
                if (icon) {
                    icon.className = isHidden ? 'fas fa-chevron-up me-1' : 'fas fa-chevron-down me-1';
                }
                break;
            }
        }
    }
};

/**
 * Выбор мастера
 */
window.selectMaster = async function(orderId, masterId, price) {
    if (!confirm('Вы уверены, что хотите выбрать этого мастера?')) return;
    
    try {
        if (!window.Orders) {
            throw new Error('Сервис заказов не загружен');
        }
        
        const result = await Orders.selectMaster(orderId, masterId, price);
        
        if (result && result.success) {
            Utils.showNotification('✅ Мастер выбран! Чат создан.', 'success');
            
            if (result.chatId) {
                setTimeout(() => {
                    window.location.href = `/HomeWork/chat.html?chatId=${result.chatId}`;
                }, 1500);
            } else {
                // Перезагружаем страницу если нет chatId
                setTimeout(() => {
                    window.location.reload();
                }, 1500);
            }
        } else {
            Utils.showNotification(result?.error || '❌ Ошибка при выборе мастера', 'error');
        }
    } catch (error) {
        console.error('❌ Ошибка выбора мастера:', error);
        Utils.showNotification('❌ Ошибка при выборе мастера', 'error');
    }
};

/**
 * Открыть чат
 */
window.openChat = function(orderId, partnerId) {
    const user = Auth.getUser();
    if (!user) {
        AuthUI.showLoginModal();
        return;
    }
    
    // Формируем ID чата в зависимости от роли
    let chatId;
    if (Auth.isMaster()) {
        chatId = `chat_${orderId}_${user.uid}`;
    } else {
        chatId = `chat_${orderId}_${partnerId}`;
    }
    
    window.location.href = `/HomeWork/chat.html?chatId=${chatId}`;
};

/**
 * Открыть модалку отзыва
 */
window.openReviewModal = function(orderId, masterId, masterName) {
    window.currentOrderId = orderId;
    window.currentMasterId = masterId;
    window.currentRating = 0;
    
    const modalEl = document.getElementById('reviewModal');
    if (modalEl && window.bootstrap) {
        const modal = new bootstrap.Modal(modalEl);
        
        // Сброс звёзд
        document.querySelectorAll('#reviewModal .star').forEach(s => s.classList.remove('active'));
        const reviewText = document.getElementById('reviewText');
        if (reviewText) reviewText.value = '';
        
        modal.show();
    } else {
        Utils.showNotification('Не удалось открыть модалку отзыва', 'error');
    }
};

/**
 * Показать модалку отклика
 */
window.showRespondModal = function(orderId, orderTitle, orderCategory, orderPrice) {
    window.currentOrderId = orderId;
    
    const infoBlock = document.getElementById('respondOrderInfo');
    if (infoBlock) infoBlock.classList.remove('d-none');
    
    const titleEl = document.getElementById('respondOrderTitle');
    if (titleEl) titleEl.textContent = orderTitle || 'Заказ';
    
    const categoryEl = document.getElementById('respondOrderCategory');
    if (categoryEl) categoryEl.textContent = orderCategory || 'Категория';
    
    const priceEl = document.getElementById('respondOrderPrice');
    if (priceEl) priceEl.textContent = Utils.formatMoney(orderPrice);
    
    const priceInput = document.getElementById('responsePrice');
    if (priceInput) priceInput.value = '';
    
    const commentInput = document.getElementById('responseComment');
    if (commentInput) commentInput.value = '';
    
    const modalEl = document.getElementById('respondModal');
    if (modalEl && window.bootstrap) {
        const modal = new bootstrap.Modal(modalEl);
        modal.show();
    }
};

/**
 * Показать модалку отзыва о клиенте
 */
window.showClientReviewModal = function(orderId, clientId, clientName) {
    window.currentOrderId = orderId;
    window.currentClientId = clientId;
    window.currentRating = 0;
    
    const nameEl = document.getElementById('reviewClientName');
    if (nameEl) nameEl.textContent = clientName || 'Клиент';
    
    // Сброс звёзд
    document.querySelectorAll('#clientRatingStars .star').forEach(s => s.classList.remove('active'));
    
    const textEl = document.getElementById('reviewClientText');
    if (textEl) textEl.value = '';
    
    const modalEl = document.getElementById('reviewClientModal');
    if (modalEl && window.bootstrap) {
        const modal = new bootstrap.Modal(modalEl);
        modal.show();
    }
};

/**
 * Очистка при уходе со страницы
 */
window.addEventListener('beforeunload', function() {
    // Очищаем слушатели
    if (window._authUnsubscribe && typeof window._authUnsubscribe === 'function') {
        window._authUnsubscribe();
        window._authUnsubscribe = null;
    }
    if (window._messagesUnsubscribe && typeof window._messagesUnsubscribe === 'function') {
        window._messagesUnsubscribe();
        window._messagesUnsubscribe = null;
    }
});

// Добавляем стили для анимаций если их нет
(function addAnimationStyles() {
    if (document.getElementById('utils-animation-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'utils-animation-styles';
    style.textContent = `
        @keyframes slideIn {
            from {
                opacity: 0;
                transform: translateX(30px);
            }
            to {
                opacity: 1;
                transform: translateX(0);
            }
        }
        
        @keyframes slideOut {
            from {
                opacity: 1;
                transform: translateX(0);
            }
            to {
                opacity: 0;
                transform: translateX(30px);
            }
        }
        
        .notification {
            pointer-events: auto;
            animation: slideIn 0.3s ease;
        }
    `;
    document.head.appendChild(style);
})();

window.Utils = Utils;
console.log('✅ Utils loaded (полная версия с глобальными функциями)');