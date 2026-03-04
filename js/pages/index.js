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
        console.log('🚀 Главная в новом стиле загружается...');
        
        // Показываем скелетон
        document.body.classList.remove('loaded');
        
        // Ждём Firebase
        await waitForFirebase();
        
        // Заполняем фильтры
        renderCategoryFilters();
        initCategoryCombo();
        
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
            setTimeout(resolve, 1000);
        });
    }

    // Рендер фильтров
    function renderCategoryFilters() {
        const container = $('categoryFilters');
        if (!container) return;

        container.innerHTML = ORDER_CATEGORIES.map(cat => `
            <span class="filter-chip ${cat.id === 'all' ? 'active' : ''}" data-category="${cat.id}">
                <i class="fas ${cat.icon}"></i> ${cat.name}
            </span>
        `).join('');
    }

    // Загрузка заказов
    async function loadOrders() {
        try {
            const orders = await Orders.getOpenOrders(filters);
            allOrders = orders;
            displayedOrders = orders.slice(0, 5);
            hasMore = orders.length > 5;
            
            renderOrders();
            
            const countEl = $('ordersCount');
            if (countEl) countEl.textContent = allOrders.length;
        } catch (error) {
            console.error('Ошибка загрузки заказов:', error);
        }
    }

    // Рендер заказов
    function renderOrders() {
        const container = $('ordersList');
        if (!container) return;

        if (displayedOrders.length === 0) {
            container.innerHTML = `
                <div class="text-center p-5">
                    <i class="fas fa-smile fa-3x mb-3" style="color: var(--text-muted);"></i>
                    <h5>В Нягани пока нет заказов</h5>
                    <p class="text-muted">Будьте первым!</p>
                </div>
            `;
            return;
        }

        container.innerHTML = displayedOrders.map(order => createOrderCard(order)).join('');
    }

    // Создание карточки заказа
    function createOrderCard(order) {
        const category = ORDER_CATEGORIES.find(c => c.id === order.category) || 
                        { icon: 'fa-tag', name: order.category || 'Услуга' };
        const isUrgent = order.urgent || Math.random() > 0.7; // Пример для демо
        
        return `
            <div class="order-card ${isUrgent ? 'urgent' : ''}" onclick="viewOrder('${order.id}')">
                <div class="order-header">
                    <span class="order-category">
                        <i class="fas ${category.icon}"></i> ${category.name}
                    </span>
                    <span class="order-price">${Utils.formatMoney(order.price)}</span>
                </div>
                <div class="order-title">${Utils.escapeHtml(order.title || 'Заказ')}</div>
                <div class="order-description">${Utils.truncate(Utils.escapeHtml(order.description || ''), 100)}</div>
                <div class="order-footer">
                    <span><i class="far fa-clock"></i> ${Utils.formatDate(order.createdAt)}</span>
                    <span><i class="fas fa-map-marker-alt"></i> 1.2 км</span>
                    <button class="respond-btn" onclick="event.stopPropagation(); respondToOrder('${order.id}')">
                        Отклик
                    </button>
                </div>
            </div>
        `;
    }

    // Загрузка мастеров
    async function loadMasters() {
        const container = $('mastersList');
        if (!container) return;

        try {
            const snapshot = await db.collection('users')
                .where('role', '==', 'master')
                .where('banned', '==', false)
                .limit(10)
                .get();

            if (snapshot.empty) {
                container.innerHTML = '<div class="text-muted p-3">Пока нет мастеров</div>';
                return;
            }

            container.innerHTML = '';
            snapshot.forEach(doc => {
                const master = doc.data();
                container.appendChild(createMasterCard(master, doc.id));
            });
        } catch (error) {
            console.error('Ошибка загрузки мастеров:', error);
        }
    }

    function createMasterCard(master, id) {
        const div = document.createElement('div');
        div.className = 'master-card';
        div.onclick = () => window.location.href = `/HomeWork/master-profile.html?id=${id}`;
        
        const rating = master.rating || 0;
        const stars = '★'.repeat(Math.floor(rating)) + '☆'.repeat(5 - Math.floor(rating));
        
        div.innerHTML = `
            <div class="master-avatar">
                <i class="fas fa-user-tie"></i>
            </div>
            <div class="master-name">${Utils.escapeHtml(master.name || 'Мастер')}</div>
            <div class="master-rating">${stars}</div>
            <div class="master-spec">${master.categories?.split(',')[0] || 'Специалист'}</div>
        `;
        
        return div;
    }

    // Инициализация комбо-бокса категорий
    function initCategoryCombo() {
        const label = $('categoryLabel');
        if (!label) return;
        
        // ... (код комбо-бокса из предыдущих версий)
    }

    // Отклик на заказ
    window.respondToOrder = async (orderId) => {
        if (!Auth.isAuthenticated()) {
            AuthUI.showLoginModal();
            return;
        }

        const price = prompt('Ваша цена (₽):');
        if (!price) return;

        const priceNum = parseInt(price);
        if (!Utils.validatePrice(priceNum)) {
            Utils.showNotification('❌ Цена должна быть от 500 до 1 000 000 ₽', 'error');
            return;
        }

        const comment = prompt('Комментарий (необязательно):', '');
        
        const result = await Orders.respondToOrder(orderId, priceNum, comment || '');
        if (result.success) {
            Utils.showNotification('✅ Отклик отправлен!', 'success');
            await loadOrders();
        }
    };

    window.viewOrder = (orderId) => {
        // Показываем детали заказа (можно реализовать позже)
        Utils.showNotification('Просмотр заказа', 'info');
    };

    // Инициализация обработчиков
    function initEventListeners() {
        // Фильтры
        document.querySelectorAll('.filter-chip[data-category]').forEach(btn => {
            btn.addEventListener('click', function() {
                document.querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                
                filters.category = this.dataset.category;
                loadOrders();
            });
        });

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
        $('searchInput')?.addEventListener('input', Utils.debounce(() => {
            // Реализовать поиск
        }, 500));

        // Тема (опционально)
        // $('themeToggle')?.addEventListener('click', Auth.toggleTheme);
    }
})();