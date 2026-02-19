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
    loadTopMasters();
    
    // Инициализация обработчиков
    initEventListeners();
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
    // Отрисовка фильтра городов
    const cityFilter = document.getElementById('cityFilter');
    if (cityFilter && window.CITIES) {
        cityFilter.innerHTML = window.CITIES.map(city => `
            <button class="filter-btn city-filter-btn ${city.id === 'all' ? 'active' : ''}" 
                    data-city="${city.id}" 
                    title="${city.name}">
                <i class="fas ${city.icon} me-1"></i>
                ${city.name}
            </button>
        `).join('');
    }
    
    // Отрисовка фильтра категорий
    const categoryFilter = document.getElementById('categoryFilter');
    if (categoryFilter && window.ORDER_CATEGORIES) {
        categoryFilter.innerHTML = window.ORDER_CATEGORIES.map(cat => `
            <button class="filter-btn category-filter-btn ${cat.id === 'all' ? 'active' : ''}" 
                    data-category="${cat.id}" 
                    title="${cat.name}">
                <i class="fas ${cat.icon} me-1"></i>
                ${cat.name}
            </button>
        `).join('');
    }
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
    
    // Перемешиваем массив для рандомности
    filtered = shuffleArray(filtered);
    
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

// Перемешивание массива (для рандомности)
function shuffleArray(array) {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
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
// ЗАГРУЗКА ТОП МАСТЕРОВ
// ============================================

async function loadTopMasters() {
    const container = document.getElementById('topMastersList');
    if (!container) return;
    
    try {
        if (!window.db) {
            throw new Error('db не определен');
        }
        
        const snapshot = await db.collection('users')
            .where('role', '==', USER_ROLE.MASTER)
            .orderBy('rating', 'desc')
            .limit(6)
            .get();
        
        if (snapshot.empty) {
            container.innerHTML = '<div class="text-center p-5">Пока нет мастеров</div>';
            return;
        }
        
        container.innerHTML = '';
        snapshot.forEach(doc => {
            const master = doc.data();
            const rating = master.rating || 0;
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
                        <span class="badge badge-success ms-1">📦 ${master.completedJobs || 0}</span>
                    </div>
                    <p class="small text-secondary mb-2">${Helpers.escapeHtml?.(master.categories) || master.categories || 'Специалист'}</p>
                    <button class="btn btn-sm w-100" onclick="viewMaster('${doc.id}')">
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

    // Фильтр по городам
    document.querySelectorAll('.city-filter-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.city-filter-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            filters.city = this.dataset.city;
            applyFilters(true);
        });
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
        // Сбрасываем город
        document.querySelectorAll('.city-filter-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.city === 'all');
        });
        
        // Сбрасываем категорию
        document.querySelectorAll('.category-filter-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.category === 'all');
        });
        
        filters = { category: 'all', city: 'all' };
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