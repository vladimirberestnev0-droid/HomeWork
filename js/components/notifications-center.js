// ============================================
// ЦЕНТР УВЕДОМЛЕНИЙ - ПОЛНАЯ ИСПРАВЛЕННАЯ ВЕРСИЯ
// ============================================

const NotificationsCenter = (function() {
    if (window.__NOTIFICATIONS_CENTER_INITIALIZED__) return window.NotificationsCenter;

    // ===== ПРИВАТНЫЕ ПЕРЕМЕННЫЕ =====
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
        'awaiting_confirmation': 'fa-hourglass-half',
        'system': 'fa-bell',
        'info': 'fa-info-circle',
        'success': 'fa-check-circle',
        'warning': 'fa-exclamation-triangle',
        'error': 'fa-exclamation-circle',
        'test': 'fa-flask'
    };

    // Цвета для разных типов
    const TYPE_COLORS = {
        'new_order': '#2CD5C4',
        'new_response': '#FF8A5C',
        'master_selected': '#00A86B',
        'order_completed': '#00A86B',
        'order_cancelled': '#DC3545',
        'new_message': '#17a2b8',
        'awaiting_confirmation': '#FFB020',
        'system': '#6c757d',
        'info': '#17a2b8',
        'success': '#00A86B',
        'warning': '#FFB020',
        'error': '#DC3545',
        'test': '#2CD5C4'
    };

    // ===== ИНИЦИАЛИЗАЦИЯ =====
    function init() {
        if (document.getElementById('notificationsCenter')) return;

        createCenterHTML();
        setupListeners();
        console.log('✅ NotificationsCenter инициализирован');
    }

    // ===== СОЗДАНИЕ HTML =====
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

    // ===== НАСТРОЙКА СЛУШАТЕЛЕЙ =====
    function setupListeners() {
        // Закрытие по оверлею
        if (overlayEl) {
            overlayEl.addEventListener('click', close);
        }

        // Кнопка закрытия
        const closeBtn = document.getElementById('closeNotificationsBtn');
        if (closeBtn) {
            closeBtn.addEventListener('click', close);
        }

        // Отметить всё как прочитанное
        const markAllBtn = document.getElementById('markAllReadBtn');
        if (markAllBtn) {
            markAllBtn.addEventListener('click', markAllAsRead);
        }

        // Очистить всё
        const clearAllBtn = document.getElementById('clearAllNotifications');
        if (clearAllBtn) {
            clearAllBtn.addEventListener('click', clearAll);
        }

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

        // Слушаем новые push-уведомления (Пункт 21)
        document.addEventListener('push-received', () => {
            if (currentUserId) {
                // Подписка обновит данные автоматически
            }
        });

        // Слушаем обновление непрочитанных
        document.addEventListener('unread-changed', (e) => {
            // Можем обновить иконку, если нужно
        });
    }

    // ===== ПОДПИСКА НА УВЕДОМЛЕНИЯ =====
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
                
                if (error.message?.includes('requires an index')) {
                    renderIndexError(error.message);
                } else {
                    renderError();
                }
            });
    }

    function unsubscribeFromNotifications() {
        if (unsubscribe) {
            unsubscribe();
            unsubscribe = null;
        }
        currentUserId = null;
    }

    // ===== ОТОБРАЖЕНИЕ (ОБНОВЛЕНО - анимация) =====
    function render() {
        if (!listEl) return;

        if (notifications.length === 0) {
            renderEmpty();
            return;
        }

        listEl.innerHTML = notifications.map((notif, index) => {
            const item = createNotificationItem(notif);
            // Добавляем задержку для анимации
            return `<div style="animation: slideInRight 0.3s ease ${index * 0.05}s both;">${item}</div>`;
        }).join('');
    }

    function createNotificationItem(notif) {
        const icon = TYPE_ICONS[notif.type] || 'fa-bell';
        const color = TYPE_COLORS[notif.type] || '#2CD5C4';
        const timeAgo = Utils?.getTimeAgo ? Utils.getTimeAgo(notif.createdAt) : '';
        
        const safeTitle = Utils?.escapeHtml ? Utils.escapeHtml(notif.title || 'Уведомление') : (notif.title || 'Уведомление');
        const safeBody = Utils?.escapeHtml ? Utils.escapeHtml(notif.body || '') : (notif.body || '');
        
        const dataAttr = Utils?.escapeAttr ? Utils.escapeAttr(JSON.stringify(notif.data || {})) : '{}';

        return `
            <div class="notification-item ${notif.read ? '' : 'unread'}" 
                 data-id="${notif.id}"
                 data-type="${notif.type || 'info'}"
                 data-data='${dataAttr}'
                 onclick="window.NotificationsCenter && window.NotificationsCenter.handleNotificationClick(this)">
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

    function renderIndexError(errorMessage) {
        if (!listEl) return;
        
        const urlMatch = errorMessage.match(/https:\/\/console\.firebase\.google\.com[^\s]+/);
        const indexUrl = urlMatch ? urlMatch[0] : '#';
        
        listEl.innerHTML = `
            <div class="empty-notifications">
                <i class="fas fa-database fa-4x mb-3" style="color: #FFB400;"></i>
                <h5>Требуется настройка</h5>
                <p class="text-muted">Для работы уведомлений нужно создать индекс в Firebase</p>
                <a href="${indexUrl}" target="_blank" class="btn btn-primary mt-3">
                    <i class="fas fa-external-link-alt me-2"></i>Создать индекс
                </a>
            </div>
        `;
    }

    // ===== ОБРАБОТЧИК КЛИКА =====
    function handleNotificationClick(element) {
        if (!element) return;
        
        const id = element.dataset.id;
        let data = {};
        
        try {
            data = JSON.parse(element.dataset.data || '{}');
        } catch (e) {
            console.warn('⚠️ Ошибка парсинга данных уведомления');
        }

        markAsRead(id);
        handleNotificationNavigation(data);
        close();
    }

    // ===== НАВИГАЦИЯ ПО УВЕДОМЛЕНИЮ =====
    function handleNotificationNavigation(data) {
        if (!data) return;

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

    // ===== ОБНОВЛЕНИЕ БЕЙДЖА (ОБНОВЛЕНО - Пункт 21) =====
    function updateGlobalBadge() {
        const oldUnreadCount = parseInt(document.querySelector('.notifications-bell .badge')?.textContent || '0');
        const newUnreadCount = notifications.filter(n => !n.read).length;
        
        if (window.Notifications) {
            window.Notifications.updateBadge(newUnreadCount);
        }

        // Если появились новые непрочитанные - можно добавить звук
        if (newUnreadCount > oldUnreadCount && window.Notifications && window.Notifications.playSound) {
            window.Notifications.playSound();
        }

        const bellIcon = document.querySelector('.notifications-bell .badge');
        if (bellIcon) {
            if (newUnreadCount > 0) {
                bellIcon.textContent = newUnreadCount > 99 ? '99+' : newUnreadCount;
                bellIcon.classList.remove('hidden');
                
                bellIcon.style.animation = 'none';
                bellIcon.offsetHeight;
                bellIcon.style.animation = 'notificationPulse 2s infinite';
            } else {
                bellIcon.classList.add('hidden');
            }
        }

        document.dispatchEvent(new CustomEvent('unread-changed', { 
            detail: { count: newUnreadCount }
        }));
    }

    // ===== ОТКРЫТЬ/ЗАКРЫТЬ =====
    function open() {
        if (!currentUserId) {
            Utils?.showInfo?.('Войдите, чтобы увидеть уведомления');
            return;
        }

        isOpen = true;
        if (centerEl) centerEl.classList.add('open');
        if (overlayEl) overlayEl.style.display = 'block';
        document.body.style.overflow = 'hidden';
    }

    function close() {
        isOpen = false;
        if (centerEl) centerEl.classList.remove('open');
        if (overlayEl) overlayEl.style.display = 'none';
        document.body.style.overflow = '';
    }

    function toggle() {
        if (isOpen) close();
        else open();
    }

    // ===== ОТМЕТИТЬ КАК ПРОЧИТАННОЕ =====
    async function markAsRead(notificationId) {
        if (!notificationId || !window.db) return;
        
        try {
            await db.collection('notifications').doc(notificationId).update({
                read: true
            });
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

    // ===== ПУБЛИЧНОЕ API =====
    const api = {
        init,
        open,
        close,
        toggle,
        markAsRead,
        markAllAsRead,
        clearAll,
        getUnreadCount,
        handleNotificationClick,
        handleNotificationNavigation
    };

    // Глобальная ссылка
    window.NotificationsCenter = api;
    window.__NOTIFICATIONS_CENTER_INITIALIZED__ = true;
    
    // Автоинициализация
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => api.init(), 1500);
    });

    console.log('✅ NotificationsCenter загружен (полная версия)');
    return Object.freeze(api);
})();

window.NotificationsCenter = NotificationsCenter;