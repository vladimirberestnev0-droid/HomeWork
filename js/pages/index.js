(function() {
    // Состояние
    let allOrders = [];
    let displayedOrders = [];
    let filters = { 
        category: 'all', 
        city: 'nyagan' // ТОЛЬКО НЯГАНЬ
    };
    let uploadedPhotos = [];
    let currentPage = 0;
    let hasMore = true;

    // DOM элементы
    const $ = (id) => document.getElementById(id);

    // Инициализация
    document.addEventListener('DOMContentLoaded', async () => {
        console.log('🚀 Главная страница загружается...');

        // Заполняем select категорий
        fillCategorySelect();

        // Инициализируем комбо-бокс
        initCategoryCombo();

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

    // Заполнение select категорий для формы
    function fillCategorySelect() {
        const select = $('category');
        if (!select) return;

        select.innerHTML = '<option value="">Выберите категорию</option>' + 
            ORDER_CATEGORIES.filter(cat => cat.id !== 'all').map(cat => 
                `<option value="${cat.id}">${cat.name}</option>`
            ).join('');
    }

    // Инициализация комбо-бокса категорий
    function initCategoryCombo() {
        const label = $('categoryLabel');
        const dropdown = $('categoryDropdown');
        const searchInput = $('categorySearch');
        const list = $('categoryList');
        const selectedInput = $('selectedCategory');
        const selectedNameSpan = $('selectedCategoryName');
        
        let allCategories = ORDER_CATEGORIES || [];
        let filteredCategories = allCategories;
        
        // Функция рендера списка
        function renderCategories(filter = '') {
            const filterLower = filter.toLowerCase();
            filteredCategories = allCategories.filter(cat => 
                cat.name.toLowerCase().includes(filterLower)
            );
            
            list.innerHTML = filteredCategories.map(cat => {
                const isActive = cat.id === selectedInput.value;
                return `
                    <div class="category-item ${isActive ? 'active' : ''}" data-category-id="${cat.id}">
                        <i class="fas ${cat.icon}"></i>
                        <span>${cat.name}</span>
                        ${isActive ? '<i class="fas fa-check ms-auto"></i>' : ''}
                    </div>
                `;
            }).join('');
            
            // Если ничего не найдено
            if (filteredCategories.length === 0) {
                list.innerHTML = '<div class="category-item disabled">Ничего не найдено</div>';
            }
        }
        
        // Открыть/закрыть дропдаун
        label.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            
            if (dropdown.style.display === 'none' || dropdown.style.display === '') {
                dropdown.style.display = 'block';
                renderCategories(searchInput.value);
                searchInput.focus();
            } else {
                dropdown.style.display = 'none';
            }
        });
        
        // Поиск
        searchInput.addEventListener('input', (e) => {
            renderCategories(e.target.value);
        });
        
        // Выбор категории
        list.addEventListener('click', (e) => {
            const item = e.target.closest('.category-item');
            if (!item || !item.dataset.categoryId) return;
            
            const categoryId = item.dataset.categoryId;
            const category = allCategories.find(c => c.id === categoryId);
            
            if (category) {
                selectedInput.value = categoryId;
                selectedNameSpan.textContent = category.name;
                
                // Обновляем фильтр и загружаем заказы
                filters.category = categoryId;
                loadOrders();
                
                // Закрываем дропдаун
                dropdown.style.display = 'none';
            }
        });
        
        // Закрытие по клику вне
        document.addEventListener('click', (e) => {
            if (!label.contains(e.target) && !dropdown.contains(e.target)) {
                dropdown.style.display = 'none';
            }
        });
        
        // Закрытие по Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && dropdown.style.display === 'block') {
                dropdown.style.display = 'none';
            }
        });
        
        // Останавливаем всплытие кликов внутри дропдауна
        dropdown.addEventListener('click', (e) => {
            e.stopPropagation();
        });
        
        // Первоначальный рендер
        renderCategories();
    }

    // Загрузка заказов (только Нягань)
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
            const ordersList = $('ordersList');
            if (ordersList) {
                ordersList.innerHTML = '<div class="text-center p-5 text-danger">Ошибка загрузки</div>';
            }
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
                    <h5>В Нягани пока нет заказов</h5>
                    <p class="text-secondary">Будьте первым, кто создаст заказ!</p>
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
        const canRespond = Auth.isAuthenticated() && Auth.isMaster() && order.status === ORDER_STATUS.OPEN;

        return `
            <div class="order-card mb-3">
                <div class="order-header">
                    <h5 class="order-title">${Utils.escapeHtml(order.title || 'Заказ')}</h5>
                    <span class="order-price">${Utils.formatMoney(order.price)}</span>
                </div>
                
                <p class="order-description">${Utils.truncate(Utils.escapeHtml(order.description || ''), 150)}</p>
                
                ${order.photos?.length ? `
                    <div class="d-flex gap-2 mb-3">
                        ${order.photos.slice(0, 3).map(url => 
                            `<img src="${url}" class="order-photo-thumb" onclick="window.open('${url}')" loading="lazy">`
                        ).join('')}
                        ${order.photos.length > 3 ? `<span class="text-secondary">+${order.photos.length-3}</span>` : ''}
                    </div>
                ` : ''}
                
                <div class="order-meta">
                    <span><i class="fas ${category.icon} me-1"></i>${category.name}</span>
                    <span><i class="fas fa-map-marker-alt me-1"></i>Нягань</span>
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
            Utils.showNotification('✅ Отклик отправлен!', 'success');
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
                address: $('address').value + ', Нягань', // Автоматически добавляем Нягань
                photos: uploadedPhotos
            };

            // Валидация
            if (!formData.category) {
                Utils.showNotification('Выберите категорию', 'warning');
                return;
            }

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
        $('headerLogoutBtn')?.addEventListener('click', (e) => {
            e.preventDefault();
            Auth.logout();
        });
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
                div.style.display = 'inline-block';
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

    // Экспортируем функцию для перезагрузки (может пригодиться)
    window.reloadOrders = loadOrders;
})();