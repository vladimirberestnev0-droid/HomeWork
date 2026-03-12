// ============================================
// ЦЕНТР УВЕДОМЛЕНИЙ (ИСТОРИЯ УВЕДОМЛЕНИЙ) - УЛУЧШЕННАЯ ВЕРСИЯ
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
    let overlayEl = null;

    // Иконки для разных типов уведомлений
    const TYPE_ICONS = {
        'new_order': 'fa-file-alt',
        'new_response': 'fa-reply',
        'master_selected': 'fa-check-circle',
        'order_completed': 'fa-check-double',
        'order_cancelled': 'fa-times-circle',
        'new_message': 'fa-comment',
        'system': 'fa-bell',
        'info': 'fa-info-circle',
        'success': 'fa-check-circle',
        'warning': 'fa-exclamation-triangle',
        'error': 'fa-exclamation-circle'
    };

    // Цвета для разных типов
    const TYPE_COLORS = {
        'new_order': '#2CD5C4',
        'new_response': '#FF8A5C',
        'master_selected': '#00A86B',
        'order_completed': '#00A86B',
        'order_cancelled': '#DC3545',
        'new_message': '#17a2b8',
        'system': '#6c757d',
        'info': '#17a2b8',
        'success': '#00A86B',
        'warning': '#FFB020',
        'error': '#DC3545'
    };

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
                    renderEmpty();
                }
            });
        }

        // Слушаем новые push-уведомления для обновления списка
        document.addEventListener('push-received', () => {
            if (currentUserId) {
                // Просто обновим подписку, она сама всё перезагрузит
            }
        });
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
                notifications = snapshot.docs.map(doc => {
                    const data = doc.data();
                    return {
                        id: doc.id,
                        ...data,
                        createdAt: data.createdAt?.toDate?.() || new Date()
                    };
                });
                
                render();
                updateGlobalBadge();
            }, (error) => {
                console.error('❌ Ошибка подписки на уведомления:', error);
                renderError();
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
            renderEmpty();
            return;
        }

        listEl.innerHTML = notifications.map(notif => createNotificationItem(notif)).join('');
        attachNotificationListeners();
    }

    function createNotificationItem(notif) {
        const icon = TYPE_ICONS[notif.type] || 'fa-bell';
        const color = TYPE_COLORS[notif.type] || '#2CD5C4';
        const timeAgo = Utils?.getTimeAgo ? Utils.getTimeAgo(notif.createdAt) : '';
        
        // Экранируем данные для безопасности
        const safeTitle = Utils?.escapeHtml ? Utils.escapeHtml(notif.title || 'Уведомление') : (notif.title || 'Уведомление');
        const safeBody = Utils?.escapeHtml ? Utils.escapeHtml(notif.body || '') : (notif.body || '');
        
        // Сериализуем data для передачи в onclick
        const dataAttr = Utils?.escapeAttr ? Utils.escapeAttr(JSON.stringify(notif.data || {})) : '{}';

        return `
            <div class="notification-item ${notif.read ? '' : 'unread'}" 
                 data-id="${notif.id}"
                 data-type="${notif.type || 'info'}"
                 data-data='${dataAttr}'
                 onclick="NotificationsCenter.handleNotificationClick(this)">
                <div class="notification-icon" style="background: ${color}20; color: ${color};">
                    <i class="fas ${icon}"></i>
                </div>
                <div class="notification-content">
                    <div class="notification-title">${safeTitle}</div>
                    <div class="notification-message">${safeBody}</div>
                    <div class="notification-time">${timeAgo}</div>
                </div>
                ${!notif.read ? '<span class="unread-dot"></span>' : ''}
            </div>
        `;
    }

    function attachNotificationListeners() {
        // Дополнительные слушатели, если нужны
    }

    function renderEmpty() {
        if (!listEl) return;
        listEl.innerHTML = `
            <div class="empty-notifications">
                <i class="fas fa-bell-slash fa-4x mb-3" style="color: var(--border);"></i>
                <h5>Нет уведомлений</h5>
                <p class="text-muted">Здесь будут появляться уведомления</p>
            </div>
        `;
    }

    function renderError() {
        if (!listEl) return;
        listEl.innerHTML = `
            <div class="empty-notifications">
                <i class="fas fa-exclamation-triangle fa-4x mb-3" style="color: #dc3545;"></i>
                <h5>Ошибка загрузки</h5>
                <p class="text-muted">Попробуйте обновить страницу</p>
                <button class="btn btn-outline-primary mt-3" onclick="location.reload()">
                    <i class="fas fa-sync-alt me-2"></i>Обновить
                </button>
            </div>
        `;
    }

    /**
     * Обработчик клика по уведомлению (элегантный)
     */
    window.NotificationsCenter.handleNotificationClick = function(element) {
        const id = element.dataset.id;
        let data = {};
        
        try {
            data = JSON.parse(element.dataset.data || '{}');
        } catch (e) {
            console.warn('Ошибка парсинга данных уведомления');
        }

        // Отмечаем как прочитанное
        markAsRead(id);

        // Обрабатываем переход
        handleNotificationNavigation(data);

        // Закрываем центр
        close();
    };

    function handleNotificationNavigation(data) {
        if (!data) return;

        // Обработка разных типов переходов
        if (data.orderId) {
            const user = Auth?.getUser();
            if (Auth?.isMaster()) {
                window.location.href = `/HomeWork/masters.html?order=${data.orderId}`;
            } else {
                window.location.href = `/HomeWork/client.html?order=${data.orderId}`;
            }
        } else if (data.chatId) {
            window.location.href = `/HomeWork/chat.html?chatId=${data.chatId}`;
        } else if (data.url) {
            window.location.href = data.url;
        }
    }

    function updateGlobalBadge() {
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

        // Диспатчим событие для обновления других компонентов
        document.dispatchEvent(new CustomEvent('unread-changed', { 
            detail: { count: unreadCount }
        }));
    }

    function open() {
        if (!currentUserId) {
            Utils?.showInfo?.('Войдите, чтобы увидеть уведомления');
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
            // Подписка обновит UI автоматически
        } catch (error) {
            console.error('❌ Ошибка при отметке прочитанного:', error);
        }
    }

    async function markAllAsRead() {
        if (!currentUserId || notifications.length === 0) return;

        const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
        if (unreadIds.length === 0) {
            Utils?.showInfo?.('Нет непрочитанных уведомлений');
            return;
        }

        const batch = db.batch();
        unreadIds.forEach(id => {
            const ref = db.collection('notifications').doc(id);
            batch.update(ref, { read: true });
        });

        try {
            await batch.commit();
            Utils?.showSuccess?.('✅ Все уведомления отмечены как прочитанные');
        } catch (error) {
            console.error('❌ Ошибка:', error);
            Utils?.showError?.('Ошибка при обновлении');
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
            Utils?.showSuccess?.('✅ Все уведомления удалены');
        } catch (error) {
            console.error('❌ Ошибка:', error);
            Utils?.showError?.('Ошибка при удалении');
        }
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