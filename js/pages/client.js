// ===== CLIENT.JS — Логика кабинета клиента =====

(function() {
    // Состояние страницы
    let currentRating = 0;
    let currentOrderId = null;
    let currentMasterId = null;
    let reviewModal = null;

    // Инициализация при загрузке
    document.addEventListener('DOMContentLoaded', () => {
        // Подписываемся на изменения авторизации
        Auth.onAuthChange(async (state) => {
            const authRequired = document.getElementById('authRequired');
            const clientCabinet = document.getElementById('clientCabinet');
            
            if (state.isAuthenticated && state.isClient) {
                // Показать кабинет клиента
                authRequired?.classList.add('d-none');
                clientCabinet?.classList.remove('d-none');
                
                // Заполнить профиль
                document.getElementById('clientName').innerText = state.userData?.name || 'Клиент';
                document.getElementById('clientEmail').innerText = state.user?.email || '';
                
                // Загрузить данные
                await Promise.all([
                    loadClientOrders('all'),
                    loadFavorites(),
                    loadHistory()
                ]);
                
            } else if (state.isAuthenticated && !state.isClient) {
                // Если пользователь не клиент
                Helpers.showNotification('Эта страница только для клиентов', 'warning');
                setTimeout(() => window.location.href = 'index.html', 2000);
                
            } else {
                // Показать блок авторизации
                authRequired?.classList.remove('d-none');
                clientCabinet?.classList.add('d-none');
            }
        });

        // Инициализация модалки
        const modalElement = document.getElementById('reviewModal');
        if (modalElement) {
            reviewModal = new bootstrap.Modal(modalElement);
        }

        // Инициализация обработчиков
        initEventListeners();
    });

    // Инициализация обработчиков событий
    function initEventListeners() {
        // Переключение табов
        document.querySelectorAll('.tab').forEach(btn => {
            btn.addEventListener('click', function() {
                document.querySelectorAll('.tab').forEach(b => {
                    b.classList.remove('active');
                });
                this.classList.add('active');
                
                document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
                const tabId = this.dataset.tab + 'Tab';
                document.getElementById(tabId)?.classList.add('active');
            });
        });

        // Фильтры заказов
        document.querySelectorAll('.filter-tab').forEach(tab => {
            tab.addEventListener('click', function() {
                document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
                this.classList.add('active');
                loadClientOrders(this.dataset.filter);
            });
        });

        // Выход
        document.getElementById('logoutLink')?.addEventListener('click', (e) => {
            e.preventDefault();
            Auth.logout().then(() => {
                window.location.href = 'index.html';
            });
        });

        // Навигация по табам через ссылки
        document.getElementById('favoritesLink')?.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelector('[data-tab="favorites"]')?.click();
        });

        document.getElementById('historyLink')?.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelector('[data-tab="history"]')?.click();
        });

        // Отправка отзыва
        document.getElementById('submitReview')?.addEventListener('click', submitReview);

        // Звезды рейтинга
        document.querySelectorAll('.rating-star').forEach(star => {
            star.addEventListener('click', function() {
                currentRating = parseInt(this.dataset.rating);
                document.querySelectorAll('.rating-star').forEach(s => s.classList.remove('active'));
                for (let i = 0; i < currentRating; i++) {
                    document.querySelectorAll('.rating-star')[i].classList.add('active');
                }
            });
        });

        // Темная тема
        document.getElementById('themeToggle')?.addEventListener('click', Auth.toggleTheme);
    }

    // Загрузка заказов клиента
    async function loadClientOrders(filter = 'all') {
        const ordersList = document.getElementById('ordersList');
        if (!ordersList) return;
        
        ordersList.innerHTML = '<div class="text-center p-5"><i class="fas fa-spinner fa-spin fa-3x"></i></div>';
        
        try {
            const user = Auth.getUser();
            if (!user) return;
            
            const orders = await Orders.getClientOrders(user.uid, filter);
            
            if (orders.length === 0) {
                ordersList.innerHTML = `
                    <div class="text-center p-5">
                        <i class="fas fa-clipboard-list fa-3x mb-3" style="color: var(--border);"></i>
                        <h4>У вас пока нет заказов</h4>
                        <p class="text-secondary mb-4">Создайте первую заявку</p>
                        <a href="index.html" class="btn">Создать заявку</a>
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

    // Создание карточки заказа
    function createOrderCard(order) {
        const div = document.createElement('div');
        div.className = 'order-item';
        
        // Статус
        const statusConfig = {
            'open': { class: 'badge-warning', text: '🔵 Активна' },
            'in_progress': { class: 'badge-info', text: '🟢 В работе' },
            'completed': { class: 'badge-success', text: '✅ Выполнена' }
        };
        
        const status = statusConfig[order.status] || statusConfig.open;
        
        // Фото
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
        
        // Отклики мастеров
        let responsesHtml = '';
        if (order.responses?.length > 0) {
            responsesHtml = '<div class="mt-4"><h6 class="mb-3">📩 Отклики мастеров</h6>';
            
            order.responses.forEach(resp => {
                const hasReview = order.reviews?.some(r => r?.masterId === resp?.masterId);
                const isSelected = order.selectedMasterId === resp?.masterId;
                
                responsesHtml += `
                    <div class="card mb-3 p-4">
                        <div class="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
                            <div>
                                <span class="fw-bold">${Helpers.escapeHtml(resp.masterName || 'Мастер')}</span>
                                <span class="badge badge-info ms-2">
                                    ⭐ ${(resp.masterRating || 0).toFixed(1)} (${resp.masterReviews || 0})
                                </span>
                            </div>
                            <span class="fw-bold" style="color: var(--accent);">${resp.price || 0} ₽</span>
                        </div>
                        <p class="text-secondary mb-3">${Helpers.escapeHtml(resp.comment || '')}</p>
                        <div class="d-flex gap-2 flex-wrap">
                            <button onclick="window.openChat('${order.id}', '${resp.masterId}')" class="btn btn-outline-secondary">
                                <i class="fas fa-comment me-2"></i>Чат
                            </button>
                            
                            ${order.status === 'open' && !isSelected ? `
                                <button onclick="window.selectMaster('${order.id}', '${resp.masterId}', ${resp.price || 0})" class="btn btn-success">
                                    <i class="fas fa-check me-2"></i>Выбрать
                                </button>
                            ` : ''}
                            
                            ${order.status === 'completed' && !hasReview ? `
                                <button onclick="window.openReview('${order.id}', '${resp.masterId}', '${Helpers.escapeHtml(resp.masterName || 'Мастер')}')" class="btn btn-outline-secondary">
                                    <i class="fas fa-star me-2"></i>Оценить
                                </button>
                            ` : ''}
                            
                            <button class="btn btn-outline-secondary" onclick="Auth.addToFavorites('${resp.masterId}')">
                                <i class="fas fa-heart"></i>
                            </button>
                        </div>
                    </div>
                `;
            });
            responsesHtml += '</div>';
        }
        
        div.innerHTML = `
            <div class="order-header">
                <div>
                    <h4 class="order-title d-inline">${Helpers.escapeHtml(order.title || 'Заказ')}</h4>
                    <span class="badge ${status.class} ms-2">${status.text}</span>
                </div>
                <span class="order-price">${order.price || 0} ₽</span>
            </div>
            <p class="text-secondary mb-3">${Helpers.escapeHtml(order.description || '')}</p>
            ${photosHtml}
            <div class="order-meta mb-3">
                <span>
                    <i class="fas ${Helpers.getCategoryIcon(order.category)}"></i>
                    ${order.category || 'Без категории'}
                </span>
                <span>
                    <i class="fas fa-map-marker-alt"></i>
                    ${Helpers.escapeHtml(order.address || 'Адрес не указан')}
                </span>
            </div>
            ${responsesHtml}
        `;
        
        return div;
    }

    // Загрузка избранного
    async function loadFavorites() {
        const favoritesList = document.getElementById('favoritesList');
        if (!favoritesList) return;
        
        try {
            const favorites = await Auth.getFavorites();
            
            if (favorites.length === 0) {
                favoritesList.innerHTML = `
                    <div class="text-center p-5">
                        <i class="fas fa-star fa-3x mb-3" style="color: var(--border);"></i>
                        <h4>Нет избранных мастеров</h4>
                        <p class="text-secondary">Добавляйте мастеров в избранное после заказов</p>
                    </div>
                `;
                return;
            }
            
            let html = '';
            favorites.forEach(master => {
                const stars = '★'.repeat(Math.floor(master.rating || 0)) + 
                             '☆'.repeat(5 - Math.floor(master.rating || 0));
                
                html += `
                    <div class="master-card mb-3">
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <h5 class="mb-1">${Helpers.escapeHtml(master.name || 'Мастер')}</h5>
                                <p class="text-secondary mb-2">${Helpers.escapeHtml(master.categories || 'Специалист')}</p>
                                <div class="mb-2">
                                    <span class="rating-stars">${stars}</span>
                                    <span class="text-secondary ms-2">${master.reviews || 0} отзывов</span>
                                </div>
                                <p><i class="fas fa-phone me-2"></i>${master.phone || 'Телефон не указан'}</p>
                            </div>
                            <div>
                                <button class="btn btn-outline-danger" onclick="Auth.removeFromFavorites('${master.id}')">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            });
            favoritesList.innerHTML = html;
            
        } catch (error) {
            console.error('❌ Ошибка загрузки избранного:', error);
            favoritesList.innerHTML = '<div class="text-center p-5 text-danger">Ошибка загрузки</div>';
        }
    }

    // Загрузка истории просмотров
    async function loadHistory() {
        const historyList = document.getElementById('historyList');
        if (!historyList) return;
        
        try {
            const user = Auth.getUser();
            if (!user) return;
            
            const userDoc = await db.collection('users').doc(user.uid).get();
            const viewedOrders = userDoc.data()?.viewedOrders || [];
            
            if (viewedOrders.length === 0) {
                historyList.innerHTML = `
                    <div class="text-center p-5">
                        <i class="fas fa-history fa-3x mb-3" style="color: var(--border);"></i>
                        <h4>История просмотров пуста</h4>
                    </div>
                `;
                return;
            }
            
            historyList.innerHTML = '<div class="text-center p-5"><i class="fas fa-spinner fa-spin fa-3x"></i></div>';
            
            const sortedViews = viewedOrders.sort((a, b) => 
                new Date(b.viewedAt) - new Date(a.viewedAt)
            ).slice(0, 20);
            
            let html = '';
            for (const view of sortedViews) {
                const orderDoc = await db.collection('orders').doc(view.orderId).get();
                if (orderDoc.exists) {
                    const order = orderDoc.data();
                    html += `
                        <div class="card p-3 mb-2">
                            <div class="d-flex justify-content-between align-items-center">
                                <div>
                                    <h6 class="mb-1">${Helpers.escapeHtml(order.title || 'Заказ')}</h6>
                                    <small class="text-secondary">${order.price || 0} ₽ · ${order.category || ''}</small>
                                </div>
                                <small class="text-secondary">${new Date(view.viewedAt).toLocaleDateString()}</small>
                            </div>
                        </div>
                    `;
                }
            }
            historyList.innerHTML = html;
            
        } catch (error) {
            console.error('❌ Ошибка загрузки истории:', error);
            historyList.innerHTML = '<div class="text-center p-5 text-danger">Ошибка загрузки</div>';
        }
    }

    // Глобальные функции
    window.selectMaster = async (orderId, masterId, price) => {
        if (!confirm('Вы уверены, что хотите выбрать этого мастера?')) return;
        
        const result = await Orders.selectMaster(orderId, masterId, price);
        if (result.success) {
            const activeFilter = document.querySelector('.filter-tab.active')?.dataset.filter || 'all';
            await loadClientOrders(activeFilter);
        }
    };

    window.openChat = (orderId, masterId) => {
        window.location.href = `chat.html?orderId=${orderId}&masterId=${masterId}`;
    };

    window.openReview = (orderId, masterId, masterName) => {
        currentOrderId = orderId;
        currentMasterId = masterId;
        currentRating = 0;
        
        document.getElementById('reviewMasterInfo').innerHTML = `<p class="fw-bold mb-0">Мастер: ${Helpers.escapeHtml(masterName)}</p>`;
        document.getElementById('reviewText').value = '';
        
        document.querySelectorAll('.rating-star').forEach(s => s.classList.remove('active'));
        
        reviewModal?.show();
    };

    // Отправка отзыва
    async function submitReview() {
        if (!currentRating) {
            alert('Поставьте оценку!');
            return;
        }
        
        try {
            const review = {
                masterId: currentMasterId,
                rating: currentRating,
                text: document.getElementById('reviewText').value || '',
                createdAt: new Date().toISOString()
            };

            await db.collection('orders').doc(currentOrderId).update({
                reviews: firebase.firestore.FieldValue.arrayUnion(review)
            });

            // Обновляем рейтинг мастера
            const masterDoc = await db.collection('users').doc(currentMasterId).get();
            if (masterDoc.exists) {
                const masterData = masterDoc.data();
                const newRating = ((masterData.rating || 0) * (masterData.reviews || 0) + currentRating) / ((masterData.reviews || 0) + 1);
                
                await db.collection('users').doc(currentMasterId).update({
                    rating: newRating,
                    reviews: (masterData.reviews || 0) + 1
                });
            }

            reviewModal?.hide();
            Helpers.showNotification('✅ Отзыв отправлен!', 'success');
            
            const activeFilter = document.querySelector('.filter-tab.active')?.dataset.filter || 'all';
            await loadClientOrders(activeFilter);
            
        } catch (error) {
            console.error('❌ Ошибка при отправке отзыва:', error);
            Helpers.showNotification('❌ Ошибка при отправке отзыва', 'error');
        }
    }
})();