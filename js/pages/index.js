(function() {
    // Состояние
    let allOrders = [];
    let displayedOrders = [];
    let filters = { 
        category: 'all', 
        city: 'nyagan'
    };
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
        
        // Загружаем РЕАЛЬНЫЕ заказы
        await loadRealOrders();
        
        // Загружаем мастеров
        await loadMasters();
        
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

        container.innerHTML = ORDER_CATEGORIES.map(cat => `
            <span class="filter-chip ${cat.id === 'all' ? 'active' : ''}" data-category="${cat.id}">
                <i class="fas ${cat.icon}"></i> ${cat.name}
            </span>
        `).join('');
        
        attachFilterHandlers();
    }

    function attachFilterHandlers() {
        document.querySelectorAll('.filter-chip[data-category]').forEach(btn => {
            btn.addEventListener('click', function() {
                document.querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                
                filters.category = this.dataset.category;
                loadRealOrders(); // ← ЗАГРУЖАЕМ ЗАНОВО
            });
        });
    }

    // ===== ЗАГРУЗКА РЕАЛЬНЫХ ЗАКАЗОВ ИЗ FIREBASE =====
    async function loadRealOrders() {
        const container = $('ordersList');
        if (!container) return;

        // Показываем загрузку
        container.innerHTML = `
            <div class="text-center p-5">
                <div class="spinner-border" style="color: var(--accent);"></div>
                <p class="mt-2 text-secondary">Загрузка заказов...</p>
            </div>
        `;

        try {
            // Проверяем, есть ли Orders
            if (!window.Orders) {
                throw new Error('Сервис заказов не найден');
            }

            // Загружаем заказы из Firebase
            const orders = await Orders.getOpenOrders(filters);
            
            if (!orders || orders.length === 0) {
                // Если заказов нет — показываем красивое сообщение
                container.innerHTML = `
                    <div class="text-center p-5">
                        <i class="fas fa-smile fa-3x mb-3" style="color: var(--text-muted);"></i>
                        <h5>В Нягани пока нет заказов</h5>
                        <p class="text-muted">Будьте первым, кто создаст заказ!</p>
                        <button class="btn btn-primary mt-3" id="createFirstOrderBtn">
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
                        Utils.showNotification('Мастера не могут создавать заказы', 'warning');
                        return;
                    }
                    // Скроллим к форме создания заказа
                    document.getElementById('orderFormColumn')?.scrollIntoView({ behavior: 'smooth' });
                });
                
                return;
            }

            // Сохраняем и отображаем заказы
            allOrders = orders;
            displayedOrders = orders.slice(0, 5);
            renderOrders(container);
            
            const countEl = $('ordersCount');
            if (countEl) countEl.textContent = allOrders.length;
            
        } catch (error) {
            console.error('❌ Ошибка загрузки заказов:', error);
            
            // Показываем ошибку
            container.innerHTML = `
                <div class="text-center p-5 text-danger">
                    <i class="fas fa-exclamation-circle fa-3x mb-3"></i>
                    <h5>Не удалось загрузить заказы</h5>
                    <p class="text-muted">Попробуйте обновить страницу</p>
                    <button class="btn btn-outline-secondary mt-3" onclick="location.reload()">
                        <i class="fas fa-sync-alt me-2"></i>Обновить
                    </button>
                </div>
            `;
        }
    }

    // Отрисовка заказов
    function renderOrders(container) {
        if (!container) container = $('ordersList');
        if (!container) return;

        if (displayedOrders.length === 0) {
            container.innerHTML = `
                <div class="text-center p-5">
                    <i class="fas fa-smile fa-3x mb-3" style="color: var(--text-muted);"></i>
                    <h5>Нет заказов</h5>
                    <p class="text-muted">Попробуйте изменить фильтры</p>
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
        
        // Определяем, срочный ли заказ (можно добавить поле urgent в БД)
        const isUrgent = order.urgent || false;
        
        // Форматируем дату
        const dateStr = order.createdAt ? Utils.formatDate(order.createdAt) : 'только что';
        
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
                    <span><i class="far fa-clock"></i> ${dateStr}</span>
                    <span><i class="fas fa-map-marker-alt"></i> Нягань</span>
                    ${Auth.isAuthenticated() && Auth.isMaster() ? `
                        <button class="respond-btn" onclick="event.stopPropagation(); respondToOrder('${order.id}')">
                            Отклик
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }

    // Загрузка мастеров
    async function loadMasters() {
        const container = $('mastersList');
        if (!container) return;

        try {
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
            
            if (masters.length === 0) {
                container.innerHTML = '<div class="text-muted p-3">Пока нет мастеров</div>';
                return;
            }
            
            container.innerHTML = '';
            masters.forEach(master => {
                container.appendChild(createMasterCard(master));
            });
            
        } catch (error) {
            console.error('Ошибка загрузки мастеров:', error);
            container.innerHTML = '<div class="text-muted p-3">Ошибка загрузки</div>';
        }
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

        const comment = prompt('Комментарий (необязательно):', '');
        
        // Отправляем реальный отклик
        const result = await Orders.respondToOrder(orderId, priceNum, comment || '');
        
        if (result && result.success) {
            Utils.showNotification('✅ Отклик отправлен!', 'success');
        } else {
            Utils.showNotification('❌ Ошибка при отправке', 'error');
        }
    };

    window.viewOrder = (orderId) => {
        Utils.showNotification('Просмотр заказа (будет позже)', 'info');
    };

    // Инициализация обработчиков
    function initEventListeners() {
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
            // Скроллим к форме
            document.getElementById('orderFormColumn')?.scrollIntoView({ behavior: 'smooth' });
        });

        // Поиск
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
                displayedOrders = filtered.slice(0, 5);
                renderOrders();
            }, 500));
        }

        // Просмотр всех заказов
        $('viewAllOrders')?.addEventListener('click', (e) => {
            e.preventDefault();
            Utils.showNotification('Все заказы (будет позже)', 'info');
        });
    }
})();