// ============================================
// ЛОГИКА ГЛАВНОЙ СТРАНИЦЫ С КЭШИРОВАНИЕМ И ВЫПАДАЮЩИМ СПИСКОМ
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
    
    // Для выпадающего списка
    let selectedCategory = 'all';
    let isDropdownOpen = false;
    
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
        
        await loadOrders(true);
        await loadMasters();
        
        document.body.classList.add('loaded');
        
        initEventListeners();
        checkUrlParams();
        restorePaginationState();
        initRespondModal();
        
        // Добавляем обработчик изменения размера окна
        window.addEventListener('resize', Utils.debounce(() => {
            renderCategoryFilters();
        }, 200));
    });

    // ===== ИНИЦИАЛИЗАЦИЯ ВЫПАДАЮЩЕГО СПИСКА =====
    function initCategoryDropdown() {
        const categoryLabel = document.getElementById('categoryLabel');
        const dropdown = document.getElementById('categoryDropdown');
        const categoryList = document.getElementById('categoryList');
        const cancelBtn = document.getElementById('cancelCategory');
        const applyBtn = document.getElementById('applyCategory');
        
        if (!categoryLabel || !dropdown) return;
        
        // Показываем/скрываем dropdown
        categoryLabel.addEventListener('click', (e) => {
            e.stopPropagation();
            isDropdownOpen = !isDropdownOpen;
            
            if (isDropdownOpen) {
                renderCategoryList();
                dropdown.classList.remove('d-none');
                
                // Позиционируем относительно кнопки
                const rect = categoryLabel.getBoundingClientRect();
                dropdown.style.top = rect.bottom + window.scrollY + 5 + 'px';
                dropdown.style.left = rect.left + 'px';
            } else {
                dropdown.classList.add('d-none');
            }
        });
        
        // Закрываем при клике вне
        document.addEventListener('click', (e) => {
            if (!dropdown.contains(e.target) && !categoryLabel.contains(e.target)) {
                dropdown.classList.add('d-none');
                isDropdownOpen = false;
            }
        });
        
        // Отмена
        cancelBtn?.addEventListener('click', () => {
            dropdown.classList.add('d-none');
            isDropdownOpen = false;
        });
        
        // Применить
        applyBtn?.addEventListener('click', () => {
            filters.category = selectedCategory;
            dropdown.classList.add('d-none');
            isDropdownOpen = false;
            
            // Обновляем текст кнопки
            const categoryData = ORDER_CATEGORIES.find(c => c.id === selectedCategory) || ORDER_CATEGORIES[0];
            categoryLabel.innerHTML = `
                <i class="fas ${categoryData.icon}"></i>
                ${categoryData.name}
                <i class="fas fa-chevron-down ms-1"></i>
            `;
            
            loadOrders(true);
        });
    }

    // ===== РЕНДЕР СПИСКА КАТЕГОРИЙ =====
    function renderCategoryList() {
        const categoryList = document.getElementById('categoryList');
        if (!categoryList) return;
        
        categoryList.innerHTML = ORDER_CATEGORIES.map(cat => `
            <div class="category-item ${cat.id === selectedCategory ? 'active' : ''}" data-category-id="${cat.id}">
                <i class="fas ${cat.icon}"></i>
                <span>${cat.name}</span>
            </div>
        `).join('');
        
        // Добавляем обработчики
        document.querySelectorAll('.category-item').forEach(item => {
            item.addEventListener('click', function() {
                const catId = this.dataset.categoryId;
                selectedCategory = catId;
                
                document.querySelectorAll('.category-item').forEach(el => {
                    el.classList.remove('active');
                });
                this.classList.add('active');
            });
        });
    }

    // ===== РЕНДЕР ФИЛЬТРОВ КАТЕГОРИЙ =====
    function renderCategoryFilters() {
        const container = $('categoryFilters');
        if (!container) return;
        
        const isDesktop = window.innerWidth >= 992;
        
        if (isDesktop) {
            // На десктопе показываем только кнопку "Все категории"
            const currentCategory = ORDER_CATEGORIES.find(c => c.id === filters.category) || ORDER_CATEGORIES[0];
            container.innerHTML = `
                <div class="desktop-category-filter">
                    <span id="categoryLabel">
                        <i class="fas ${currentCategory.icon}"></i>
                        ${currentCategory.name}
                        <i class="fas fa-chevron-down ms-1"></i>
                    </span>
                </div>
            `;
            initCategoryDropdown();
        } else {
            // На мобилках - скроллящиеся чипсы
            container.innerHTML = ORDER_CATEGORIES.map(cat => `
                <span class="filter-chip ${cat.id === filters.category ? 'active' : ''}" data-category="${cat.id}">
                    <i class="fas ${cat.icon}"></i> ${cat.name}
                </span>
            `).join('');
            attachFilterHandlers();
        }
    }

    // ===== ИНИЦИАЛИЗАЦИЯ МОДАЛКИ ОТКЛИКА =====
    function initRespondModal() {
        const submitBtn = document.getElementById('submitResponse');
        if (submitBtn) {
            submitBtn.addEventListener('click', handleSubmitResponse);
        }
        
        const modal = document.getElementById('respondModal');
        if (modal) {
            modal.addEventListener('hidden.bs.modal', function() {
                document.getElementById('responsePrice').value = '';
                document.getElementById('responseComment').value = '';
            });
        }
    }

    // ===== ОБРАБОТКА ОТПРАВКИ ОТКЛИКА =====
    async function handleSubmitResponse() {
        const price = parseInt(document.getElementById('responsePrice')?.value);
        const comment = document.getElementById('responseComment')?.value || '';
        const orderData = JSON.parse(sessionStorage.getItem('respond_order') || '{}');
        
        if (!orderData.orderId) {
            Utils.showError('Ошибка: заказ не найден');
            return;
        }

        if (!price || price < 500) {
            Utils.showNotification('Введите цену (минимум 500 ₽)', 'warning');
            return;
        }

        if (price > 1000000) {
            Utils.showNotification('Цена не может превышать 1 000 000 ₽', 'warning');
            return;
        }

        const result = await Orders.respondToOrder(orderData.orderId, price, comment);
        
        if (result && result.success) {
            const modalEl = document.getElementById('respondModal');
            const modal = bootstrap.Modal.getInstance(modalEl);
            if (modal) modal.hide();
            
            Utils.showNotification('✅ Отклик отправлен!', 'success');
            
            document.getElementById('responsePrice').value = '';
            document.getElementById('responseComment').value = '';
            sessionStorage.removeItem('respond_order');
            
            loadOrders(true);
        } else {
            Utils.showNotification(result?.error || '❌ Ошибка при отправке', 'error');
        }
    }

    // ===== СОХРАНЕНИЕ СОСТОЯНИЯ ПАГИНАЦИИ =====
    function savePaginationState() {
        if (lastDoc) {
            sessionStorage.setItem('lastDocId', lastDoc.id);
            sessionStorage.setItem('hasMore', hasMore);
            sessionStorage.setItem('filters', JSON.stringify(filters));
        }
    }

    function restorePaginationState() {
        const savedHasMore = sessionStorage.getItem('hasMore');
        const savedFilters = sessionStorage.getItem('filters');
        
        if (savedHasMore) {
            hasMore = savedHasMore === 'true';
        }
        
        if (savedFilters) {
            try {
                filters = JSON.parse(savedFilters);
                selectedCategory = filters.category;
            } catch (e) {
                console.warn('Ошибка восстановления фильтров');
            }
        }
    }

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

    // ===== РЕНДЕР ФИЛЬТРА ГОРОДА =====
    function renderCityFilter() {
        const container = $('cityFilter');
        if (!container) return;

        container.innerHTML = CITIES.map(city => `
            <span class="filter-chip ${city.id === filters.city ? 'active' : ''}" data-city="${city.id}">
                <i class="fas fa-map-marker-alt"></i> ${city.name}
            </span>
        `).join('');
        
        attachCityHandlers();
    }

    // ===== ОБРАБОТЧИКИ ФИЛЬТРОВ (ДЛЯ МОБИЛОК) =====
    function attachFilterHandlers() {
        document.querySelectorAll('[data-category]').forEach(btn => {
            btn.addEventListener('click', function() {
                document.querySelectorAll('[data-category]').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                
                filters.category = this.dataset.category;
                selectedCategory = filters.category;
                loadOrders(true);
            });
        });
    }

    function attachCityHandlers() {
        document.querySelectorAll('[data-city]').forEach(btn => {
            btn.addEventListener('click', function() {
                document.querySelectorAll('[data-city]').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                
                filters.city = this.dataset.city;
                loadOrders(true);
            });
        });
    }

    // ===== ЗАГРУЗКА ЗАКАЗОВ С ПАГИНАЦИЕЙ =====
    async function loadOrders(reset = true) {
        if (isLoading) {
            console.log('⏳ Уже загружается...');
            return;
        }
        
        const container = $('ordersList');
        if (!container) return;

        isLoading = true;
        console.log(`🔄 ${reset ? 'Сброс и загрузка' : 'Загрузка ещё'}`);

        if (reset && displayedOrders.length === 0) {
            container.innerHTML = `
                <div class="text-center p-5">
                    <div class="spinner-glow"></div>
                    <p class="mt-3 text-secondary">Загружаем заказы...</p>
                </div>
            `;
        }

        if (reset) {
            lastDoc = null;
            allOrders = [];
            displayedOrders = [];
            hideLoadMoreButton();
            sessionStorage.removeItem('lastDocId');
        }

        try {
            if (!window.Orders) {
                throw new Error('Сервис заказов не найден');
            }

            const params = {
                limit: 6,
                lastDoc: reset ? null : lastDoc,
                force: reset
            };
            
            console.log('📦 Параметры запроса:', params);
            
            const result = await Orders.getOpenOrders(filters, params);

            console.log('📦 Результат:', result);

            if (!result || !result.orders) {
                throw new Error('Не удалось загрузить заказы');
            }

            const newOrders = result.orders;
            
            lastDoc = result.lastDoc;
            hasMore = result.hasMore;
            
            console.log('📦 lastDoc:', lastDoc ? 'есть' : 'null', 'hasMore:', hasMore);

            if (reset) {
                allOrders = newOrders;
                displayedOrders = newOrders;
            } else {
                allOrders = [...allOrders, ...newOrders];
                displayedOrders = [...displayedOrders, ...newOrders];
            }

            console.log(`📦 Всего заказов: ${allOrders.length}`);

            if (displayedOrders.length === 0) {
                showEmptyState(container);
            } else {
                renderOrders(container, reset);
            }
            
            savePaginationState();
            
        } catch (error) {
            console.error('❌ Ошибка загрузки заказов:', error);
            
            const loadMoreContainer = document.getElementById('loadMoreContainer');
            if (loadMoreContainer) {
                loadMoreContainer.remove();
            }
            
            if (reset && displayedOrders.length === 0) {
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
            console.log('🔄 Загрузка завершена');
        }
    }

    // ===== ОТРИСОВКА ЗАКАЗОВ =====
    function renderOrders(container, reset = true) {
        if (!container) container = $('ordersList');
        if (!container) return;

        if (reset) {
            container.innerHTML = displayedOrders.map(order => createOrderCard(order)).join('');
        } else {
            const newOrdersHtml = displayedOrders.slice(-6).map(order => createOrderCard(order)).join('');
            container.insertAdjacentHTML('beforeend', newOrdersHtml);
        }

        setTimeout(() => {
            const newCards = reset 
                ? container.querySelectorAll('.order-card')
                : container.querySelectorAll('.order-card:not(.animated)');
                
            newCards.forEach((card, index) => {
                card.classList.add('animated');
                card.style.animation = `fadeInUp 0.5s ease ${index * 0.1}s forwards`;
                card.style.opacity = '0';
            });
        }, 100);

        updateOrdersCount();

        if (hasMore) {
            showLoadMoreButton(container);
        } else {
            hideLoadMoreButton();
        }
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
        let loadMoreContainer = document.getElementById('loadMoreContainer');
        
        if (!loadMoreContainer) {
            loadMoreContainer = document.createElement('div');
            loadMoreContainer.id = 'loadMoreContainer';
            loadMoreContainer.className = 'text-center mt-4 mb-3';
            container.insertAdjacentElement('afterend', loadMoreContainer);
        }
        
        const isLoadingNow = loadMoreContainer.getAttribute('data-loading') === 'true';
        
        loadMoreContainer.innerHTML = `
            <button class="btn btn-outline-primary rounded-pill px-5 py-3" id="loadMoreBtn" ${isLoadingNow ? 'disabled' : ''}>
                ${isLoadingNow ? 
                    '<span class="spinner-border spinner-border-sm me-2"></span>Загрузка...' : 
                    '<i class="fas fa-chevron-down me-2"></i>Показать ещё'
                }
            </button>
        `;
        
        const loadMoreBtn = document.getElementById('loadMoreBtn');
        if (loadMoreBtn) {
            const newBtn = loadMoreBtn.cloneNode(true);
            loadMoreBtn.parentNode.replaceChild(newBtn, loadMoreBtn);
            
            newBtn.addEventListener('click', async function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                console.log('🖱️ Кнопка "Показать ещё" нажата');
                
                if (isLoading) {
                    console.log('⏳ Уже идёт загрузка');
                    return;
                }
                
                const container = document.getElementById('loadMoreContainer');
                container.setAttribute('data-loading', 'true');
                this.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Загрузка...';
                this.disabled = true;
                
                await loadOrders(false);
            });
        }
    }

    function hideLoadMoreButton() {
        const container = document.getElementById('loadMoreContainer');
        if (container) {
            container.remove();
        }
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
            if (Auth.isMaster()) {
                Utils.showWarning('Мастера не могут создавать заказы');
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
        
        const user = Auth.getUser();
        
        const hasResponded = order.responses?.some(r => r.masterId === user?.uid) || false;
        const isMyOrder = order.clientId === user?.uid;
        
        const shouldShowButton = Auth.isAuthenticated() && 
                                Auth.isMaster() && 
                                order.status === 'open' && 
                                !isMyOrder && 
                                !hasResponded;
        
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
                
                ${shouldShowButton ? `
                    <button class="respond-btn" onclick="event.stopPropagation(); showRespondModal('${order.id}', '${Utils.escapeHtml(order.title)}', '${order.category}', ${order.price})">
                        <i class="fas fa-reply me-2"></i>Откликнуться
                    </button>
                ` : ''}
                
                ${hasResponded && !isMyOrder ? `
                    <div class="text-center mt-2">
                        <small class="text-secondary">
                            <i class="fas fa-check-circle me-1" style="color: var(--success);"></i>
                            Вы уже откликнулись
                        </small>
                    </div>
                ` : ''}
                
                ${isMyOrder ? `
                    <div class="text-center mt-2">
                        <small class="text-secondary">
                            <i class="fas fa-user me-1"></i>
                            Ваш заказ
                        </small>
                    </div>
                ` : ''}
            </div>
        `;
    }

    // ===== ЗАГРУЗКА МАСТЕРОВ С КЭШИРОВАНИЕМ =====
    async function loadMasters(forceRefresh = false) {
        const container = $('mastersList');
        if (!container) return;

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
            
            Utils.setMemoryCache(MASTERS_CACHE_KEY, masters, MASTERS_CACHE_TTL);
            Utils.setPersistentCache(MASTERS_CACHE_KEY, masters, MASTERS_CACHE_TTL);
            
            container.innerHTML = masters.map(master => createMasterCard(master)).join('');
            
        } catch (error) {
            console.error('❌ Ошибка загрузки мастеров:', error);
            
            const cachedMasters = Utils.getPersistentCache(MASTERS_CACHE_KEY);
            if (cachedMasters && cachedMasters.length > 0) {
                container.innerHTML = cachedMasters.map(master => createMasterCard(master)).join('');
            } else {
                const masters = getDemoMasters();
                container.innerHTML = masters.map(master => createMasterCard(master)).join('');
            }
        }
    }

    // ===== СОЗДАНИЕ КАРТОЧКИ МАСТЕРА =====
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
            <div class="master-card" onclick="handleMasterClick('${master.id}')">
                <div class="master-avatar">
                    <i class="fas fa-user-tie"></i>
                </div>
                <h4 class="master-name">${Utils.escapeHtml(master.name || 'Мастер')}</h4>
                <div class="master-rating">${stars} <span>${rating.toFixed(1)}</span></div>
                <p class="master-spec">${Utils.escapeHtml(spec)}</p>
            </div>
        `;
    }

    // ===== ОБРАБОТКА КЛИКА ПО МАСТЕРУ =====
    window.handleMasterClick = function(masterId) {
        if (!Auth.isAuthenticated()) {
            AuthUI.showLoginModal();
            Utils.showInfo('Войдите, чтобы просмотреть профиль мастера');
            return;
        }
        
        if (window.Loader) {
            Loader.navigateTo(`/HomeWork/master.html?id=${masterId}`, 'Загружаем профиль...');
        } else {
            window.location.href = `/HomeWork/master.html?id=${masterId}`;
        }
    };

    function getDemoMasters() {
        return [
            { id: 'demo1', name: 'Иван Д.', rating: 5, categories: 'Сантехника, Отопление' },
            { id: 'demo2', name: 'Сергей М.', rating: 4.8, categories: 'Электрика, Сборка мебели' },
            { id: 'demo3', name: 'Ольга К.', rating: 5, categories: 'Клининг, Декорирование' },
            { id: 'demo4', name: 'Дмитрий В.', rating: 4.7, categories: 'Ремонт под ключ' },
            { id: 'demo5', name: 'Елена П.', rating: 5, categories: 'Дизайн интерьера' },
            { id: 'demo6', name: 'Алексей Н.', rating: 4.9, categories: 'Отделочные работы' },
            { id: 'demo7', name: 'Анна С.', rating: 5, categories: 'Уборка, Декорирование' },
            { id: 'demo8', name: 'Павел К.', rating: 4.8, categories: 'Сантехника, Электрика' }
        ];
    }

    // ===== ИНИЦИАЛИЗАЦИЯ ОБРАБОТЧИКОВ =====
    function initEventListeners() {
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

        // Обработчик для ссылки "Все мастера"
        const allMastersLink = document.getElementById('allMastersLink');
        if (allMastersLink) {
            allMastersLink.addEventListener('click', (e) => {
                e.preventDefault();
                
                if (!Auth.isAuthenticated()) {
                    // Сохраняем намерение перейти к мастерам
                    sessionStorage.setItem('redirectAfterLogin', '/HomeWork/masters.html');
                    AuthUI.showLoginModal();
                    Utils.showInfo('Войдите, чтобы просмотреть список мастеров');
                } else {
                    // Если авторизован - переходим
                    if (window.Loader) {
                        Loader.navigateTo('/HomeWork/masters.html', 'Загружаем мастеров...');
                    } else {
                        window.location.href = '/HomeWork/masters.html';
                    }
                }
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
                    hideLoadMoreButton();
                } else {
                    renderOrders(container);
                }
            }, 500));
        }
    }

    // ===== ПОКАЗ МОДАЛКИ ОТКЛИКА =====
    window.showRespondModal = function(orderId, title, category, price) {
        console.log('🖱️ Клик по отклику:', {orderId, title, category, price});
        
        if (!Auth.isAuthenticated()) {
            AuthUI.showLoginModal();
            return;
        }
        
        if (!Auth.isMaster()) {
            Utils.showWarning('Только мастера могут откликаться');
            return;
        }
        
        sessionStorage.setItem('respond_order', JSON.stringify({
            orderId, 
            title, 
            category, 
            price
        }));
        
        if (window.location.pathname.includes('index.html') || window.location.pathname === '/HomeWork/') {
            console.log('📋 Показываем модалку на главной');
            
            const modal = document.getElementById('respondModal');
            if (modal) {
                document.getElementById('respondOrderTitle').textContent = title || 'Заказ';
                document.getElementById('respondOrderCategory').textContent = category || 'Категория';
                document.getElementById('respondOrderPrice').textContent = Utils.formatMoney(price);
                
                const bsModal = new bootstrap.Modal(modal);
                bsModal.show();
            } else {
                Utils.showError('Ошибка: модалка не найдена');
                if (window.Loader) {
                    Loader.navigateTo(`/HomeWork/master.html?respond=${orderId}`, 'Переходим к отклику...');
                } else {
                    window.location.href = `/HomeWork/master.html?respond=${orderId}`;
                }
            }
        } else {
            if (window.Loader) {
                Loader.navigateTo(`/HomeWork/master.html?respond=${orderId}`, 'Переходим к отклику...');
            } else {
                window.location.href = `/HomeWork/master.html?respond=${orderId}`;
            }
        }
    };

    window.viewOrder = (orderId) => {
        Utils.showInfo(`Заказ #${orderId.substring(0, 6)}...`);
    };

    window.addEventListener('pageshow', (event) => {
        if (event.persisted) {
            console.log('📦 Страница из кэша браузера, обновляем данные');
            loadOrders(true);
            loadMasters(true);
        }
    });

})();