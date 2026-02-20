// ===== INDEX.JS — Логика главной страницы =====

// Глобальные переменные
let map = null;
let ordersMap = null;
let ymapsReady = false;
let uploadedPhotos = [];
let searchTimeout = null;

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

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 index.js загружен и готов к работе!');
    
    // Отрисовываем блок авторизации
    if (typeof AuthUI !== 'undefined') {
        AuthUI.renderAuthBlock();
    }
    
    // Инициализация фильтров
    initFilters();
    
    // Инициализация карт
    if (typeof ymaps !== 'undefined') {
        ymaps.ready(() => {
            ymapsReady = true;
            initMaps();
        });
    }
    
    // Загрузка данных
    loadAllOrders();
    loadTopMasters('week');  // ← 1. ЗАМЕНИ ЭТУ СТРОКУ (было loadTopMasters())
    
    // Инициализация обработчиков
    initEventListeners();
    
    // Инициализация кнопок рейтинга  // ← 2. ДОБАВЬ ЭТУ СТРОКУ
    initLeaderboardButtons();
});

// Подписка на изменения авторизации
if (typeof Auth !== 'undefined') {
    Auth.onAuthChange((state) => {
        console.log('🔄 Статус авторизации изменился:', state);
        
        if (typeof AuthUI !== 'undefined') {
            AuthUI.renderAuthBlock();
        }
        
        const clientLink = document.getElementById('clientLink');
        if (clientLink) {
            clientLink.style.display = state.isMaster ? 'none' : 'inline-block';
        }
        
        const headerLogoutBtn = document.getElementById('headerLogoutBtn');
        if (headerLogoutBtn) {
            headerLogoutBtn.style.display = state.isAuthenticated ? 'inline-block' : 'none';
        }
        
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
        
        if (state.isMaster) {
            console.log('✅ Мастер авторизован, перезагружаем заказы');
            loadAllOrders();
        }
    });
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
    if (categoryFilter && window.ORDER_CATEGORIES) {
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
    } else {
        console.error('❌ Категории не найдены в window.ORDER_CATEGORIES');
    }
}

// ============================================
// КОМБО-ПОИСК ПО ГОРОДАМ
// ============================================

function initCityCombo() {
    const container = document.getElementById('citySearchCombo');
    const input = document.getElementById('citySearchInput');
    const dropdown = document.getElementById('cityDropdown');
    
    if (!container || !input || !dropdown || !window.SORTED_CITIES_BY_DISTRICT) {
        console.error('❌ Не удалось инициализировать комбо-поиск');
        return;
    }
    
    let selectedCityId = 'all';
    let searchTimeout;
    
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
// ФУНКЦИИ ЗАГРУЗКИ ДАННЫХ
// ============================================

// Загрузка всех заказов
async function loadAllOrders() {
    try {
        if (!window.db) {
            throw new Error('db не определен');
        }
        
        console.log('📦 Загрузка заказов...');
        
        const snapshot = await db.collection('orders')
            .where('status', '==', ORDER_STATUS.OPEN)
            .orderBy('createdAt', 'desc')
            .get();
        
        allOrders = [];
        snapshot.forEach(doc => {
            allOrders.push({ id: doc.id, ...doc.data() });
        });
        
        console.log(`📦 Загружено ${allOrders.length} заказов`);
        
        // Обновляем счетчик
        document.getElementById('ordersCount').textContent = allOrders.length;
        
        // Применяем фильтры
        applyFilters();

    } catch (error) {
        console.error('❌ Ошибка загрузки заказов:', error);
        showError('Не удалось загрузить заказы');
    }
}

// Применение фильтров и отображение
function applyFilters(resetPage = true) {
    if (resetPage) {
        currentPage = 0;
        displayedOrders = [];
    }
    
    // Фильтруем заказы
    let filtered = [...allOrders];
    
    // Фильтр по категории
    if (filters.category !== 'all') {
        filtered = filtered.filter(order => order.category === filters.category);
    }
    
    // Фильтр по городу
    if (filters.city !== 'all') {
        const cityName = window.CITIES.find(c => c.id === filters.city)?.name;
        if (cityName) {
            filtered = filtered.filter(order => 
                order.address && order.address.toLowerCase().includes(cityName.toLowerCase())
            );
        }
    }
        
    // Обновляем отображаемые заказы
    if (resetPage) {
        displayedOrders = filtered.slice(0, PAGINATION.ORDERS_INITIAL);
    } else {
        const start = displayedOrders.length;
        const end = start + PAGINATION.ORDERS_LOAD_MORE;
        const more = filtered.slice(start, end);
        displayedOrders = [...displayedOrders, ...more];
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
    
    if (hasMore) {
        const remaining = totalFiltered - displayedOrders.length;
        remainingSpan.textContent = remaining;
        container.classList.remove('d-none');
    } else {
        container.classList.add('d-none');
    }
}

// Отрисовка заказов
function renderOrders() {
    const ordersList = document.getElementById('ordersList');
    if (!ordersList) return;
    
    if (displayedOrders.length === 0) {
        ordersList.innerHTML = `
            <div class="text-center p-5">
                <i class="fas fa-smile fa-3x mb-3" style="color: var(--border);"></i>
                <h5>Нет заказов</h5>
                <p class="text-secondary">Попробуйте изменить фильтры</p>
            </div>
        `;
        return;
    }
    
    ordersList.innerHTML = '';
    displayedOrders.forEach(order => {
        ordersList.appendChild(createOrderCard(order));
    });
}

// Создание карточки заказа
function createOrderCard(order) {
    const div = document.createElement('div');
    div.className = 'order-item';
    
    // Иконка категории
    const categoryIcon = window.CATEGORY_ICONS?.[order.category] || 'fa-tag';
    
    // Иконка города (определяем по адресу)
    let cityIcon = 'fa-map-marker-alt';
    let cityName = 'Город не указан';
    if (order.address) {
        const foundCity = window.CITIES.find(c => 
            order.address.toLowerCase().includes(c.name.toLowerCase())
        );
        if (foundCity) {
            cityIcon = foundCity.icon;
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
    
    let actionsHtml = '';
    const showButton = typeof Auth !== 'undefined' && 
                      Auth.isAuthenticated && 
                      Auth.isAuthenticated() && 
                      Auth.isMaster && 
                      Auth.isMaster() && 
                      order.status === ORDER_STATUS.OPEN;
    
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
            <h5 class="order-title mb-0">${Helpers.escapeHtml?.(order.title) || order.title || 'Заказ'}</h5>
            <span class="order-price">${order.price || 0} ₽</span>
        </div>
        <p class="text-secondary mb-3">${Helpers.escapeHtml?.(order.description) || order.description || 'Нет описания'}</p>
        ${photosHtml}
        <div class="order-meta">
            <span>
                <i class="fas ${categoryIcon}"></i>
                ${order.category || 'Без категории'}
            </span>
            <span>
                <i class="fas ${cityIcon}"></i>
                ${cityName}
            </span>
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

let currentLeaderboardPeriod = 'week'; // 'day', 'week', 'month', 'all'

async function loadTopMasters(period = 'week') {
    const container = document.getElementById('topMastersList');
    if (!container) return;
    
    // Показываем загрузку
    container.innerHTML = '<div class="text-center p-5"><div class="spinner mb-3"></div><p class="text-secondary">Загрузка...</p></div>';
    
    try {
        if (!window.db) {
            throw new Error('db не определен');
        }
        
        // Определяем дату для фильтрации
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
                startDate = null; // все время
        }
        
        // Получаем всех мастеров
        const mastersSnapshot = await db.collection('users')
            .where('role', '==', USER_ROLE.MASTER)
            .get();
        
        const masters = [];
        
        for (const doc of mastersSnapshot.docs) {
            const master = { id: doc.id, ...doc.data() };
            
            // Если нужен период, считаем активность за этот период
            if (startDate) {
                // Считаем заказы за период
                const ordersSnapshot = await db.collection('orders')
                    .where('selectedMasterId', '==', doc.id)
                    .where('status', '==', ORDER_STATUS.COMPLETED)
                    .where('completedAt', '>=', startDate)
                    .get();
                
                // Если за период ничего нет — пропускаем или показываем с 0
                master.periodCompleted = ordersSnapshot.size;
                
                // Считаем рейтинг за период (можно усложнить)
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
        
        // Сортируем по рейтингу (за период или общий)
        masters.sort((a, b) => {
            if (startDate) {
                return (b.periodRating || 0) - (a.periodRating || 0);
            } else {
                return (b.rating || 0) - (a.rating || 0);
            }
        });
        
        // Берем топ-6
        const topMasters = masters.slice(0, 6);
        
        if (topMasters.length === 0) {
            container.innerHTML = '<div class="text-center p-5">Пока нет мастеров</div>';
            return;
        }
        
        container.innerHTML = '';
        
        topMasters.forEach(master => {
            // Используем рейтинг за период или общий
            const rating = startDate ? (master.periodRating || 0) : (master.rating || 0);
            const completedJobs = startDate ? (master.periodCompleted || 0) : (master.completedJobs || 0);
            
            const stars = '★'.repeat(Math.floor(rating)) + '☆'.repeat(5 - Math.floor(rating));
            
            const col = document.createElement('div');
            col.className = 'col-md-4 col-lg-2';
            col.innerHTML = `
                <div class="master-card text-center">
                    <div class="master-avatar">
                        <i class="fas fa-user-tie"></i>
                    </div>
                    <h6 class="fw-bold mb-1">${Helpers.escapeHtml?.(master.name) || master.name || 'Мастер'}</h6>
                    <div class="rating-stars mb-2">${stars}</div>
                    <div class="mb-2">
                        <span class="badge badge-primary">⭐ ${rating.toFixed(1)}</span>
                        <span class="badge badge-success ms-1">📦 ${completedJobs}</span>
                    </div>
                    <p class="small text-secondary mb-2">${Helpers.escapeHtml?.(master.categories) || master.categories || 'Специалист'}</p>
                    <button class="btn btn-sm w-100" onclick="viewMaster('${master.id}')">
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
                // Убираем active со всех
                Object.values(buttons).forEach(b => b?.classList.remove('active'));
                // Добавляем active текущей
                btn.classList.add('active');
                // Загружаем мастеров за период
                loadTopMasters(period);
            });
        }
    });
}

// ============================================
// ФУНКЦИИ РАБОТЫ С КАРТАМИ
// ============================================

function initMaps() {
    try {
        if (document.getElementById('map') && typeof ymaps !== 'undefined') {
            map = new ymaps.Map('map', {
                center: [55.7558, 37.6173],
                zoom: 10
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
        }
        
        if (document.getElementById('ordersMap') && typeof ymaps !== 'undefined') {
            ordersMap = new ymaps.Map('ordersMap', {
                center: [61.0, 69.0], // Центр ХМАО
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
            .where('status', '==', ORDER_STATUS.OPEN)
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
// ДЕЙСТВИЯ С ЗАКАЗАМИ
// ============================================

async function respondToOrder(orderId) {
    if (typeof Auth === 'undefined' || !Auth.isAuthenticated || !Auth.isAuthenticated()) {
        Helpers.showNotification('❌ Сначала войдите в систему', 'warning');
        return;
    }
    
    if (typeof Auth === 'undefined' || !Auth.isMaster || !Auth.isMaster()) {
        Helpers.showNotification('❌ Только мастера могут откликаться', 'warning');
        return;
    }

    const price = prompt('Ваша цена за работу (₽):', '');
    if (!price) return;
    
    const comment = prompt('Краткий комментарий:', '');
    
    if (typeof Orders !== 'undefined' && Orders.respondToOrder) {
        const result = await Orders.respondToOrder(orderId, price, comment);
        if (result && result.success) {
            loadAllOrders();
        }
    } else {
        Helpers.showNotification('❌ Функция отклика временно недоступна', 'error');
    }
}

function viewMaster(masterId) {
    window.location.href = `/HomeWork/masters.html?master=${masterId}`;
}

// ============================================
// РАБОТА С ФАЙЛАМИ
// ============================================

async function handleFiles(files) {
    if (uploadedPhotos.length + files.length > 5) {
        Helpers.showNotification('Максимум 5 фото', 'warning');
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
    // Выход
    const logoutHandler = () => {
        if (typeof Auth !== 'undefined' && Auth.logout) {
            Auth.logout();
        }
    };
    document.getElementById('logoutBtn')?.addEventListener('click', logoutHandler);
    document.getElementById('headerLogoutBtn')?.addEventListener('click', logoutHandler);

    // Обновление
    document.getElementById('refreshBtn')?.addEventListener('click', () => {
        loadAllOrders();
        loadOrdersMap();
    });

    // Темная тема
    document.getElementById('themeToggle')?.addEventListener('click', () => {
        if (typeof Auth !== 'undefined' && Auth.toggleTheme) {
            Auth.toggleTheme();
        }
    });

    // Фильтр по категориям
    document.querySelectorAll('.category-filter-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.category-filter-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            filters.category = this.dataset.category;
            applyFilters(true);
        });
    });

    // Сброс фильтров
    document.getElementById('clearFiltersBtn')?.addEventListener('click', () => {
        // Сбрасываем город (уже обработано в initCityCombo)
        filters = { category: 'all', city: 'all' };
        
        // Сбрасываем категорию
        document.querySelectorAll('.category-filter-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.category === 'all');
        });
        
        applyFilters(true);
    });

    // Кнопка "Показать еще"
    document.getElementById('loadMoreBtn')?.addEventListener('click', () => {
        if (!isLoading && hasMore) {
            isLoading = true;
            applyFilters(false);
            isLoading = false;
        }
    });

    // Загрузка фото
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

    // Форма заказа
    document.getElementById('orderForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (typeof Auth === 'undefined' || !Auth.isAuthenticated || !Auth.isAuthenticated()) {
            Helpers.showNotification('Пожалуйста, войдите в систему', 'warning');
            return;
        }
        
        if (typeof Auth !== 'undefined' && Auth.isMaster && Auth.isMaster()) {
            Helpers.showNotification('Мастера не могут создавать заказы', 'warning');
            return;
        }

        const orderData = {
            category: document.getElementById('category').value,
            title: document.getElementById('title').value,
            description: document.getElementById('description').value,
            price: parseInt(document.getElementById('price').value),
            address: document.getElementById('address').value,
            latitude: parseFloat(document.getElementById('latitude').value) || 55.7558,
            longitude: parseFloat(document.getElementById('longitude').value) || 37.6173,
            photos: uploadedPhotos,
            clientName: document.getElementById('clientName').value,
            clientPhone: document.getElementById('phone').value
        };

        if (typeof Orders !== 'undefined' && Orders.create) {
            const result = await Orders.create(orderData);
            if (result && result.success) {
                document.getElementById('orderForm').reset();
                document.getElementById('latitude').value = '';
                document.getElementById('longitude').value = '';
                uploadedPhotos = [];
                if (document.getElementById('photoPreview')) {
                    document.getElementById('photoPreview').innerHTML = '';
                }
                if (map) map.geoObjects.removeAll();
                
                document.getElementById('successMessage').classList.remove('d-none');
                setTimeout(() => {
                    document.getElementById('successMessage').classList.add('d-none');
                }, 5000);
                
                loadAllOrders();
                loadOrdersMap();
            }
        } else {
            Helpers.showNotification('❌ Функция создания заказа временно недоступна', 'error');
        }
    });

    // AI-подсказка цены
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
}

// ============================================
// ЭКСПОРТ ФУНКЦИЙ В ГЛОБАЛЬНУЮ ОБЛАСТЬ
// ============================================

window.initMaps = initMaps;
window.loadOrders = loadAllOrders;
window.loadOrdersMap = loadOrdersMap;
window.loadTopMasters = loadTopMasters;
window.respondToOrder = respondToOrder;
window.viewMaster = viewMaster;
window.removePhoto = removePhoto;

console.log('✅ index.js успешно загружен, все функции доступны глобально!');