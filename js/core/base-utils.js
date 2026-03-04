const Utils = (function() {
    // ===== БЕЗОПАСНОСТЬ =====
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function validateEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    function validatePrice(price) {
        return price && !isNaN(price) && price >= 500 && price <= 1000000;
    }

    // ===== РАБОТА С ДАТАМИ =====
    function safeGetDate(timestamp) {
        if (!timestamp) return new Date();
        try {
            if (timestamp.toDate) return timestamp.toDate();
            if (timestamp instanceof Date) return timestamp;
            if (typeof timestamp === 'string') {
                const date = new Date(timestamp);
                return isNaN(date.getTime()) ? new Date() : date;
            }
            return new Date();
        } catch {
            return new Date();
        }
    }

    function formatDate(timestamp) {
        const date = safeGetDate(timestamp);
        const now = new Date();
        const diff = now - date;

        if (diff < 60000) return 'только что';
        if (diff < 3600000) return Math.floor(diff / 60000) + ' мин назад';
        if (diff < 86400000) {
            return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        }
        return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
    }

    // ===== ФОРМАТИРОВАНИЕ =====
    function formatMoney(amount) {
        return new Intl.NumberFormat('ru-RU', {
            style: 'currency',
            currency: 'RUB',
            minimumFractionDigits: 0
        }).format(amount || 0);
    }

    function truncate(text, length = 100) {
        if (!text) return '';
        return text.length > length ? text.substring(0, length) + '...' : text;
    }

    // ===== УВЕДОМЛЕНИЯ =====
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

        // Контейнер для уведомлений
        let container = document.getElementById('notification-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'notification-container';
            container.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                display: flex;
                flex-direction: column;
                gap: 10px;
            `;
            document.body.appendChild(container);
        }

        const notification = document.createElement('div');
        notification.style.cssText = `
            background: white;
            border-left: 4px solid ${colors[type]};
            padding: 12px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            min-width: 250px;
            display: flex;
            align-items: center;
            gap: 12px;
            animation: slideIn 0.3s ease;
        `;

        notification.innerHTML = `
            <i class="fas ${icons[type]}" style="color: ${colors[type]};"></i>
            <span style="flex: 1;">${escapeHtml(message)}</span>
            <span style="cursor: pointer; opacity: 0.5;" onclick="this.parentElement.remove()">×</span>
        `;

        container.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, duration);
    }

    function showError(message, error = null) {
        if (error) console.error(error);
        showNotification(message, 'error');
    }

    // ===== ПРОВЕРКИ =====
    function checkFirestore() {
        if (typeof db === 'undefined' || !db) {
            console.error('❌ Firestore не инициализирован!');
            return false;
        }
        return true;
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

    // Публичное API
    return {
        escapeHtml,
        validateEmail,
        validatePrice,
        safeGetDate,
        formatDate,
        formatMoney,
        truncate,
        showNotification,
        showError,
        checkFirestore,
        generateId,
        getSessionId
    };
})();

window.Utils = Utils;
console.log('✅ Utils loaded');