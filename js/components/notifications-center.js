// ============================================
// ЦЕНТР УВЕДОМЛЕНИЙ (ИСТОРИЯ УВЕДОМЛЕНИЙ)
// ============================================

const NotificationsCenter = (function() {
    if (window.__NOTIFICATIONS_CENTER_INITIALIZED__) return window.NotificationsCenter;

    let isOpen = false;
    let unsubscribe = null;
    let currentUserId = null;
    let notifications = [];

    // DOM элементы
    let centerEl = null;
    let listEl = null;
    let badgeEl = null;
    let overlayEl = null;

    function init() {
        if (document.getElementById('notificationsCenter')) return;

        createCenterHTML();
        setupListeners();
        console.log('✅ NotificationsCenter инициализирован');
    }

    function createCenterHTML() {
        // Создаём оверлей
        overlayEl = document.createElement('div');
        overlayEl.id = 'notificationsOverlay';
        overlayEl.className = 'notifications-overlay';
        overlayEl.style.display = 'none';
        document.body.appendChild(overlayEl);

        // Создаём центр уведомлений
        centerEl = document.createElement('div');
        centerEl.id = 'notificationsCenter';
        centerEl.className = 'notifications-center';
        centerEl.innerHTML = `
            <div class="notifications-header">
                <h3>
                    <i class="fas fa-bell me-2" style="color: var(--accent);"></i>
                    Уведомления
                </h3>
                <div class="header-actions">
                    <button class="mark-all-read" id="markAllReadBtn" title="Прочитать всё">
                        <i class="fas fa-check-double"></i>
                    </button>
                    <button class="close-btn" id="closeNotificationsBtn">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
            <div class="notifications-list" id="notificationsList">
                <div class="text-center p-5">
                    <div class="spinner-glow-sm"></div>
                    <p class="mt-2 text-muted">Загрузка уведомлений...</p>
                </div>
            </div>
            <div class="notifications-footer">
                <button class="clear-all-btn" id="clearAllNotifications">
                    <i class="fas fa-trash-alt me-2"></i>Очистить всё
                </button>
            </div>
        `;
        document.body.appendChild(centerEl);

        listEl = document.getElementById('notificationsList');
    }

    function setupListeners() {
        // Закрытие по оверлею
        overlayEl.addEventListener('click', close);

        // Кнопка закрытия
        document.getElementById('closeNotificationsBtn')?.addEventListener('click', close);

        // Отметить всё как прочитанное
        document.getElementById('markAllReadBtn')?.addEventListener('click', markAllAsRead);

        // Очистить всё
        document.getElementById('clearAllNotifications')?.addEventListener('click', clearAll);

        // Подписка на авторизацию
        if (window.Auth) {
            Auth.onAuthChange((state) => {
                if (state.isAuthenticated && state.user) {
                    subscribeToNotifications(state.user.uid);
                } else {
                    unsubscribeFromNotifications();
                }
            });
        }
    }

    function subscribeToNotifications(userId) {
        unsubscribeFromNotifications();
        currentUserId = userId;

        if (!window.db) return;

        unsubscribe = db.collection('notifications')
            .where('userId', '==', userId)
            .orderBy('createdAt', 'desc')
            .limit(50)
            .onSnapshot((snapshot) => {
                notifications = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    createdAt: doc.data().createdAt?.toDate?.() || new Date()
                }));
                
                render();
                updateBadge();
            }, (error) => {
                console.error('Ошибка подписки на уведомления:', error);
            });
    }

    function unsubscribeFromNotifications() {
        if (unsubscribe) {
            unsubscribe();
            unsubscribe = null;
        }
        currentUserId = null;
    }

    function render() {
        if (!listEl) return;

        if (notifications.length === 0) {
            listEl.innerHTML = `
                <div class="empty-notifications">
                    <i class="fas fa-bell-slash fa-4x mb-3" style="color: var(--border);"></i>
                    <h5>Нет уведомлений</h5>
                    <p class="text-muted">Здесь будут появляться уведомления</p>
                </div>
            `;
            return;
        }

        listEl.innerHTML = notifications.map(notif => `
            <div class="notification-item ${notif.read ? '' : 'unread'}" 
                 data-id="${notif.id}"
                 onclick="NotificationsCenter.openNotification('${notif.id}', ${JSON.stringify(notif.data || {}).replace(/"/g, '&quot;')})">
                <div class="notification-icon ${notif.type || 'info'}">
                    <i class="fas ${getIconForType(notif.type)}"></i>
                </div>
                <div class="notification-content">
                    <div class="notification-title">${Utils.escapeHtml(notif.title || 'Уведомление')}</div>
                    <div class="notification-message">${Utils.escapeHtml(notif.body || '')}</div>
                    <div class="notification-time">${Utils.getTimeAgo(notif.createdAt)}</div>
                </div>
                ${!notif.read ? '<span class="unread-dot"></span>' : ''}
            </div>
        `).join('');
    }

    function getIconForType(type) {
        const icons = {
            'new_order': 'fa-file-alt',
            'new_response': 'fa-reply',
            'master_selected': 'fa-check-circle',
            'order_completed': 'fa-check-double',
            'order_cancelled': 'fa-times-circle',
            'new_message': 'fa-comment',
            'system': 'fa-bell'
        };
        return icons[type] || 'fa-bell';
    }

    function updateBadge() {
        const unreadCount = notifications.filter(n => !n.read).length;
        
        // Обновляем глобальный бейдж
        if (window.Notifications) {
            window.Notifications.updateBadge(unreadCount);
        }

        // Обновляем бейдж на иконке центра
        const bellIcon = document.querySelector('.notifications-bell .badge');
        if (bellIcon) {
            if (unreadCount > 0) {
                bellIcon.textContent = unreadCount > 99 ? '99+' : unreadCount;
                bellIcon.classList.remove('hidden');
            } else {
                bellIcon.classList.add('hidden');
            }
        }
    }

    function open() {
        if (!currentUserId) {
            Utils.showInfo('Войдите, чтобы увидеть уведомления');
            return;
        }

        isOpen = true;
        centerEl.classList.add('open');
        overlayEl.style.display = 'block';
        document.body.style.overflow = 'hidden';
    }

    function close() {
        isOpen = false;
        centerEl.classList.remove('open');
        overlayEl.style.display = 'none';
        document.body.style.overflow = '';
    }

    function toggle() {
        if (isOpen) close();
        else open();
    }

    async function markAsRead(notificationId) {
        try {
            await db.collection('notifications').doc(notificationId).update({
                read: true
            });
        } catch (error) {
            console.error('Ошибка при отметке прочитанного:', error);
        }
    }

    async function markAllAsRead() {
        if (!currentUserId || notifications.length === 0) return;

        const batch = db.batch();
        const unreadIds = notifications.filter(n => !n.read).map(n => n.id);

        unreadIds.forEach(id => {
            const ref = db.collection('notifications').doc(id);
            batch.update(ref, { read: true });
        });

        try {
            await batch.commit();
            Utils.showSuccess('✅ Все уведомления отмечены как прочитанные');
        } catch (error) {
            console.error('Ошибка:', error);
            Utils.showError('Ошибка при обновлении');
        }
    }

    async function clearAll() {
        if (!currentUserId || notifications.length === 0) return;

        if (!confirm('Удалить все уведомления?')) return;

        const batch = db.batch();
        notifications.forEach(n => {
            const ref = db.collection('notifications').doc(n.id);
            batch.delete(ref);
        });

        try {
            await batch.commit();
            Utils.showSuccess('✅ Все уведомления удалены');
        } catch (error) {
            console.error('Ошибка:', error);
            Utils.showError('Ошибка при удалении');
        }
    }

    function openNotification(id, data) {
        markAsRead(id);
        
        // Обработка разных типов уведомлений
        if (data.orderId) {
            // Определяем роль пользователя? Пока просто переходим на страницу заказа
            if (Auth.isMaster()) {
                window.location.href = `/HomeWork/masters.html?order=${data.orderId}`;
            } else {
                window.location.href = `/HomeWork/client.html?order=${data.orderId}`;
            }
        } else if (data.chatId) {
            window.location.href = `/HomeWork/chat.html?chatId=${data.chatId}`;
        }
        
        close();
    }

    function getUnreadCount() {
        return notifications.filter(n => !n.read).length;
    }

    const api = {
        init,
        open,
        close,
        toggle,
        markAsRead,
        markAllAsRead,
        clearAll,
        openNotification,
        getUnreadCount
    };

    window.__NOTIFICATIONS_CENTER_INITIALIZED__ = true;
    return Object.freeze(api);
})();

// Автоинициализация
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => NotificationsCenter.init(), 1500);
});

window.NotificationsCenter = NotificationsCenter;