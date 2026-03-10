// ============================================
// КОМПОНЕНТ УВЕДОМЛЕНИЙ (ИСПРАВЛЕННАЯ ВЕРСИЯ)
// ============================================

const Notifications = (function() {
    // Защита от повторных инициализаций
    if (window.__NOTIFICATIONS_INITIALIZED__) {
        return window.Notifications;
    }

    // ===== ПРИВАТНЫЕ ПЕРЕМЕННЫЕ =====
    let profileBadge = null;
    let unsubscribe = null;
    let currentCount = 0;
    let isInitialized = false;
    let notificationPermission = false;

    // ===== ИНИЦИАЛИЗАЦИЯ =====
    function init() {
        if (isInitialized) return;
        
        createBadge();
        setupListeners();
        requestPermission();
        
        isInitialized = true;
        console.log('✅ Notifications компонент загружен');
    }

    // ===== СОЗДАНИЕ БЕЙДЖА =====
    function createBadge() {
        if (document.getElementById('profileBadge')) return;
        
        profileBadge = document.createElement('div');
        profileBadge.id = 'profileBadge';
        profileBadge.className = 'profile-badge hidden';
        profileBadge.textContent = '0';
        document.body.appendChild(profileBadge);
    }

    // ===== НАСТРОЙКА СЛУШАТЕЛЕЙ =====
    function setupListeners() {
        // Подписываемся на изменения авторизации
        if (window.Auth) {
            Auth.onAuthChange((state) => {
                if (state.isAuthenticated && state.user) {
                    subscribeToUnread(state.user.uid);
                } else {
                    unsubscribeFromUnread();
                    updateBadge(0);
                }
            });
        }

        // Слушаем новые сообщения для уведомлений
        document.addEventListener('new-message', (e) => {
            const { chatId, message } = e.detail || {};
            if (document.hidden && message && message.senderId !== Auth?.getUser()?.uid) {
                showBrowserNotification('Новое сообщение', {
                    body: `${message.senderName || 'Пользователь'}: ${message.text || '📎 Файл'}`,
                    data: { chatId }
                });
            }
        });
    }

    // ===== ПОДПИСКА НА НЕПРОЧИТАННЫЕ =====
    function subscribeToUnread(userId) {
        unsubscribeFromUnread();
        
        if (window.Chat && Chat.subscribeToUnread) {
            unsubscribe = Chat.subscribeToUnread(userId, (count) => {
                currentCount = count;
                updateBadge(count);
                updateTitle(count);
                updateTabBadges(count);
                
                // Триггерим событие
                document.dispatchEvent(new CustomEvent('unread-changed', { 
                    detail: { count } 
                }));
            });
        } else {
            // Fallback - периодический опрос
            startPolling(userId);
        }
    }

    function unsubscribeFromUnread() {
        if (unsubscribe) {
            unsubscribe();
            unsubscribe = null;
        }
    }

    // ===== POLLING FALLBACK =====
    function startPolling(userId) {
        let lastCount = 0;
        const interval = setInterval(async () => {
            if (window.Chat && Chat.getUnreadCount) {
                const count = await Chat.getUnreadCount(userId);
                if (count !== lastCount) {
                    lastCount = count;
                    currentCount = count;
                    updateBadge(count);
                    updateTitle(count);
                    updateTabBadges(count);
                }
            }
        }, 10000); // каждые 10 секунд
        
        // Сохраняем для очистки
        window._pollingInterval = interval;
    }

    // ===== ОБНОВЛЕНИЕ БЕЙДЖА =====
    function updateBadge(count) {
        if (!profileBadge) {
            profileBadge = document.getElementById('profileBadge');
            if (!profileBadge) createBadge();
        }
        
        if (!profileBadge) return;
        
        if (count > 0) {
            profileBadge.className = 'profile-badge';
            profileBadge.textContent = count > 99 ? '99+' : count;
            
            // Анимация
            profileBadge.style.animation = 'none';
            profileBadge.offsetHeight; // рефлоу
            profileBadge.style.animation = 'badgePulse 0.3s ease';
        } else {
            profileBadge.className = 'profile-badge hidden';
        }
    }

    // ===== ОБНОВЛЕНИЕ БЕЙДЖЕЙ НА ТАБАХ =====
    function updateTabBadges(count) {
        // Обновляем бейдж на вкладке чатов в кабинете
        const chatTabBadges = document.querySelectorAll('.tab-badge');
        chatTabBadges.forEach(badge => {
            if (count > 0) {
                badge.textContent = count > 99 ? '99+' : count;
                badge.classList.remove('hidden');
            } else {
                badge.classList.add('hidden');
            }
        });

        // Обновляем бейдж в нижней навигации
        const navBadges = document.querySelectorAll('.nav-badge');
        navBadges.forEach(badge => {
            if (count > 0) {
                badge.textContent = count > 99 ? '99+' : count;
                badge.classList.remove('hidden');
            } else {
                badge.classList.add('hidden');
            }
        });
    }

    // ===== ОБНОВЛЕНИЕ ЗАГОЛОВКА =====
    function updateTitle(count) {
        const baseTitle = 'СВОЙ МАСТЕР 86';
        if (count > 0) {
            document.title = `(${count}) ${baseTitle}`;
        } else {
            document.title = baseTitle;
        }
    }

    // ===== РАЗРЕШЕНИЯ =====
    async function requestPermission() {
        if (!('Notification' in window)) {
            console.log('Браузер не поддерживает уведомления');
            return false;
        }
        
        if (Notification.permission === 'granted') {
            notificationPermission = true;
            return true;
        }
        
        if (Notification.permission !== 'denied') {
            try {
                const permission = await Notification.requestPermission();
                notificationPermission = permission === 'granted';
                return notificationPermission;
            } catch (error) {
                console.error('Ошибка запроса разрешения:', error);
                return false;
            }
        }
        
        return false;
    }

    // ===== ПОКАЗ БРАУЗЕРНОГО УВЕДОМЛЕНИЯ =====
    function showBrowserNotification(title, options = {}) {
        if (!notificationPermission && Notification.permission !== 'granted') {
            return null;
        }
        
        try {
            const defaultOptions = {
                icon: '/HomeWork/icons/icon-192x192.png',
                badge: '/HomeWork/icons/icon-72x72.png',
                vibrate: [200, 100, 200],
                silent: false,
                ...options
            };
            
            const notification = new Notification(title, defaultOptions);
            
            notification.onclick = function() {
                window.focus();
                if (options.data?.url) {
                    window.location.href = options.data.url;
                } else if (options.data?.chatId) {
                    window.location.href = `/HomeWork/chat.html?chatId=${options.data.chatId}`;
                } else if (options.data?.orderId) {
                    if (Auth.isMaster()) {
                        window.location.href = `/HomeWork/masters.html?order=${options.data.orderId}`;
                    } else {
                        window.location.href = `/HomeWork/client.html?order=${options.data.orderId}`;
                    }
                }
                this.close();
            };
            
            return notification;
        } catch (error) {
            console.error('Ошибка показа уведомления:', error);
            return null;
        }
    }

    // ===== ПОЛУЧЕНИЕ ТЕКУЩЕГО КОЛИЧЕСТВА =====
    function getCurrentCount() {
        return currentCount;
    }

    // ===== РУЧНОЕ ОБНОВЛЕНИЕ =====
    async function refresh() {
        if (!Auth?.isAuthenticated()) return;
        
        const user = Auth.getUser();
        if (!user) return;
        
        if (window.Chat && Chat.getUnreadCount) {
            const count = await Chat.getUnreadCount(user.uid);
            currentCount = count;
            updateBadge(count);
            updateTitle(count);
            updateTabBadges(count);
        }
    }

    // ===== ОЧИСТКА =====
    function cleanup() {
        unsubscribeFromUnread();
        
        if (window._pollingInterval) {
            clearInterval(window._pollingInterval);
            window._pollingInterval = null;
        }
        
        if (profileBadge) {
            profileBadge.remove();
            profileBadge = null;
        }
        
        isInitialized = false;
    }

    // ===== ПУБЛИЧНОЕ API =====
    const api = {
        init,
        requestPermission,
        showBrowserNotification,
        getCurrentCount,
        refresh,
        cleanup,
        updateBadge,      // экспортируем для внешнего использования (из центра уведомлений)
        updateTabBadges
    };

    window.__NOTIFICATIONS_INITIALIZED__ = true;
    
    return Object.freeze(api);
})();

// Автоинициализация
document.addEventListener('DOMContentLoaded', () => {
    // Ждём загрузки основных сервисов
    setTimeout(() => {
        Notifications.init();
    }, 1500);
});

// Глобальный доступ
window.Notifications = Notifications;