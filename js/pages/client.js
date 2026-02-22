// ===== js/pages/client.js =====
// ПОЛНОСТЬЮ ОБНОВЛЕННЫЙ КАБИНЕТ КЛИЕНТА С ГЕЙМИФИКАЦИЕЙ

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
                const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
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
        formatMoney: (amount) => {
            return new Intl.NumberFormat('ru-RU', {
                style: 'currency',
                currency: 'RUB',
                minimumFractionDigits: 0
            }).format(amount || 0);
        },
        showNotification: (msg, type) => {
            if (window.Helpers?.showNotification) {
                Helpers.showNotification(msg, type);
            } else {
                console.log(`🔔 ${type}: ${msg}`);
                alert(msg);
            }
        },
        getCategoryIcon: (cat) => {
            if (window.Helpers?.getCategoryIcon) return Helpers.getCategoryIcon(cat);
            return 'fa-tag';
        },
        pluralize: (count, words) => {
            if (window.Helpers?.pluralize) return Helpers.pluralize(count, words);
            const cases = [2, 0, 1, 1, 1, 2];
            return words[(count % 100 > 4 && count % 100 < 20) ? 2 : cases[Math.min(count % 10, 5)]];
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
        
        if (state.isAuthenticated && state.isClient) {
            // Показываем кабинет
            if (authRequired) authRequired.style.display = 'none';
            if (clientCabinet) clientCabinet.classList.remove('d-none');
            if (welcomeBanner) welcomeBanner.style.display = 'flex';
            
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
            
        } else if (state.isAuthenticated && !state.isClient) {
            safeHelpers.showNotification('❌ Эта страница только для клиентов', 'warning');
            setTimeout(() => window.location.href = '/HomeWork/masters.html', 1500);
            
        } else {
            // Показываем блок авторизации
            if (authRequired) authRequired.style.display = 'block';
            if (clientCabinet) clientCabinet.classList.add('d-none');
            if (welcomeBanner) welcomeBanner.style.display = 'none';
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
                const date = userData.createdAt.toDate?.() || new Date(userData.createdAt);
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
            
            const achievements = await ClientGamification.getUserAchievementsWithStatus(user.uid);
            
            // Показываем первые 8 достижений
            const topAchievements = achievements.slice(0, 8);
            
            container.innerHTML = topAchievements.map(ach => `
                <div class="achievement-icon-mini ${ach.earned ? 'earned' : ''}" 
                     title="${ach.title}: ${ach.description}">
                    <i class="fas ${ach.icon}"></i>
                </div>
            `).join('');
            
            // Обновляем статистику
            const stats = await ClientGamification.getAchievementsStats(user.uid);
            
            // Обновляем счетчики если есть
            const achievementsCount = $('achievementsCount');
            if (achievementsCount) {
                achievementsCount.textContent = `${stats.earned}/${stats.total}`;
            }
            
        } catch (error) {
            console.error('❌ Ошибка загрузки достижений:', error);
            container.innerHTML = '<div class="text-secondary">Нет достижений</div>';
        }
    }

    // ===== ОБНОВЛЕНИЕ ПРОГРЕССА УРОВНЯ =====
    async function updateLevelProgress() {
        try {
            const user = Auth.getUser();
            const userData = Auth.getUserData();
            
            if (!user || !userData) return;
            
            const xp = userData.xp || 0;
            const progress = ClientGamification.getLevelProgress(xp);
            
            // Прогресс-бар
            const progressBar = $('xpProgressBar');
            if (progressBar) {
                progressBar.style.width = `${progress.progress}%`;
            }
            
            // Текст прогресса
            const progressText = $('xpProgressText');
            if (progressText) {
                if (progress.next) {
                    progressText.textContent = `${xp}/${progress.next.minXP} XP`;
                } else {
                    progressText.textContent = `${xp} XP (макс. уровень)`;
                }
            }
            
            // Бейдж уровня
            const levelBadge = $('levelBadge');
            if (levelBadge) {
                levelBadge.textContent = progress.current.level;
            }
            
            // Обновляем XP в статистике
            const statXP = $('statXP');
            if (statXP) {
                statXP.textContent = `${xp} XP`;
            }
            
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
            allOrders = orders;
            
            // Первые 5 заказов
            displayedOrders = orders.slice(0, 5);
            hasMore = orders.length > 5;
            
            renderOrders();
            
            // Обновляем счетчик
            const ordersCount = $('ordersCount');
            if (ordersCount) {
                ordersCount.textContent = orders.length;
            }
            
            // Показываем/скрываем кнопку "Показать ещё"
            const loadMoreBtn = $('loadMoreOrders');
            if (loadMoreBtn) {
                loadMoreBtn.style.display = hasMore ? 'block' : 'none';
            }
            
        } catch (error) {
            console.error('❌ Ошибка загрузки заказов:', error);
            ordersList.innerHTML = `
                <div class="text-center p-5">
                    <i class="fas fa-exclamation-circle fa-3x mb-3" style="color: var(--danger);"></i>
                    <h5>Ошибка загрузки</h5>
                    <p class="text-secondary">${error.message}</p>
                    <button class="btn btn-outline-secondary mt-3" onclick="loadClientOrders('${filter}')">
                        <i class="fas fa-sync-alt me-2"></i>Повторить
                    </button>
                </div>
            `;
        }
    }

    // ===== ОТРИСОВКА ЗАКАЗОВ =====
    function renderOrders() {
        const ordersList = $('ordersList');
        if (!ordersList) return;
        
        if (displayedOrders.length === 0) {
            ordersList.innerHTML = `
                <div class="text-center p-5">
                    <i class="fas fa-clipboard-list fa-4x mb-3" style="color: var(--border);"></i>
                    <h4>У вас пока нет заказов</h4>
                    <p class="text-secondary mb-4">Создайте первую заявку</p>
                    <a href="/HomeWork/" class="btn btn-lg">
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

    // ===== СОЗДАНИЕ КАРТОЧКИ ЗАКАЗА =====
    function createOrderCard(order) {
        if (!order) return null;
        
        const div = document.createElement('div');
        div.className = 'order-card mb-3 animate__animated animate__fadeIn';
        
        // Статус
        const statusConfig = {
            'open': { class: 'badge-warning', text: '🔵 Активен', icon: 'fa-clock' },
            'in_progress': { class: 'badge-info', text: '🟢 В работе', icon: 'fa-cog fa-spin' },
            'completed': { class: 'badge-success', text: '✅ Завершён', icon: 'fa-check-circle' }
        };
        
        const status = statusConfig[order.status] || statusConfig.open;
        
        // Фото
        let photosHtml = '';
        if (order.photos?.length > 0) {
            photosHtml = `
                <div class="order-photos mb-3">
                    ${order.photos.slice(0, 3).map(url => `
                        <img src="${url}" class="order-photo-thumb" onclick="window.open('${url}')" loading="lazy">
                    `).join('')}
                    ${order.photos.length > 3 ? `<span class="photo-count">+${order.photos.length-3}</span>` : ''}
                </div>
            `;
        }
        
        // Отклики мастеров
        let responsesHtml = '';
        if (order.responses?.length > 0) {
            responsesHtml = `
                <div class="responses-section mt-4">
                    <h6 class="mb-3">
                        <i class="fas fa-users me-2" style="color: var(--accent);"></i>
                        Отклики мастеров (${order.responses.length})
                    </h6>
                    ${order.responses.map(resp => createResponseCard(order, resp)).join('')}
                </div>
            `;
        }
        
        div.innerHTML = `
            <div class="order-header">
                <div class="d-flex align-items-center gap-2">
                    <h4 class="order-title mb-0">${safeHelpers.escapeHtml(order.title || 'Заказ')}</h4>
                    <span class="badge ${status.class}">
                        <i class="fas ${status.icon} me-1"></i>${status.text}
                    </span>
                </div>
                <span class="order-price">${safeHelpers.formatMoney(order.price)}</span>
            </div>
            
            <p class="order-description">${safeHelpers.escapeHtml(order.description || 'Нет описания')}</p>
            
            ${photosHtml}
            
            <div class="order-meta">
                <span><i class="fas ${safeHelpers.getCategoryIcon(order.category)}"></i> ${order.category || 'Без категории'}</span>
                <span><i class="fas fa-map-marker-alt"></i> ${safeHelpers.escapeHtml(order.address || 'Адрес не указан')}</span>
                <span><i class="fas fa-clock"></i> ${safeHelpers.formatDate(order.createdAt)}</span>
            </div>
            
            ${responsesHtml}
        `;
        
        return div;
    }

    // ===== СОЗДАНИЕ КАРТОЧКИ ОТКЛИКА =====
    function createResponseCard(order, resp) {
        const hasReview = order.reviews?.some(r => r.masterId === resp.masterId);
        const isSelected = order.selectedMasterId === resp.masterId;
        
        return `
            <div class="response-card ${isSelected ? 'selected' : ''}">
                <div class="response-header">
                    <div class="d-flex align-items-center gap-2">
                        <div class="response-avatar">
                            <i class="fas fa-user-tie"></i>
                        </div>
                        <div>
                            <h6 class="mb-0">${safeHelpers.escapeHtml(resp.masterName || 'Мастер')}</h6>
                            <div class="response-rating">
                                <span class="rating-stars">${'★'.repeat(Math.floor(resp.masterRating || 0))}</span>
                                <span class="text-secondary ms-1">${resp.masterReviews || 0} отзывов</span>
                            </div>
                        </div>
                    </div>
                    <div class="response-price">${safeHelpers.formatMoney(resp.price)}</div>
                </div>
                
                ${resp.comment ? `<p class="response-comment">${safeHelpers.escapeHtml(resp.comment)}</p>` : ''}
                
                <div class="response-actions">
                    <button class="btn btn-sm btn-outline-secondary" onclick="openChat('${order.id}', '${resp.masterId}')">
                        <i class="fas fa-comment me-1"></i> Чат
                    </button>
                    
                    ${order.status === 'open' && !isSelected ? `
                        <button class="btn btn-sm btn-success" onclick="selectMaster('${order.id}', '${resp.masterId}', ${resp.price})">
                            <i class="fas fa-check me-1"></i> Выбрать
                        </button>
                    ` : ''}
                    
                    ${order.status === 'completed' && !hasReview ? `
                        <button class="btn btn-sm btn-outline-warning" onclick="openReview('${order.id}', '${resp.masterId}', '${safeHelpers.escapeHtml(resp.masterName || 'Мастер')}')">
                            <i class="fas fa-star me-1"></i> Оценить
                        </button>
                    ` : ''}
                    
                    <button class="btn btn-sm btn-outline-danger" onclick="toggleFavorite('${resp.masterId}')">
                        <i class="fas fa-heart"></i>
                    </button>
                </div>
            </div>
        `;
    }

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
                            <i class="fas fa-heart fa-4x mb-3" style="color: var(--border);"></i>
                            <h4>Нет избранных мастеров</h4>
                            <p class="text-secondary">Добавляйте мастеров в избранное после заказов</p>
                        </div>
                    </div>
                `;
                return;
            }
            
            container.innerHTML = '';
            
            for (const masterId of favorites) {
                const masterDoc = await db.collection('users').doc(masterId).get();
                if (masterDoc.exists) {
                    const master = masterDoc.data();
                    const col = document.createElement('div');
                    col.className = 'col-md-6';
                    col.innerHTML = createFavoriteCard(masterId, master);
                    container.appendChild(col);
                }
            }
            
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
                <div class="d-flex align-items-center gap-3">
                    <div class="favorite-avatar">
                        <i class="fas fa-user-tie"></i>
                    </div>
                    <div class="flex-grow-1">
                        <h5 class="mb-1">${safeHelpers.escapeHtml(master.name || 'Мастер')}</h5>
                        <p class="text-secondary mb-2">${safeHelpers.escapeHtml(master.categories || 'Специалист')}</p>
                        <div class="d-flex align-items-center gap-3">
                            <span class="rating-stars">${stars}</span>
                            <span class="text-secondary">${master.reviews || 0} отзывов</span>
                        </div>
                    </div>
                    <div class="d-flex flex-column gap-2">
                        <button class="btn btn-sm btn-outline-secondary" onclick="window.open('/HomeWork/master-profile.html?id=${id}')">
                            <i class="fas fa-user"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger" onclick="removeFromFavorites('${id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
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
                        <i class="fas fa-credit-card fa-3x mb-3" style="color: var(--border);"></i>
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
                const color = isIncome ? 'var(--success)' : 'var(--danger)';
                
                html += `
                    <div class="payment-item">
                        <div class="d-flex align-items-center gap-3">
                            <div class="payment-icon" style="background: ${color}20; color: ${color};">
                                <i class="fas ${isIncome ? 'fa-arrow-down' : 'fa-arrow-up'}"></i>
                            </div>
                            <div class="flex-grow-1">
                                <div class="fw-bold">${payment.description || (isIncome ? 'Пополнение' : 'Списание')}</div>
                                <small class="text-secondary">${safeHelpers.formatDate(payment.createdAt)}</small>
                            </div>
                            <div class="fw-bold" style="color: ${color};">
                                ${sign}${safeHelpers.formatMoney(payment.amount)}
                            </div>
                        </div>
                    </div>
                `;
            });
            
            container.innerHTML = html;
            
            // Обновляем финансовую статистику
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
            
            // Общая сумма потраченная
            const totalSpent = userData.totalSpent || 0;
            const financeTotalSpent = $('financeTotalSpent');
            if (financeTotalSpent) {
                financeTotalSpent.textContent = safeHelpers.formatMoney(totalSpent);
            }
            
            const statTotalSpent = $('statTotalSpent');
            if (statTotalSpent) {
                statTotalSpent.textContent = safeHelpers.formatMoney(totalSpent);
            }
            
            // Средний чек
            const orders = await Orders.getClientOrders(user.uid, 'all');
            const avgOrder = orders.length > 0 
                ? orders.reduce((sum, o) => sum + (o.price || 0), 0) / orders.length 
                : 0;
            
            const financeAvgOrder = $('financeAvgOrder');
            if (financeAvgOrder) {
                financeAvgOrder.textContent = safeHelpers.formatMoney(avgOrder);
            }
            
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
                        <i class="fas fa-comments fa-4x mb-3" style="color: var(--border);"></i>
                        <h4>Нет активных чатов</h4>
                        <p class="text-secondary">Начните общение с мастером после отклика</p>
                    </div>
                `;
                return;
            }
            
            container.innerHTML = '';
            
            for (const doc of chatsSnapshot.docs) {
                const chat = doc.data();
                const otherId = chat.participants.find(id => id !== user.uid);
                
                if (otherId) {
                    const otherDoc = await db.collection('users').doc(otherId).get();
                    const other = otherDoc.data();
                    
                    const card = document.createElement('div');
                    card.className = 'chat-card mb-2';
                    card.onclick = () => window.location.href = `/HomeWork/chat.html?chatId=${doc.id}`;
                    
                    card.innerHTML = `
                        <div class="chat-avatar">
                            <i class="fas ${other.role === 'master' ? 'fa-user-tie' : 'fa-user'}"></i>
                        </div>
                        <div class="chat-info">
                            <div class="chat-name">${safeHelpers.escapeHtml(other.name || 'Пользователь')}</div>
                            <div class="chat-last-message">${chat.lastMessage || 'Нет сообщений'}</div>
                        </div>
                        <div class="chat-time">${safeHelpers.formatDate(chat.lastMessageAt)}</div>
                        ${chat.unreadCount ? `<span class="chat-unread">${chat.unreadCount}</span>` : ''}
                    `;
                    
                    container.appendChild(card);
                }
            }
            
            // Обновляем бейдж непрочитанных
            const unreadCount = chatsSnapshot.docs.reduce((sum, doc) => sum + (doc.data().unreadCount || 0), 0);
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
                    <div class="alert alert-info">
                        <i class="fas fa-info-circle me-2"></i>
                        Нет заказов в работе для отслеживания
                    </div>
                `;
                return;
            }
            
            let html = '<div class="tracking-select mb-3">';
            html += '<label class="form-label fw-bold">Выберите заказ для отслеживания:</label>';
            html += '<select class="form-select" id="trackingOrderSelect">';
            html += '<option value="">Выберите заказ</option>';
            
            ordersSnapshot.forEach(doc => {
                const order = doc.data();
                html += `<option value="${doc.id}">${order.title || 'Заказ'} - ${order.address || ''}</option>`;
            });
            
            html += '</select></div>';
            
            container.innerHTML = html;
            
            // Инициализируем карту
            initTrackingMap();
            
        } catch (error) {
            console.error('❌ Ошибка загрузки заказов для отслеживания:', error);
        }
    }

    // ===== ИНИЦИАЛИЗАЦИЯ КАРТЫ ОТСЛЕЖИВАНИЯ =====
    function initTrackingMap() {
        if (typeof ymaps === 'undefined') return;
        
        ymaps.ready(() => {
            const mapEl = $('trackingMap');
            if (!mapEl) return;
            
            const map = new ymaps.Map('trackingMap', {
                center: [61.0, 69.0],
                zoom: 10
            });
            
            // Слушаем выбор заказа
            const select = $('trackingOrderSelect');
            if (select) {
                select.addEventListener('change', async (e) => {
                    const orderId = e.target.value;
                    if (!orderId) return;
                    
                    const orderDoc = await db.collection('orders').doc(orderId).get();
                    const order = orderDoc.data();
                    
                    if (order.latitude && order.longitude) {
                        map.geoObjects.removeAll();
                        
                        // Точка заказа
                        const orderPlacemark = new ymaps.Placemark(
                            [order.latitude, order.longitude],
                            { hintContent: 'Ваш заказ', balloonContent: order.title },
                            { preset: 'islands#greenIcon' }
                        );
                        map.geoObjects.add(orderPlacemark);
                        
                        // Точка мастера (если есть)
                        if (order.masterLatitude && order.masterLongitude) {
                            const masterPlacemark = new ymaps.Placemark(
                                [order.masterLatitude, order.masterLongitude],
                                { hintContent: 'Мастер', balloonContent: 'Мастер в пути' },
                                { preset: 'islands#blueIcon' }
                            );
                            map.geoObjects.add(masterPlacemark);
                            
                            // Маршрут
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
                            
                            // Обновляем информацию
                            await updateTrackingInfo(order);
                        }
                        
                        map.setCenter([order.latitude, order.longitude], 12);
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
        
        // Здесь можно добавить расчет ETA и расстояния
        panel.innerHTML = `
            <div class="tracking-info-card">
                <h6 class="mb-3"><i class="fas fa-info-circle me-2" style="color: var(--accent);"></i>Информация о заказе</h6>
                <div class="row g-3">
                    <div class="col-md-4">
                        <div class="tracking-stat">
                            <span class="tracking-label">Мастер</span>
                            <span class="tracking-value" id="trackingMasterName">${order.masterName || 'Неизвестно'}</span>
                        </div>
                    </div>
                    <div class="col-md-4">
                        <div class="tracking-stat">
                            <span class="tracking-label">Телефон мастера</span>
                            <span class="tracking-value" id="trackingMasterPhone">${order.masterPhone || 'Скрыт'}</span>
                        </div>
                    </div>
                    <div class="col-md-4">
                        <div class="tracking-stat">
                            <span class="tracking-label">Ориентировочное время</span>
                            <span class="tracking-value tracking-eta">≈ 30-40 минут</span>
                        </div>
                    </div>
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
                
                // Начисляем XP
                const user = Auth.getUser();
                if (user && window.ClientGamification) {
                    await ClientGamification.addXP(user.uid, 10, 'Выбор мастера');
                    await ClientGamification.checkAchievements(user.uid);
                }
                
                // Перезагружаем заказы
                await loadClientOrders(currentFilter);
                
                // Открываем чат
                window.open(`/HomeWork/chat.html?orderId=${orderId}&masterId=${masterId}`);
            } else {
                safeHelpers.showNotification(result.error || '❌ Ошибка при выборе мастера', 'error');
            }
            
        } catch (error) {
            console.error('❌ Ошибка выбора мастера:', error);
            safeHelpers.showNotification('❌ Ошибка при выборе мастера', 'error');
        }
    };

    // ===== ОТКРЫТИЕ ЧАТА =====
    window.openChat = (orderId, masterId) => {
        window.location.href = `/HomeWork/chat.html?orderId=${orderId}&masterId=${masterId}`;
    };

    // ===== ОТКРЫТИЕ ОТЗЫВА =====
    window.openReview = (orderId, masterId, masterName) => {
        currentOrderId = orderId;
        currentMasterId = masterId;
        currentRating = 0;
        
        const infoEl = $('reviewMasterInfo');
        if (infoEl) {
            infoEl.innerHTML = `
                <div class="d-flex align-items-center gap-3">
                    <div class="review-master-avatar">
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
        
        // Сброс звезд
        document.querySelectorAll('.rating-star-lg').forEach(s => s.classList.remove('active'));
        
        if (reviewModal) reviewModal.show();
    };

    // ===== ОТПРАВКА ОТЗЫВА =====
    async function submitReview() {
        if (!currentRating) {
            alert('Пожалуйста, поставьте оценку!');
            return;
        }
        
        try {
            const reviewText = $('reviewText')?.value || '';
            const user = Auth.getUser();
            
            if (!user) throw new Error('Не авторизован');
            
            const review = {
                clientId: user.uid,
                clientName: Auth.getUserData()?.name || 'Клиент',
                masterId: currentMasterId,
                rating: currentRating,
                text: reviewText,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            // Добавляем отзыв к заказу
            await db.collection('orders').doc(currentOrderId).update({
                reviews: firebase.firestore.FieldValue.arrayUnion(review)
            });

            // Обновляем рейтинг мастера
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

            // Добавляем отзыв в отдельную коллекцию
            await db.collection('reviews').add({
                ...review,
                orderId: currentOrderId
            });

            // Начисляем XP клиенту
            if (window.ClientGamification) {
                await ClientGamification.addXP(user.uid, 10, 'Оставил отзыв');
                await ClientGamification.checkAchievements(user.uid);
            }

            if (reviewModal) reviewModal.hide();
            safeHelpers.showNotification('✅ Спасибо за отзыв!', 'success');
            
            // Обновляем заказы
            await loadClientOrders(currentFilter);
            
        } catch (error) {
            console.error('❌ Ошибка при отправке отзыва:', error);
            safeHelpers.showNotification('❌ Ошибка при отправке отзыва', 'error');
        }
    }

    // ===== ПЕРЕКЛЮЧЕНИЕ ТАБОВ =====
    function switchTab(tabId) {
        // Обновляем табы
        document.querySelectorAll('.tab-modern').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabId);
        });
        
        // Обновляем контент
        document.querySelectorAll('.tab-content-modern').forEach(content => {
            content.classList.toggle('active', content.id === tabId + 'Tab');
        });
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
        if (submitBtn) {
            submitBtn.addEventListener('click', submitReview);
        }

        // Кнопка пополнения баланса
        const topupBtn = $('topupBalanceBtn');
        if (topupBtn) {
            topupBtn.addEventListener('click', () => {
                if (topupModal) topupModal.show();
            });
        }

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
            logoutLink.addEventListener('click', (e) => {
                e.preventDefault();
                if (window.Auth?.logout) {
                    Auth.logout().then(() => {
                        window.location.href = '/HomeWork/';
                    });
                }
            });
        }

        // Темная тема
        const themeToggle = $('themeToggle');
        if (themeToggle && window.Auth?.toggleTheme) {
            themeToggle.addEventListener('click', Auth.toggleTheme);
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
        if (editProfileBtn) {
            editProfileBtn.addEventListener('click', () => {
                if (editProfileModal) editProfileModal.show();
            });
        }

        // Сохранение профиля
        const saveProfileBtn = $('saveProfileBtn');
        if (saveProfileBtn) {
            saveProfileBtn.addEventListener('click', saveProfile);
        }

        // Пополнение баланса
        const processTopupBtn = $('processTopupBtn');
        if (processTopupBtn) {
            processTopupBtn.addEventListener('click', processTopup);
        }

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
            
            // Обновляем отображение
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
            // Здесь будет интеграция с платежной системой
            safeHelpers.showNotification(`Переход к оплате на сумму ${amount} ₽...`, 'info');
            
            // Для демо просто добавляем баланс
            const user = Auth.getUser();
            if (user) {
                const userData = Auth.getUserData();
                const currentBalance = userData.balance || 0;
                
                await db.collection('users').doc(user.uid).update({
                    balance: currentBalance + amount
                });
                
                // Логируем платеж
                await db.collection('payments').add({
                    userId: user.uid,
                    amount: amount,
                    type: 'topup',
                    status: 'completed',
                    description: 'Пополнение баланса',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                
                // Обновляем данные
                Auth.refreshUserData();
                
                if (topupModal) topupModal.hide();
                safeHelpers.showNotification(`✅ Баланс пополнен на ${amount} ₽`, 'success');
                
                // Обновляем отображение
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
                
                // Начисляем XP
                if (window.ClientGamification) {
                    await ClientGamification.addXP(user.uid, 5, 'Добавил в избранное');
                }
            }
            
            await loadFavorites();
            
        } catch (error) {
            console.error('❌ Ошибка:', error);
        }
    };
})();