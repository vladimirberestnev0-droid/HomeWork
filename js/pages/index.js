(function() {
    // ===== СОСТОЯНИЕ =====
    let allOrders = [];
    let displayedOrders = [];
    let filters = { 
        category: 'all', 
        city: 'nyagan'
    };
    let currentPage = 0;
    let hasMore = true;

    // ===== DOM ЭЛЕМЕНТЫ =====
    const $ = (id) => document.getElementById(id);

    // ===== ИНИЦИАЛИЗАЦИЯ =====
    document.addEventListener('DOMContentLoaded', async () => {
        console.log('🚀 Главная загружается...');
        
        // Показываем скелетон
        document.body.classList.remove('loaded');
        
        // Ждём Firebase
        await waitForFirebase();
        
        // Заполняем фильтры ВСЕМИ категориями (адаптивность через CSS)
        renderCategoryFilters();
        
        // Загружаем реальные заказы
        await loadRealOrders();
        
        // Загружаем мастеров
        await loadMasters();
        
        // Показываем контент
        document.body.classList.add('loaded');
        
        // Инициализируем обработчики
        initEventListeners();
        
        // Красивое появление карточек
        animateCards();
    });

    // ===== ОЖИДАНИЕ FIREBASE =====
    function waitForFirebase() {
        return new Promise((resolve) => {
            if (window.db && window.auth) {
                resolve();
                return;
            }
            const check = setInterval(() => {
                if (window.db && window.auth) {
                    clearInterval(check);
                    resolve();
                }
            }, 100);
            setTimeout(() => {
                clearInterval(check);
                resolve();
            }, 3000);
        });
    }

    // ===== РЕНДЕР ФИЛЬТРОВ (ВСЕ КАТЕГОРИИ) =====
    function renderCategoryFilters() {
        const container = $('categoryFilters');
        if (!container) return;

        // На мобилках скроллятся, на десктопе оборачиваются
        container.innerHTML = ORDER_CATEGORIES.map(cat => `
            <span class="filter-chip ${cat.id === 'all' ? 'active' : ''}" data-category="${cat.id}">
                <i class="fas ${cat.icon}"></i> ${cat.name}
            </span>
        `).join('');
        
        attachFilterHandlers();
    }

    // ===== ОБРАБОТЧИКИ ФИЛЬТРОВ =====
    function attachFilterHandlers() {
        document.querySelectorAll('.filter-chip[data-category]').forEach(btn => {
            btn.addEventListener('click', function() {
                document.querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                
                filters.category = this.dataset.category;
                loadRealOrders();
                
                // Плавный скролл к заказам
                document.getElementById('ordersList')?.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'nearest' 
                });
            });
        });
    }

    // ===== ЗАГРУЗКА РЕАЛЬНЫХ ЗАКАЗОВ =====
    async function loadRealOrders() {
        const container = $('ordersList');
        if (!container) return;

        // Показываем загрузку с анимацией
        container.innerHTML = `
            <div class="text-center p-5">
                <div class="spinner-glow"></div>
                <p class="mt-3 text-secondary" style="animation: pulse 1.5s infinite;">Загружаем заказы...</p>
            </div>
        `;

        try {
            if (!window.Orders) throw new Error('Сервис заказов не найден');

            const orders = await Orders.getOpenOrders(filters);
            
            if (!orders || orders.length === 0) {
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
                    window.location.href = '/HomeWork/client.html';
                });
                
                return;
            }

            allOrders = orders;
            displayedOrders = orders.slice(0, 6); // Показываем 6 заказов
            renderOrders(container);
            
            const countEl = $('ordersCount');
            if (countEl) countEl.textContent = allOrders.length;
            
        } catch (error) {
            console.error('❌ Ошибка загрузки заказов:', error);
            
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
    }

    // ===== ОТРИСОВКА ЗАКАЗОВ =====
    function renderOrders(container) {
        if (!container) container = $('ordersList');
        if (!container) return;

        if (displayedOrders.length === 0) {
            container.innerHTML = `
                <div class="text-center p-5">
                    <i class="fas fa-search fa-4x mb-3" style="color: var(--text-muted);"></i>
                    <h5>Нет заказов по выбранным фильтрам</h5>
                    <p class="text-muted">Попробуйте изменить категорию</p>
                </div>
            `;
            return;
        }

        container.innerHTML = displayedOrders.map(order => createOrderCard(order)).join('');
        
        // Добавляем анимацию появления карточкам
        setTimeout(() => {
            document.querySelectorAll('.order-card').forEach((card, index) => {
                card.style.animation = `fadeInUp 0.5s ease ${index * 0.1}s forwards`;
                card.style.opacity = '0';
            });
        }, 100);
    }

    // ===== СОЗДАНИЕ КАРТОЧКИ ЗАКАЗА =====
    function createOrderCard(order) {
        const category = ORDER_CATEGORIES.find(c => c.id === order.category) || 
                        { icon: 'fa-tag', name: order.category || 'Услуга' };
        const dateStr = order.createdAt ? Utils.formatDate(order.createdAt) : 'только что';
        
        // Определяем, срочный ли заказ (можно добавить поле в БД)
        const isUrgent = order.urgent || Math.random() > 0.7; // Для демо
        
        return `
            <div class="order-card ${isUrgent ? 'urgent' : ''}" onclick="viewOrder('${order.id}')" style="opacity: 0;">
                <div class="order-badge ${isUrgent ? 'urgent-badge' : ''}">
                    ${isUrgent ? '<i class="fas fa-exclamation-circle"></i> Срочно' : ''}
                </div>
                <div class="order-header">
                    <span class="order-category">
                        <i class="fas ${category.icon}"></i> ${category.name}
                    </span>
                    <span class="order-price">${Utils.formatMoney(order.price)}</span>
                </div>
                <h3 class="order-title">${Utils.escapeHtml(order.title || 'Заказ')}</h3>
                <p class="order-description">${Utils.truncate(Utils.escapeHtml(order.description || ''), 120)}</p>
                
                ${order.photos && order.photos.length > 0 ? `
                    <div class="order-photos">
                        <img src="${order.photos[0]}" alt="Фото заказа" class="order-photo-thumb">
                        ${order.photos.length > 1 ? `<span class="photo-count">+${order.photos.length-1}</span>` : ''}
                    </div>
                ` : ''}
                
                <div class="order-footer">
                    <span class="order-time">
                        <i class="far fa-clock"></i> ${dateStr}
                    </span>
                    <span class="order-location">
                        <i class="fas fa-map-marker-alt"></i> Нягань
                    </span>
                </div>
                
                ${Auth.isAuthenticated() && Auth.isMaster() ? `
                    <button class="respond-btn" onclick="event.stopPropagation(); window.location.href='/HomeWork/master.html?respond=${order.id}'">
                        <i class="fas fa-reply me-2"></i>Откликнуться
                    </button>
                ` : ''}
            </div>
        `;
    }

    // ===== ЗАГРУЗКА МАСТЕРОВ =====
    async function loadMasters() {
        const container = $('mastersList');
        if (!container) return;

        try {
            let masters = [];
            
            if (window.db) {
                const snapshot = await db.collection('users')
                    .where('role', '==', 'master')
                    .where('banned', '==', false)
                    .limit(8)
                    .get();
                    
                snapshot.forEach(doc => {
                    masters.push({ id: doc.id, ...doc.data() });
                });
            }
            
            if (masters.length === 0) {
                // Показываем демо-мастеров
                masters = [
                    { name: 'Иван Д.', rating: 5, categories: 'Сантехника, Отопление' },
                    { name: 'Сергей М.', rating: 4, categories: 'Электрика, Сборка мебели' },
                    { name: 'Ольга К.', rating: 5, categories: 'Клининг, Декорирование' },
                    { name: 'Дмитрий В.', rating: 4, categories: 'Ремонт под ключ' },
                    { name: 'Елена П.', rating: 5, categories: 'Дизайн интерьера' },
                    { name: 'Алексей Н.', rating: 4, categories: 'Отделочные работы' },
                ];
            }
            
            container.innerHTML = '';
            masters.forEach(master => {
                container.appendChild(createMasterCard(master));
            });
            
        } catch (error) {
            console.error('Ошибка загрузки мастеров:', error);
            container.innerHTML = '<div class="text-muted p-3">Ошибка загрузки мастеров</div>';
        }
    }

    // ===== СОЗДАНИЕ КАРТОЧКИ МАСТЕРА =====
    function createMasterCard(master) {
        const div = document.createElement('div');
        div.className = 'master-card';
        div.onclick = () => {
            if (Auth.isAuthenticated()) {
                window.location.href = `/HomeWork/master.html`;
            } else {
                AuthUI.showLoginModal();
            }
        };
        
        const rating = master.rating || 5;
        const fullStars = Math.floor(rating);
        const halfStar = rating % 1 >= 0.5;
        let stars = '';
        
        for (let i = 0; i < 5; i++) {
            if (i < fullStars) {
                stars += '<i class="fas fa-star"></i>';
            } else if (i === fullStars && halfStar) {
                stars += '<i class="fas fa-star-half-alt"></i>';
            } else {
                stars += '<i class="far fa-star"></i>';
            }
        }
        
        div.innerHTML = `
            <div class="master-avatar">
                <i class="fas fa-user-tie"></i>
            </div>
            <h4 class="master-name">${Utils.escapeHtml(master.name || 'Мастер')}</h4>
            <div class="master-rating">${stars} <span>${rating.toFixed(1)}</span></div>
            <p class="master-spec">${master.categories?.split(',')[0] || 'Специалист'}</p>
        `;
        
        return div;
    }

    // ===== ПРОСМОТР ЗАКАЗА (ВРЕМЕННО) =====
    window.viewOrder = (orderId) => {
        Utils.showNotification('👀 Просмотр заказа будет доступен позже', 'info');
    };

    // ===== АНИМАЦИЯ КАРТОЧЕК =====
    function animateCards() {
        const style = document.createElement('style');
        style.textContent = `
            @keyframes fadeInUp {
                from {
                    opacity: 0;
                    transform: translateY(30px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
            
            @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.5; }
            }
            
            .spinner-glow {
                width: 50px;
                height: 50px;
                border: 3px solid var(--border);
                border-top-color: var(--accent);
                border-radius: 50%;
                animation: spin 1s linear infinite, glow 1.5s ease-in-out infinite;
                margin: 0 auto;
            }
            
            @keyframes glow {
                0%, 100% { box-shadow: 0 0 10px var(--accent); }
                50% { box-shadow: 0 0 30px var(--accent); }
            }
            
            .pulse-button {
                animation: buttonPulse 2s infinite;
            }
            
            @keyframes buttonPulse {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.05); }
            }
            
            .fade-in {
                animation: fadeIn 0.5s ease;
            }
            
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
        `;
        document.head.appendChild(style);
    }

    // ===== ИНИЦИАЛИЗАЦИЯ ОБРАБОТЧИКОВ =====
    function initEventListeners() {
        // Фильтры
        attachFilterHandlers();

        // Кнопка создания заказа
        $('createOrderBtn')?.addEventListener('click', () => {
            if (!Auth.isAuthenticated()) {
                AuthUI.showLoginModal();
                return;
            }
            if (Auth.isMaster()) {
                Utils.showNotification('Мастера не могут создавать заказы', 'warning');
                return;
            }
            window.location.href = '/HomeWork/client.html';
        });

        // Поиск с дебаунсом
        const searchInput = $('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', Utils.debounce((e) => {
                const query = e.target.value.trim().toLowerCase();
                if (query.length < 3) {
                    loadRealOrders();
                    return;
                }
                
                // Фильтруем уже загруженные заказы
                const filtered = allOrders.filter(order => 
                    order.title?.toLowerCase().includes(query) || 
                    order.description?.toLowerCase().includes(query)
                );
                displayedOrders = filtered.slice(0, 6);
                
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

        // Просмотр всех заказов
        $('viewAllOrders')?.addEventListener('click', (e) => {
            e.preventDefault();
            $('ordersList')?.scrollIntoView({ behavior: 'smooth' });
        });

        // Анимация при скролле
        window.addEventListener('scroll', () => {
            const floatingBtn = document.querySelector('.btn-floating');
            if (floatingBtn) {
                const scrollY = window.scrollY;
                if (scrollY > 200) {
                    floatingBtn.style.transform = 'scale(1.05)';
                } else {
                    floatingBtn.style.transform = 'scale(1)';
                }
            }
        });
    }

    // Добавляем стили для пустого состояния
    const style = document.createElement('style');
    style.textContent = `
        .empty-state-icon {
            animation: float 3s ease-in-out infinite;
        }
        
        @keyframes float {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-10px); }
        }
    `;
    document.head.appendChild(style);
})();