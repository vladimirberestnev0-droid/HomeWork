(function() {
    // Состояние
    let allOrders = [];
    let displayedOrders = [];
    let filters = { category: 'all', city: 'all' };
    let uploadedPhotos = [];
    let currentPage = 0;
    let hasMore = true;

    // DOM элементы
    const $ = (id) => document.getElementById(id);

    // Инициализация
    document.addEventListener('DOMContentLoaded', async () => {
        console.log('🚀 Главная страница загружается...');

        // Заполняем категории
        renderCategoryFilters();

        // Загружаем заказы
        await loadOrders();

        // Подписываемся на изменения авторизации
        Auth.onAuthChange((state) => {
            updateAuthUI(state);
            toggleOrderForm(state);
        });

        // Инициализируем обработчики
        initEventListeners();
    });

    // Рендер фильтров категорий
    function renderCategoryFilters() {
        const container = $('categoryFilter');
        if (!container) return;

        container.innerHTML = ORDER_CATEGORIES.map(cat => `
            <button class="filter-btn ${cat.id === 'all' ? 'active' : ''}" data-category="${cat.id}">
                <i class="fas ${cat.icon} me-1"></i>${cat.name}
            </button>
        `).join('');
    }

    // Загрузка заказов
    async function loadOrders() {
        try {
            const orders = await Orders.getOpenOrders(filters);
            allOrders = orders;
            displayedOrders = orders.slice(0, 7);
            hasMore = orders.length > 7;
            
            renderOrders();
            
            const countEl = $('ordersCount');
            if (countEl) countEl.textContent = allOrders.length;
            
            toggleLoadMore();
        } catch (error) {
            console.error('Ошибка загрузки заказов:', error);
            $('ordersList').innerHTML = '<div class="text-center p-5 text-danger">Ошибка загрузки</div>';
        }
    }

    // Рендер заказов
    function renderOrders() {
        const container = $('ordersList');
        if (!container) return;

        if (displayedOrders.length === 0) {
            container.innerHTML = `
                <div class="text-center p-5">
                    <i class="fas fa-smile fa-3x mb-3" style="color: var(--border);"></i>
                    <h5>Нет заказов</h5>
                    <p class="text-secondary">Попробуйте изменить фильтры</p>
                </div>
            `;
            return;
        }

        container.innerHTML = displayedOrders.map(order => createOrderCard(order)).join('');
    }

    // Создание карточки заказа
    function createOrderCard(order) {
        const category = ORDER_CATEGORIES.find(c => c.id === order.category) || 
                        { icon: 'fa-tag', name: order.category };
        const canRespond = Auth.isAuthenticated() && Auth.isMaster() && order.status === ORDER_STATUS.OPEN;

        return `
            <div class="order-card">
                <div class="order-header">
                    <h5 class="order-title">${Utils.escapeHtml(order.title || 'Заказ')}</h5>
                    <span class="order-price">${Utils.formatMoney(order.price)}</span>
                </div>
                
                <p class="order-description">${Utils.truncate(Utils.escapeHtml(order.description || ''), 150)}</p>
                
                ${order.photos?.length ? `
                    <div class="d-flex gap-2 mb-3">
                        ${order.photos.slice(0, 3).map(url => 
                            `<img src="${url}" style="width:60px; height:60px; object-fit:cover; border-radius:8px; cursor:pointer;" onclick="window.open('${url}')">`
                        ).join('')}
                        ${order.photos.length > 3 ? `<span class="text-secondary">+${order.photos.length-3}</span>` : ''}
                    </div>
                ` : ''}
                
                <div class="order-meta">
                    <span><i class="fas ${category.icon} me-1"></i>${category.name}</span>
                    <span><i class="fas fa-map-marker-alt me-1"></i>${Utils.escapeHtml(order.address || '')}</span>
                </div>
                
                ${canRespond ? `
                    <button class="btn btn-primary btn-sm mt-3" onclick="respondToOrder('${order.id}')">
                        <i class="fas fa-reply me-1"></i>Откликнуться
                    </button>
                ` : ''}
            </div>
        `;
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
            await loadOrders();
        }
    };

    // Переключение кнопки "Показать ещё"
    function toggleLoadMore() {
        const container = $('loadMoreContainer');
        const remainingSpan = $('remainingOrdersCount');
        
        if (!container || !remainingSpan) return;
        
        if (hasMore) {
            remainingSpan.textContent = allOrders.length - displayedOrders.length;
            container.classList.remove('d-none');
        } else {
            container.classList.add('d-none');
        }
    }

    // Обновление UI при авторизации
    function updateAuthUI(state) {
        // Обновляем блок авторизации
        if (window.AuthUI) {
            AuthUI.renderAuthBlock();
        }
    }

    // Показ/скрытие формы для мастеров
    function toggleOrderForm(state) {
        const formColumn = $('orderFormColumn');
        const ordersColumn = $('ordersColumn');
        
        if (!formColumn || !ordersColumn) return;
        
        if (state.isAuthenticated && state.isMaster) {
            formColumn.style.display = 'none';
            ordersColumn.className = 'col-md-12';
        } else {
            formColumn.style.display = 'block';
            ordersColumn.className = 'col-md-6';
        }
    }

    // Инициализация обработчиков
    function initEventListeners() {
        // Фильтр по категориям
        document.querySelectorAll('.filter-btn[data-category]').forEach(btn => {
            btn.addEventListener('click', function() {
                document.querySelectorAll('.filter-btn[data-category]').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                
                filters.category = this.dataset.category;
                loadOrders();
            });
        });

        // Фильтр по городам
        $('cityFilter')?.addEventListener('change', (e) => {
            filters.city = e.target.value;
            loadOrders();
        });

        // Кнопка "Показать ещё"
        $('loadMoreBtn')?.addEventListener('click', () => {
            const start = displayedOrders.length;
            const end = start + 5;
            const more = allOrders.slice(start, end);
            displayedOrders = [...displayedOrders, ...more];
            hasMore = end < allOrders.length;
            
            renderOrders();
            toggleLoadMore();
        });

        // Форма создания заказа
        $('orderForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            if (!Auth.isAuthenticated()) {
                AuthUI.showLoginModal();
                return;
            }

            if (Auth.isMaster()) {
                Utils.showNotification('Мастера не могут создавать заказы', 'warning');
                return;
            }

            const formData = {
                category: $('category').value,
                title: $('title').value,
                description: $('description').value,
                price: parseInt($('price').value),
                address: $('address').value,
                photos: uploadedPhotos
            };

            const result = await Orders.create(formData);
            if (result.success) {
                $('orderForm').reset();
                uploadedPhotos = [];
                $('photoPreview').innerHTML = '';
                await loadOrders();
            }
        });

        // Загрузка фото
        $('photoInput')?.addEventListener('change', (e) => {
            handleFiles(e.target.files);
        });

        // Тема
        $('themeToggle')?.addEventListener('click', Auth.toggleTheme);

        // Выход
        $('headerLogoutBtn')?.addEventListener('click', Auth.logout);
    }

    // Обработка файлов
    function handleFiles(files) {
        if (uploadedPhotos.length + files.length > 5) {
            Utils.showNotification('Максимум 5 фото', 'warning');
            return;
        }

        const preview = $('photoPreview');
        
        for (let file of files) {
            if (!file.type.startsWith('image/')) continue;
            if (file.size > 10 * 1024 * 1024) {
                Utils.showNotification('Файл слишком большой (макс 10MB)', 'warning');
                continue;
            }
            
            const reader = new FileReader();
            reader.onload = (e) => {
                const div = document.createElement('div');
                div.style.position = 'relative';
                div.innerHTML = `
                    <img src="${e.target.result}" style="width:60px; height:60px; object-fit:cover; border-radius:8px;">
                    <span style="position:absolute; top:-5px; right:-5px; background:red; color:white; border-radius:50%; width:20px; height:20px; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:12px;" 
                          onclick="this.parentElement.remove()">×</span>
                `;
                preview.appendChild(div);
            };
            reader.readAsDataURL(file);
            
            uploadedPhotos.push(file);
        }
    }
})();