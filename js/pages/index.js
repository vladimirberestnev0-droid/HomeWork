(function() {
    // Состояние
    let allOrders = [];
    let displayedOrders = [];
    let filters = { 
        category: 'all', 
        city: 'nyagan'
    };
    let uploadedPhotos = [];
    let currentPage = 0;
    let hasMore = true;

    const $ = (id) => document.getElementById(id);

    // Инициализация
    document.addEventListener('DOMContentLoaded', async () => {
        console.log('🚀 Главная загружается...');
        
        // Показываем скелетон
        document.body.classList.remove('loaded');
        
        // Ждём Firebase
        await waitForFirebase();
        
        // Заполняем фильтры
        renderCategoryFilters();
        
        // Загружаем данные
        await Promise.all([
            loadOrders(),
            loadMasters()
        ]);
        
        // Показываем контент
        document.body.classList.add('loaded');
        
        // Инициализируем обработчики
        initEventListeners();
    });

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

    // Рендер фильтров
    function renderCategoryFilters() {
        const container = $('categoryFilters');
        if (!container) return;

        // Показываем только первые 8 категорий, остальные скрываем
        const visibleCategories = ORDER_CATEGORIES.slice(0, 8);
        const hiddenCategories = ORDER_CATEGORIES.slice(8);

        container.innerHTML = visibleCategories.map(cat => `
            <span class="filter-chip ${cat.id === 'all' ? 'active' : ''}" data-category="${cat.id}">
                <i class="fas ${cat.icon}"></i> ${cat.name}
            </span>
        `).join('');

        // Добавляем кнопку "Ещё", если есть скрытые категории
        if (hiddenCategories.length > 0) {
            const moreBtn = document.createElement('span');
            moreBtn.className = 'filter-chip more-categories';
            moreBtn.innerHTML = '<i class="fas fa-ellipsis-h"></i> Ещё';
            moreBtn.addEventListener('click', () => showAllCategories());
            container.appendChild(moreBtn);
        }
    }

    // Показать все категории
    function showAllCategories() {
        const container = $('categoryFilters');
        if (!container) return;
        
        container.innerHTML = ORDER_CATEGORIES.map(cat => `
            <span class="filter-chip ${cat.id === 'all' ? 'active' : ''}" data-category="${cat.id}">
                <i class="fas ${cat.icon}"></i> ${cat.name}
            </span>
        `).join('');
        
        // Перезапускаем обработчики
        attachFilterHandlers();
    }

    // Прикрепить обработчики к фильтрам
    function attachFilterHandlers() {
        document.querySelectorAll('.filter-chip[data-category]').forEach(btn => {
            btn.addEventListener('click', function() {
                document.querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                
                filters.category = this.dataset.category;
                loadOrders();
            });
        });
    }

    // Загрузка заказов
    async function loadOrders() {
        const container = $('ordersList');
        if (!container) return;

        try {
            // Пытаемся загрузить из Firebase
            let orders = [];
            if (window.Orders) {
                orders = await Orders.getOpenOrders(filters);
            }
            
            // Если заказов нет, показываем демо-заказы
            if (!orders || orders.length === 0) {
                showDemoOrders(container);
                return;
            }
            
            allOrders = orders;
            displayedOrders = orders.slice(0, 5);
            renderOrders(container);
            
            const countEl = $('ordersCount');
            if (countEl) countEl.textContent = allOrders.length;
            
        } catch (error) {
            console.error('Ошибка загрузки заказов:', error);
            showDemoOrders(container);
        }
    }

    // Показать демо-заказы (пока нет базы)
    function showDemoOrders(container) {
        container.innerHTML = `
            <div class="order-card" onclick="viewOrder('demo1')">
                <div class="order-header">
                    <span class="order-category"><i class="fas fa-wrench"></i> Сантехника</span>
                    <span class="order-price">1 500 ₽</span>
                </div>
                <div class="order-title">Протекает кран на кухне</div>
                <div class="order-description">Капает вода из смесителя, нужна замена картриджа. Нягань, 3-й микрорайон.</div>
                <div class="order-footer">
                    <span><i class="far fa-clock"></i> 15 мин назад</span>
                    <span><i class="fas fa-map-marker-alt"></i> 1.2 км</span>
                    <button class="respond-btn" onclick="event.stopPropagation(); respondToOrder('demo1')">Отклик</button>
                </div>
            </div>
            <div class="order-card urgent" onclick="viewOrder('demo2')">
                <div class="order-header">
                    <span class="order-category"><i class="fas fa-bolt"></i> Электрика</span>
                    <span class="order-price">2 500 ₽</span>
                </div>
                <div class="order-title">Нет света в комнате</div>
                <div class="order-description">Выбило пробки, нужен электрик срочно. Есть дети.</div>
                <div class="order-footer">
                    <span><i class="far fa-clock"></i> 5 мин назад</span>
                    <span><i class="fas fa-map-marker-alt"></i> 0.5 км</span>
                    <button class="respond-btn" onclick="event.stopPropagation(); respondToOrder('demo2')">Срочно</button>
                </div>
            </div>
            <div class="order-card" onclick="viewOrder('demo3')">
                <div class="order-header">
                    <span class="order-category"><i class="fas fa-broom"></i> Клининг</span>
                    <span class="order-price">2 000 ₽</span>
                </div>
                <div class="order-title">Генеральная уборка квартиры</div>
                <div class="order-description">2-комнатная, 45 кв.м. Нужны свои средства.</div>
                <div class="order-footer">
                    <span><i class="far fa-clock"></i> 45 мин назад</span>
                    <span><i class="fas fa-map-marker-alt"></i> 3 км</span>
                    <button class="respond-btn" onclick="event.stopPropagation(); respondToOrder('demo3')">Отклик</button>
                </div>
            </div>
        `;
    }

    // Загрузка мастеров
    async function loadMasters() {
        const container = $('mastersList');
        if (!container) return;

        try {
            // Пытаемся загрузить из Firebase
            let masters = [];
            if (window.db) {
                const snapshot = await db.collection('users')
                    .where('role', '==', 'master')
                    .where('banned', '==', false)
                    .limit(10)
                    .get();
                    
                snapshot.forEach(doc => {
                    masters.push({ id: doc.id, ...doc.data() });
                });
            }
            
            // Если мастеров нет, показываем демо
            if (masters.length === 0) {
                showDemoMasters(container);
                return;
            }
            
            container.innerHTML = '';
            masters.forEach(master => {
                container.appendChild(createMasterCard(master));
            });
            
        } catch (error) {
            console.error('Ошибка загрузки мастеров:', error);
            showDemoMasters(container);
        }
    }

    // Показать демо-мастеров
    function showDemoMasters(container) {
        const demoMasters = [
            { name: 'Иван Д.', spec: 'Сантехника', rating: 5 },
            { name: 'Сергей М.', spec: 'Электрика', rating: 4 },
            { name: 'Ольга К.', spec: 'Клининг', rating: 5 },
            { name: 'Дмитрий', spec: 'Ремонт', rating: 4 }
        ];
        
        container.innerHTML = '';
        demoMasters.forEach(master => {
            container.appendChild(createMasterCard(master));
        });
    }

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
        
        const rating = master.rating || 0;
        const stars = '★'.repeat(rating) + '☆'.repeat(5 - rating);
        
        div.innerHTML = `
            <div class="master-avatar">
                <i class="fas fa-user-tie"></i>
            </div>
            <div class="master-name">${Utils.escapeHtml(master.name || 'Мастер')}</div>
            <div class="master-rating">${stars}</div>
            <div class="master-spec">${master.spec || master.categories?.split(',')[0] || 'Специалист'}</div>
        `;
        
        return div;
    }

    // Отклик на заказ
    window.respondToOrder = async (orderId) => {
        if (!Auth.isAuthenticated()) {
            AuthUI.showLoginModal();
            return;
        }

        if (!Auth.isMaster()) {
            Utils.showNotification('❌ Только мастера могут откликаться', 'warning');
            return;
        }

        const price = prompt('Ваша цена (₽):');
        if (!price) return;

        const priceNum = parseInt(price);
        if (isNaN(priceNum) || priceNum < 500 || priceNum > 1000000) {
            Utils.showNotification('❌ Цена должна быть от 500 до 1 000 000 ₽', 'error');
            return;
        }

        Utils.showNotification('✅ Отклик отправлен! (демо-режим)', 'success');
    };

    window.viewOrder = (orderId) => {
        Utils.showNotification('Просмотр заказа (демо)', 'info');
    };

    // Поиск
    function initSearch() {
        const searchInput = $('searchInput');
        if (!searchInput) return;
        
        searchInput.addEventListener('input', Utils.debounce((e) => {
            const query = e.target.value.trim().toLowerCase();
            if (query.length < 3) {
                loadOrders();
                return;
            }
            
            // Фильтруем демо-заказы
            const container = $('ordersList');
            const cards = container.querySelectorAll('.order-card');
            cards.forEach(card => {
                const text = card.textContent.toLowerCase();
                card.style.display = text.includes(query) ? 'block' : 'none';
            });
        }, 500));
    }

    // Инициализация обработчиков
    function initEventListeners() {
        // Фильтры
        attachFilterHandlers();

        // Создание заказа
        $('createOrderBtn')?.addEventListener('click', () => {
            if (!Auth.isAuthenticated()) {
                AuthUI.showLoginModal();
                return;
            }
            if (Auth.isMaster()) {
                Utils.showNotification('Мастера не могут создавать заказы', 'warning');
                return;
            }
            window.location.href = '/HomeWork/';
        });

        // Поиск
        initSearch();

        // Просмотр всех заказов
        $('viewAllOrders')?.addEventListener('click', (e) => {
            e.preventDefault();
            Utils.showNotification('Все заказы (демо)', 'info');
        });
    }
})();