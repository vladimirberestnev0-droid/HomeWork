// ============================================
// ЛОГИКА ГЛАВНОЙ СТРАНИЦЫ С КЭШИРОВАНИЕМ
// ============================================

(function() {
    // ===== СОСТОЯНИЕ =====
    let allOrders = [];
    let displayedOrders = [];
    let filters = { 
        category: 'all', 
        city: 'nyagan',
        sort: 'newest'
    };
    let lastDoc = null;
    let hasMore = true;
    let isLoading = false;
    
    // Константы для кэша
    const MASTERS_CACHE_KEY = 'home_masters';
    const MASTERS_CACHE_TTL = 10 * 60 * 1000; // 10 минут

    // ===== DOM ЭЛЕМЕНТЫ =====
    const $ = (id) => document.getElementById(id);

    // ===== ИНИЦИАЛИЗАЦИЯ =====
    document.addEventListener('DOMContentLoaded', async () => {
        console.log('🚀 Главная загружается...');
        
        document.body.classList.remove('loaded');
        
        await waitForFirebase();
        
        renderCategoryFilters();
        renderCityFilter();
        
        await loadOrders();
        await loadMasters();
        
        document.body.classList.add('loaded');
        
        initEventListeners();
        checkUrlParams();
    });

    // ===== ПРОВЕРКА ПАРАМЕТРОВ URL =====
    function checkUrlParams() {
        const urlParams = new URLSearchParams(window.location.search);
        const focusParam = urlParams.get('focus');
        
        if (focusParam === 'search') {
            setTimeout(() => {
                const searchInput = document.getElementById('searchInput');
                if (searchInput) {
                    searchInput.focus();
                    searchInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 1000);
        }
    }

    // ===== ОЖИДАНИЕ FIREBASE =====
    function waitForFirebase() {
        return new Promise((resolve) => {
            if (window.db && window.auth) {
                resolve();
                return;
            }
            
            const onFirebaseReady = () => {
                resolve();
                document.removeEventListener('firebase-initialized', onFirebaseReady);
            };
            
            document.addEventListener('firebase-initialized', onFirebaseReady);
            
            setTimeout(() => {
                document.removeEventListener('firebase-initialized', onFirebaseReady);
                console.warn('⚠️ Таймаут ожидания Firebase');
                resolve();
            }, 3000);
        });
    }

    // ===== РЕНДЕР ФИЛЬТРОВ КАТЕГОРИЙ =====
    function renderCategoryFilters() {
        const container = $('categoryFilters');
        if (!container) return;

        container.innerHTML = ORDER_CATEGORIES.map(cat => `
            <span class="filter-chip ${cat.id === 'all' ? 'active' : ''}" data-category="${cat.id}">
                <i class="fas ${cat.icon}"></i> ${cat.name}
            </span>
        `).join('');
    }

    // ===== РЕНДЕР ФИЛЬТРА ГОРОДА =====
    function renderCityFilter() {
        const container = $('cityFilter');
        if (!container) return;

        container.innerHTML = CITIES.map(city => `
            <span class="filter-chip ${city.id === filters.city ? 'active' : ''}" data-city="${city.id}">
                <i class="fas fa-map-marker-alt"></i> ${city.name}
            </span>
        `).join('');
    }

    // ===== ЗАГРУЗКА ЗАКАЗОВ С ПАГИНАЦИЕЙ =====
    async function loadOrders(reset = true) {
        if (isLoading) return;
        
        const container = $('ordersList');
        if (!container) return;

        isLoading = true;

        if (reset) {
            container.innerHTML = `
                <div class="text-center p-5">
                    <div class="spinner-glow"></div>
                    <p class="mt-3 text-secondary">Загружаем заказы...</p>
                </div>
            `;
            lastDoc = null;
            allOrders = [];
        }

        try {
            if (!window.Orders) {
                throw new Error('Сервис заказов не найден');
            }

            let query = db.collection('orders')
                .where('status', '==', ORDER_STATUS.OPEN)
                .orderBy('createdAt', 'desc')
                .limit(6);

            if (lastDoc && !reset) {
                query = query.startAfter(lastDoc);
            }

            const snapshot = await query.get();
            
            if (snapshot.empty) {
                if (reset) {
                    showEmptyState(container);
                }
                hasMore = false;
                isLoading = false;
                return;
            }

            lastDoc = snapshot.docs[snapshot.docs.length - 1];
            hasMore = snapshot.docs.length === 6;

            const newOrders = [];
            snapshot.forEach(doc => {
                newOrders.push({ id: doc.id, ...doc.data() });
            });

            let filtered = applyFilters(newOrders);

            if (reset) {
                allOrders = filtered;
                displayedOrders = filtered;
            } else {
                allOrders = [...allOrders, ...filtered];
                displayedOrders = [...displayedOrders, ...filtered];
            }

            renderOrders(container, reset);
            
        } catch (error) {
            console.error('❌ Ошибка загрузки заказов:', error);
            
            if (reset) {
                container.innerHTML = `
                    <div class="text-center p-5">
                        <i class="fas fa-exclamation-triangle fa-4x mb-3" style="color: var(--accent-urgent);"></i>
                        <h5>Не удалось загрузить заказы</h5>
                        <p class="text-muted">Попробуйте обновить страницу</p>
                        <button class="btn btn-outline-secondary btn-lg mt-3" onclick="location.reload()">
                            <i class="fas fa-sync-alt me-2"></i>Обновить
                        </button>
                    </div>
                `;
            }
        } finally {
            isLoading = false;
        }
    }

    // ===== ПРИМЕНЕНИЕ ФИЛЬТРОВ =====
    function applyFilters(orders) {
        let filtered = [...orders];

        if (filters.category && filters.category !== 'all') {
            filtered = filtered.filter(o => o.category === filters.category);
        }

        if (filters.city && filters.city !== 'all') {
            const cityName = CITIES.find(c => c.id === filters.city)?.name?.toLowerCase();
            if (cityName) {
                filtered = filtered.filter(o => 
                    o.city === cityName || 
                    (o.address && o.address.toLowerCase().includes(cityName))
                );
            }
        }

        if (filters.sort === 'price_asc') {
            filtered.sort((a, b) => a.price - b.price);
        } else if (filters.sort === 'price_desc') {
            filtered.sort((a, b) => b.price - a.price);
        }

        return filtered;
    }

    // ===== ОТРИСОВКА ЗАКАЗОВ =====
    function renderOrders(container, reset = true) {
        if (!container) container = $('ordersList');
        if (!container) return;

        if (displayedOrders.length === 0) {
            showEmptyState(container);
            return;
        }

        if (reset) {
            container.innerHTML = displayedOrders.map(order => createOrderCard(order)).join('');
        } else {
            container.insertAdjacentHTML('beforeend', displayedOrders.slice(-6).map(order => createOrderCard(order)).join(''));
        }

        setTimeout(() => {
            document.querySelectorAll('.order-card:not(.animated)').forEach((card, index) => {
                card.classList.add('animated');
                card.style.animation = `fadeInUp 0.5s ease ${index * 0.1}s forwards`;
                card.style.opacity = '0';
            });
        }, 100);

        if (hasMore) {
            showLoadMoreButton(container);
        } else {
            hideLoadMoreButton();
        }
        
        updateOrdersCount();
    }

    // ===== ОБНОВЛЕНИЕ СЧЁТЧИКА ЗАКАЗОВ =====
    function updateOrdersCount() {
        const countEl = $('ordersCount');
        if (countEl) {
            countEl.textContent = allOrders.length;
        }
    }

    // ===== ПОКАЗ КНОПКИ "ЗАГРУЗИТЬ ЕЩЁ" =====
    function showLoadMoreButton(container) {
        let loadMoreBtn = document.getElementById('loadMoreContainer');
        
        if (!loadMoreBtn) {
            loadMoreBtn = document.createElement('div');
            loadMoreBtn.id = 'loadMoreContainer';
            loadMoreBtn.className = 'text-center mt-4 mb-3';
            container.insertAdjacentElement('afterend', loadMoreBtn);
        }
        
        loadMoreBtn.innerHTML = `
            <button class="btn btn-outline-primary rounded-pill px-5 py-3" id="loadMoreBtn" ${isLoading ? 'disabled' : ''}>
                ${isLoading ? 
                    '<span class="spinner-border spinner-border-sm me-2"></span>Загрузка...' : 
                    '<i class="fas fa-chevron-down me-2"></i>Показать ещё'
                }
            </button>
        `;
        
        document.getElementById('loadMoreBtn')?.addEventListener('click', () => {
            loadOrders(false);
        });
    }

    function hideLoadMoreButton() {
        const btn = document.getElementById('loadMoreContainer');
        if (btn) btn.remove();
    }

    // ===== ПУСТОЕ СОСТОЯНИЕ =====
    function showEmptyState(container) {
        container.innerHTML = `
            <div class="text-center p-5 fade-in">
                <div class="empty-state-icon">
                    <i class="fas fa-smile-wink fa-4x" style="color: var(--accent); opacity: 0.5;"></i>
                </div>
                <h5 class="mt-3">В Нягани пока нет заказов</h5>
                <p class="text-muted">Будьте первым, кто создаст заказ!</p>
                <button class="btn btn-primary btn-lg mt-3 pulse-button" id="createFirstOrderBtn">
                    <i class="fas fa-plus-circle me-2"></i>Создать заказ
                </button>
            </div>
        `;
        
        document.getElementById('createFirstOrderBtn')?.addEventListener('click', () => {
            if (!Auth.isAuthenticated()) {
                AuthUI.showLoginModal();
                return;
            }
            window.location.href = '/HomeWork/client.html?tab=new';
        });
    }

    // ===== СОЗДАНИЕ КАРТОЧКИ ЗАКАЗА =====
    function createOrderCard(order) {
        const category = ORDER_CATEGORIES.find(c => c.id === order.category) || 
                        { icon: 'fa-tag', name: order.category || 'Услуга' };
        const dateStr = order.createdAt ? Utils.formatDate(order.createdAt) : 'только что';
        const isUrgent = order.urgent || (order.price && order.price < 1000);
        const hasPhotos = order.photos && order.photos.length > 0;
        
        return `
            <div class="order-card ${isUrgent ? 'urgent' : ''}" onclick="viewOrder('${order.id}')" style="opacity: 0;">
                ${isUrgent ? `
                    <div class="order-badge urgent-badge">
                        <i class="fas fa-exclamation-circle"></i> Срочно
                    </div>
                ` : ''}
                
                <div class="order-header">
                    <span class="order-category">
                        <i class="fas ${category.icon}"></i> ${category.name}
                    </span>
                    <span class="order-price">${Utils.formatMoney(order.price)}</span>
                </div>
                
                <h3 class="order-title">${Utils.escapeHtml(order.title || 'Заказ')}</h3>
                
                <p class="order-description">${Utils.truncate(Utils.escapeHtml(order.description || ''), 100)}</p>
                
                ${hasPhotos ? `
                    <div class="order-photos">
                        <img src="${order.photos[0]}" alt="Фото заказа" class="order-photo-thumb" 
                             onclick="event.stopPropagation(); window.open('${order.photos[0]}')" loading="lazy">
                        ${order.photos.length > 1 ? `<span class="photo-count">+${order.photos.length-1}</span>` : ''}
                    </div>
                ` : ''}
                
                <div class="order-footer">
                    <span class="order-time">
                        <i class="far fa-clock"></i> ${dateStr}
                    </span>
                    <span class="order-location">
                        <i class="fas fa-map-marker-alt"></i> ${order.city || 'Нягань'}
                    </span>
                </div>
                
                ${Auth.isAuthenticated() && Auth.isMaster() ? `
                    <button class="respond-btn" onclick="event.stopPropagation(); showRespondModal('${order.id}', '${Utils.escapeHtml(order.title)}', '${order.category}', ${order.price})">
                        <i class="fas fa-reply me-2"></i>Откликнуться
                    </button>
                ` : ''}
            </div>
        `;
    }

    // ===== ЗАГРУЗКА МАСТЕРОВ С КЭШИРОВАНИЕМ =====
    async function loadMasters(forceRefresh = false) {
        const container = $('mastersList');
        if (!container) return;

        // Пробуем загрузить из кэша
        if (!forceRefresh) {
            const cachedMasters = Utils.getPersistentCache(MASTERS_CACHE_KEY);
            if (cachedMasters && cachedMasters.length > 0) {
                console.log('📦 Мастера из кэша');
                container.innerHTML = cachedMasters.map(master => createMasterCard(master)).join('');
                return;
            }
            
            const memoryCached = Utils.getMemoryCache(MASTERS_CACHE_KEY);
            if (memoryCached && memoryCached.length > 0) {
                console.log('📦 Мастера из memory cache');
                container.innerHTML = memoryCached.map(master => createMasterCard(master)).join('');
                // Сохраняем в persistent cache
                Utils.setPersistentCache(MASTERS_CACHE_KEY, memoryCached, MASTERS_CACHE_TTL);
                return;
            }
        }

        try {
            let masters = [];
            
            if (window.db) {
                try {
                    const snapshot = await db.collection('users')
                        .where('role', '==', 'master')
                        .where('banned', '==', false)
                        .orderBy('rating', 'desc')
                        .limit(8)
                        .get();
                        
                    snapshot.forEach(doc => {
                        masters.push({ id: doc.id, ...doc.data() });
                    });
                } catch (indexError) {
                    console.warn('⚠️ Индекс не найден, загружаем без сортировки');
                    
                    const snapshot = await db.collection('users')
                        .where('role', '==', 'master')
                        .where('banned', '==', false)
                        .limit(20)
                        .get();
                        
                    snapshot.forEach(doc => {
                        masters.push({ id: doc.id, ...doc.data() });
                    });
                    
                    masters.sort((a, b) => (b.rating || 0) - (a.rating || 0));
                    masters = masters.slice(0, 8);
                }
            }
            
            if (masters.length === 0) {
                masters = getDemoMasters();
            }
            
            // Сохраняем в кэш
            Utils.setMemoryCache(MASTERS_CACHE_KEY, masters, MASTERS_CACHE_TTL);
            Utils.setPersistentCache(MASTERS_CACHE_KEY, masters, MASTERS_CACHE_TTL);
            
            container.innerHTML = masters.map(master => createMasterCard(master)).join('');
            
        } catch (error) {
            console.error('❌ Ошибка загрузки мастеров:', error);
            
            // При ошибке пробуем показать кэш
            const cachedMasters = Utils.getPersistentCache(MASTERS_CACHE_KEY);
            if (cachedMasters && cachedMasters.length > 0) {
                container.innerHTML = cachedMasters.map(master => createMasterCard(master)).join('');
            } else {
                const masters = getDemoMasters();
                container.innerHTML = masters.map(master => createMasterCard(master)).join('');
            }
        }
    }

    function getDemoMasters() {
        return [
            { name: 'Иван Д.', rating: 5, categories: 'Сантехника, Отопление' },
            { name: 'Сергей М.', rating: 4.8, categories: 'Электрика, Сборка мебели' },
            { name: 'Ольга К.', rating: 5, categories: 'Клининг, Декорирование' },
            { name: 'Дмитрий В.', rating: 4.7, categories: 'Ремонт под ключ' },
            { name: 'Елена П.', rating: 5, categories: 'Дизайн интерьера' },
            { name: 'Алексей Н.', rating: 4.9, categories: 'Отделочные работы' },
            { name: 'Анна С.', rating: 5, categories: 'Уборка, Декорирование' },
            { name: 'Павел К.', rating: 4.8, categories: 'Сантехника, Электрика' }
        ];
    }

    function createMasterCard(master) {
        const rating = master.rating || 5;
        const fullStars = Math.floor(rating);
        const hasHalf = rating % 1 >= 0.5;
        
        let stars = '';
        for (let i = 0; i < 5; i++) {
            if (i < fullStars) {
                stars += '<i class="fas fa-star"></i>';
            } else if (i === fullStars && hasHalf) {
                stars += '<i class="fas fa-star-half-alt"></i>';
            } else {
                stars += '<i class="far fa-star"></i>';
            }
        }
        
        const spec = master.categories ? master.categories.split(',')[0].trim() : 'Специалист';
        
        return `
            <div class="master-card" onclick="window.location.href='/HomeWork/master.html'">
                <div class="master-avatar">
                    <i class="fas fa-user-tie"></i>
                </div>
                <h4 class="master-name">${Utils.escapeHtml(master.name || 'Мастер')}</h4>
                <div class="master-rating">${stars} <span>${rating.toFixed(1)}</span></div>
                <p class="master-spec">${Utils.escapeHtml(spec)}</p>
            </div>
        `;
    }

    // ===== ИНИЦИАЛИЗАЦИЯ ОБРАБОТЧИКОВ =====
    function initEventListeners() {
        document.querySelectorAll('[data-category]').forEach(btn => {
            btn.addEventListener('click', function() {
                document.querySelectorAll('[data-category]').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                
                filters.category = this.dataset.category;
                loadOrders(true);
            });
        });

        document.querySelectorAll('[data-city]').forEach(btn => {
            btn.addEventListener('click', function() {
                document.querySelectorAll('[data-city]').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                
                filters.city = this.dataset.city;
                loadOrders(true);
            });
        });

        document.getElementById('sortSelect')?.addEventListener('change', (e) => {
            filters.sort = e.target.value;
            loadOrders(true);
        });

        const createBtn = document.getElementById('createOrderBtn');
        if (createBtn) {
            createBtn.addEventListener('click', () => {
                if (!Auth.isAuthenticated()) {
                    AuthUI.showLoginModal();
                    return;
                }
                if (Auth.isMaster()) {
                    Utils.showWarning('Мастера не могут создавать заказы');
                    return;
                }
                window.location.href = '/HomeWork/client.html?tab=new';
            });
        }

        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', Utils.debounce((e) => {
                const query = e.target.value.trim().toLowerCase();
                
                if (query.length < 3) {
                    loadOrders(true);
                    return;
                }
                
                const filtered = allOrders.filter(order => 
                    (order.title && order.title.toLowerCase().includes(query)) || 
                    (order.description && order.description.toLowerCase().includes(query))
                );
                
                displayedOrders = filtered;
                
                const container = $('ordersList');
                if (filtered.length === 0) {
                    container.innerHTML = `
                        <div class="text-center p-5">
                            <i class="fas fa-search fa-4x mb-3" style="color: var(--text-muted);"></i>
                            <h5>Ничего не найдено</h5>
                            <p class="text-muted">Попробуйте изменить запрос</p>
                        </div>
                    `;
                } else {
                    renderOrders(container);
                }
            }, 500));
        }
    }

    // ===== ГЛОБАЛЬНЫЕ ФУНКЦИИ =====
    window.viewOrder = (orderId) => {
        Utils.showInfo('👀 Просмотр заказа будет доступен позже');
    };

    window.showRespondModal = (orderId, title, category, price) => {
        if (!Auth.isAuthenticated()) {
            AuthUI.showLoginModal();
            return;
        }
        
        sessionStorage.setItem('respond_order', JSON.stringify({
            orderId, title, category, price
        }));
        
        window.location.href = `/HomeWork/master.html?respond=${orderId}`;
    };
})();