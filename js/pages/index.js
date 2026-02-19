// ===== INDEX.JS — Логика главной страницы =====

// Глобальные переменные
let map = null;
let ordersMap = null;
let ymapsReady = false;
let uploadedPhotos = [];
let searchTimeout = null;
let currentCategory = 'all';

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 index.js загружен и готов к работе!');
    
    // Отрисовываем блок авторизации
    if (typeof AuthUI !== 'undefined') {
        AuthUI.renderAuthBlock();
    }
    
    // Проверяем режим отображения
    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode');
    
    // Инициализация карт с проверкой загрузки API
    if (typeof ymaps !== 'undefined') {
        console.log('🗺️ API Яндекс.Карт загружен, ждём готовность...');
        ymaps.ready(() => {
            console.log('🗺️ Яндекс.Карты готовы к работе');
            ymapsReady = true;
            // Даём небольшую задержку, чтобы DOM точно отрисовался
            setTimeout(() => {
                initMaps();
            }, 300);
        });
    } else {
        console.warn('⚠️ API Яндекс.Карт не загружен! Проверь подключение скрипта в index.html');
    }
    
    // Загрузка данных
    loadOrders();
    loadTopMasters();
    
    // Инициализация обработчиков
    initEventListeners();
    
    // Если режим orders, скроллим к заказам
    if (mode === 'orders') {
        setTimeout(() => {
            document.getElementById('ordersColumn')?.scrollIntoView({ behavior: 'smooth' });
        }, 500);
    }
});

// Подписка на изменения авторизации (ОДИН РАЗ!)
if (typeof Auth !== 'undefined') {
    Auth.onAuthChange((state) => {
        console.log('🔄 Статус авторизации изменился:', state);
        
        // Перерисовываем блок авторизации
        if (typeof AuthUI !== 'undefined') {
            AuthUI.renderAuthBlock();
        }
        
        // Скрываем ссылку "Мои заказы" для мастеров
        const clientLink = document.getElementById('clientLink');
        if (clientLink) {
            clientLink.style.display = state.isMaster ? 'none' : 'inline-block';
        }
        
        // Показываем/скрываем кнопку выхода
        const headerLogoutBtn = document.getElementById('headerLogoutBtn');
        if (headerLogoutBtn) {
            headerLogoutBtn.style.display = state.isAuthenticated ? 'inline-block' : 'none';
        }
        
        // Показываем/скрываем форму создания заказа
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
            loadOrders();
        }
    });
}

// ============================================
// ФУНКЦИИ РАБОТЫ С КАРТАМИ
// ============================================

// Инициализация карт
function initMaps() {
    console.log('🗺️ Попытка инициализации карт...');
    
    try {
        // Проверяем, загружены ли Яндекс.Карты
        if (typeof ymaps === 'undefined') {
            console.error('❌ Яндекс.Карты не загружены!');
            return;
        }

        // КАРТА 1: Для выбора адреса при создании заказа
        const mapElement = document.getElementById('map');
        if (mapElement) {
            console.log('🗺️ Найден элемент #map, создаём карту выбора адреса');
            
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
            
            console.log('✅ Карта выбора адреса успешно создана');
        } else {
            console.warn('⚠️ Элемент #map не найден в DOM');
        }
        
        // КАРТА 2: Для отображения заказов
        const ordersMapElement = document.getElementById('ordersMap');
        if (ordersMapElement) {
            console.log('🗺️ Найден элемент #ordersMap, создаём карту заказов');
            
            ordersMap = new ymaps.Map('ordersMap', {
                center: [55.7558, 37.6173],
                zoom: 10
            });
            
            console.log('✅ Карта заказов создана, загружаем метки...');
            loadOrdersMap();
        } else {
            console.warn('⚠️ Элемент #ordersMap не найден в DOM');
        }
        
    } catch (error) {
        console.error('❌ Ошибка при инициализации карт:', error);
    }
}

// Загрузка карты заказов
async function loadOrdersMap() {
    // Проверяем все необходимые условия
    if (!ymapsReady) {
        console.warn('⚠️ Яндекс.Карты ещё не готовы');
        return;
    }
    
    if (!ordersMap) {
        console.warn('⚠️ Карта заказов ещё не создана');
        return;
    }
    
    if (!window.db) {
        console.warn('⚠️ База данных не инициализирована');
        return;
    }
    
    console.log('🗺️ Загружаем заказы на карту...');
    
    try {
        ordersMap.geoObjects.removeAll();
        
        const snapshot = await db.collection('orders')
            .where('status', '==', ORDER_STATUS.OPEN)
            .limit(50)
            .get();

        let markerCount = 0;
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
                markerCount++;
            }
        });
        
        console.log(`✅ На карту загружено ${markerCount} меток заказов`);
        
    } catch (error) {
        console.error('❌ Ошибка загрузки карты:', error);
    }
}

// ============================================
// ФУНКЦИИ ЗАГРУЗКИ ДАННЫХ
// ============================================

// Загрузка топ мастеров
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

// Загрузка заказов
async function loadOrders() {
    const ordersList = document.getElementById('ordersList');
    if (!ordersList) return;
    
    try {
        if (!window.db) {
            throw new Error('db не определен');
        }
        
        let orders = [];
        
        if (typeof Auth !== 'undefined' && Auth.isMaster && Auth.isMaster()) {
            orders = await getOpenOrders();
            
            if (currentCategory !== 'all') {
                orders = orders.filter(order => order.category === currentCategory);
            }
        } else {
            const snapshot = await db.collection('orders')
                .where('status', '==', ORDER_STATUS.OPEN)
                .orderBy('createdAt', 'desc')
                .limit(10)
                .get();
            
            snapshot.forEach(doc => {
                orders.push({ id: doc.id, ...doc.data() });
            });
        }
        
        if (orders.length === 0) {
            ordersList.innerHTML = `
                <div class="text-center p-5">
                    <i class="fas fa-smile fa-3x mb-3" style="color: var(--border);"></i>
                    <h5>Нет открытых заказов</h5>
                    <p class="text-secondary">${currentCategory !== 'all' ? 'В этой категории пока нет заказов' : 'Создайте первый заказ'}</p>
                </div>
            `;
            return;
        }
        
        ordersList.innerHTML = '';
        orders.forEach(order => {
            ordersList.appendChild(createOrderCard(order));
        });
        
    } catch (error) {
        console.error('❌ Ошибка загрузки заказов:', error);
        ordersList.innerHTML = '<div class="text-center p-5 text-danger">Ошибка загрузки</div>';
    }
}

// Получение открытых заказов
async function getOpenOrders() {
    try {
        const snapshot = await db.collection('orders')
            .where('status', '==', ORDER_STATUS.OPEN)
            .orderBy('createdAt', 'desc')
            .limit(20)
            .get();
        
        const orders = [];
        snapshot.forEach(doc => {
            orders.push({ id: doc.id, ...doc.data() });
        });
        
        return orders;
    } catch (error) {
        console.error('Ошибка загрузки заказов:', error);
        return [];
    }
}

// Создание карточки заказа
function createOrderCard(order) {
    const div = document.createElement('div');
    div.className = 'order-item';
    div.__orderData = order;
    
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
    const showButton = typeof Auth !== 'undefined' && Auth.isAuthenticated && Auth.isAuthenticated() && Auth.isMaster && Auth.isMaster() && order.status === ORDER_STATUS.OPEN;
    
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
                <i class="fas ${window.CATEGORY_ICONS?.[order.category] || 'fa-tag'}"></i>
                ${order.category || 'Без категории'}
            </span>
            <span>
                <i class="fas fa-map-marker-alt"></i>
                ${Helpers.escapeHtml?.(order.address) || order.address || 'Адрес не указан'}
            </span>
        </div>
        ${actionsHtml}
    `;
    
    return div;
}

// ============================================
// ФУНКЦИИ ПОИСКА И ФИЛЬТРАЦИИ
// ============================================

// Поиск заказов
async function searchOrders(query) {
    console.log('🔍 Поиск:', query);
    if (!query || query.length < 3) {
        Helpers.showNotification('Введите минимум 3 символа', 'warning');
        return;
    }
    
    Helpers.showNotification(`Ищем: ${query}`, 'info');
}

// Фильтр по категории
function setupCategoryFilter() {
    const filterButtons = document.querySelectorAll('.category-filter-btn');
    filterButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            filterButtons.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            currentCategory = this.dataset.category;
            console.log('📊 Выбрана категория:', currentCategory);
            
            loadOrders();
        });
    });
}

// ============================================
// ДЕЙСТВИЯ С ЗАКАЗАМИ
// ============================================

// Отклик на заказ
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
            loadOrders();
        }
    } else {
        Helpers.showNotification('❌ Функция отклика временно недоступна', 'error');
    }
}

// Просмотр мастера
function viewMaster(masterId) {
    window.location.href = `/HomeWork/masters.html?master=${masterId}`;
}

// ============================================
// РАБОТА С ФАЙЛАМИ
// ============================================

// Обработка файлов
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

// Удаление фото
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

    // Поиск
    document.getElementById('searchBtn')?.addEventListener('click', () => {
        const query = document.getElementById('smartSearch').value;
        searchOrders(query);
    });

    // Обновление
    document.getElementById('refreshBtn')?.addEventListener('click', () => {
        loadOrders();
        loadOrdersMap();
    });

    // Темная тема
    document.getElementById('themeToggle')?.addEventListener('click', () => {
        if (typeof Auth !== 'undefined' && Auth.toggleTheme) {
            Auth.toggleTheme();
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
                
                loadOrders();
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

    // Настройка фильтра по категориям
    setupCategoryFilter();
}

// ============================================
// ЭКСПОРТ ФУНКЦИЙ В ГЛОБАЛЬНУЮ ОБЛАСТЬ
// ============================================

window.initMaps = initMaps;
window.loadOrders = loadOrders;
window.loadOrdersMap = loadOrdersMap;
window.loadTopMasters = loadTopMasters;
window.searchOrders = searchOrders;
window.respondToOrder = respondToOrder;
window.viewMaster = viewMaster;
window.removePhoto = removePhoto;

console.log('✅ index.js успешно загружен, все функции доступны глобально!');