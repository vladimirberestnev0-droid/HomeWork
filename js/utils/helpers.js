// ===== js/utils/helpers.js =====
const Helpers = {
    escapeHtml(text) {
        if (!text) return '';
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    },

    formatDate(timestamp) {
        if (!timestamp) return 'только что';
        try {
            const date = timestamp.toDate();
            const now = new Date();
            const diff = now - date;
            
            if (diff < 60000) return 'только что';
            if (diff < 3600000) return Math.floor(diff/60000) + ' мин назад';
            if (diff < 86400000) return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
            return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
        } catch (e) {
            return 'недавно';
        }
    },

    showNotification(message, type = 'info') {
        const colors = {
            success: '#00A86B',
            error: '#DC3545',
            warning: '#FFB020',
            info: '#E67A4B'
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
                <span>${this.escapeHtml(message)}</span>
            </div>
        `;
        
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
    },

    validatePrice(price) {
        return price && !isNaN(price) && price >= 500 && price <= 1000000;
    },

    validatePhone(phone) {
        return /^(\+7|8)[\s(]?(\d{3})[\s)]?[\s-]?(\d{3})[\s-]?(\d{2})[\s-]?(\d{2})$/.test(phone);
    },

    validateEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    },

    getCategoryIcon(category) {
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
    },

    pluralize(count, words) {
        const cases = [2, 0, 1, 1, 1, 2];
        return words[(count % 100 > 4 && count % 100 < 20) ? 2 : cases[Math.min(count % 10, 5)]];
    },

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },

    copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            this.showNotification('✅ Скопировано!', 'success');
        }).catch(() => {
            this.showNotification('❌ Ошибка копирования', 'error');
        });
    },

    setStorage(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (e) {
            console.error('Ошибка сохранения в localStorage:', e);
        }
    },

    getStorage(key, defaultValue = null) {
        try {
            const value = localStorage.getItem(key);
            return value ? JSON.parse(value) : defaultValue;
        } catch (e) {
            console.error('Ошибка чтения из localStorage:', e);
            return defaultValue;
        }
    }
};

// ВАЖНО! Экспортируем в глобальную область
window.Helpers = Helpers;