// ===== INDEX.JS — Логика главной страницы =====
// ВЕРСИЯ 13.4 — ИСПРАВЛЕНА ПРОБЛЕМА ИСЧЕЗНОВЕНИЯ ЗАКАЗОВ

// ===== ЗАЩИТА ОТ БЕСКОНЕЧНЫХ РЕДИРЕКТОВ =====
(function() {
    const REDIRECT_KEY = 'last_redirect';
    const MAX_REDIRECTS = 7;
    const TIME_WINDOW = 5000; // 5 секунд
    
    const now = Date.now();
    const lastRedirect = sessionStorage.getItem(REDIRECT_KEY);
    
    if (lastRedirect) {
        try {
            const data = JSON.parse(lastRedirect);
            if (now - data.timestamp < TIME_WINDOW) {
                data.count++;
                if (data.count > MAX_REDIRECTS) {
                    console.error('⚠️ Обнаружен бесконечный редирект!');
                    alert('❌ Слишком много перенаправлений. Проверьте подключение к интернету или обратитесь в поддержку.');
                    window.stop();
                    return;
                }
                sessionStorage.setItem(REDIRECT_KEY, JSON.stringify(data));
            } else {
                sessionStorage.setItem(REDIRECT_KEY, JSON.stringify({ count: 1, timestamp: now }));
            }
        } catch (e) {
            sessionStorage.setItem(REDIRECT_KEY, JSON.stringify({ count: 1, timestamp: now }));
        }
    } else {
        sessionStorage.setItem(REDIRECT_KEY, JSON.stringify({ count: 1, timestamp: now }));
    }
})();

// ===== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ =====
let map = null;
let ordersMap = null;
let ymapsReady = false;
let uploadedPhotos = [];
let searchTimeout = null;

// Для автоподстановки адресов
let addressTimeout = null;
let addressContainer = null;
let selectedAddressIndex = -1;
let currentSuggestions = [];

// Состояние фильтров и пагинации
let filters = {
    category: 'all',
    city: 'all'
};
let allOrders = [];           // Все загруженные заказы
let displayedOrders = [];      // Отображаемые заказы
let currentPage = 0;
let isLoading = false;
let hasMore = true;

// ===== НОВЫЕ ПЕРЕМЕННЫЕ ДЛЯ ЗАЩИТЫ ОТ ГОНКИ =====
let isLoadingOrders = false;          // Флаг, чтобы не запускать параллельные загрузки
let ordersLoadTimeout = null;         // Таймер для дебаунса
let lastOrdersUpdate = 0;             // Время последнего успешного обновления
let pendingAuthUpdate = false;        // Флаг для отложенного обновления после авторизации
const ORDERS_UPDATE_COOLDOWN = 1000;  // Минимальный интервал между обновлениями (1 сек)

// Топ мастеров
let currentLeaderboardPeriod = 'week';

// Модалка авторизации
let authModal = null;

// ===== ФУНКЦИЯ ОТОБРАЖЕНИЯ ЗВЕЗД РЕЙТИНГА =====
function renderRatingStars(rating) {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating - fullStars >= 0.5;
    let stars = '';
    
    for (let i = 0; i < 5; i++) {
        if (i < fullStars) {
            stars += '<i class="fas fa-star" style="color: gold;"></i>';
        } else if (i === fullStars && hasHalfStar) {
            stars += '<i class="fas fa-star-half-alt" style="color: gold;"></i>';
        } else {
            stars += '<i class="far fa-star" style="color: gold;"></i>';
        }
    }
    
    return stars;
}

// ============================================
// ФУНКЦИЯ ПРОВЕРКИ ПОЗИЦИОНИРОВАНИЯ
// ============================================

function checkOrderPositioning() {
    const formColumn = document.getElementById('orderFormColumn');
    const ordersColumn = document.getElementById('ordersColumn');
    const formRow = document.getElementById('orderFormRow');
    
    if (!formColumn || !ordersColumn || !formRow) return;
    
    console.log('🔍 Проверка позиционирования:');
    console.log('- formColumn display:', window.getComputedStyle(formColumn).display);
    console.log('- ordersColumn display:', window.getComputedStyle(ordersColumn).display);
    console.log('- formRow flex-direction:', window.getComputedStyle(formRow).flexDirection);
    
    // Принудительно применяем стили если что-то пошло не так
    if (window.getComputedStyle(formRow).flexDirection !== 'row') {
        console.warn('⚠️ flex-direction не row, применяем фикс');
        formRow.style.setProperty('flex-direction', 'row', 'important');
    }
    
    if (window.getComputedStyle(formColumn).flex !== '0 0 50%') {
        console.warn('⚠️ ширина формы не 50%, применяем фикс');
        formColumn.style.setProperty('flex', '0 0 50%', 'important');
        formColumn.style.setProperty('max-width', '50%', 'important');
        formColumn.style.setProperty('width', '50%', 'important');
    }
    
    if (window.getComputedStyle(ordersColumn).flex !== '0 0 50%') {
        console.warn('⚠️ ширина заказов не 50%, применяем фикс');
        ordersColumn.style.setProperty('flex', '0 0 50%', 'important');
        ordersColumn.style.setProperty('max-width', '50%', 'important');
        ordersColumn.style.setProperty('width', '50%', 'important');
    }
}

// ============================================
// ИНИЦИАЛИЗАЦИЯ ФИЛЬТРОВ
// ============================================

function initFilters() {
    console.log('🔧 Инициализация фильтров...');
    
    // ===== КОМБО-ПОИСК ПО ГОРОДАМ =====
    initCityCombo();
    
    // ===== КАТЕГОРИИ =====
    const categoryFilter = document.getElementById('categoryFilter');
    if (!categoryFilter) {
        console.error('❌ categoryFilter не найден');
        return;
    }
    
    if (!window.ORDER_CATEGORIES) {
        console.error('❌ ORDER_CATEGORIES не определены');
        return;
    }
    
    console.log('📋 Категории загружены:', window.ORDER_CATEGORIES.length);
    
    categoryFilter.innerHTML = window.ORDER_CATEGORIES.map(cat => `
        <button class="filter-btn category-filter-btn ${cat.id === 'all' ? 'active' : ''}" 
                data-category="${cat.id}" 
                title="${cat.name}">
            <i class="fas ${cat.icon} me-1"></i>
            ${cat.name}
        </button>
    `).join('');
    
    // Добавляем обработчики для категорий
    document.querySelectorAll('.category-filter-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.category-filter-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            filters.category = this.dataset.category;
            console.log('📋 Выбрана категория:', filters.category);
            applyFilters(true);
        });
    });
    
    console.log('✅ Кнопки категорий сформированы');
}

// ============================================
// КОМБО-ПОИСК ПО ГОРОДАМ (исправлено с проверками)
// ============================================

function initCityCombo() {
    const container = document.getElementById('citySearchCombo');
    const input = document.getElementById('citySearchInput');
    const dropdown = document.getElementById('cityDropdown');
    
    if (!container || !input || !dropdown) {
        console.warn('⚠️ Элементы для комбо-поиска не найдены, инициализация пропущена');
        return;
    }
    
    if (!window.SORTED_CITIES_BY_DISTRICT) {
        console.warn('⚠️ SORTED_CITIES_BY_DISTRICT не определен, инициализация пропущена');
        return;
    }
    
    let selectedCityId = 'all';
    
    // ===== СТРОИМ ВЫПАДАЮЩИЙ СПИСОК =====
    function buildDropdown(filterText = '') {
        const filter = filterText.toLowerCase().trim();
        let html = '';
        
        // Всегда показываем "Все города"
        html += `<div class="dropdown-item" data-city-id="all" style="padding: 10px 16px; cursor: pointer; border-bottom: 1px solid var(--border); font-weight: bold; background: ${selectedCityId === 'all' ? 'var(--accent-light)' : 'transparent'};">🏠 Все города</div>`;
        
        // Порядок районов
        const districtOrder = [
            '🏙️ ГОРОДА ОКРУЖНОГО ПОДЧИНЕНИЯ',
            '🏘️ ПОСЕЛКИ ГОРОДСКОГО ТИПА',
            '📍 БЕЛОЯРСКИЙ РАЙОН',
            '📍 БЕРЁЗОВСКИЙ РАЙОН',
            '📍 КОНДИНСКИЙ РАЙОН',
            '📍 НЕФТЕЮГАНСКИЙ РАЙОН',
            '📍 НИЖНЕВАРТОВСКИЙ РАЙОН',
            '📍 ОКТЯБРЬСКИЙ РАЙОН',
            '📍 СОВЕТСКИЙ РАЙОН',
            '📍 СУРГУТСКИЙ РАЙОН',
            '📍 ХАНТЫ-МАНСИЙСКИЙ РАЙОН'
        ];
        
        districtOrder.forEach(district => {
            const cities = window.SORTED_CITIES_BY_DISTRICT[district];
            if (!cities || cities.length === 0) return;
            
            // Фильтруем города
            const filteredCities = cities.filter(city => 
                city.id !== 'all' && city.name.toLowerCase().includes(filter)
            );
            
            if (filteredCities.length === 0) return;
            
            // Заголовок района
            html += `<div class="dropdown-district" style="padding: 8px 16px; background: var(--bg-light); font-weight: 700; color: var(--accent); font-size: 0.9rem; border-bottom: 1px solid var(--border);">${district}</div>`;
            
            // Города района
            filteredCities.forEach(city => {
                const isSelected = (selectedCityId === city.id);
                html += `
                    <div class="dropdown-item" data-city-id="${city.id}" 
                         style="padding: 8px 16px 8px 32px; cursor: pointer; background: ${isSelected ? 'var(--accent-light)' : 'transparent'}; transition: all 0.2s;">
                        ${city.name}
                    </div>
                `;
            });
        });
        
        if (html === '') {
            html = `<div class="dropdown-item disabled" style="padding: 16px; color: var(--text-soft); text-align: center;">❌ Городов не найдено</div>`;
        }
        
        dropdown.innerHTML = html;
        
        // Добавляем обработчики на элементы
        dropdown.querySelectorAll('.dropdown-item[data-city-id]').forEach(item => {
            item.addEventListener('click', function(e) {
                e.stopPropagation();
                const cityId = this.dataset.cityId;
                const cityName = cityId === 'all' ? '' : this.textContent.trim();
                
                selectedCityId = cityId;
                input.value = cityName;
                dropdown.style.display = 'none';
                
                // Обновляем фильтр
                filters.city = cityId;
                applyFilters(true);
                
                // Подсветка выбранного
                buildDropdown('');
            });
            
            // Ховер эффект
            item.addEventListener('mouseenter', function() {
                this.style.backgroundColor = 'var(--accent-light)';
            });
            item.addEventListener('mouseleave', function() {
                if (this.dataset.cityId !== selectedCityId) {
                    this.style.backgroundColor = 'transparent';
                }
            });
        });
    }
    
    // ===== ПОКАЗ/СКРЫТИЕ DROPDOWN =====
    input.addEventListener('focus', () => {
        buildDropdown(input.value);
        dropdown.style.display = 'block';
    });
    
    input.addEventListener('input', function() {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            buildDropdown(this.value);
        }, 300);
    });
    
    // Закрытие по клику вне
    document.addEventListener('click', (e) => {
        if (!container.contains(e.target)) {
            dropdown.style.display = 'none';
        }
    });
    
    // Выбор по Enter
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const firstItem = dropdown.querySelector('.dropdown-item[data-city-id]');
            if (firstItem) firstItem.click();
        }
    });
    
    // Сброс
    document.getElementById('clearFiltersBtn')?.addEventListener('click', () => {
        selectedCityId = 'all';
        input.value = '';
        filters.city = 'all';
        applyFilters(true);
        buildDropdown('');
    });
    
    console.log('✅ Комбо-поиск инициализирован');
}

// ============================================
// ФУНКЦИИ ЗАГРУЗКИ ДАННЫХ (ОБНОВЛЕННЫЕ)
// ============================================

// Загрузка всех заказов с защитой от множественных вызовов
async function loadAllOrders(force = false) {
    // Защита от параллельных вызовов
    if (isLoadingOrders) {
        console.log('⏳ Загрузка заказов уже выполняется, пропускаем...');
        return;
    }

    // Защита от слишком частых обновлений
    const now = Date.now();
    if (!force && now - lastOrdersUpdate < ORDERS_UPDATE_COOLDOWN) {
        console.log(`⏳ Слишком частые обновления. Ждём ${ORDERS_UPDATE_COOLDOWN}мс...`);
        if (ordersLoadTimeout) clearTimeout(ordersLoadTimeout);
        ordersLoadTimeout = setTimeout(() => loadAllOrders(true), ORDERS_UPDATE_COOLDOWN);
        return;
    }

    isLoadingOrders = true;
    
    try {
        if (!window.db) {
            throw new Error('db не определен');
        }
        
        console.log('📦 Загрузка заказов...');
        
        const snapshot = await db.collection('orders')
            .where('status', '==', window.ORDER_STATUS?.OPEN || 'open')
            .orderBy('createdAt', 'desc')
            .get();
        
        const newOrders = [];
        snapshot.forEach(doc => {
            newOrders.push({ id: doc.id, ...doc.data() });
        });
        
        console.log(`📦 Загружено ${newOrders.length} заказов`);
        
        // Обновляем состояние только если данные действительно новые
        if (JSON.stringify(allOrders) !== JSON.stringify(newOrders)) {
            allOrders = newOrders;
            lastOrdersUpdate = Date.now();
            
            // Обновляем счетчик
            const ordersCountEl = document.getElementById('ordersCount');
            if (ordersCountEl) ordersCountEl.textContent = allOrders.length;
            
            // Применяем фильтры
            applyFilters(true);
        } else {
            console.log('📦 Данные заказов не изменились');
        }

    } catch (error) {
        console.error('❌ Ошибка загрузки заказов:', error);
        showError('Не удалось загрузить заказы');
    } finally {
        isLoadingOrders = false;
        if (ordersLoadTimeout) {
            clearTimeout(ordersLoadTimeout);
            ordersLoadTimeout = null;
        }
    }
}

// Применение фильтров и отображение
function applyFilters(resetPage = true) {
    // Фильтруем заказы
    let filtered = [...allOrders];
    
    // Фильтр по категории
    if (filters.category !== 'all') {
        filtered = filtered.filter(order => order.category === filters.category);
    }
    
    // Фильтр по городу
    if (filters.city !== 'all' && window.CITIES) {
        const cityName = window.CITIES.find(c => c.id === filters.city)?.name;
        if (cityName) {
            filtered = filtered.filter(order => 
                order.address && order.address.toLowerCase().includes(cityName.toLowerCase())
            );
        }
    }
    
    // Обновляем отображаемые заказы
    if (resetPage) {
        const initialCount = window.PAGINATION?.ORDERS_INITIAL || 7;
        displayedOrders = filtered.slice(0, initialCount);
        currentPage = 0;
    } else {
        const start = displayedOrders.length;
        const loadMoreCount = window.PAGINATION?.ORDERS_LOAD_MORE || 5;
        const end = start + loadMoreCount;
        const moreOrders = filtered.slice(start, end);
        
        // Избегаем дублирования
        if (moreOrders.length > 0) {
            const existingIds = new Set(displayedOrders.map(o => o.id));
            const uniqueNewOrders = moreOrders.filter(o => !existingIds.has(o.id));
            displayedOrders = [...displayedOrders, ...uniqueNewOrders];
        }
    }
    
    // Проверяем, есть ли еще заказы
    hasMore = displayedOrders.length < filtered.length;
    
    // Обновляем UI
    renderOrders();
    updateLoadMoreButton(filtered.length);
}

// Обновление кнопки "Показать еще"
function updateLoadMoreButton(totalFiltered) {
    const container = document.getElementById('loadMoreContainer');
    const remainingSpan = document.getElementById('remainingOrdersCount');
    
    if (!container || !remainingSpan) return;
    
    if (hasMore) {
        const remaining = totalFiltered - displayedOrders.length;
        remainingSpan.textContent = remaining;
        container.classList.remove('d-none');
    } else {
        container.classList.add('d-none');
    }
}

// Отрисовка заказов с оптимизацией
function renderOrders() {
    const ordersList = document.getElementById('ordersList');
    if (!ordersList) return;
    
    // Генерируем ключ на основе отображаемых заказов
    const currentStateKey = displayedOrders.map(o => o.id).join(',');
    
    // Если список не изменился и уже отрисован — пропускаем рендер
    if (ordersList.dataset.lastState === currentStateKey && ordersList.children.length > 0) {
        console.log('📦 Список заказов не изменился, пропускаем рендер');
        return;
    }
    
    if (displayedOrders.length === 0) {
        ordersList.innerHTML = `
            <div class="text-center p-5">
                <i class="fas fa-smile fa-3x mb-3" style="color: var(--border);"></i>
                <h5>Нет заказов</h5>
                <p class="text-secondary">Попробуйте изменить фильтры</p>
            </div>
        `;
    } else {
        ordersList.innerHTML = '';
        displayedOrders.forEach(order => {
            ordersList.appendChild(createOrderCard(order));
        });
    }
    
    // Сохраняем текущее состояние для будущих сравнений
    ordersList.dataset.lastState = currentStateKey;
}

// Создание карточки заказа
function createOrderCard(order) {
    const div = document.createElement('div');
    div.className = 'order-item';
    
    const categoryIcon = window.CATEGORY_ICONS?.[order.category] || 'fa-tag';
    
    let cityIcon = 'fa-map-marker-alt';
    let cityName = 'Город не указан';
    if (order.address && window.CITIES) {
        const foundCity = window.CITIES.find(c => 
            order.address.toLowerCase().includes(c.name.toLowerCase())
        );
        if (foundCity) {
            cityIcon = foundCity.icon || 'fa-map-marker-alt';
            cityName = foundCity.name;
        }
    }
    
    let photosHtml = '';
    if (order.photos?.length > 0) {
        photosHtml = `
            <div class="d-flex gap-2 mb-3 flex-wrap">
                ${order.photos.slice(0, 3).map(url => 
                    `<img src="${url}" style="width: 60px; height: 60px; object-fit: cover; border-radius: var(--radius-sm); cursor: pointer;" onclick="window.open('${url}')">`
                ).join('')}
                ${order.photos.length > 3 ? `<span class="text-secondary">+${order.photos.length-3}</span>` : ''}
            </div>
        `;
    }
    
    const showButton = typeof Auth !== 'undefined' && 
                      Auth.isAuthenticated && 
                      Auth.isAuthenticated() && 
                      typeof Auth.isMaster === 'function' && 
                      Auth.isMaster() && 
                      order.status === (window.ORDER_STATUS?.OPEN || 'open');
    
    let actionsHtml = '';
    if (showButton) {
        actionsHtml = `
            <div class="d-flex gap-2 mt-3">
                <button class="btn btn-success flex-grow-1" onclick="respondToOrder('${order.id}')">
                    <i class="fas fa-reply me-2"></i>Откликнуться
                </button>
            </div>
        `;
    }
    
    div.innerHTML = `
        <div class="order-header">
            <h5 class="order-title mb-0">${Utils.escapeHtml(order.title || 'Заказ')}</h5>
            <span class="order-price">${order.price || 0} ₽</span>
        </div>
        <p class="text-secondary mb-3">${Utils.escapeHtml(order.description || 'Нет описания')}</p>
        ${photosHtml}
        <div class="order-meta">
            <span><i class="fas ${categoryIcon}"></i> ${order.category || 'Без категории'}</span>
            <span><i class="fas ${cityIcon}"></i> ${cityName}</span>
        </div>
        ${actionsHtml}
    `;
    
    return div;
}

// Показать ошибку
function showError(message) {
    const ordersList = document.getElementById('ordersList');
    if (ordersList) {
        ordersList.innerHTML = `
            <div class="text-center p-5 text-danger">
                <i class="fas fa-exclamation-circle fa-3x mb-3"></i>
                <p>${message}</p>
            </div>
        `;
    }
}

// ============================================
// ЗАГРУЗКА ТОП МАСТЕРОВ ПО ПЕРИОДАМ
// ============================================

async function loadTopMasters(period = 'week') {
    const container = document.getElementById('topMastersList');
    if (!container) return;
    
    container.innerHTML = '<div class="text-center p-5"><div class="spinner mb-3"></div><p class="text-secondary">Загрузка...</p></div>';
    
    try {
        if (!window.db) {
            throw new Error('db не определен');
        }
        
        const now = new Date();
        let startDate = null;
        
        switch(period) {
            case 'day':
                startDate = new Date(now.setHours(0, 0, 0, 0));
                break;
            case 'week':
                startDate = new Date(now.setDate(now.getDate() - 7));
                break;
            case 'month':
                startDate = new Date(now.setMonth(now.getMonth() - 1));
                break;
            case 'all':
            default:
                startDate = null;
        }
        
        const mastersSnapshot = await db.collection('users')
            .where('role', '==', window.USER_ROLE?.MASTER || 'master')
            .get();
        
        const masters = [];
        
        for (const doc of mastersSnapshot.docs) {
            const master = { id: doc.id, ...doc.data() };
            
            if (startDate) {
                const ordersSnapshot = await db.collection('orders')
                    .where('selectedMasterId', '==', doc.id)
                    .where('status', '==', window.ORDER_STATUS?.COMPLETED || 'completed')
                    .where('completedAt', '>=', startDate)
                    .get();
                
                master.periodCompleted = ordersSnapshot.size;
                
                let periodRating = 0;
                let periodReviews = 0;
                
                ordersSnapshot.forEach(orderDoc => {
                    const order = orderDoc.data();
                    if (order.reviews) {
                        order.reviews.forEach(review => {
                            if (review.masterId === doc.id) {
                                periodRating += review.rating || 0;
                                periodReviews++;
                            }
                        });
                    }
                });
                
                master.periodRating = periodReviews > 0 ? periodRating / periodReviews : 0;
            }
            
            masters.push(master);
        }
        
        masters.sort((a, b) => {
            if (startDate) {
                return (b.periodRating || 0) - (a.periodRating || 0);
            } else {
                return (b.rating || 0) - (a.rating || 0);
            }
        });
        
        const topMasters = masters.slice(0, 6);
        
        if (topMasters.length === 0) {
            container.innerHTML = '<div class="text-center p-5">Пока нет мастеров</div>';
            return;
        }
        
        container.innerHTML = '';
        
        topMasters.forEach(master => {
            const rating = startDate ? (master.periodRating || 0) : (master.rating || 0);
            const completedJobs = startDate ? (master.periodCompleted || 0) : (master.completedJobs || 0);
            
            const ratingStars = renderRatingStars(rating);
            
            const col = document.createElement('div');
            col.className = 'col-md-4 col-lg-2';
            col.innerHTML = `
                <div class="master-card text-center">
                    <div class="master-avatar">
                        <i class="fas fa-user-tie"></i>
                    </div>
                    <h6 class="fw-bold mb-1">${Utils.escapeHtml(master.name || 'Мастер')}</h6>
                    <div class="rating-stars mb-2">${ratingStars}</div>
                    <div class="mb-2">
                        <span class="badge badge-primary">⭐ ${rating.toFixed(1)}</span>
                        <span class="badge badge-success ms-1">📦 ${completedJobs}</span>
                    </div>
                    <p class="small text-secondary mb-2">${Utils.escapeHtml(master.categories || 'Специалист')}</p>
                    <button class="btn btn-sm w-100" onclick="handleViewMaster('${master.id}')">
                        Смотреть профиль
                    </button>
                </div>
            `;
            container.appendChild(col);
        });
        
    } catch (error) {
        console.error('❌ Ошибка загрузки мастеров:', error);
        container.innerHTML = '<div class="text-center p-5 text-danger">Ошибка загрузки</div>';
    }
}

// ===== ОБРАБОТЧИКИ ДЛЯ КНОПОК ПЕРИОДОВ =====
function initLeaderboardButtons() {
    const buttons = {
        day: document.getElementById('leaderboardDaily'),
        week: document.getElementById('leaderboardWeekly'),
        month: document.getElementById('leaderboardMonthly'),
        all: document.getElementById('leaderboardAll')
    };
    
    Object.entries(buttons).forEach(([period, btn]) => {
        if (btn) {
            btn.addEventListener('click', () => {
                Object.values(buttons).forEach(b => b?.classList.remove('active'));
                btn.classList.add('active');
                loadTopMasters(period);
            });
        }
    });
}

// ===== ОБРАБОТКА КЛИКА ПО ПРОФИЛЮ МАСТЕРА =====
function handleViewMaster(masterId) {
    if (Auth?.isAuthenticated?.()) {
        window.location.href = `/HomeWork/master-profile.html?id=${masterId}`;
    } else {
        showAuthRequiredModal();
    }
}

// ===== МОДАЛКА АВТОРИЗАЦИИ =====
function showAuthRequiredModal() {
    const modalEl = document.getElementById('authRequiredModal');
    if (!modalEl) {
        console.error('❌ Модалка не найдена');
        Utils.showNotification('Для просмотра профиля необходимо войти в систему', 'warning');
        if (typeof AuthUI?.showLoginModal === 'function') {
            AuthUI.showLoginModal();
        }
        return;
    }
    
    if (typeof bootstrap === 'undefined') {
        console.error('❌ Bootstrap не загружен');
        Utils.showNotification('Ошибка загрузки модального окна', 'error');
        return;
    }
    
    try {
        // Убиваем старые бэкдропы
        document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
        
        if (authModal) {
            authModal.show();
            return;
        }
        
        authModal = new bootstrap.Modal(modalEl, {
            backdrop: 'static',
            keyboard: true
        });
        
        authModal.show();
        
        modalEl.addEventListener('hidden.bs.modal', function () {
            document.body.classList.remove('modal-open');
            document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
            document.body.style.overflow = '';
            document.body.style.paddingRight = '';
        }, { once: true });
        
    } catch (error) {
        console.error('❌ Ошибка модалки:', error);
        Utils.showNotification('Для просмотра профиля необходимо войти в систему', 'warning');
        
        if (typeof AuthUI?.showLoginModal === 'function') {
            AuthUI.showLoginModal();
        }
    }
}

function closeAuthModal() {
    if (authModal) {
        authModal.hide();
        
        setTimeout(() => {
            document.body.classList.remove('modal-open');
            document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
            document.body.style.overflow = '';
            document.body.style.paddingRight = '';
        }, 300);
    }
}

// ============================================
// ФУНКЦИИ РАБОТЫ С КАРТАМИ
// ============================================

function initMaps() {
    try {
        if (document.getElementById('map') && typeof ymaps !== 'undefined') {
            map = new ymaps.Map('map', {
                center: [61.0, 69.0],
                zoom: 8
            });
            
            map.events.add('click', async (e) => {
                const coords = e.get('coords');
                document.getElementById('latitude').value = coords[0].toFixed(6);
                document.getElementById('longitude').value = coords[1].toFixed(6);
                
                const res = await ymaps.geocode(coords);
                const firstGeoObject = res.geoObjects.get(0);
                document.getElementById('address').value = firstGeoObject.getAddressLine();
                
                map.geoObjects.removeAll();
                map.geoObjects.add(new ymaps.Placemark(coords));
            });
            
            initAddressAutocomplete();
        }
        
        if (document.getElementById('ordersMap') && typeof ymaps !== 'undefined') {
            ordersMap = new ymaps.Map('ordersMap', {
                center: [61.0, 69.0],
                zoom: 8
            });
            loadOrdersMap();
        }
    } catch (error) {
        console.error('❌ Ошибка карт:', error);
    }
}

async function loadOrdersMap() {
    if (!ymapsReady || !ordersMap || !window.db) return;
    
    try {
        ordersMap.geoObjects.removeAll();
        
        const snapshot = await db.collection('orders')
            .where('status', '==', window.ORDER_STATUS?.OPEN || 'open')
            .limit(50)
            .get();

        snapshot.forEach(doc => {
            const order = doc.data();
            if (order.latitude && order.longitude) {
                const placemark = new ymaps.Placemark(
                    [order.latitude, order.longitude],
                    {
                        balloonContent: `
                            <strong>${order.title || 'Заказ'}</strong><br>
                            ${order.price || 0} ₽<br>
                            ${order.address || ''}
                        `
                    },
                    {
                        preset: 'islands#icon',
                        iconColor: '#E67A4B'
                    }
                );
                ordersMap.geoObjects.add(placemark);
            }
        });
    } catch (error) {
        console.error('❌ Ошибка карты:', error);
    }
}

// ============================================
// ФУНКЦИЯ АВТОПОДСТАНОВКИ АДРЕСОВ
// ============================================

function initAddressAutocomplete() {
    const addressInput = document.getElementById('address');
    if (!addressInput || typeof ymaps === 'undefined') return;
    
    console.log('📍 Инициализация автоподстановки адресов');
    
    if (!document.getElementById('addressSuggestions')) {
        const suggestionsDiv = document.createElement('div');
        suggestionsDiv.id = 'addressSuggestions';
        suggestionsDiv.className = 'address-suggestions';
        suggestionsDiv.style.display = 'none';
        addressInput.parentNode.style.position = 'relative';
        addressInput.parentNode.appendChild(suggestionsDiv);
        addressContainer = suggestionsDiv;
    }
    
    const loadingIcon = document.createElement('i');
    loadingIcon.className = 'fas fa-spinner address-loading';
    loadingIcon.id = 'addressLoading';
    loadingIcon.style.display = 'none';
    addressInput.parentNode.appendChild(loadingIcon);
    
    addressInput.addEventListener('input', function(e) {
        const query = e.target.value.trim();
        
        const loading = document.getElementById('addressLoading');
        if (loading) loading.style.display = 'block';
        
        if (addressTimeout) clearTimeout(addressTimeout);
        
        if (query.length < 3) {
            if (addressContainer) addressContainer.style.display = 'none';
            if (loading) loading.style.display = 'none';
            return;
        }
        
        addressTimeout = setTimeout(() => {
            searchAddresses(query);
        }, 300);
    });
    
    document.addEventListener('click', function(e) {
        if (!addressInput.contains(e.target) && !addressContainer?.contains(e.target)) {
            if (addressContainer) addressContainer.style.display = 'none';
            selectedAddressIndex = -1;
        }
    });
    
    addressInput.addEventListener('keydown', function(e) {
        if (!addressContainer || addressContainer.style.display === 'none') return;
        
        const items = addressContainer.querySelectorAll('.address-suggestion-item');
        if (items.length === 0) return;
        
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            selectedAddressIndex = (selectedAddressIndex + 1) % items.length;
            highlightSuggestion(items);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            selectedAddressIndex = (selectedAddressIndex - 1 + items.length) % items.length;
            highlightSuggestion(items);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (selectedAddressIndex >= 0 && items[selectedAddressIndex]) {
                items[selectedAddressIndex].click();
            }
        } else if (e.key === 'Escape') {
            addressContainer.style.display = 'none';
            selectedAddressIndex = -1;
        }
    });
}

function highlightSuggestion(items) {
    items.forEach((item, index) => {
        if (index === selectedAddressIndex) {
            item.style.background = 'var(--accent-light)';
            item.scrollIntoView({ block: 'nearest' });
        } else {
            item.style.background = '';
        }
    });
}

async function searchAddresses(query) {
    if (!addressContainer || typeof ymaps === 'undefined') return;
    
    try {
        const loading = document.getElementById('addressLoading');
        
        const result = await ymaps.geocode(query, {
            results: 10,
            kind: 'house',
            boundedBy: [[70.0, 50.0], [55.0, 80.0]]
        });
        
        if (loading) loading.style.display = 'none';
        
        const suggestions = result.geoObjects.toArray();
        currentSuggestions = suggestions;
        
        if (suggestions.length === 0) {
            addressContainer.style.display = 'none';
            return;
        }
        
        let html = '';
        suggestions.forEach((suggestion, index) => {
            const address = suggestion.getAddressLine();
            const coords = suggestion.geometry.getCoordinates();
            
            const kinds = suggestion.getPremise() ? 'дом' : 
                         suggestion.getThoroughfare() ? 'улица' : 
                         'район';
            
            html += `
                <div class="address-suggestion-item" 
                     data-address="${address.replace(/"/g, '&quot;')}"
                     data-lat="${coords[0]}"
                     data-lon="${coords[1]}"
                     data-index="${index}">
                    <i class="fas fa-map-marker-alt"></i>
                    <span class="address-text">${address}</span>
                    <span class="address-type">${kinds}</span>
                </div>
            `;
        });
        
        addressContainer.innerHTML = html;
        addressContainer.style.display = 'block';
        selectedAddressIndex = -1;
        
        addressContainer.querySelectorAll('.address-suggestion-item').forEach(item => {
            item.addEventListener('click', function() {
                const address = this.dataset.address;
                const lat = parseFloat(this.dataset.lat);
                const lon = parseFloat(this.dataset.lon);
                
                document.getElementById('address').value = address;
                document.getElementById('latitude').value = lat.toFixed(6);
                document.getElementById('longitude').value = lon.toFixed(6);
                
                addressContainer.style.display = 'none';
                
                if (window.map) {
                    window.map.setCenter([lat, lon], 15);
                    window.map.geoObjects.removeAll();
                    window.map.geoObjects.add(new ymaps.Placemark([lat, lon]));
                }
            });
        });
        
    } catch (error) {
        console.error('❌ Ошибка поиска адреса:', error);
        const loading = document.getElementById('addressLoading');
        if (loading) loading.style.display = 'none';
    }
}

// ============================================
// ДЕЙСТВИЯ С ЗАКАЗАМИ
// ============================================

async function respondToOrder(orderId) {
    if (typeof Auth === 'undefined' || !Auth.isAuthenticated || !Auth.isAuthenticated()) {
        Utils.showNotification('❌ Сначала войдите в систему', 'warning');
        return;
    }
    
    if (typeof Auth.isMaster !== 'function' || !Auth.isMaster()) {
        Utils.showNotification('❌ Только мастера могут откликаться', 'warning');
        return;
    }

    const price = prompt('Ваша цена за работу (₽):', '');
    if (!price) return;
    
    const priceNum = parseInt(price);
    if (isNaN(priceNum) || !Utils.validatePrice(priceNum)) {
        Utils.showNotification('❌ Цена должна быть от 500 до 1 000 000 ₽', 'error');
        return;
    }
    
    const comment = prompt('Краткий комментарий (необязательно):', '');
    
    if (typeof Orders?.respondToOrder === 'function') {
        const result = await Orders.respondToOrder(orderId, priceNum, comment || '');
        if (result?.success) {
            Utils.showNotification('✅ Отклик отправлен!', 'success');
            loadAllOrders(true); // force = true
        } else {
            Utils.showNotification(result?.error || '❌ Ошибка при отправке отклика', 'error');
        }
    } else {
        Utils.showNotification('❌ Функция отклика временно недоступна', 'error');
    }
}

// ============================================
// РАБОТА С ФАЙЛАМИ
// ============================================

async function handleFiles(files) {
    if (uploadedPhotos.length + files.length > 5) {
        Utils.showNotification('Максимум 5 фото', 'warning');
        return;
    }
    
    const photoPreview = document.getElementById('photoPreview');
    
    for (let file of files) {
        if (!file.type.startsWith('image/')) continue;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            const previewDiv = document.createElement('div');
            previewDiv.style.cssText = 'position: relative; width: 80px; height: 80px; border-radius: 12px; overflow: hidden;';
            previewDiv.innerHTML = `
                <img src="${e.target.result}" style="width: 100%; height: 100%; object-fit: cover;">
                <span class="remove-photo" onclick="removePhoto('${file.name}')" 
                      style="position: absolute; top: 2px; right: 2px; background: rgba(0,0,0,0.5); 
                             color: white; border-radius: 50%; width: 20px; height: 20px; 
                             display: flex; align-items: center; justify-content: center; 
                             font-size: 12px; cursor: pointer;">×</span>
            `;
            photoPreview.appendChild(previewDiv);
        };
        reader.readAsDataURL(file);
        
        try {
            if (!window.storage) {
                console.warn('storage не определен');
                continue;
            }
            
            const storageRef = storage.ref(`orders/${Date.now()}_${file.name}`);
            await storageRef.put(file);
            const url = await storageRef.getDownloadURL();
            uploadedPhotos.push(url);
        } catch (error) {
            console.error('❌ Ошибка загрузки фото:', error);
        }
    }
}

function removePhoto(fileName) {
    uploadedPhotos = uploadedPhotos.filter(url => !url.includes(fileName));
    const photoPreview = document.getElementById('photoPreview');
    photoPreview.innerHTML = '';
    uploadedPhotos.forEach(url => {
        const previewDiv = document.createElement('div');
        previewDiv.style.cssText = 'width: 80px; height: 80px; border-radius: 12px; overflow: hidden;';
        previewDiv.innerHTML = `<img src="${url}" style="width: 100%; height: 100%; object-fit: cover;">`;
        photoPreview.appendChild(previewDiv);
    });
}

// ============================================
// ИНИЦИАЛИЗАЦИЯ ОБРАБОТЧИКОВ
// ============================================

function initEventListeners() {
    const logoutHandler = () => {
        if (typeof Auth?.logout === 'function') {
            Auth.logout();
        }
    };
    
    document.getElementById('logoutBtn')?.addEventListener('click', logoutHandler);
    document.getElementById('headerLogoutBtn')?.addEventListener('click', logoutHandler);

    document.getElementById('refreshBtn')?.addEventListener('click', () => {
        loadAllOrders(true);
        loadOrdersMap();
    });

    document.getElementById('themeToggle')?.addEventListener('click', () => {
        if (typeof Auth?.toggleTheme === 'function') {
            Auth.toggleTheme();
        }
    });

    document.getElementById('clearFiltersBtn')?.addEventListener('click', () => {
        filters = { category: 'all', city: 'all' };
        document.querySelectorAll('.category-filter-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.category === 'all');
        });
        applyFilters(true);
    });

    document.getElementById('loadMoreBtn')?.addEventListener('click', () => {
        if (!isLoading && hasMore) {
            isLoading = true;
            applyFilters(false);
            isLoading = false;
        }
    });

    const uploadArea = document.getElementById('uploadArea');
    const photoInput = document.getElementById('photoInput');

    if (uploadArea && photoInput) {
        uploadArea.addEventListener('click', () => photoInput.click());
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.style.background = 'rgba(230,122,75,0.1)';
        });
        uploadArea.addEventListener('dragleave', () => {
            uploadArea.style.background = '';
        });
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.style.background = '';
            handleFiles(e.dataTransfer.files);
        });
        photoInput.addEventListener('change', (e) => {
            handleFiles(e.target.files);
        });
    }

    document.getElementById('orderForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (typeof Auth === 'undefined' || !Auth.isAuthenticated || !Auth.isAuthenticated()) {
            Utils.showNotification('Пожалуйста, войдите в систему', 'warning');
            return;
        }
        
        if (typeof Auth.isMaster === 'function' && Auth.isMaster()) {
            Utils.showNotification('Мастера не могут создавать заказы', 'warning');
            return;
        }

        const orderData = {
            category: document.getElementById('category').value,
            title: document.getElementById('title').value,
            description: document.getElementById('description').value,
            price: parseInt(document.getElementById('price').value),
            address: document.getElementById('address').value,
            latitude: parseFloat(document.getElementById('latitude').value) || 61.0,
            longitude: parseFloat(document.getElementById('longitude').value) || 69.0,
            photos: uploadedPhotos,
            clientName: document.getElementById('clientName').value,
            clientPhone: document.getElementById('phone').value
        };

        if (typeof Orders?.create === 'function') {
            const result = await Orders.create(orderData);
            if (result?.success) {
                document.getElementById('orderForm').reset();
                document.getElementById('latitude').value = '';
                document.getElementById('longitude').value = '';
                uploadedPhotos = [];
                document.getElementById('photoPreview').innerHTML = '';
                if (map) map.geoObjects.removeAll();
                
                document.getElementById('successMessage').classList.remove('d-none');
                setTimeout(() => {
                    document.getElementById('successMessage').classList.add('d-none');
                }, 5000);
                
                loadAllOrders(true);
                loadOrdersMap();
            }
        } else {
            Utils.showNotification('❌ Функция создания заказа временно недоступна', 'error');
        }
    });

    // AI Price Hint
    const categoryEl = document.getElementById('category');
    const descriptionEl = document.getElementById('description');
    const priceEl = document.getElementById('price');
    const aiHint = document.getElementById('aiPriceHint');

    if (categoryEl && descriptionEl && priceEl && aiHint) {
        const priceAI = {
            prices: {
                'Сантехника': { min: 1500, max: 8000, avg: 3000 },
                'Электрика': { min: 1000, max: 6000, avg: 2500 },
                'Отделочные работы': { min: 3000, max: 20000, avg: 8000 },
                'Мебель': { min: 800, max: 5000, avg: 2000 },
                'Окна и двери': { min: 2000, max: 10000, avg: 4500 },
                'Бытовой ремонт': { min: 500, max: 4000, avg: 1500 },
                'Клининг': { min: 1000, max: 5000, avg: 2000 },
                'Ремонт техники': { min: 800, max: 6000, avg: 2000 }
            },
            
            boost: {
                'срочно': 1.3,
                'сегодня': 1.2,
                'ночью': 1.5,
                'сложный': 1.4,
                'дорогой': 1.3,
                'гарантия': 1.2,
                'высота': 1.3
            },

            calc(cat, desc) {
                if (!cat || !desc || desc.length < 10) return null;
                const base = this.prices[cat];
                if (!base) return 2000;
                
                let price = base.avg;
                const text = desc.toLowerCase();
                
                Object.entries(this.boost).forEach(([word, mult]) => {
                    if (text.includes(word)) price *= mult;
                });
                
                return Math.min(Math.max(Math.round(price), base.min), base.max);
            }
        };

        function updateAI() {
            const cat = categoryEl.value;
            const desc = descriptionEl.value;
            const price = priceAI.calc(cat, desc);
            
            if (price) {
                aiHint.innerHTML = `
                    <div class="ai-price-hint p-3 rounded-4">
                        <i class="fas fa-robot me-2" style="color: var(--accent);"></i>
                        🤖 ИИ предлагает цену: <strong>${price} ₽</strong> (нажми чтобы применить)
                    </div>
                `;
                aiHint.onclick = () => {
                    priceEl.value = price;
                    aiHint.innerHTML = '';
                };
            } else {
                aiHint.innerHTML = '';
            }
        }

        categoryEl.addEventListener('change', updateAI);
        descriptionEl.addEventListener('input', updateAI);
    }

    // Achievements button
    document.getElementById('achievementsBtn')?.addEventListener('click', () => {
        const modalEl = document.getElementById('achievementsModal');
        if (modalEl && bootstrap) {
            loadAchievements();
            const modal = new bootstrap.Modal(modalEl);
            modal.show();
        }
    });

    // Leaderboard button
    document.getElementById('leaderboardBtn')?.addEventListener('click', () => {
        const modalEl = document.getElementById('leaderboardModal');
        if (modalEl && bootstrap) {
            loadFullLeaderboard();
            const modal = new bootstrap.Modal(modalEl);
            modal.show();
        }
    });

    // Telegram button
    document.getElementById('telegramBtn')?.addEventListener('click', () => {
        if (typeof TelegramClient?.showLinkInstructions === 'function') {
            TelegramClient.showLinkInstructions();
        } else {
            window.open('https://t.me/WorkHomBot', '_blank');
        }
    });

    // Notifications button
    document.getElementById('notificationsBtn')?.addEventListener('click', () => {
        Utils.showNotification('Уведомления пока в разработке', 'info');
    });

    // Analytics button
    document.getElementById('analyticsBtn')?.addEventListener('click', () => {
        Utils.showNotification('Аналитика заказов будет доступна позже', 'info');
    });

    // Tracking toggle
    document.getElementById('trackingToggle')?.addEventListener('click', (e) => {
        const btn = e.currentTarget;
        const panel = document.getElementById('trackingPanel');
        if (panel) {
            if (panel.classList.contains('d-none')) {
                panel.classList.remove('d-none');
                btn.innerHTML = '<i class="fas fa-eye-slash me-1"></i> Скрыть мастеров';
                loadOnlineMasters();
            } else {
                panel.classList.add('d-none');
                btn.innerHTML = '<i class="fas fa-location-dot me-1"></i> Показать мастеров онлайн';
            }
        }
    });

    // Tracking master select
    document.getElementById('trackingMasterSelect')?.addEventListener('change', (e) => {
        const masterId = e.target.value;
        if (masterId && typeof Tracking?.listenToMasterPosition === 'function') {
            Tracking.listenToMasterPosition(masterId, (position) => {
                updateTrackingInfo(position);
            });
        }
    });

    // AI Price Hint button
    document.getElementById('aiPriceHintBtn')?.addEventListener('click', () => {
        const cat = categoryEl?.value;
        const desc = descriptionEl?.value;
        
        if (!cat || !desc) {
            Utils.showNotification('Сначала выберите категорию и напишите описание', 'warning');
            return;
        }
        
        const price = priceAI?.calc(cat, desc);
        if (price && priceEl) {
            priceEl.value = price;
            Utils.showNotification(`✅ Рекомендуемая цена: ${price} ₽`, 'success');
        }
    });
}

// ============================================
// ДОПОЛНИТЕЛЬНЫЕ ФУНКЦИИ
// ============================================

async function loadAchievements() {
    const list = document.getElementById('achievementsList');
    if (!list) return;
    
    try {
        const user = Auth?.getUser?.();
        if (!user) {
            list.innerHTML = '<div class="text-center p-5">Войдите, чтобы увидеть достижения</div>';
            return;
        }
        
        const achievements = [
            { id: 1, name: 'Первый заказ', desc: 'Создайте первый заказ', icon: 'fa-rocket', earned: false },
            { id: 2, name: 'Отличный отзыв', desc: 'Получите 5 звёзд', icon: 'fa-star', earned: false },
            { id: 3, name: 'Постоянный клиент', desc: 'Выполните 5 заказов', icon: 'fa-trophy', earned: false },
            { id: 4, name: 'Мастер на все руки', desc: 'Попробуйте 3 категории', icon: 'fa-tools', earned: false },
            { id: 5, name: 'Скоростной', desc: 'Заказ за 1 день', icon: 'fa-clock', earned: false }
        ];
        
        list.innerHTML = achievements.map(ach => `
            <div class="col-md-4">
                <div class="card p-4 text-center ${ach.earned ? 'achievement-earned' : ''}">
                    <i class="fas ${ach.icon} fa-2x mb-3" style="color: ${ach.earned ? 'gold' : 'var(--border)'};"></i>
                    <h6>${ach.name}</h6>
                    <p class="small text-secondary">${ach.desc}</p>
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('❌ Ошибка загрузки достижений:', error);
        list.innerHTML = '<div class="text-center p-5 text-danger">Ошибка загрузки</div>';
    }
}

async function loadFullLeaderboard() {
    const list = document.getElementById('leaderboardList');
    if (!list) return;
    
    try {
        const snapshot = await db.collection('users')
            .where('role', '==', window.USER_ROLE?.MASTER || 'master')
            .orderBy('rating', 'desc')
            .limit(20)
            .get();
        
        if (snapshot.empty) {
            list.innerHTML = '<div class="text-center p-5">Нет мастеров</div>';
            return;
        }
        
        let html = '';
        let position = 1;
        
        snapshot.forEach(doc => {
            const master = doc.data();
            const rankClass = position <= 3 ? `rank-${position}` : '';
            const ratingStars = renderRatingStars(master.rating || 0);
            
            html += `
                <div class="leaderboard-item" onclick="handleViewMaster('${doc.id}')">
                    <div class="leaderboard-rank ${rankClass}">${position}</div>
                    <div class="leaderboard-avatar">
                        <i class="fas fa-user-tie"></i>
                    </div>
                    <div class="leaderboard-info">
                        <div class="leaderboard-name">${Utils.escapeHtml(master.name || 'Мастер')}</div>
                        <div class="leaderboard-stats">
                            <span class="rating-stars">${ratingStars}</span>
                            <span class="ms-2">${(master.rating || 0).toFixed(1)}</span>
                            <span class="ms-2"><i class="fas fa-check-circle" style="color: var(--success);"></i> ${master.completedJobs || 0}</span>
                            <span class="ms-2"><i class="fas fa-comment" style="color: var(--accent);"></i> ${master.reviews || 0}</span>
                        </div>
                    </div>
                    <div class="leaderboard-xp">${master.xp || 0} XP</div>
                </div>
            `;
            position++;
        });
        
        list.innerHTML = html;
        
    } catch (error) {
        console.error('❌ Ошибка загрузки лидерборда:', error);
        list.innerHTML = '<div class="text-center p-5 text-danger">Ошибка загрузки</div>';
    }
}

async function loadOnlineMasters() {
    const select = document.getElementById('trackingMasterSelect');
    if (!select) return;
    
    try {
        select.innerHTML = `
            <option value="">Выберите мастера</option>
            <option value="master1">🔨 Иван (Сантехник)</option>
            <option value="master2">⚡ Петр (Электрик)</option>
            <option value="master3">🎨 Елена (Отделка)</option>
        `;
        
    } catch (error) {
        console.error('❌ Ошибка загрузки онлайн мастеров:', error);
    }
}

function updateTrackingInfo(position) {
    const etaEl = document.getElementById('masterEta');
    if (etaEl && position) {
        etaEl.innerHTML = `
            <i class="fas fa-location-dot me-2"></i>
            Расстояние: ${position.eta?.distance || '...'} км | 
            Время: ${position.eta?.minutes || '...'} мин
        `;
    }
}

// ===== НОВАЯ ФУНКЦИЯ: СЛУШАТЕЛЬ АВТОРИЗАЦИИ =====
function setupAuthListener() {
    if (typeof Auth?.onAuthChange !== 'function') return;
    
    Auth.onAuthChange((state) => {
        console.log('🔄 Статус авторизации изменился:', state);
        
        // Обновляем UI авторизации
        if (typeof AuthUI?.renderAuthBlock === 'function') {
            AuthUI.renderAuthBlock();
        }
        
        // Обновляем ссылки
        const clientLink = document.getElementById('clientLink');
        if (clientLink) {
            clientLink.style.display = state.isMaster ? 'none' : 'inline-block';
        }
        
        const headerLogoutBtn = document.getElementById('headerLogoutBtn');
        if (headerLogoutBtn) {
            headerLogoutBtn.style.display = state.isAuthenticated ? 'inline-block' : 'none';
        }
        
        // Обновляем видимость формы для мастеров
        const orderFormColumn = document.getElementById('orderFormColumn');
        if (orderFormColumn) {
            if (state.isMaster) {
                orderFormColumn.style.display = 'none';
                document.getElementById('ordersColumn').className = 'col-md-12';
            } else {
                orderFormColumn.style.display = 'block';
                document.getElementById('ordersColumn').className = 'col-md-6';
            }
        }
        
        // Загружаем заказы для мастеров с дебаунсом
        if (state.isMaster) {
            console.log('✅ Мастер авторизован, планируем перезагрузку заказов');
            
            if (pendingAuthUpdate) {
                clearTimeout(pendingAuthUpdate);
            }
            
            pendingAuthUpdate = setTimeout(() => {
                loadAllOrders(true);
                pendingAuthUpdate = null;
            }, 300);
        }
    });
}

// ============================================
// ИНИЦИАЛИЗАЦИЯ ПРИ ЗАГРУЗКЕ СТРАНИЦЫ
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 index.js (v13.4) загружен и готов к работе!');
    
    setTimeout(checkOrderPositioning, 500);
    
    if (typeof AuthUI?.renderAuthBlock === 'function') {
        AuthUI.renderAuthBlock();
    }
    
    // Загружаем города перед инициализацией фильтров
    if (typeof loadCities === 'function') {
        loadCities().then(() => {
            initFilters();
        }).catch(err => {
            console.error('Ошибка загрузки городов:', err);
            initFilters(); // всё равно продолжаем
        });
    } else {
        initFilters();
    }
    
    if (typeof ymaps !== 'undefined') {
        ymaps.ready(() => {
            ymapsReady = true;
            initMaps();
        });
    }
    
    // Загрузка данных
    loadAllOrders(true);
    loadTopMasters('week');
    
    initEventListeners();
    initLeaderboardButtons();
    setupAuthListener();
});

// Перепроверяем позиционирование после загрузки
window.addEventListener('load', () => {
    setTimeout(checkOrderPositioning, 100);
});

window.addEventListener('resize', () => {
    setTimeout(checkOrderPositioning, 100);
});

// ===== ФИКС СТРУКТУРЫ ЗАКАЗОВ =====
(function fixOrdersStructure() {
    window.addEventListener('load', function() {
        setTimeout(function() {
            console.log('🔧 Применяем фикс структуры заказов...');
            
            const ordersCol = document.getElementById('ordersColumn');
            const ordersList = document.getElementById('ordersList');
            const loadMoreContainer = document.getElementById('loadMoreContainer');
            
            if (ordersCol && ordersList && loadMoreContainer) {
                let ordersContent = document.querySelector('.orders-content');
                
                if (!ordersContent) {
                    ordersContent = document.createElement('div');
                    ordersContent.className = 'orders-content';
                    
                    ordersList.parentNode.insertBefore(ordersContent, ordersList);
                    ordersContent.appendChild(ordersList);
                    ordersContent.appendChild(loadMoreContainer);
                    
                    console.log('✅ Структура заказов создана');
                }
                
                ordersContent.style.cssText = 'flex: 1 !important; display: flex !important; flex-direction: column !important; min-height: 0 !important; overflow: hidden !important;';
                ordersList.style.cssText = 'flex: 1 !important; overflow-y: auto !important;';
                loadMoreContainer.style.cssText = 'flex-shrink: 0 !important; text-align: center !important; padding: 10px 0 !important;';
                
                console.log('✅ Фикс структуры заказов применён');
            }
        }, 1000);
    });
})();

// ============================================
// ЖЁСТКИЙ ФИКС ВИДИМОСТИ КОНТЕЙНЕРОВ
// ============================================
(function forceShowContainers() {
    window.addEventListener('load', function() {
        setTimeout(function() {
            console.log('🔧 Применяем фикс видимости контейнеров...');
            
            const containers = [
                'orderFormRow',
                'orderFormColumn',
                'ordersColumn',
                'ordersList',
                'ordersMap'
            ];
            
            containers.forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    el.style.setProperty('display', 'block', 'important');
                    el.style.setProperty('visibility', 'visible', 'important');
                    el.style.setProperty('opacity', '1', 'important');
                    el.style.setProperty('height', 'auto', 'important');
                    el.style.setProperty('min-height', '100px', 'important');
                    
                    if (id === 'orderFormRow') {
                        el.style.setProperty('display', 'flex', 'important');
                        el.style.setProperty('min-height', '600px', 'important');
                    }
                    
                    if (id === 'orderFormColumn' || id === 'ordersColumn') {
                        el.style.setProperty('flex', '0 0 50%', 'important');
                        el.style.setProperty('max-width', '50%', 'important');
                        el.style.setProperty('min-height', '500px', 'important');
                    }
                    
                    if (id === 'ordersList') {
                        el.style.setProperty('display', 'flex', 'important');
                        el.style.setProperty('flex-direction', 'column', 'important');
                        el.style.setProperty('gap', '15px', 'important');
                    }
                    
                    console.log(`✅ ${id} принудительно показан`);
                }
            });
            
            window.dispatchEvent(new Event('resize'));
            console.log('🎉 Фикс контейнеров применён!');
        }, 300);
    });
})();

// ============================================
// ЭКСПОРТ ФУНКЦИЙ В ГЛОБАЛЬНУЮ ОБЛАСТЬ
// ============================================

window.initMaps = initMaps;
window.loadOrders = loadAllOrders;
window.loadOrdersMap = loadOrdersMap;
window.loadTopMasters = loadTopMasters;
window.respondToOrder = respondToOrder;
window.handleViewMaster = handleViewMaster;
window.showAuthRequiredModal = showAuthRequiredModal;
window.closeAuthModal = closeAuthModal;
window.removePhoto = removePhoto;
window.loadFullLeaderboard = loadFullLeaderboard;
window.loadOnlineMasters = loadOnlineMasters;

console.log('✅ index.js успешно загружен, все функции доступны глобально!');