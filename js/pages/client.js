// ===== js/pages/client.js =====
// ПОЛНОСТЬЮ ОБНОВЛЕННЫЙ КАБИНЕТ КЛИЕНТА

(function() {
    // Состояние
    let currentRating = 0;
    let currentOrderId = null;
    let currentMasterId = null;
    let currentFilter = 'all';
    let allOrders = [];
    let displayedOrders = [];
    let currentPage = 0;
    let hasMore = true;
    
    // Модалки
    let reviewModal = null;
    let topupModal = null;
    let editProfileModal = null;
    let achievementsModal = null;

    // Кэш для статистики
    let statsCache = {
        achievements: null,
        progress: null,
        lastUpdate: 0
    };

    // Безопасный Helpers
    const safeHelpers = {
        escapeHtml: (text) => {
            if (!text) return '';
            if (window.Helpers?.escapeHtml) return Helpers.escapeHtml(text);
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        },
        formatDate: (timestamp) => {
            if (window.Helpers?.formatDate) return Helpers.formatDate(timestamp);
            if (!timestamp) return 'только что';
            try {
                const date = GamificationBase?.safeGetDate(timestamp) || new Date(timestamp);
                return date.toLocaleString('ru-RU', { 
                    day: 'numeric', 
                    month: 'long', 
                    hour: '2-digit', 
                    minute: '2-digit' 
                });
            } catch {
                return 'недавно';
            }
        },
        formatShortDate: (timestamp) => {
            if (!timestamp) return '';
            try {
                const date = GamificationBase?.safeGetDate(timestamp) || new Date(timestamp);
                return date.toLocaleString('ru-RU', { 
                    day: 'numeric', 
                    month: 'short',
                    hour: '2-digit', 
                    minute: '2-digit' 
                }).replace('.', '');
            } catch {
                return '';
            }
        },
        formatMoney: (amount) => {
            return new Intl.NumberFormat('ru-RU', {
                style: 'currency',
                currency: 'RUB',
                minimumFractionDigits: 0
            }).format(amount || 0);
        },
        showNotification: (msg, type = 'info') => {
            if (window.Helpers?.showNotification) {
                Helpers.showNotification(msg, type);
            } else {
                const notification = document.createElement('div');
                notification.className = `alert alert-${type} position-fixed top-0 end-0 m-3 animate__animated animate__fadeInRight`;
                notification.style.zIndex = '9999';
                notification.style.minWidth = '300px';
                notification.style.boxShadow = '0 10px 30px rgba(0,0,0,0.2)';
                notification.innerHTML = msg;
                document.body.appendChild(notification);
                
                setTimeout(() => {
                    notification.classList.add('animate__fadeOutRight');
                    setTimeout(() => notification.remove(), 500);
                }, 3000);
            }
        },
        getCategoryIcon: (cat) => {
            const icons = {
                'Сантехника': 'fa-wrench',
                'Электрика': 'fa-bolt',
                'Уборка': 'fa-broom',
                'Ремонт': 'fa-hammer',
                'Сборка мебели': 'fa-couch',
                'Грузчики': 'fa-truck',
                'Малярные работы': 'fa-paint-brush',
                'Плиточные работы': 'fa-th',
                'default': 'fa-tag'
            };
            return icons[cat] || icons.default;
        },
        getCategoryColor: (cat) => {
            const colors = {
                'Сантехника': '#3498db',
                'Электрика': '#f39c12',
                'Уборка': '#2ecc71',
                'Ремонт': '#e74c3c',
                'Сборка мебели': '#9b59b6',
                'Грузчики': '#1abc9c',
                'Малярные работы': '#e67e22',
                'Плиточные работы': '#95a5a6',
                'default': '#34495e'
            };
            return colors[cat] || colors.default;
        },
        pluralize: (count, words) => {
            if (window.Helpers?.pluralize) return Helpers.pluralize(count, words);
            const cases = [2, 0, 1, 1, 1, 2];
            return words[(count % 100 > 4 && count % 100 < 20) ? 2 : cases[Math.min(count % 10, 5)]];
        },
        getStatusConfig: (status) => {
            const configs = {
                'open': {
                    text: 'Активен',
                    icon: 'fa-clock',
                    color: '#3498db',
                    bg: 'rgba(52, 152, 219, 0.1)',
                    border: '#3498db'
                },
                'in_progress': {
                    text: 'В работе',
                    icon: 'fa-cog fa-spin',
                    color: '#f39c12',
                    bg: 'rgba(243, 156, 18, 0.1)',
                    border: '#f39c12'
                },
                'completed': {
                    text: 'Завершён',
                    icon: 'fa-check-circle',
                    color: '#2ecc71',
                    bg: 'rgba(46, 204, 113, 0.1)',
                    border: '#2ecc71'
                },
                'cancelled': {
                    text: 'Отменён',
                    icon: 'fa-times-circle',
                    color: '#e74c3c',
                    bg: 'rgba(231, 76, 60, 0.1)',
                    border: '#e74c3c'
                }
            };
            return configs[status] || configs.open;
        }
    };

    // Получить элемент
    const $ = (id) => document.getElementById(id);

    // ===== ИНИЦИАЛИЗАЦИЯ =====
    document.addEventListener('DOMContentLoaded', async () => {
        console.log('🚀 Клиентский кабинет загружается...');
        
        // Инициализируем модалки
        initModals();
        
        // Подписываемся на изменения авторизации
        if (window.Auth?.onAuthChange) {
            Auth.onAuthChange(handleAuthChange);
        }
        
        // Инициализируем обработчики
        initEventListeners();
        
        // Проверяем текущий статус
        if (Auth?.isAuthenticated?.()) {
            await handleAuthChange({
                isAuthenticated: true,
                user: Auth.getUser(),
                userData: Auth.getUserData(),
                isClient: !Auth.isMaster?.()
            });
        }
    });

    // ===== ИНИЦИАЛИЗАЦИЯ МОДАЛОК =====
    function initModals() {
        try {
            if (typeof bootstrap !== 'undefined') {
                const reviewEl = $('reviewModal');
                if (reviewEl) reviewModal = new bootstrap.Modal(reviewEl);
                
                const topupEl = $('topupModal');
                if (topupEl) topupModal = new bootstrap.Modal(topupEl);
                
                const editEl = $('editProfileModal');
                if (editEl) editProfileModal = new bootstrap.Modal(editEl);
                
                const achievementsEl = $('achievementsModal');
                if (achievementsEl) achievementsModal = new bootstrap.Modal(achievementsEl);
            }
        } catch (error) {
            console.error('❌ Ошибка инициализации модалок:', error);
        }
    }

    // ===== ОБРАБОТКА ИЗМЕНЕНИЯ АВТОРИЗАЦИИ =====
    async function handleAuthChange(state) {
        console.log('🔄 Статус авторизации:', state);
        
        const authRequired = $('authRequired');
        const clientCabinet = $('clientCabinet');
        const welcomeBanner = $('welcomeBanner');
        const headerXPBadge = $('headerXPBadge');
        
        if (state.isAuthenticated && state.isClient) {
            // Показываем кабинет
            if (authRequired) authRequired.style.display = 'none';
            if (clientCabinet) clientCabinet.classList.remove('d-none');
            if (welcomeBanner) welcomeBanner.style.display = 'flex';
            if (headerXPBadge) headerXPBadge.style.display = 'flex';
            
            // Заполняем профиль
            await loadClientProfile();
            
            // Загружаем данные
            await Promise.all([
                loadClientOrders('all'),
                loadFavorites(),
                loadPayments(),
                loadChats(),
                loadTrackingOrders(),
                loadAchievements(),
                updateLevelProgress()
            ]);
            
            // Инициализируем карту
            initTrackingMap();
            
        } else if (state.isAuthenticated && !state.isClient) {
            safeHelpers.showNotification('❌ Эта страница только для клиентов', 'warning');
            setTimeout(() => window.location.href = '/HomeWork/masters.html', 1500);
            
        } else {
            // Показываем блок авторизации
            if (authRequired) authRequired.style.display = 'block';
            if (clientCabinet) clientCabinet.classList.add('d-none');
            if (welcomeBanner) welcomeBanner.style.display = 'none';
            if (headerXPBadge) headerXPBadge.style.display = 'none';
        }
    }

    // ===== ЗАГРУЗКА ПРОФИЛЯ =====
    async function loadClientProfile() {
        try {
            const user = Auth.getUser();
            const userData = Auth.getUserData();
            
            if (!user || !userData) return;
            
            // Имя
            const nameEl = $('clientName');
            if (nameEl) nameEl.textContent = userData.name || 'Клиент';
            
            // Приветствие
            const welcomeName = $('welcomeName');
            if (welcomeName) welcomeName.textContent = userData.name || 'Клиент';
            
            // Роль
            const roleEl = $('clientRole');
            if (roleEl) roleEl.textContent = 'Клиент';
            
            // Email
            const emailEl = $('editEmail');
            if (emailEl) emailEl.value = user.email || '';
            
            // Телефон
            const phoneEl = $('editPhone');
            if (phoneEl) phoneEl.value = userData.phone || '';
            
            // О себе
            const bioEl = $('editBio');
            if (bioEl) bioEl.value = userData.bio || '';
            
            // Баланс
            const balanceEl = $('clientBalance');
            if (balanceEl) balanceEl.textContent = safeHelpers.formatMoney(userData.balance || 0);
            
            const financeBalance = $('financeBalance');
            if (financeBalance) financeBalance.textContent = safeHelpers.formatMoney(userData.balance || 0);
            
            // Дата регистрации
            const memberSince = $('memberSince');
            if (memberSince && userData.createdAt) {
                const date = GamificationBase?.safeGetDate(userData.createdAt) || new Date(userData.createdAt);
                memberSince.textContent = date.toLocaleDateString('ru-RU', { 
                    month: 'long', 
                    year: 'numeric' 
                });
            }
            
        } catch (error) {
            console.error('❌ Ошибка загрузки профиля:', error);
        }
    }

    // ===== ЗАГРУЗКА ДОСТИЖЕНИЙ =====
    async function loadAchievements() {
        const container = $('achievementsIcons');
        if (!container) return;
        
        try {
            const user = Auth.getUser();
            if (!user) return;
            
            if (statsCache.achievements && Date.now() - statsCache.lastUpdate < 300000) {
                renderAchievementsIcons(statsCache.achievements);
                return;
            }
            
            const achievements = await ClientGamification.getUserAchievementsWithStatus(user.uid);
            statsCache.achievements = achievements;
            statsCache.lastUpdate = Date.now();
            
            renderAchievementsIcons(achievements);
            
        } catch (error) {
            console.error('❌ Ошибка загрузки достижений:', error);
            container.innerHTML = '<div class="text-secondary small">Ошибка загрузки</div>';
        }
    }

    // ===== ОТРИСОВКА ИКОНОК ДОСТИЖЕНИЙ =====
    function renderAchievementsIcons(achievements) {
        const container = $('achievementsIcons');
        if (!container) return;
        
        const earned = achievements.filter(a => a.earned);
        const earnedCount = earned.length;
        const totalCount = achievements.length;
        
        const achievementsCount = $('achievementsCount');
        if (achievementsCount) {
            achievementsCount.textContent = `${earnedCount}/${totalCount}`;
        }
        
        let displayAchievements = earned.slice(0, 8);
        
        if (displayAchievements.length < 8) {
            const notEarned = achievements.filter(a => !a.earned).slice(0, 8 - displayAchievements.length);
            displayAchievements = [...displayAchievements, ...notEarned];
        }
        
        container.innerHTML = displayAchievements.map(ach => `
            <div class="achievement-icon-mini ${ach.earned ? 'earned' : 'locked'}" 
                 title="${ach.earned ? '✓ ' : '🔒 '}${ach.title}: ${ach.description}">
                <i class="fas ${ach.icon}"></i>
            </div>
        `).join('');
    }

    // ===== ОБНОВЛЕНИЕ ПРОГРЕССА УРОВНЯ =====
    async function updateLevelProgress() {
        try {
            const user = Auth.getUser();
            const userData = Auth.getUserData();
            
            if (!user || !userData) return;
            
            const xp = userData.xp || 0;
            const progress = ClientGamification.getLevelProgress(xp);
            
            const progressBar = $('xpProgressBar');
            if (progressBar) progressBar.style.width = `${progress.progress}%`;
            
            const progressText = $('xpProgressText');
            if (progressText) {
                if (progress.next) {
                    progressText.textContent = `${xp}/${progress.next.minXP} XP`;
                } else {
                    progressText.textContent = `${xp} XP (макс. уровень)`;
                }
            }
            
            const xpToNextLevel = $('xpToNextLevel');
            if (xpToNextLevel) {
                if (progress.next) {
                    xpToNextLevel.textContent = `${progress.xpToNext} XP`;
                } else {
                    xpToNextLevel.textContent = 'Макс. уровень';
                }
            }
            
            const currentLevelName = $('currentLevelName');
            if (currentLevelName) currentLevelName.textContent = progress.current.name;
            
            const levelBadge = $('levelBadge');
            if (levelBadge) levelBadge.textContent = progress.current.level;
            
            const headerLevel = $('headerLevel');
            if (headerLevel) headerLevel.textContent = progress.current.level;
            
            const headerXP = $('headerXP');
            if (headerXP) headerXP.textContent = xp;
            
        } catch (error) {
            console.error('❌ Ошибка обновления прогресса:', error);
        }
    }

    // ===== ЗАГРУЗКА ЗАКАЗОВ =====
    async function loadClientOrders(filter = 'all') {
        const ordersList = $('ordersList');
        if (!ordersList) return;
        
        currentFilter = filter;
        currentPage = 0;
        
        ordersList.innerHTML = `
            <div class="text-center p-5">
                <div class="spinner-border text-primary mb-3" role="status">
                    <span class="visually-hidden">Загрузка...</span>
                </div>
                <p class="text-secondary">Загрузка заказов...</p>
            </div>
        `;
        
        try {
            const user = Auth.getUser();
            if (!user) return;
            
            if (!window.Orders?.getClientOrders) {
                throw new Error('Сервис заказов недоступен');
            }
            
            const orders = await Orders.getClientOrders(user.uid, filter);
            allOrders = orders || [];
            
            const userData = Auth.getUserData();
            if (userData) {
                const completedCount = allOrders.filter(o => o.status === 'completed').length;
                const mastersCount = new Set(allOrders.filter(o => o.selectedMasterId).map(o => o.selectedMasterId)).size;
                
                await db.collection('users').doc(user.uid).update({
                    ordersCount: allOrders.length,
                    completedOrders: completedCount,
                    mastersCount: mastersCount
                }).catch(() => {});
            }
            
            displayedOrders = orders.slice(0, 5);
            hasMore = orders.length > 5;
            
            renderOrders();
            
            const ordersCount = $('ordersCount');
            if (ordersCount) ordersCount.textContent = allOrders.length;
            
            const loadMoreBtn = $('loadMoreOrders');
            if (loadMoreBtn) loadMoreBtn.style.display = hasMore ? 'block' : 'none';
            
        } catch (error) {
            console.error('❌ Ошибка загрузки заказов:', error);
            ordersList.innerHTML = `
                <div class="text-center p-5">
                    <i class="fas fa-exclamation-circle fa-3x mb-3" style="color: var(--danger);"></i>
                    <h5>Ошибка загрузки</h5>
                    <p class="text-secondary">${error.message}</p>
                    <button class="btn btn-outline-secondary mt-3" onclick="window.location.reload()">
                        <i class="fas fa-sync-alt me-2"></i>Обновить страницу
                    </button>
                </div>
            `;
        }
    }

    // ===== ОТРИСОВКА ЗАКАЗОВ (КРУТЫЕ КАРТОЧКИ) =====
    function renderOrders() {
        const ordersList = $('ordersList');
        if (!ordersList) return;
        
        if (displayedOrders.length === 0) {
            ordersList.innerHTML = `
                <div class="text-center p-5">
                    <div class="empty-state-illustration mb-4">
                        <i class="fas fa-clipboard-list fa-5x" style="color: var(--border); opacity: 0.5;"></i>
                    </div>
                    <h4 class="mb-3">У вас пока нет заказов</h4>
                    <p class="text-secondary mb-4">Создайте первую заявку и мастера сами найдут вас!</p>
                    <a href="/HomeWork/" class="btn btn-lg" style="background: var(--accent); color: white; padding: 12px 40px;">
                        <i class="fas fa-plus-circle me-2"></i>Создать заказ
                    </a>
                </div>
            `;
            return;
        }
        
        ordersList.innerHTML = '';
        displayedOrders.forEach(order => {
            const card = createOrderCard(order);
            if (card) ordersList.appendChild(card);
        });
    }

    // ===== СОЗДАНИЕ КРУТОЙ КАРТОЧКИ ЗАКАЗА =====
    function createOrderCard(order) {
        if (!order) return null;
        
        const div = document.createElement('div');
        div.className = 'order-card mb-4 animate__animated animate__fadeIn';
        
        const status = safeHelpers.getStatusConfig(order.status);
        const categoryColor = safeHelpers.getCategoryColor(order.category);
        const categoryIcon = safeHelpers.getCategoryIcon(order.category);
        
        // Определяем, есть ли отклики
        const hasResponses = order.responses && order.responses.length > 0;
        const responsesCount = order.responses?.length || 0;
        
        // Выбран ли мастер
        const hasMaster = !!order.selectedMasterId;
        
        // Фото (если есть)
        let photoPreview = '';
        if (order.photos && order.photos.length > 0) {
            photoPreview = `
                <div class="order-photo-preview" onclick="window.open('${order.photos[0]}')">
                    <img src="${order.photos[0]}" alt="Фото заказа">
                    ${order.photos.length > 1 ? `<span class="photo-count">+${order.photos.length - 1}</span>` : ''}
                </div>
            `;
        }
        
        // Визуальный индикатор статуса
        const statusIndicator = `
            <div class="status-indicator" style="background: ${status.color}; box-shadow: 0 0 15px ${status.color}40;">
                <i class="fas ${status.icon}"></i>
            </div>
        `;
        
        // Хедер с категорией и ценой
        const header = `
            <div class="order-card-header">
                <div class="category-badge" style="background: ${categoryColor}15; color: ${categoryColor};">
                    <i class="fas ${categoryIcon} me-1"></i>
                    <span>${order.category || 'Услуга'}</span>
                </div>
                <div class="order-price-tag">
                    <span class="price-amount">${safeHelpers.formatMoney(order.price)}</span>
                    <span class="price-label">₽</span>
                </div>
            </div>
        `;
        
        // Основная информация
        const body = `
            <div class="order-card-body">
                <div class="order-title-section">
                    <h4 class="order-title">${safeHelpers.escapeHtml(order.title || 'Заказ')}</h4>
                    ${order.urgent ? '<span class="urgent-badge"><i class="fas fa-exclamation-circle me-1"></i>Срочно</span>' : ''}
                </div>
                
                <p class="order-description">${safeHelpers.escapeHtml(order.description || 'Нет описания').substring(0, 150)}${order.description?.length > 150 ? '...' : ''}</p>
                
                <div class="order-meta-grid">
                    <div class="meta-item">
                        <i class="fas fa-map-marker-alt" style="color: ${categoryColor};"></i>
                        <span>${safeHelpers.escapeHtml(order.address || 'Адрес не указан')}</span>
                    </div>
                    <div class="meta-item">
                        <i class="fas fa-calendar-alt" style="color: ${categoryColor};"></i>
                        <span>${safeHelpers.formatShortDate(order.createdAt)}</span>
                    </div>
                    ${order.preferredDate ? `
                    <div class="meta-item">
                        <i class="fas fa-clock" style="color: ${categoryColor};"></i>
                        <span>К ${safeHelpers.formatShortDate(order.preferredDate)}</span>
                    </div>
                    ` : ''}
                </div>
            </div>
        `;
        
        // Статус и действия
        const footer = `
            <div class="order-card-footer">
                <div class="order-status-wrapper">
                    <div class="order-status" style="background: ${status.bg}; color: ${status.color}; border-left: 4px solid ${status.color};">
                        <i class="fas ${status.icon} me-2"></i>
                        <span>${status.text}</span>
                    </div>
                    
                    ${hasMaster ? `
                        <div class="master-status">
                            <i class="fas fa-user-check" style="color: #2ecc71;"></i>
                            <span>Мастер выбран</span>
                        </div>
                    ` : ''}
                </div>
                
                <div class="order-stats">
                    ${hasResponses ? `
                        <div class="responses-count" title="${responsesCount} ${safeHelpers.pluralize(responsesCount, ['отклик', 'отклика', 'откликов'])}">
                            <i class="fas fa-users" style="color: ${status.color};"></i>
                            <span>${responsesCount}</span>
                        </div>
                    ` : ''}
                    
                    <button class="btn-action" onclick="event.stopPropagation(); toggleOrderDetails('${order.id}')">
                        <i class="fas fa-chevron-down"></i>
                    </button>
                </div>
            </div>
        `;
        
        // Секция с откликами (скрыта по умолчанию)
        let responsesSection = '';
        if (hasResponses) {
            responsesSection = `
                <div class="order-responses-section" id="responses-${order.id}" style="display: none;">
                    <h6 class="responses-title">
                        <i class="fas fa-users me-2" style="color: var(--accent);"></i>
                        Отклики мастеров (${responsesCount})
                    </h6>
                    <div class="responses-grid">
                        ${order.responses.map(resp => createResponseCard(order, resp)).join('')}
                    </div>
                </div>
            `;
        }
        
        div.innerHTML = `
            <div class="order-card-inner">
                ${statusIndicator}
                <div class="order-card-content">
                    <div class="order-card-main">
                        <div class="order-card-left">
                            ${photoPreview || `<div class="order-photo-placeholder" style="background: ${categoryColor}15; color: ${categoryColor};"><i class="fas ${categoryIcon} fa-2x"></i></div>`}
                        </div>
                        <div class="order-card-right">
                            ${header}
                            ${body}
                            ${footer}
                        </div>
                    </div>
                    ${responsesSection}
                </div>
            </div>
        `;
        
        return div;
    }

    // ===== СОЗДАНИЕ КАРТОЧКИ ОТКЛИКА (УЛУЧШЕННАЯ) =====
    function createResponseCard(order, resp) {
        const hasReview = order.reviews?.some(r => r.masterId === resp.masterId);
        const isSelected = order.selectedMasterId === resp.masterId;
        
        const rating = resp.masterRating || 0;
        const stars = '★'.repeat(Math.floor(rating)) + '☆'.repeat(5 - Math.floor(rating));
        
        // Определяем время отклика
        const responseTime = resp.createdAt ? safeHelpers.formatShortDate(resp.createdAt) : 'только что';
        
        return `
            <div class="response-card ${isSelected ? 'selected' : ''}">
                ${isSelected ? '<div class="selected-badge"><i class="fas fa-crown me-1"></i>Выбран</div>' : ''}
                
                <div class="response-avatar">
                    <i class="fas fa-user-tie"></i>
                </div>
                
                <div class="response-content">
                    <div class="response-header">
                        <div class="response-name">
                            <h6>${safeHelpers.escapeHtml(resp.masterName || 'Мастер')}</h6>
                            <div class="response-rating">
                                <span class="rating-stars" style="color: gold;">${stars}</span>
                                <span class="rating-count">(${resp.masterReviews || 0})</span>
                            </div>
                        </div>
                        <div class="response-price">${safeHelpers.formatMoney(resp.price)}</div>
                    </div>
                    
                    ${resp.comment ? `<p class="response-comment">${safeHelpers.escapeHtml(resp.comment)}</p>` : ''}
                    
                    <div class="response-meta">
                        <span class="response-time">
                            <i class="fas fa-clock me-1"></i>${responseTime}
                        </span>
                    </div>
                    
                    <div class="response-actions">
                        <button class="btn-response primary" onclick="window.openChat('${order.id}', '${resp.masterId}')">
                            <i class="fas fa-comment me-2"></i>Чат
                        </button>
                        
                        ${order.status === 'open' && !isSelected ? `
                            <button class="btn-response success" onclick="window.selectMaster('${order.id}', '${resp.masterId}', ${resp.price})">
                                <i class="fas fa-check me-2"></i>Выбрать
                            </button>
                        ` : ''}
                        
                        ${order.status === 'completed' && !hasReview ? `
                            <button class="btn-response warning" onclick="window.openReview('${order.id}', '${resp.masterId}', '${safeHelpers.escapeHtml(resp.masterName || 'Мастер')}')">
                                <i class="fas fa-star me-2"></i>Оценить
                            </button>
                        ` : ''}
                        
                        <button class="btn-response favorite" onclick="window.toggleFavorite('${resp.masterId}')">
                            <i class="fas fa-heart"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    // ===== ПОКАЗ/СКРЫТИЕ ОТКЛИКОВ =====
    window.toggleOrderDetails = (orderId) => {
        const section = $(`responses-${orderId}`);
        const btn = event.currentTarget;
        const icon = btn.querySelector('i');
        
        if (section) {
            if (section.style.display === 'none') {
                section.style.display = 'block';
                icon.classList.remove('fa-chevron-down');
                icon.classList.add('fa-chevron-up');
                btn.classList.add('active');
            } else {
                section.style.display = 'none';
                icon.classList.remove('fa-chevron-up');
                icon.classList.add('fa-chevron-down');
                btn.classList.remove('active');
            }
        }
    };

    // ===== ЗАГРУЗКА ИЗБРАННОГО =====
    async function loadFavorites() {
        const container = $('favoritesList');
        if (!container) return;
        
        try {
            const user = Auth.getUser();
            if (!user) return;
            
            const userData = Auth.getUserData();
            const favorites = userData.favorites || [];
            
            if (favorites.length === 0) {
                container.innerHTML = `
                    <div class="col-12">
                        <div class="text-center p-5">
                            <i class="fas fa-heart fa-4x mb-3" style="color: var(--border); opacity: 0.5;"></i>
                            <h4 class="mb-3">Нет избранных мастеров</h4>
                            <p class="text-secondary mb-4">Добавляйте мастеров в избранное после заказов</p>
                        </div>
                    </div>
                `;
                return;
            }
            
            container.innerHTML = '';
            
            const masterPromises = favorites.map(masterId => 
                db.collection('users').doc(masterId).get()
            );
            
            const masterDocs = await Promise.all(masterPromises);
            
            masterDocs.forEach((doc, index) => {
                if (doc.exists) {
                    const master = doc.data();
                    const col = document.createElement('div');
                    col.className = 'col-md-6';
                    col.innerHTML = createFavoriteCard(favorites[index], master);
                    container.appendChild(col);
                }
            });
            
        } catch (error) {
            console.error('❌ Ошибка загрузки избранного:', error);
            container.innerHTML = `
                <div class="col-12">
                    <div class="text-center p-5 text-danger">
                        <i class="fas fa-exclamation-circle fa-3x mb-3"></i>
                        <p>Ошибка загрузки избранного</p>
                    </div>
                </div>
            `;
        }
    }

    // ===== КАРТОЧКА ИЗБРАННОГО =====
    function createFavoriteCard(id, master) {
        const rating = master.rating || 0;
        const stars = '★'.repeat(Math.floor(rating)) + '☆'.repeat(5 - Math.floor(rating));
        
        return `
            <div class="favorite-card">
                <div class="favorite-avatar">
                    <i class="fas fa-user-tie fa-2x"></i>
                </div>
                <div class="favorite-info">
                    <h5 class="favorite-name">${safeHelpers.escapeHtml(master.name || 'Мастер')}</h5>
                    <p class="favorite-category">${safeHelpers.escapeHtml(master.categories || 'Специалист')}</p>
                    <div class="favorite-rating">
                        <span class="rating-stars" style="color: gold;">${stars}</span>
                        <span class="rating-text">${master.reviews || 0} отзывов</span>
                    </div>
                </div>
                <div class="favorite-actions">
                    <button class="btn-icon" onclick="window.open('/HomeWork/master-profile.html?id=${id}')" title="Профиль">
                        <i class="fas fa-user"></i>
                    </button>
                    <button class="btn-icon danger" onclick="window.removeFromFavorites('${id}')" title="Удалить">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }

    // ===== ЗАГРУЗКА ПЛАТЕЖЕЙ =====
    async function loadPayments() {
        const container = $('paymentsList');
        if (!container) return;
        
        try {
            const user = Auth.getUser();
            if (!user) return;
            
            const paymentsSnapshot = await db.collection('payments')
                .where('userId', '==', user.uid)
                .orderBy('createdAt', 'desc')
                .limit(10)
                .get();
            
            if (paymentsSnapshot.empty) {
                container.innerHTML = `
                    <div class="text-center p-4">
                        <i class="fas fa-credit-card fa-3x mb-3" style="color: var(--border); opacity: 0.5;"></i>
                        <p class="text-secondary">Нет операций</p>
                    </div>
                `;
                return;
            }
            
            let html = '';
            paymentsSnapshot.forEach(doc => {
                const payment = doc.data();
                const isIncome = payment.type === 'topup';
                const sign = isIncome ? '+' : '-';
                const color = isIncome ? '#2ecc71' : '#e74c3c';
                
                html += `
                    <div class="payment-item">
                        <div class="payment-icon" style="background: ${color}15; color: ${color};">
                            <i class="fas ${isIncome ? 'fa-arrow-down' : 'fa-arrow-up'}"></i>
                        </div>
                        <div class="payment-details">
                            <div class="payment-title">${payment.description || (isIncome ? 'Пополнение баланса' : 'Списание')}</div>
                            <div class="payment-date">${safeHelpers.formatDate(payment.createdAt)}</div>
                        </div>
                        <div class="payment-amount" style="color: ${color};">
                            ${sign}${safeHelpers.formatMoney(payment.amount)}
                        </div>
                    </div>
                `;
            });
            
            container.innerHTML = html;
            
            await updateFinanceStats();
            
        } catch (error) {
            console.error('❌ Ошибка загрузки платежей:', error);
            container.innerHTML = `
                <div class="text-center p-4 text-danger">
                    <i class="fas fa-exclamation-circle fa-3x mb-3"></i>
                    <p>Ошибка загрузки</p>
                </div>
            `;
        }
    }

    // ===== ОБНОВЛЕНИЕ ФИНАНСОВОЙ СТАТИСТИКИ =====
    async function updateFinanceStats() {
        try {
            const user = Auth.getUser();
            if (!user) return;
            
            const userData = Auth.getUserData();
            
            const totalSpent = userData.totalSpent || 0;
            const financeTotalSpent = $('financeTotalSpent');
            if (financeTotalSpent) financeTotalSpent.textContent = safeHelpers.formatMoney(totalSpent);
            
            const statTotalSpent = $('statTotalSpent');
            if (statTotalSpent) statTotalSpent.textContent = safeHelpers.formatMoney(totalSpent);
            
            const orders = await Orders.getClientOrders(user.uid, 'all');
            const avgOrder = orders.length > 0 
                ? orders.reduce((sum, o) => sum + (o.price || 0), 0) / orders.length 
                : 0;
            
            const financeAvgOrder = $('financeAvgOrder');
            if (financeAvgOrder) financeAvgOrder.textContent = safeHelpers.formatMoney(avgOrder);
            
        } catch (error) {
            console.error('❌ Ошибка обновления финансовой статистики:', error);
        }
    }

    // ===== ЗАГРУЗКА ЧАТОВ =====
    async function loadChats() {
        const container = $('chatsList');
        if (!container) return;
        
        try {
            const user = Auth.getUser();
            if (!user) return;
            
            const chatsSnapshot = await db.collection('chats')
                .where('participants', 'array-contains', user.uid)
                .orderBy('lastMessageAt', 'desc')
                .limit(20)
                .get();
            
            if (chatsSnapshot.empty) {
                container.innerHTML = `
                    <div class="text-center p-5">
                        <i class="fas fa-comments fa-4x mb-3" style="color: var(--border); opacity: 0.5;"></i>
                        <h4 class="mb-3">Нет активных чатов</h4>
                        <p class="text-secondary mb-4">Начните общение с мастером после выбора мастера</p>
                        <a href="/HomeWork/" class="btn btn-outline-secondary">
                            <i class="fas fa-plus-circle me-2"></i>Создать заказ
                        </a>
                    </div>
                `;
                return;
            }
            
            container.innerHTML = '';
            
            const chatPromises = chatsSnapshot.docs.map(async (doc) => {
                const chat = doc.data();
                const otherId = chat.participants.find(id => id !== user.uid);
                
                if (otherId) {
                    const otherDoc = await db.collection('users').doc(otherId).get();
                    const other = otherDoc.data();
                    return { chat, other, chatId: doc.id };
                }
                return null;
            });
            
            const chatData = await Promise.all(chatPromises);
            
            chatData.filter(c => c).forEach(({ chat, other, chatId }) => {
                const card = document.createElement('div');
                card.className = 'chat-card mb-2';
                card.onclick = () => window.location.href = `/HomeWork/chat.html?chatId=${chatId}`;
                
                const lastMessage = chat.lastMessage || 'Нет сообщений';
                const truncatedMessage = lastMessage.length > 40 ? lastMessage.substring(0, 40) + '...' : lastMessage;
                
                card.innerHTML = `
                    <div class="chat-avatar" style="background: ${other.role === 'master' ? 'var(--accent-gradient)' : 'linear-gradient(135deg, #3498db, #2980b9)'};">
                        <i class="fas ${other.role === 'master' ? 'fa-user-tie' : 'fa-user'}"></i>
                    </div>
                    <div class="chat-info">
                        <div class="chat-name">${safeHelpers.escapeHtml(other.name || 'Пользователь')}</div>
                        <div class="chat-last-message">${truncatedMessage}</div>
                    </div>
                    <div class="chat-meta">
                        <div class="chat-time">${safeHelpers.formatShortDate(chat.lastMessageAt)}</div>
                        ${chat.unreadCount && chat.unreadCount[user.uid] ? `<span class="chat-unread">${chat.unreadCount[user.uid] > 99 ? '99+' : chat.unreadCount[user.uid]}</span>` : ''}
                    </div>
                `;
                
                container.appendChild(card);
            });
            
            const unreadCount = chatData.reduce((sum, c) => sum + (c?.chat.unreadCount?.[user.uid] || 0), 0);
            const badge = $('unreadMessagesBadge');
            if (badge) {
                badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
                badge.style.display = unreadCount > 0 ? 'flex' : 'none';
            }
            
        } catch (error) {
            console.error('❌ Ошибка загрузки чатов:', error);
            container.innerHTML = `
                <div class="text-center p-4 text-danger">
                    <i class="fas fa-exclamation-circle fa-3x mb-3"></i>
                    <p>Ошибка загрузки чатов</p>
                </div>
            `;
        }
    }

    // ===== ЗАГРУЗКА ЗАКАЗОВ ДЛЯ ОТСЛЕЖИВАНИЯ =====
    async function loadTrackingOrders() {
        const container = $('activeTrackingOrders');
        if (!container) return;
        
        try {
            const user = Auth.getUser();
            if (!user) return;
            
            const ordersSnapshot = await db.collection('orders')
                .where('clientId', '==', user.uid)
                .where('status', '==', 'in_progress')
                .where('selectedMasterId', '!=', null)
                .get();
            
            if (ordersSnapshot.empty) {
                container.innerHTML = `
                    <div class="alert alert-info" style="border-radius: 20px; border: none;">
                        <i class="fas fa-info-circle me-2"></i>
                        Нет заказов в работе для отслеживания
                    </div>
                `;
                return;
            }
            
            let html = '<div class="tracking-select mb-3">';
            html += '<label class="form-label fw-bold mb-2">Выберите заказ для отслеживания:</label>';
            html += '<select class="form-select" id="trackingOrderSelect" style="border-radius: 15px; padding: 12px;">';
            html += '<option value="">📋 Выберите заказ</option>';
            
            ordersSnapshot.forEach(doc => {
                const order = doc.data();
                html += `<option value="${doc.id}">${order.title || 'Заказ'} - ${order.address || ''}</option>`;
            });
            
            html += '</select></div>';
            
            container.innerHTML = html;
            
        } catch (error) {
            console.error('❌ Ошибка загрузки заказов для отслеживания:', error);
            container.innerHTML = `
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-circle me-2"></i>
                    Ошибка загрузки заказов
                </div>
            `;
        }
    }

    // ===== ИНИЦИАЛИЗАЦИЯ КАРТЫ ОТСЛЕЖИВАНИЯ =====
    function initTrackingMap() {
        if (typeof ymaps === 'undefined') {
            console.warn('⚠️ Яндекс.Карты не загружены');
            return;
        }
        
        ymaps.ready(() => {
            const mapEl = $('trackingMap');
            if (!mapEl) return;
            
            const map = new ymaps.Map('trackingMap', {
                center: [55.76, 37.64],
                zoom: 10
            });
            
            const select = $('trackingOrderSelect');
            if (select) {
                select.addEventListener('change', async (e) => {
                    const orderId = e.target.value;
                    if (!orderId) {
                        map.geoObjects.removeAll();
                        return;
                    }
                    
                    try {
                        const orderDoc = await db.collection('orders').doc(orderId).get();
                        const order = orderDoc.data();
                        
                        map.geoObjects.removeAll();
                        
                        if (order.latitude && order.longitude) {
                            const orderPlacemark = new ymaps.Placemark(
                                [order.latitude, order.longitude],
                                { 
                                    hintContent: '📍 Ваш заказ',
                                    balloonContent: `<b>${order.title || 'Заказ'}</b><br>${order.address || ''}`
                                },
                                { preset: 'islands#greenIcon' }
                            );
                            map.geoObjects.add(orderPlacemark);
                            
                            if (order.masterLatitude && order.masterLongitude) {
                                const masterPlacemark = new ymaps.Placemark(
                                    [order.masterLatitude, order.masterLongitude],
                                    { 
                                        hintContent: '🔧 Мастер',
                                        balloonContent: `<b>${order.masterName || 'Мастер'}</b><br>В пути к вам`
                                    },
                                    { preset: 'islands#blueIcon' }
                                );
                                map.geoObjects.add(masterPlacemark);
                                
                                try {
                                    const multiRoute = new ymaps.multiRouter.MultiRoute({
                                        referencePoints: [
                                            [order.masterLatitude, order.masterLongitude],
                                            [order.latitude, order.longitude]
                                        ],
                                        params: { routingMode: 'auto' }
                                    }, {
                                        boundsAutoApply: true
                                    });
                                    
                                    map.geoObjects.add(multiRoute);
                                } catch (routeError) {
                                    console.warn('⚠️ Ошибка построения маршрута:', routeError);
                                }
                                
                                await updateTrackingInfo(order);
                            }
                            
                            map.setCenter([order.latitude, order.longitude], 12);
                        }
                        
                    } catch (error) {
                        console.error('❌ Ошибка загрузки данных для карты:', error);
                        safeHelpers.showNotification('Ошибка загрузки данных для карты', 'error');
                    }
                });
            }
        });
    }

    // ===== ОБНОВЛЕНИЕ ИНФОРМАЦИИ О ТРЕКИНГЕ =====
    async function updateTrackingInfo(order) {
        const panel = $('trackingInfoPanel');
        if (!panel) return;
        
        panel.style.display = 'block';
        
        const eta = Math.floor(Math.random() * 30) + 15;
        
        panel.innerHTML = `
            <div class="tracking-info-card">
                <h6 class="mb-3">
                    <i class="fas fa-info-circle me-2" style="color: var(--accent);"></i>
                    Информация о заказе
                </h6>
                <div class="row g-3">
                    <div class="col-md-4">
                        <div class="tracking-stat">
                            <span class="tracking-label">Мастер</span>
                            <span class="tracking-value">${safeHelpers.escapeHtml(order.masterName || 'Неизвестно')}</span>
                        </div>
                    </div>
                    <div class="col-md-4">
                        <div class="tracking-stat">
                            <span class="tracking-label">Телефон</span>
                            <span class="tracking-value">
                                ${order.masterPhone ? `<a href="tel:${order.masterPhone}">${order.masterPhone}</a>` : 'Скрыт'}
                            </span>
                        </div>
                    </div>
                    <div class="col-md-4">
                        <div class="tracking-stat">
                            <span class="tracking-label">Прибытие</span>
                            <span class="tracking-value tracking-eta">
                                <i class="fas fa-clock me-1"></i>≈ ${eta} мин
                            </span>
                        </div>
                    </div>
                </div>
                <div class="mt-3">
                    <button class="btn btn-sm btn-outline-secondary" onclick="window.openChat('${order.id}', '${order.selectedMasterId}')">
                        <i class="fas fa-comment me-1"></i> Написать мастеру
                    </button>
                </div>
            </div>
        `;
    }

    // ===== ВЫБОР МАСТЕРА =====
    window.selectMaster = async (orderId, masterId, price) => {
        if (!confirm('Вы уверены, что хотите выбрать этого мастера?')) return;
        
        try {
            if (!window.Orders?.selectMaster) {
                throw new Error('Сервис заказов недоступен');
            }
            
            const result = await Orders.selectMaster(orderId, masterId, price);
            
            if (result.success) {
                safeHelpers.showNotification('✅ Мастер выбран! Чат открыт', 'success');
                
                const user = Auth.getUser();
                if (user && window.ClientGamification) {
                    await ClientGamification.addXP(user.uid, 10, 'Выбор мастера');
                    await ClientGamification.checkAchievements(user.uid);
                    
                    await updateLevelProgress();
                    await loadAchievements();
                }
                
                await loadClientOrders(currentFilter);
                
                // Открываем чат через 500мс
                setTimeout(() => {
                    window.location.href = `/HomeWork/chat.html?chatId=${result.chatId}&orderId=${orderId}&masterId=${masterId}`;
                }, 500);
            } else {
                safeHelpers.showNotification(result.error || '❌ Ошибка при выборе мастера', 'error');
            }
            
        } catch (error) {
            console.error('❌ Ошибка выбора мастера:', error);
            safeHelpers.showNotification('❌ Ошибка при выборе мастера', 'error');
        }
    };

    // ===== ОТКРЫТИЕ ЧАТА (ИСПРАВЛЕНО) =====
    window.openChat = (orderId, masterId) => {
        const user = Auth.getUser();
        if (!user) {
            safeHelpers.showNotification('❌ Сначала войдите в систему', 'warning');
            return;
        }
        const chatId = `chat_${orderId}_${masterId}`;
        window.location.href = `/HomeWork/chat.html?chatId=${chatId}&orderId=${orderId}&masterId=${masterId}`;
    };

    // ===== ОТКРЫТИЕ ОТЗЫВА =====
    window.openReview = (orderId, masterId, masterName) => {
        currentOrderId = orderId;
        currentMasterId = masterId;
        currentRating = 0;
        
        const infoEl = $('reviewMasterInfo');
        if (infoEl) {
            infoEl.innerHTML = `
                <div class="d-flex align-items-center gap-3 p-3" style="background: var(--bg-light); border-radius: 20px;">
                    <div class="review-master-avatar" style="width: 60px; height: 60px; background: var(--accent-gradient); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 30px;">
                        <i class="fas fa-user-tie"></i>
                    </div>
                    <div>
                        <h5 class="mb-1">${masterName}</h5>
                        <p class="text-secondary mb-0">Оцените качество работы</p>
                    </div>
                </div>
            `;
        }
        
        const textEl = $('reviewText');
        if (textEl) textEl.value = '';
        
        document.querySelectorAll('.rating-star-lg').forEach(s => s.classList.remove('active'));
        
        if (reviewModal) reviewModal.show();
    };

    // ===== ОТПРАВКА ОТЗЫВА =====
    async function submitReview() {
        if (!currentRating) {
            safeHelpers.showNotification('Пожалуйста, поставьте оценку!', 'warning');
            return;
        }
        
        try {
            const reviewText = $('reviewText')?.value || '';
            const user = Auth.getUser();
            const userData = Auth.getUserData();
            
            if (!user) throw new Error('Не авторизован');
            
            const review = {
                clientId: user.uid,
                clientName: userData?.name || 'Клиент',
                masterId: currentMasterId,
                rating: currentRating,
                text: reviewText,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            await db.collection('orders').doc(currentOrderId).update({
                reviews: firebase.firestore.FieldValue.arrayUnion(review)
            });

            const masterDoc = await db.collection('users').doc(currentMasterId).get();
            if (masterDoc.exists) {
                const masterData = masterDoc.data();
                const currentRating = masterData.rating || 0;
                const currentReviews = masterData.reviews || 0;
                
                const newRating = ((currentRating * currentReviews) + review.rating) / (currentReviews + 1);
                
                await db.collection('users').doc(currentMasterId).update({
                    rating: newRating,
                    reviews: currentReviews + 1
                });
            }

            await db.collection('reviews').add({
                ...review,
                orderId: currentOrderId
            });

            if (window.ClientGamification) {
                await ClientGamification.addXP(user.uid, 10, 'Оставил отзыв');
                await ClientGamification.checkAchievements(user.uid);
                
                await updateLevelProgress();
                await loadAchievements();
            }

            if (reviewModal) reviewModal.hide();
            safeHelpers.showNotification('✅ Спасибо за отзыв! +10 XP', 'success');
            
            await loadClientOrders(currentFilter);
            
        } catch (error) {
            console.error('❌ Ошибка при отправке отзыва:', error);
            safeHelpers.showNotification('❌ Ошибка при отправке отзыва', 'error');
        }
    }

    // ===== ПЕРЕКЛЮЧЕНИЕ ТАБОВ =====
    function switchTab(tabId) {
        document.querySelectorAll('.tab-modern').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabId);
        });
        
        document.querySelectorAll('.tab-content-modern').forEach(content => {
            content.classList.toggle('active', content.id === tabId + 'Tab');
        });
        
        if (tabId === 'achievements') {
            loadFullAchievements();
        }
    }

    // ===== ЗАГРУЗКА ПОЛНОГО СПИСКА ДОСТИЖЕНИЙ =====
    async function loadFullAchievements() {
        try {
            const user = Auth.getUser();
            if (!user) return;
            
            const achievements = await ClientGamification.getUserAchievementsWithStatus(user.uid);
            const stats = await ClientGamification.getAchievementsStats(user.uid);
            
            const earnedEl = $('achievementsEarned');
            if (earnedEl) earnedEl.textContent = stats.earned;
            
            const totalEl = $('achievementsTotal');
            if (totalEl) totalEl.textContent = stats.total;
            
            const progressEl = $('achievementsProgress');
            if (progressEl) progressEl.textContent = stats.percent + '%';
            
            const groups = {
                orders: achievements.filter(a => a.group === 'orders'),
                budget: achievements.filter(a => a.group === 'budget'),
                reviews: achievements.filter(a => a.group === 'reviews'),
                categories: achievements.filter(a => a.group === 'categories'),
                special: achievements.filter(a => a.group === 'special')
            };
            
            Object.entries(groups).forEach(([group, items]) => {
                const grid = $(`achievements${group.charAt(0).toUpperCase() + group.slice(1)}Grid`);
                if (grid) {
                    if (items.length === 0) {
                        grid.innerHTML = '<div class="text-secondary p-3">Нет достижений в этой категории</div>';
                    } else {
                        grid.innerHTML = items.map(ach => `
                            <div class="achievement-card ${ach.earned ? 'earned' : ''}">
                                <div class="achievement-icon">
                                    <i class="fas ${ach.icon}" style="color: ${ach.earned ? 'gold' : ach.color}"></i>
                                </div>
                                <div class="achievement-name">${ach.title}</div>
                                <div class="achievement-description">${ach.description}</div>
                                <div class="achievement-xp">+${ach.xp} XP</div>
                            </div>
                        `).join('');
                    }
                }
            });
            
        } catch (error) {
            console.error('❌ Ошибка загрузки достижений:', error);
        }
    }

    // ===== ИНИЦИАЛИЗАЦИЯ ОБРАБОТЧИКОВ =====
    function initEventListeners() {
        // Табы
        document.querySelectorAll('.tab-modern').forEach(tab => {
            tab.addEventListener('click', () => switchTab(tab.dataset.tab));
        });

        // Фильтры заказов
        document.querySelectorAll('.filter-chip').forEach(chip => {
            chip.addEventListener('click', function() {
                document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
                this.classList.add('active');
                loadClientOrders(this.dataset.filter);
            });
        });

        // Звезды рейтинга
        document.querySelectorAll('.rating-star-lg').forEach(star => {
            star.addEventListener('click', function() {
                const rating = parseInt(this.dataset.rating);
                currentRating = rating;
                
                document.querySelectorAll('.rating-star-lg').forEach((s, index) => {
                    if (index < rating) {
                        s.classList.add('active');
                    } else {
                        s.classList.remove('active');
                    }
                });
            });
        });

        // Отправка отзыва
        const submitBtn = $('submitReview');
        if (submitBtn) submitBtn.addEventListener('click', submitReview);

        // Кнопка пополнения баланса
        const topupBtn = $('topupBalanceBtn');
        const showTopupModal = $('showTopupModal');
        
        if (topupBtn) topupBtn.addEventListener('click', () => topupModal?.show());
        if (showTopupModal) showTopupModal.addEventListener('click', () => topupModal?.show());

        // Кнопка показать ещё
        const loadMoreBtn = $('loadMoreOrders');
        if (loadMoreBtn) {
            loadMoreBtn.addEventListener('click', () => {
                const start = displayedOrders.length;
                const end = start + 5;
                const more = allOrders.slice(start, end);
                displayedOrders = [...displayedOrders, ...more];
                hasMore = end < allOrders.length;
                
                renderOrders();
                loadMoreBtn.style.display = hasMore ? 'block' : 'none';
            });
        }

        // Выход
        const logoutLink = $('logoutLink');
        if (logoutLink) {
            logoutLink.addEventListener('click', async (e) => {
                e.preventDefault();
                if (window.Auth?.logout) {
                    await Auth.logout();
                    window.location.href = '/HomeWork/';
                }
            });
        }

        // Темная тема
        const themeToggle = $('themeToggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => {
                document.body.classList.toggle('dark-theme');
                const icon = themeToggle.querySelector('i');
                if (icon) {
                    if (document.body.classList.contains('dark-theme')) {
                        icon.classList.remove('fa-moon');
                        icon.classList.add('fa-sun');
                        localStorage.setItem('theme', 'dark');
                    } else {
                        icon.classList.remove('fa-sun');
                        icon.classList.add('fa-moon');
                        localStorage.setItem('theme', 'light');
                    }
                }
            });
            
            if (localStorage.getItem('theme') === 'dark') {
                document.body.classList.add('dark-theme');
                const icon = themeToggle.querySelector('i');
                if (icon) {
                    icon.classList.remove('fa-moon');
                    icon.classList.add('fa-sun');
                }
            }
        }

        // Уведомления
        const notificationsBtn = $('notificationsBtn');
        if (notificationsBtn) {
            notificationsBtn.addEventListener('click', () => {
                safeHelpers.showNotification('Уведомления пока в разработке', 'info');
            });
        }

        // Редактирование профиля
        const editProfileBtn = $('editProfileBtn');
        if (editProfileBtn) editProfileBtn.addEventListener('click', () => editProfileModal?.show());

        // Сохранение профиля
        const saveProfileBtn = $('saveProfileBtn');
        if (saveProfileBtn) saveProfileBtn.addEventListener('click', saveProfile);

        // Пополнение баланса
        const processTopupBtn = $('processTopupBtn');
        if (processTopupBtn) processTopupBtn.addEventListener('click', processTopup);

        // Пресеты пополнения
        document.querySelectorAll('.topup-preset').forEach(preset => {
            preset.addEventListener('click', function() {
                document.querySelectorAll('.topup-preset').forEach(p => p.classList.remove('active'));
                this.classList.add('active');
                
                const amount = parseInt(this.dataset.amount);
                const input = $('topupAmount');
                if (input) input.value = amount;
            });
        });

        // Вывод средств
        const withdrawBtn = $('withdrawBtn');
        if (withdrawBtn) {
            withdrawBtn.addEventListener('click', () => {
                safeHelpers.showNotification('Вывод средств будет доступен позже', 'info');
            });
        }

        // Загрузка фото для отзыва
        const uploadArea = $('reviewUploadArea');
        const photoInput = $('reviewPhotoInput');
        
        if (uploadArea && photoInput) {
            uploadArea.addEventListener('click', () => photoInput.click());
            
            photoInput.addEventListener('change', (e) => {
                const preview = $('reviewPhotoPreview');
                if (preview && e.target.files.length > 0) {
                    preview.innerHTML = Array.from(e.target.files).map(file => `
                        <img src="${URL.createObjectURL(file)}" class="review-photo-preview" 
                             onclick="window.open('${URL.createObjectURL(file)}')">
                    `).join('');
                }
            });
        }
        
        // Показать все достижения
        const showAllBtn = $('showAllAchievementsBtn');
        if (showAllBtn) {
            showAllBtn.addEventListener('click', async () => {
                await loadFullAchievements();
                if (achievementsModal) achievementsModal.show();
            });
        }
    }

    // ===== СОХРАНЕНИЕ ПРОФИЛЯ =====
    async function saveProfile() {
        try {
            const user = Auth.getUser();
            if (!user) throw new Error('Не авторизован');
            
            const name = $('editName')?.value;
            const phone = $('editPhone')?.value;
            const bio = $('editBio')?.value;
            
            const updates = {};
            if (name) updates.name = name;
            if (phone) updates.phone = phone;
            if (bio) updates.bio = bio;
            
            await db.collection('users').doc(user.uid).update(updates);
            
            if (editProfileModal) editProfileModal.hide();
            safeHelpers.showNotification('✅ Профиль обновлён!', 'success');
            
            await loadClientProfile();
            
        } catch (error) {
            console.error('❌ Ошибка сохранения профиля:', error);
            safeHelpers.showNotification('❌ Ошибка при сохранении', 'error');
        }
    }

    // ===== ПОПОЛНЕНИЕ БАЛАНСА =====
    async function processTopup() {
        const amount = parseInt($('topupAmount')?.value);
        
        if (!amount || amount < 100) {
            safeHelpers.showNotification('Минимальная сумма пополнения 100 ₽', 'warning');
            return;
        }
        
        try {
            safeHelpers.showNotification(`⏳ Подготовка платежа на сумму ${amount} ₽...`, 'info');
            
            const user = Auth.getUser();
            if (user) {
                const userData = Auth.getUserData();
                const currentBalance = userData.balance || 0;
                
                let bonus = 0;
                if (amount >= 1000) {
                    bonus = Math.floor(amount * 0.05);
                }
                
                const totalAmount = amount + bonus;
                
                await db.collection('users').doc(user.uid).update({
                    balance: currentBalance + totalAmount
                });
                
                await db.collection('payments').add({
                    userId: user.uid,
                    amount: amount,
                    bonus: bonus,
                    total: totalAmount,
                    type: 'topup',
                    status: 'completed',
                    description: bonus > 0 ? `Пополнение +${bonus} бонус` : 'Пополнение баланса',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                
                if (Auth.refreshUserData) await Auth.refreshUserData();
                
                if (topupModal) topupModal.hide();
                
                if (bonus > 0) {
                    safeHelpers.showNotification(`✅ Баланс пополнен на ${amount} ₽ + ${bonus} ₽ бонус!`, 'success');
                } else {
                    safeHelpers.showNotification(`✅ Баланс пополнен на ${amount} ₽`, 'success');
                }
                
                await loadClientProfile();
                await loadPayments();
            }
            
        } catch (error) {
            console.error('❌ Ошибка пополнения:', error);
            safeHelpers.showNotification('❌ Ошибка при пополнении', 'error');
        }
    }

    // ===== УДАЛЕНИЕ ИЗ ИЗБРАННОГО =====
    window.removeFromFavorites = async (masterId) => {
        try {
            const user = Auth.getUser();
            if (!user) return;
            
            await db.collection('users').doc(user.uid).update({
                favorites: firebase.firestore.FieldValue.arrayRemove(masterId)
            });
            
            safeHelpers.showNotification('❌ Мастер удалён из избранного', 'info');
            await loadFavorites();
            
        } catch (error) {
            console.error('❌ Ошибка удаления из избранного:', error);
            safeHelpers.showNotification('❌ Ошибка', 'error');
        }
    };

    // ===== ДОБАВЛЕНИЕ В ИЗБРАННОЕ =====
    window.toggleFavorite = async (masterId) => {
        try {
            const user = Auth.getUser();
            if (!user) {
                safeHelpers.showNotification('Войдите в систему', 'warning');
                return;
            }
            
            const userData = Auth.getUserData();
            const favorites = userData.favorites || [];
            
            if (favorites.includes(masterId)) {
                await removeFromFavorites(masterId);
            } else {
                await db.collection('users').doc(user.uid).update({
                    favorites: firebase.firestore.FieldValue.arrayUnion(masterId)
                });
                safeHelpers.showNotification('✅ Мастер добавлен в избранное', 'success');
                
                if (window.ClientGamification) {
                    await ClientGamification.addXP(user.uid, 5, 'Добавил в избранное');
                    await updateLevelProgress();
                    await loadAchievements();
                }
            }
            
            await loadFavorites();
            
        } catch (error) {
            console.error('❌ Ошибка:', error);
            safeHelpers.showNotification('❌ Ошибка', 'error');
        }
    };
    
    // Обновляем данные каждые 5 минут
    setInterval(async () => {
        const user = Auth.getUser();
        if (user) {
            await updateLevelProgress();
            await loadAchievements();
        }
    }, 300000);
})();