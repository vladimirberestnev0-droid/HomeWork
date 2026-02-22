// ===== masters.js =====
// ПОЛНОСТЬЮ РАБОЧАЯ ВЕРСИЯ С FIREBASE

(function() {
    // ===== ПРОВЕРКА ГЛОБАЛЬНЫХ КОНСТАНТ =====
    const ORDER_STATUS = window.ORDER_STATUS || {
        OPEN: 'open',
        IN_PROGRESS: 'in_progress',
        COMPLETED: 'completed',
        CANCELLED: 'cancelled'
    };
    
    const USER_ROLE = window.USER_ROLE || {
        MASTER: 'master',
        CLIENT: 'client',
        ADMIN: 'admin'
    };

    // Состояние
    let calendar = null;
    let scheduleCalendar = null;
    let portfolioPhotos = [];
    let currentRating = 0;
    let currentOrderId = null;
    let statsInterval = null;
    let currentFilter = 'all';
    
    // Кэш для статистики
    let statsCache = {
        level: null,
        achievements: null,
        lastUpdate: 0
    };

    // ===== БЕЗОПАСНЫЙ HELPER =====
    const safeHelpers = {
        // Экранирование HTML
        escapeHtml: (text) => {
            if (!text) return '';
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        },
        
        // Безопасное получение даты из Firestore Timestamp
        safeGetDate: (timestamp) => {
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
                return new Date();
            } catch {
                return new Date();
            }
        },
        
        // Форматирование даты
        formatDate: (timestamp) => {
            if (!timestamp) return 'только что';
            try {
                const date = safeHelpers.safeGetDate(timestamp);
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
        
        // Короткое форматирование даты
        formatShortDate: (timestamp) => {
            if (!timestamp) return '';
            try {
                const date = safeHelpers.safeGetDate(timestamp);
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
        
        // Форматирование денег
        formatMoney: (amount) => {
            return new Intl.NumberFormat('ru-RU', {
                style: 'currency',
                currency: 'RUB',
                minimumFractionDigits: 0
            }).format(amount || 0);
        },
        
        // Показ уведомлений
        showNotification: (msg, type = 'info') => {
            if (window.Helpers?.showNotification) {
                Helpers.showNotification(msg, type);
                return;
            }
            
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
        },
        
        // Плюрализация
        pluralize: (count, words) => {
            const cases = [2, 0, 1, 1, 1, 2];
            return words[(count % 100 > 4 && count % 100 < 20) ? 2 : cases[Math.min(count % 10, 5)]];
        }
    };

    // Короткая функция для получения элемента
    const $ = (id) => document.getElementById(id);

    // ===== ПРОВЕРКА FIREBASE =====
    function checkFirebase() {
        if (typeof firebase === 'undefined') {
            console.error('❌ Firebase не загружен!');
            safeHelpers.showNotification('❌ Ошибка подключения к базе данных', 'error');
            return false;
        }
        if (typeof db === 'undefined' || !db) {
            console.error('❌ Firestore не инициализирован!');
            safeHelpers.showNotification('❌ Ошибка подключения к базе данных', 'error');
            return false;
        }
        return true;
    }

    // ===== ГЕЙМИФИКАЦИЯ =====
    async function updateMasterLevel() {
        try {
            if (!checkFirebase()) return;
            
            const user = Auth.getUser();
            const userData = Auth.getUserData();
            
            if (!user || !userData) return;
            
            const xp = userData.xp || 0;
            
            // Проверяем, есть ли Gamification
            let level = { level: 1, name: 'Новичок' };
            let progress = { progress: 0, xpNeeded: 100 };
            
            if (window.Gamification) {
                level = Gamification.getLevelFromXP(xp);
                progress = Gamification.getLevelProgress(xp);
            }
            
            // Обновляем UI с проверкой существования элементов
            const levelEl = $('masterLevel');
            if (levelEl) levelEl.textContent = `Уровень ${level.level}`;
            
            const levelNameEl = $('masterLevelName');
            if (levelNameEl) levelNameEl.textContent = level.name;
            
            const progressBar = $('masterXPProgress');
            if (progressBar) progressBar.style.width = `${progress.progress}%`;
            
            const xpEl = $('masterXP');
            if (xpEl) xpEl.textContent = `${xp} XP`;
            
            const nextLevelEl = $('masterNextLevel');
            if (nextLevelEl) {
                if (progress.next) {
                    nextLevelEl.textContent = `до уровня ${progress.next.level} (${progress.xpNeeded} XP)`;
                } else {
                    nextLevelEl.textContent = 'максимальный уровень';
                }
            }
            
            // Обновляем в шапке
            const headerLevel = $('headerLevelValue');
            if (headerLevel) headerLevel.textContent = level.level;
            
            const headerXP = $('headerXPValue');
            if (headerXP) headerXP.textContent = xp;
            
            // Цвет уровня
            const levelBadge = $('headerLevel');
            if (levelBadge) {
                levelBadge.className = `level-badge level-${level.level}`;
            }
            
        } catch (error) {
            console.error('❌ Ошибка обновления уровня:', error);
        }
    }

    // ===== ЗАГРУЗКА ДАННЫХ МАСТЕРА =====
    async function loadMasterData(state) {
        try {
            const userData = state.userData;
            
            // Имя
            const masterNameEl = $('masterName');
            if (masterNameEl) masterNameEl.innerText = userData?.name || 'Мастер';
            
            // Роль/категория
            const masterRoleEl = $('masterRole');
            if (masterRoleEl) {
                const categories = userData?.categories ? userData.categories.split(',')[0] : 'Строительный мастер';
                masterRoleEl.innerText = categories;
            }
            
            // Рейтинг
            const rating = userData?.rating || 0;
            const reviews = userData?.reviews || 0;
            
            const masterRatingEl = $('masterRating');
            if (masterRatingEl) masterRatingEl.innerHTML = rating.toFixed(1);
            
            const masterReviewsEl = $('masterReviews');
            if (masterReviewsEl) {
                masterReviewsEl.innerHTML = `${reviews} ${safeHelpers.pluralize(reviews, ['отзыв', 'отзыва', 'отзывов'])}`;
            }
            
            // Звезды
            const starsElement = $('ratingStars');
            if (starsElement) {
                const fullStars = Math.floor(rating);
                const hasHalfStar = rating - fullStars >= 0.5;
                let stars = '';
                for (let i = 0; i < 5; i++) {
                    if (i < fullStars) stars += '★';
                    else if (i === fullStars && hasHalfStar) stars += '½';
                    else stars += '☆';
                }
                starsElement.innerHTML = stars;
            }
            
            // Опыт (если есть)
            if (userData?.experience) {
                const expEl = $('masterExperience');
                if (expEl) expEl.innerText = `${userData.experience} лет`;
            }
            
        } catch (error) {
            console.error('❌ Ошибка загрузки данных мастера:', error);
        }
    }

    // ===== ЗАГРУЗКА БЕЙДЖЕЙ =====
    async function loadBadges() {
        const container = $('badgesContainer');
        if (!container) return;
        
        try {
            if (!checkFirebase()) return;
            
            const user = Auth.getUser();
            if (!user) return;
            
            // Проверяем, есть ли сервис бейджей
            if (!window.Badges) {
                container.innerHTML = '<span class="badge badge-secondary">Скоро будут бейджи</span>';
                return;
            }
            
            const badges = await Badges.getMasterBadges(user.uid);
            
            if (!badges || badges.length === 0) {
                container.innerHTML = '<span class="badge badge-secondary">Нет бейджей</span>';
                return;
            }
            
            container.innerHTML = badges.map(badge => `
                <span class="badge-item" title="${badge.description || ''}">
                    <i class="fas ${badge.icon || 'fa-medal'}"></i>
                    ${badge.name}
                </span>
            `).join('');
            
        } catch (error) {
            console.error('❌ Ошибка загрузки бейджей:', error);
            if (container) {
                container.innerHTML = '<span class="badge badge-secondary">Ошибка загрузки</span>';
            }
        }
    }

    // ===== ЗАГРУЗКА ОТКЛИКОВ =====
    async function loadMasterResponses(filter = 'all') {
        const responsesList = $('responsesList');
        if (!responsesList) return;
        
        currentFilter = filter;
        
        responsesList.innerHTML = `
            <div class="text-center p-5">
                <div class="spinner mb-3"></div>
                <p class="text-secondary">Загрузка откликов...</p>
            </div>
        `;
        
        try {
            if (!checkFirebase()) return;
            
            const user = Auth.getUser();
            if (!user) return;
            
            if (!window.Orders) {
                throw new Error('Сервис заказов недоступен');
            }
            
            const responses = await Orders.getMasterResponses(user.uid);
            
            let filtered = responses;
            if (filter === 'pending') {
                filtered = responses.filter(r => r.status === ORDER_STATUS.OPEN);
            } else if (filter === 'accepted') {
                filtered = responses.filter(r => r.status === ORDER_STATUS.IN_PROGRESS);
            } else if (filter === 'completed') {
                filtered = responses.filter(r => r.status === ORDER_STATUS.COMPLETED);
            }
            
            updateStats(responses);
            
            if (filtered.length === 0) {
                responsesList.innerHTML = `
                    <div class="text-center p-5">
                        <i class="fas fa-inbox fa-4x mb-3" style="color: var(--border);"></i>
                        <h5 class="mb-3">Нет откликов</h5>
                        <p class="text-secondary mb-4">Вы ещё не откликались на заказы</p>
                        <a href="/HomeWork/" class="btn">
                            <i class="fas fa-search me-2"></i>Найти заказы
                        </a>
                    </div>
                `;
                return;
            }
            
            responsesList.innerHTML = filtered.map(item => createResponseCard(item)).join('');
            
        } catch (error) {
            console.error('❌ Ошибка загрузки откликов:', error);
            responsesList.innerHTML = '<div class="text-center p-5 text-danger">Ошибка загрузки</div>';
        }
    }

    // ===== СОЗДАНИЕ КАРТОЧКИ ОТКЛИКА =====
    function createResponseCard(item) {
        const order = item.order || {};
        const response = item.response || {};
        
        const statusConfig = {
            'open': { class: 'badge-warning', text: '⏳ Ожидает', icon: 'fa-clock' },
            'in_progress': { class: 'badge-info', text: '🔨 В работе', icon: 'fa-cog fa-spin' },
            'completed': { class: 'badge-success', text: '✅ Выполнен', icon: 'fa-check-circle' }
        };
        
        const status = statusConfig[item.status] || statusConfig.open;
        
        let photosHtml = '';
        if (order.photos?.length > 0) {
            photosHtml = `
                <div class="d-flex gap-2 mt-3 flex-wrap">
                    ${order.photos.slice(0, 3).map(url => `
                        <img src="${url}" class="order-photo-thumb" onclick="window.open('${url}')" style="width: 60px; height: 60px; object-fit: cover; border-radius: 10px; cursor: pointer;">
                    `).join('')}
                </div>
            `;
        }
        
        const responseTime = response.createdAt ? safeHelpers.formatShortDate(response.createdAt) : 'только что';
        
        return `
            <div class="response-item animate__animated animate__fadeIn">
                <div class="order-header">
                    <div>
                        <span class="order-title">${safeHelpers.escapeHtml(order.title || 'Заказ')}</span>
                        <span class="badge badge-info ms-2">${order.category || 'Без категории'}</span>
                    </div>
                    <span class="order-price">${safeHelpers.formatMoney(response.price)}</span>
                </div>
                
                <span class="badge ${status.class} mb-3">
                    <i class="fas ${status.icon} me-1"></i>${status.text}
                </span>
                
                ${photosHtml}
                
                <div class="order-meta">
                    <span><i class="fas fa-user"></i> ${safeHelpers.escapeHtml(order.clientName || 'Клиент')}</span>
                    <span><i class="fas fa-map-marker-alt"></i> ${safeHelpers.escapeHtml(order.address || 'Адрес не указан')}</span>
                    <span><i class="fas fa-calendar"></i> ${responseTime}</span>
                </div>
                
                ${response.comment ? `
                    <div class="card bg-light p-3 mb-3">
                        <p class="mb-0">
                            <i class="fas fa-comment me-2" style="color: var(--accent);"></i>
                            ${safeHelpers.escapeHtml(response.comment)}
                        </p>
                    </div>
                ` : ''}
                
                <div class="d-flex gap-2">
                    <button onclick="window.mastersAPI.openChat('${item.orderId}', '${order.clientId}')" class="btn">
                        <i class="fas fa-comment me-2"></i>Чат
                    </button>
                    
                    ${item.status === ORDER_STATUS.IN_PROGRESS ? `
                        <button onclick="window.mastersAPI.completeOrder('${item.orderId}')" class="btn btn-success">
                            <i class="fas fa-check-double me-2"></i>Заказ выполнен
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }

    // ===== ОБНОВЛЕНИЕ СТАТИСТИКИ =====
    function updateStats(responses) {
        const total = responses.length;
        const accepted = responses.filter(r => r.status === ORDER_STATUS.IN_PROGRESS || r.status === ORDER_STATUS.COMPLETED).length;
        const completed = responses.filter(r => r.status === ORDER_STATUS.COMPLETED).length;
        
        const statResponses = $('statResponses');
        if (statResponses) statResponses.innerText = total;
        
        const statAccepted = $('statAccepted');
        if (statAccepted) statAccepted.innerText = accepted;
        
        const statCompleted = $('statCompleted');
        if (statCompleted) statCompleted.innerText = completed;
        
        const userData = Auth.getUserData();
        const statXP = $('statXP');
        if (statXP) statXP.innerText = userData?.xp || 0;
        
        const conversion = total > 0 ? Math.round((accepted / total) * 100) : 0;
        
        const conversionRate = $('conversionRate');
        if (conversionRate) conversionRate.innerText = `${conversion}%`;
        
        const conversionBar = $('conversionBar');
        if (conversionBar) conversionBar.style.width = `${conversion}%`;
    }

    // ===== ЗАГРУЗКА ПОРТФОЛИО =====
    async function loadPortfolio() {
        const grid = $('portfolioGrid');
        if (!grid) return;
        
        try {
            if (!checkFirebase()) return;
            
            const user = Auth.getUser();
            if (!user) return;
            
            const snapshot = await db.collection('portfolio')
                .where('masterId', '==', user.uid)
                .orderBy('createdAt', 'desc')
                .get();
            
            if (snapshot.empty) {
                grid.innerHTML = `
                    <div class="text-center p-5">
                        <i class="fas fa-images fa-4x mb-3" style="color: var(--border);"></i>
                        <h5 class="mb-3">Портфолио пусто</h5>
                        <p class="text-secondary mb-4">Добавьте свои работы, чтобы привлечь клиентов</p>
                        <button class="btn" onclick="document.getElementById('addPortfolioBtn').click()">
                            <i class="fas fa-plus me-2"></i>Добавить первую работу
                        </button>
                    </div>
                `;
                return;
            }
            
            let html = '';
            snapshot.forEach(doc => {
                const work = doc.data();
                html += `
                    <div class="portfolio-item" onclick="window.mastersAPI.viewPortfolio('${work.imageUrl}', '${safeHelpers.escapeHtml(work.title)}', '${safeHelpers.escapeHtml(work.description)}')">
                        <img src="${work.imageUrl}" alt="${work.title}">
                        <div class="portfolio-info">
                            <h6>${safeHelpers.escapeHtml(work.title)}</h6>
                            <small>${work.category}</small>
                        </div>
                    </div>
                `;
            });
            
            grid.innerHTML = html;
            
        } catch (error) {
            console.error('❌ Ошибка загрузки портфолио:', error);
            grid.innerHTML = '<div class="text-center p-5 text-danger">Ошибка загрузки</div>';
        }
    }

    // ===== ИНИЦИАЛИЗАЦИЯ КАЛЕНДАРЯ =====
    function initCalendar() {
        const calendarEl = $('calendar');
        if (!calendarEl) return;
        
        if (typeof FullCalendar === 'undefined') {
            console.warn('⚠️ FullCalendar не загружен');
            return;
        }
        
        if (calendar) calendar.destroy();
        
        calendar = new FullCalendar.Calendar(calendarEl, {
            initialView: 'dayGridMonth',
            locale: 'ru',
            headerToolbar: {
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,timeGridDay'
            },
            buttonText: {
                today: 'Сегодня',
                month: 'Месяц',
                week: 'Неделя',
                day: 'День'
            },
            events: async (info, successCallback) => {
                try {
                    if (!checkFirebase()) return;
                    
                    const user = Auth.getUser();
                    if (!user) return;
                    
                    const orders = await db.collection('orders')
                        .where('selectedMasterId', '==', user.uid)
                        .where('status', 'in', [ORDER_STATUS.IN_PROGRESS, ORDER_STATUS.COMPLETED])
                        .get();
                    
                    const events = [];
                    orders.forEach(doc => {
                        const order = doc.data();
                        if (order.createdAt) {
                            const date = order.createdAt.toDate ? order.createdAt.toDate() : new Date(order.createdAt);
                            events.push({
                                title: order.title || 'Заказ',
                                start: date,
                                backgroundColor: '#E67A4B',
                                borderColor: '#E67A4B',
                                textColor: 'white',
                                extendedProps: {
                                    orderId: doc.id,
                                    price: order.price,
                                    address: order.address
                                }
                            });
                        }
                    });
                    successCallback(events);
                } catch (error) {
                    console.error('❌ Ошибка загрузки событий календаря:', error);
                    successCallback([]);
                }
            },
            eventClick: (info) => {
                const props = info.event.extendedProps;
                safeHelpers.showNotification(`
                    Заказ: ${info.event.title}<br>
                    Цена: ${safeHelpers.formatMoney(props.price)}<br>
                    Адрес: ${props.address || 'Не указан'}
                `, 'info');
            }
        });
        
        calendar.render();
    }

    // ===== ЗАГРУЗКА КЛИЕНТОВ (CRM) =====
    async function loadClients() {
        const tbody = document.querySelector('#clientsList');
        if (!tbody) return;
        
        try {
            if (!checkFirebase()) return;
            
            const user = Auth.getUser();
            if (!user) return;
            
            const ordersSnapshot = await db.collection('orders')
                .where('selectedMasterId', '==', user.uid)
                .get();
            
            const clientMap = new Map();
            const clientIds = new Set();
            
            ordersSnapshot.forEach(doc => {
                const order = doc.data();
                if (order.clientId) {
                    clientIds.add(order.clientId);
                }
            });
            
            for (const clientId of clientIds) {
                try {
                    const clientDoc = await db.collection('users').doc(clientId).get();
                    if (clientDoc.exists) {
                        const client = clientDoc.data();
                        
                        const clientOrders = ordersSnapshot.docs.filter(
                            doc => doc.data().clientId === clientId
                        );
                        
                        const totalSpent = clientOrders.reduce((sum, doc) => sum + (doc.data().price || 0), 0);
                        
                        clientMap.set(clientId, {
                            name: client.name || 'Клиент',
                            phone: client.phone || 'Не указан',
                            orders: clientOrders.length,
                            total: totalSpent
                        });
                    }
                } catch (e) {
                    console.warn(`⚠️ Не удалось загрузить клиента ${clientId}:`, e);
                }
            }
            
            if (clientMap.size === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="5" class="text-center p-5">
                            <i class="fas fa-users fa-3x mb-3" style="color: var(--border);"></i>
                            <p class="text-secondary">Пока нет клиентов</p>
                        </td>
                    </tr>
                `;
                return;
            }
            
            let html = '';
            clientMap.forEach((client, id) => {
                html += `
                    <tr>
                        <td class="fw-bold">${safeHelpers.escapeHtml(client.name)}</td>
                        <td>${client.phone}</td>
                        <td>${client.orders}</td>
                        <td>${safeHelpers.formatMoney(client.total)}</td>
                        <td>
                            <button class="btn btn-sm btn-outline-secondary" onclick="window.mastersAPI.openChatWithClient('${id}')">
                                <i class="fas fa-comment"></i>
                            </button>
                        </td>
                    </tr>
                `;
            });
            
            tbody.innerHTML = html;
            
        } catch (error) {
            console.error('❌ Ошибка загрузки клиентов:', error);
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center p-5 text-danger">
                        <i class="fas fa-exclamation-circle fa-3x mb-3"></i>
                        <p>Ошибка загрузки клиентов</p>
                    </td>
                </tr>
            `;
        }
    }

    // ===== ЗАГРУЗКА ПРАЙС-ЛИСТА =====
    async function loadPriceList() {
        const container = $('priceList');
        if (!container) return;
        
        try {
            const user = Auth.getUser();
            if (!user) return;
            
            const userData = Auth.getUserData();
            const prices = userData?.prices || {};
            
            const categories = [
                'Сантехника', 'Электрика', 'Отделочные работы', 
                'Мебель', 'Ремонт', 'Клининг'
            ];
            
            container.innerHTML = categories.map(cat => {
                const catPrices = prices[cat] || { min: 1000, hour: 500 };
                return `
                    <div class="col-md-6 col-lg-4">
                        <div class="price-card">
                            <h5>
                                <i class="fas ${getCategoryIcon(cat)} me-2" style="color: var(--accent);"></i>
                                ${cat}
                            </h5>
                            <div class="price-input">
                                <label>Минимальная цена</label>
                                <input type="number" class="price-min-input" data-category="${cat}" 
                                       value="${catPrices.min || 1000}" placeholder="₽">
                            </div>
                            <div class="price-input">
                                <label>Цена за час</label>
                                <input type="number" class="price-hour-input" data-category="${cat}" 
                                       value="${catPrices.hour || 500}" placeholder="₽/час">
                            </div>
                            <button class="save-price-btn" onclick="window.mastersAPI.savePrice('${cat}')">
                                <i class="fas fa-save me-2"></i>Сохранить
                            </button>
                        </div>
                    </div>
                `;
            }).join('');
            
        } catch (error) {
            console.error('❌ Ошибка загрузки прайс-листа:', error);
            container.innerHTML = '<div class="col-12 text-center text-danger">Ошибка загрузки</div>';
        }
    }

    function getCategoryIcon(cat) {
        const icons = {
            'Сантехника': 'fa-wrench',
            'Электрика': 'fa-bolt',
            'Отделочные работы': 'fa-paint-brush',
            'Мебель': 'fa-couch',
            'Ремонт': 'fa-hammer',
            'Клининг': 'fa-broom'
        };
        return icons[cat] || 'fa-tag';
    }

    // ===== API ДЛЯ ГЛОБАЛЬНЫХ ФУНКЦИЙ =====
    window.mastersAPI = {
        // Сохранение цены
        savePrice: async (category) => {
            try {
                if (!checkFirebase()) return;
                
                const user = Auth.getUser();
                if (!user) return;
                
                const minInput = document.querySelector(`.price-min-input[data-category="${category}"]`);
                const hourInput = document.querySelector(`.price-hour-input[data-category="${category}"]`);
                
                if (!minInput || !hourInput) return;
                
                const min = parseInt(minInput.value) || 0;
                const hour = parseInt(hourInput.value) || 0;
                
                const userData = Auth.getUserData();
                const prices = userData?.prices || {};
                
                prices[category] = { min, hour };
                
                await db.collection('users').doc(user.uid).update({
                    prices: prices
                });
                
                safeHelpers.showNotification(`✅ Цены на ${category.toLowerCase()} сохранены`, 'success');
                
            } catch (error) {
                console.error('❌ Ошибка сохранения цены:', error);
                safeHelpers.showNotification('❌ Ошибка при сохранении', 'error');
            }
        },

        // Установка рейтинга
        setCustomerRating: (rating) => {
            currentRating = rating;
            document.querySelectorAll('#completeOrderModal .rating-star').forEach(star => {
                const starRating = parseInt(star.dataset.rating);
                if (starRating <= rating) {
                    star.classList.add('active');
                } else {
                    star.classList.remove('active');
                }
            });
        },

        // Завершение заказа
        completeOrder: async (orderId) => {
            currentOrderId = orderId;
            currentRating = 0;
            
            document.querySelectorAll('#completeOrderModal .rating-star').forEach(star => {
                star.classList.remove('active');
            });
            
            const commentEl = $('completeComment');
            if (commentEl) commentEl.value = '';
            
            const modalEl = $('completeOrderModal');
            if (modalEl) {
                const modal = new bootstrap.Modal(modalEl);
                modal.show();
            }
        },

        // ОТКРЫТИЕ ЧАТА
        openChat: (orderId, clientId) => {
            const user = Auth.getUser();
            if (!user) {
                safeHelpers.showNotification('❌ Сначала войдите в систему', 'warning');
                return;
            }
            const chatId = `chat_${orderId}_${user.uid}`;
            window.location.href = `/HomeWork/chat.html?chatId=${chatId}&orderId=${orderId}&masterId=${user.uid}`;
        },

        // Открыть чат с клиентом
        openChatWithClient: (clientId) => {
            const user = Auth.getUser();
            if (!user) {
                safeHelpers.showNotification('❌ Сначала войдите в систему', 'warning');
                return;
            }
            // Здесь нужно получить заказ для этого клиента
            // Для демо просто открываем главную
            window.location.href = `/HomeWork/`;
        },

        // Просмотр портфолио
        viewPortfolio: (imageUrl, title, description) => {
            const imgEl = $('viewPortfolioImage');
            if (imgEl) imgEl.src = imageUrl;
            
            const titleEl = $('viewPortfolioTitle');
            if (titleEl) titleEl.innerText = title;
            
            const descEl = $('viewPortfolioDesc');
            if (descEl) descEl.innerText = description;
            
            const modalEl = $('viewPortfolioModal');
            if (modalEl) new bootstrap.Modal(modalEl).show();
        }
    };

    // ===== ОБРАБОТЧИК ЗАВЕРШЕНИЯ ЗАКАЗА =====
    async function handleCompleteOrder() {
        if (!currentOrderId) {
            safeHelpers.showNotification('❌ Ошибка: заказ не выбран', 'error');
            return;
        }
        
        try {
            if (!checkFirebase()) return;
            
            const orderDoc = await db.collection('orders').doc(currentOrderId).get();
            if (!orderDoc.exists) throw new Error('Заказ не найден');
            
            const orderData = orderDoc.data();
            const clientId = orderData.clientId;
            
            if (currentRating > 0) {
                const review = {
                    masterId: Auth.getUser().uid,
                    masterName: Auth.getUserData()?.name || 'Мастер',
                    rating: currentRating,
                    text: $('completeComment')?.value || '',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                };
                
                await db.collection('orders').doc(currentOrderId).update({
                    customerReviews: firebase.firestore.FieldValue.arrayUnion(review)
                });
                
                try {
                    const clientDoc = await db.collection('users').doc(clientId).get();
                    if (clientDoc.exists) {
                        const clientData = clientDoc.data();
                        const currentClientRating = clientData.rating || 0;
                        const currentClientReviews = clientData.reviews || 0;
                        
                        const newRating = ((currentClientRating * currentClientReviews) + currentRating) / (currentClientReviews + 1);
                        
                        await db.collection('users').doc(clientId).update({
                            rating: newRating,
                            reviews: currentClientReviews + 1
                        });
                    }
                } catch (e) {
                    console.warn('⚠️ Не удалось обновить рейтинг клиента:', e);
                }
            }
            
            if (window.Orders?.completeOrder) {
                const result = await Orders.completeOrder(currentOrderId);
                
                if (result?.success) {
                    if (window.Gamification) {
                        await Gamification.addXP(Auth.getUser().uid, 50, 'Заказ выполнен');
                    }
                    
                    const modal = bootstrap.Modal.getInstance($('completeOrderModal'));
                    if (modal) modal.hide();
                    
                    safeHelpers.showNotification('✅ Заказ выполнен! +50 XP', 'success');
                    
                    await updateMasterLevel();
                    await loadMasterResponses(currentFilter);
                } else {
                    throw new Error(result?.error || 'Ошибка при завершении заказа');
                }
            } else {
                await db.collection('orders').doc(currentOrderId).update({
                    status: ORDER_STATUS.COMPLETED,
                    completedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                
                const modal = bootstrap.Modal.getInstance($('completeOrderModal'));
                if (modal) modal.hide();
                
                safeHelpers.showNotification('✅ Заказ выполнен!', 'success');
                await loadMasterResponses(currentFilter);
            }
            
        } catch (error) {
            console.error('❌ Ошибка:', error);
            safeHelpers.showNotification(`❌ ${error.message}`, 'error');
        }
    }

    // ===== ИНИЦИАЛИЗАЦИЯ ОБРАБОТЧИКОВ =====
    function initEventListeners() {
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', function() {
                document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                this.classList.add('active');
                
                document.querySelectorAll('.tab-content').forEach(p => p.classList.remove('active'));
                const tabId = this.dataset.tab + 'Tab';
                const contentEl = $(tabId);
                if (contentEl) contentEl.classList.add('active');
                
                if (this.dataset.tab === 'calendar' && calendar) {
                    calendar.render();
                } else if (this.dataset.tab === 'crm') {
                    loadClients();
                }
            });
        });

        document.querySelectorAll('.filter-tab').forEach(tab => {
            tab.addEventListener('click', function() {
                document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
                this.classList.add('active');
                loadMasterResponses(this.dataset.filter);
            });
        });

        const editProfileBtn = $('editProfileBtn');
        if (editProfileBtn) {
            editProfileBtn.addEventListener('click', () => {
                const userData = Auth.getUserData();
                
                const editName = $('editName');
                if (editName) editName.value = userData?.name || '';
                
                const editPhone = $('editPhone');
                if (editPhone) editPhone.value = userData?.phone || '';
                
                const editCategories = $('editCategories');
                if (editCategories) editCategories.value = userData?.categories || '';
                
                const editBio = $('editBio');
                if (editBio) editBio.value = userData?.bio || '';
                
                const editExperience = $('editExperience');
                if (editExperience) editExperience.value = userData?.experience || '';
                
                const modalEl = $('editProfileModal');
                if (modalEl) new bootstrap.Modal(modalEl).show();
            });
        }

        const saveProfileBtn = $('saveProfileBtn');
        if (saveProfileBtn) {
            saveProfileBtn.addEventListener('click', async () => {
                const user = Auth.getUser();
                if (!user) return;
                
                const updates = {};
                
                const editName = $('editName');
                if (editName) updates.name = editName.value;
                
                const editPhone = $('editPhone');
                if (editPhone) updates.phone = editPhone.value;
                
                const editCategories = $('editCategories');
                if (editCategories) updates.categories = editCategories.value;
                
                const editBio = $('editBio');
                if (editBio) updates.bio = editBio.value;
                
                const editExperience = $('editExperience');
                if (editExperience) updates.experience = parseInt(editExperience.value) || 0;
                
                if (Object.keys(updates).length === 0) {
                    safeHelpers.showNotification('Нет данных для сохранения', 'warning');
                    return;
                }
                
                try {
                    if (!checkFirebase()) return;
                    
                    await db.collection('users').doc(user.uid).update(updates);
                    
                    const modal = bootstrap.Modal.getInstance($('editProfileModal'));
                    if (modal) modal.hide();
                    
                    await loadMasterData({ userData: { ...Auth.getUserData(), ...updates } });
                    safeHelpers.showNotification('✅ Профиль обновлён', 'success');
                    
                } catch (error) {
                    console.error('❌ Ошибка сохранения профиля:', error);
                    safeHelpers.showNotification('❌ Ошибка при сохранении', 'error');
                }
            });
        }

        const addPortfolioBtn = $('addPortfolioBtn');
        if (addPortfolioBtn) {
            addPortfolioBtn.addEventListener('click', () => {
                portfolioPhotos = [];
                const previewEl = $('portfolioPhotoPreview');
                if (previewEl) previewEl.innerHTML = '';
                
                const modalEl = $('addPortfolioModal');
                if (modalEl) new bootstrap.Modal(modalEl).show();
            });
        }

        const portfolioUploadArea = $('portfolioUploadArea');
        const portfolioPhotoInput = $('portfolioPhotoInput');

        if (portfolioUploadArea && portfolioPhotoInput) {
            portfolioUploadArea.addEventListener('click', () => portfolioPhotoInput.click());

            portfolioUploadArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                portfolioUploadArea.style.background = 'rgba(230,122,75,0.1)';
            });

            portfolioUploadArea.addEventListener('dragleave', () => {
                portfolioUploadArea.style.background = '';
            });

            portfolioUploadArea.addEventListener('drop', (e) => {
                e.preventDefault();
                portfolioUploadArea.style.background = '';
                handlePortfolioFile(e.dataTransfer.files[0]);
            });

            portfolioPhotoInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    handlePortfolioFile(e.target.files[0]);
                }
            });
        }

        function handlePortfolioFile(file) {
            if (!file || !file.type.startsWith('image/')) return;
            
            const reader = new FileReader();
            reader.onload = (e) => {
                const previewEl = $('portfolioPhotoPreview');
                if (previewEl) {
                    previewEl.innerHTML = `
                        <img src="${e.target.result}" style="max-width: 100%; max-height: 200px; border-radius: 15px;">
                    `;
                }
                portfolioPhotos = [file];
            };
            reader.readAsDataURL(file);
        }

        const savePortfolioBtn = $('savePortfolioBtn');
        if (savePortfolioBtn) {
            savePortfolioBtn.addEventListener('click', async () => {
                if (portfolioPhotos.length === 0) {
                    alert('Загрузите фото');
                    return;
                }
                
                try {
                    if (!checkFirebase()) return;
                    
                    const user = Auth.getUser();
                    const userData = Auth.getUserData();
                    if (!user || !userData) return;
                    
                    const file = portfolioPhotos[0];
                    const fileName = `${user.uid}_${Date.now()}.jpg`;
                    const storageRef = storage.ref(`portfolio/${fileName}`);
                    await storageRef.put(file);
                    const imageUrl = await storageRef.getDownloadURL();
                    
                    await db.collection('portfolio').add({
                        masterId: user.uid,
                        masterName: userData.name,
                        title: $('portfolioTitle')?.value || 'Работа',
                        description: $('portfolioDesc')?.value || '',
                        category: $('portfolioCategory')?.value || 'Другое',
                        imageUrl: imageUrl,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    
                    if (window.Gamification) {
                        await Gamification.addXP(user.uid, 10, 'Добавил фото в портфолио');
                        await updateMasterLevel();
                    }
                    
                    const modal = bootstrap.Modal.getInstance($('addPortfolioModal'));
                    if (modal) modal.hide();
                    
                    await loadPortfolio();
                    safeHelpers.showNotification('✅ Работа добавлена! +10 XP', 'success');
                    
                } catch (error) {
                    console.error('❌ Ошибка:', error);
                    safeHelpers.showNotification('❌ Ошибка при добавлении', 'error');
                }
            });
        }

        const verifyMasterBtn = $('verifyMasterBtn');
        if (verifyMasterBtn) {
            verifyMasterBtn.addEventListener('click', () => {
                const modalEl = $('verifyModal');
                if (modalEl) new bootstrap.Modal(modalEl).show();
            });
        }

        const logoutLink = $('logoutLink');
        if (logoutLink) {
            logoutLink.addEventListener('click', (e) => {
                e.preventDefault();
                
                if (statsInterval) {
                    clearInterval(statsInterval);
                    statsInterval = null;
                }
                
                Auth.logout().then(() => {
                    window.location.href = '/HomeWork/';
                });
            });
        }

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
        }

        const notificationsBtn = $('notificationsBtn');
        if (notificationsBtn) {
            notificationsBtn.addEventListener('click', () => {
                safeHelpers.showNotification('Уведомления пока в разработке', 'info');
            });
        }

        const clientSearch = $('clientSearch');
        if (clientSearch) {
            clientSearch.addEventListener('input', (e) => {
                const search = e.target.value.toLowerCase();
                const rows = document.querySelectorAll('#clientsList tr');
                
                rows.forEach(row => {
                    const text = row.textContent.toLowerCase();
                    if (row.querySelector('td')?.colSpan !== '5') {
                        row.style.display = text.includes(search) ? '' : 'none';
                    }
                });
            });
        }

        const exportClientsBtn = $('exportClientsBtn');
        if (exportClientsBtn) {
            exportClientsBtn.addEventListener('click', () => {
                safeHelpers.showNotification('Функция экспорта будет доступна позже', 'info');
            });
        }

        const createContractBtn = $('createContractBtn');
        if (createContractBtn) {
            createContractBtn.addEventListener('click', () => {
                safeHelpers.showNotification('Генерация договоров в разработке', 'info');
            });
        }

        const addPriceBtn = $('addPriceBtn');
        if (addPriceBtn) {
            addPriceBtn.addEventListener('click', () => {
                const modalEl = $('addPriceModal');
                if (modalEl) new bootstrap.Modal(modalEl).show();
            });
        }

        const savePriceBtn = $('savePriceBtn');
        if (savePriceBtn) {
            savePriceBtn.addEventListener('click', async () => {
                const name = $('priceServiceName')?.value;
                const category = $('priceServiceCategory')?.value;
                const price = parseInt($('priceValue')?.value);
                const unit = $('priceUnit')?.value;
                const description = $('priceDescription')?.value;
                
                if (!name || !price) {
                    safeHelpers.showNotification('Заполните название и цену', 'warning');
                    return;
                }
                
                try {
                    if (!checkFirebase()) return;
                    
                    const user = Auth.getUser();
                    if (!user) return;
                    
                    const userData = Auth.getUserData();
                    const customPrices = userData?.customPrices || [];
                    
                    customPrices.push({
                        name,
                        category,
                        price,
                        unit,
                        description,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    
                    await db.collection('users').doc(user.uid).update({
                        customPrices: customPrices
                    });
                    
                    const modal = bootstrap.Modal.getInstance($('addPriceModal'));
                    if (modal) modal.hide();
                    
                    safeHelpers.showNotification('✅ Услуга добавлена', 'success');
                    
                    const priceServiceName = $('priceServiceName');
                    if (priceServiceName) priceServiceName.value = '';
                    
                    const priceValue = $('priceValue');
                    if (priceValue) priceValue.value = '';
                    
                    const priceDescription = $('priceDescription');
                    if (priceDescription) priceDescription.value = '';
                    
                } catch (error) {
                    console.error('❌ Ошибка:', error);
                    safeHelpers.showNotification('❌ Ошибка при сохранении', 'error');
                }
            });
        }

        const videoConsultBtn = $('videoConsultBtn');
        if (videoConsultBtn) {
            videoConsultBtn.addEventListener('click', () => {
                const modalEl = $('videoConsultModal');
                if (modalEl) new bootstrap.Modal(modalEl).show();
            });
        }

        const confirmCompleteBtn = $('confirmCompleteBtn');
        if (confirmCompleteBtn) {
            confirmCompleteBtn.addEventListener('click', handleCompleteOrder);
        }

        if (localStorage.getItem('theme') === 'dark') {
            document.body.classList.add('dark-theme');
            const icon = themeToggle?.querySelector('i');
            if (icon) {
                icon.classList.remove('fa-moon');
                icon.classList.add('fa-sun');
            }
        }
    }

    // ===== ИНИЦИАЛИЗАЦИЯ =====
    document.addEventListener('DOMContentLoaded', () => {
        if (!window.Auth) {
            console.error('❌ Auth не загружен!');
            safeHelpers.showNotification('❌ Ошибка загрузки авторизации', 'error');
            return;
        }
        
        Auth.onAuthChange(async (state) => {
            const authRequired = $('authRequired');
            const masterCabinet = $('masterCabinet');
            
            if (state.isAuthenticated && state.isMaster) {
                if (authRequired) authRequired.classList.add('d-none');
                if (masterCabinet) masterCabinet.classList.remove('d-none');
                
                await Promise.all([
                    loadMasterData(state),
                    updateMasterLevel(),
                    loadBadges(),
                    loadMasterResponses('all'),
                    loadPortfolio(),
                    loadPriceList(),
                    loadClients()
                ]);
                
                initCalendar();
                
                if (statsInterval) clearInterval(statsInterval);
                statsInterval = setInterval(updateMasterLevel, 60000);
                
            } else if (state.isAuthenticated && !state.isMaster) {
                safeHelpers.showNotification('❌ Эта страница только для мастеров', 'warning');
                setTimeout(() => window.location.href = '/HomeWork/', 2000);
            } else {
                if (authRequired) authRequired.classList.remove('d-none');
                if (masterCabinet) masterCabinet.classList.add('d-none');
                
                if (statsInterval) {
                    clearInterval(statsInterval);
                    statsInterval = null;
                }
            }
        });

        initEventListeners();
    });

})();