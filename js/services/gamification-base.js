// ===== js/services/gamification-base.js =====
// БАЗОВАЯ ЛОГИКА ГЕЙМИФИКАЦИИ (ОБЩАЯ ДЛЯ ВСЕХ)

const GamificationBase = (function() {
    // Константы
    const ORDER_STATUS = window.ORDER_STATUS || {
        COMPLETED: 'completed'
    };

    const USER_ROLE = window.USER_ROLE || {
        MASTER: 'master',
        CLIENT: 'client'
    };

    // ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =====

    /**
     * Безопасное получение Timestamp
     */
    function safeGetDate(timestamp) {
        if (!timestamp) return new Date();
        try {
            if (timestamp.toDate) {
                return timestamp.toDate();
            }
            if (timestamp instanceof Date) {
                return timestamp;
            }
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
     * Безопасное выполнение Firestore запроса
     */
    async function safeFirestoreQuery(queryFn, fallback = null) {
        if (!checkFirestore()) return fallback;
        try {
            return await queryFn();
        } catch (error) {
            console.error('❌ Ошибка Firestore:', error);
            return fallback;
        }
    }

    /**
     * Получить максимальное значение из массива
     */
    function safeMax(arr) {
        if (!Array.isArray(arr) || arr.length === 0) return 0;
        const max = Math.max(...arr);
        return isFinite(max) ? max : 0;
    }

    // ===== РАБОТА С УВЕДОМЛЕНИЯМИ =====

    /**
     * Показать уведомление о достижении
     */
    function showAchievementNotification(achievement, xp) {
        const notification = document.createElement('div');
        notification.className = 'achievement-notification animate__animated animate__fadeInRight';
        notification.innerHTML = `
            <div class="achievement-notification-content">
                <div class="achievement-notification-icon">
                    <i class="fas ${achievement.icon || 'fa-trophy'}"></i>
                </div>
                <div class="achievement-notification-text">
                    <h4>🏆 Новое достижение!</h4>
                    <p>${achievement.title || achievement.name}</p>
                    <span class="achievement-notification-xp">+${xp} XP</span>
                </div>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.classList.add('animate__fadeOutRight');
            setTimeout(() => notification.remove(), 500);
        }, 5000);
    }

    /**
     * Показать уведомление о повышении уровня
     */
    function showLevelUpNotification(oldLevel, newLevel) {
        const notification = document.createElement('div');
        notification.className = 'achievement-notification animate__animated animate__fadeInRight';
        notification.style.background = 'linear-gradient(135deg, #FFD700, #FFA500)';
        notification.style.color = '#333';
        notification.innerHTML = `
            <div class="achievement-notification-content">
                <div class="achievement-notification-icon" style="background: white;">
                    <i class="fas fa-arrow-up" style="color: gold;"></i>
                </div>
                <div class="achievement-notification-text">
                    <h4>🎉 Уровень повышен!</h4>
                    <p>${oldLevel.name} → ${newLevel.name}</p>
                    <span class="achievement-notification-xp" style="background: rgba(0,0,0,0.1);">+50 XP бонус</span>
                </div>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.classList.add('animate__fadeOutRight');
            setTimeout(() => notification.remove(), 500);
        }, 5000);
    }

    // Публичное API
    return {
        ORDER_STATUS,
        USER_ROLE,
        safeGetDate,
        checkFirestore,
        safeFirestoreQuery,
        safeMax,
        showAchievementNotification,
        showLevelUpNotification
    };
})();

// Глобальный доступ
window.GamificationBase = GamificationBase;
console.log('✅ GamificationBase загружен');