(function() {
    // Состояние
    let currentFilter = 'all';
    let allOrders = [];
    let currentOrderId = null;
    let currentMasterId = null;
    let currentRating = 0;

    // DOM элементы
    const $ = (id) => document.getElementById(id);

    // Инициализация
    document.addEventListener('DOMContentLoaded', () => {
        Auth.onAuthChange(async (state) => {
            const authRequired = $('authRequired');
            const clientCabinet = $('clientCabinet');
            const welcomeBanner = $('welcomeBanner');

            if (state.isAuthenticated && state.userData) {
                if (state.isClient) {
                    authRequired?.classList.add('d-none');
                    clientCabinet?.classList.remove('d-none');
                    welcomeBanner?.classList.remove('d-none');
                    
                    await loadClientProfile();
                    await loadClientOrders('all');
                    await loadChats();
                } else {
                    Utils.showNotification('❌ Эта страница только для клиентов', 'warning');
                    setTimeout(() => window.location.href = '/HomeWork/', 2000);
                }
            } else if (state.isAuthenticated && !state.userData) {
                // Данные ещё загружаются
                console.log('⏳ Ожидание данных...');
            } else {
                authRequired?.classList.remove('d-none');
                clientCabinet?.classList.add('d-none');
                welcomeBanner?.classList.add('d-none');
            }
        });

        initEventListeners();
    });

    // Загрузка профиля
    async function loadClientProfile() {
        const userData = Auth.getUserData();
        if (!userData) return;

        $('clientName').textContent = userData.name || 'Клиент';
        $('welcomeName').textContent = userData.name || 'Клиент';
        $('clientEmail').textContent = userData.email || '';
        $('clientPhone').textContent = userData.phone || 'Телефон не указан';
        $('clientRating').textContent = (userData.rating || 0).toFixed(1);
        $('clientReviews').textContent = userData.reviews || 0;
    }

    // Загрузка заказов
    async function loadClientOrders(filter = 'all') {
        currentFilter = filter;
        
        const ordersList = $('ordersList');
        ordersList.innerHTML = '<div class="text-center p-5"><div class="spinner-border"></div><p class="mt-2">Загрузка...</p></div>';

        try {
            const user = Auth.getUser();
            if (!user) return;

            const orders = await Orders.getClientOrders(user.uid, filter);
            allOrders = orders;
            
            $('clientOrdersCount').textContent = orders.length;

            if (orders.length === 0) {
                ordersList.innerHTML = `
                    <div class="text-center p-5">
                        <i class="fas fa-clipboard-list fa-3x mb-3" style="color: var(--border);"></i>
                        <h5>Нет заказов</h5>
                        <a href="/HomeWork/" class="btn btn-primary mt-3">Создать заказ</a>
                    </div>
                `;
                return;
            }

            ordersList.innerHTML = orders.map(order => createOrderCard(order)).join('');
        } catch (error) {
            console.error('Ошибка загрузки заказов:', error);
            ordersList.innerHTML = '<div class="text-center p-5 text-danger">Ошибка загрузки</div>';
        }
    }

    // Создание карточки заказа
    function createOrderCard(order) {
        const statusText = {
            'open': '🔵 Активен',
            'in_progress': '🟠 В работе',
            'completed': '✅ Завершён'
        }[order.status] || order.status;

        const hasResponses = order.responses && order.responses.length > 0;
        const hasMaster = !!order.selectedMasterId;

        return `
            <div class="order-card">
                <div class="order-header">
                    <h5 class="order-title">${Utils.escapeHtml(order.title || 'Заказ')}</h5>
                    <span class="order-price">${Utils.formatMoney(order.price)}</span>
                </div>
                
                <p class="order-description">${Utils.truncate(Utils.escapeHtml(order.description || ''), 100)}</p>
                
                <div class="order-meta">
                    <span><i class="fas fa-tag me-1"></i>${order.category || 'Без категории'}</span>
                    <span><i class="fas fa-map-marker-alt me-1"></i>${Utils.escapeHtml(order.address || '')}</span>
                    <span><i class="fas fa-calendar me-1"></i>${Utils.formatDate(order.createdAt)}</span>
                </div>
                
                <div class="d-flex justify-content-between align-items-center mt-3">
                    <span class="badge ${order.status === 'completed' ? 'bg-success' : 'bg-primary'}">${statusText}</span>
                    
                    ${order.status === 'open' && hasResponses ? 
                        `<button class="btn btn-sm btn-outline-primary" onclick="toggleResponses('${order.id}')">
                            <i class="fas fa-users me-1"></i>Отклики (${order.responses.length})
                        </button>` : ''}
                    
                    ${order.status === 'in_progress' && hasMaster ?
                        `<button class="btn btn-sm btn-outline-primary" onclick="openChat('${order.id}', '${order.selectedMasterId}')">
                            <i class="fas fa-comment me-1"></i>Чат
                        </button>` : ''}
                </div>
                
                ${order.status === 'open' && hasResponses ? `
                    <div id="responses-${order.id}" class="responses-list mt-3" style="display: none;">
                        ${order.responses.map(response => createResponseCard(order, response)).join('')}
                    </div>
                ` : ''}
            </div>
        `;
    }

    // Создание карточки отклика
    function createResponseCard(order, response) {
        const isSelected = order.selectedMasterId === response.masterId;
        
        return `
            <div class="response-card ${isSelected ? 'border-success' : ''}">
                <div class="response-header">
                    <span class="response-master">${Utils.escapeHtml(response.masterName || 'Мастер')}</span>
                    <span class="response-price">${Utils.formatMoney(response.price)}</span>
                </div>
                
                ${response.comment ? `<p class="small text-secondary mb-2">${Utils.escapeHtml(response.comment)}</p>` : ''}
                
                <div class="d-flex justify-content-between align-items-center">
                    <small class="text-muted">${Utils.formatDate(response.createdAt)}</small>
                    
                    ${order.status === ORDER_STATUS.OPEN && !isSelected ? `
                        <button class="btn btn-sm btn-success" onclick="selectMaster('${order.id}', '${response.masterId}', ${response.price})">
                            Выбрать
                        </button>
                    ` : ''}
                    
                    ${order.status === ORDER_STATUS.COMPLETED && !hasReview(order, response.masterId) ? `
                        <button class="btn btn-sm btn-warning" onclick="openReviewModal('${order.id}', '${response.masterId}', '${response.masterName}')">
                            Оценить
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }

    // Проверка, оставлен ли отзыв
    function hasReview(order, masterId) {
        return order.reviews?.some(r => r.masterId === masterId) || false;
    }

    // Показать/скрыть отклики
    window.toggleResponses = (orderId) => {
        const el = $(`responses-${orderId}`);
        if (el) {
            el.style.display = el.style.display === 'none' ? 'block' : 'none';
        }
    };

    // Выбор мастера
    window.selectMaster = async (orderId, masterId, price) => {
        if (!confirm('Вы уверены, что хотите выбрать этого мастера?')) return;

        const result = await Orders.selectMaster(orderId, masterId, price);
        
        if (result.success) {
            Utils.showNotification('✅ Мастер выбран!', 'success');
            await loadClientOrders(currentFilter);
            
            if (result.chatId) {
                setTimeout(() => {
                    window.location.href = `/HomeWork/chat.html?chatId=${result.chatId}`;
                }, 1000);
            }
        }
    };

    // Открыть чат
    window.openChat = (orderId, masterId) => {
        const chatId = `chat_${orderId}_${masterId}`;
        window.location.href = `/HomeWork/chat.html?chatId=${chatId}`;
    };

    // Открыть модалку отзыва
    window.openReviewModal = (orderId, masterId, masterName) => {
        currentOrderId = orderId;
        currentMasterId = masterId;
        currentRating = 0;
        
        const modal = new bootstrap.Modal($('reviewModal'));
        
        // Сброс звёзд
        document.querySelectorAll('#reviewModal .star').forEach(s => s.classList.remove('active'));
        $('reviewText').value = '';
        
        modal.show();
    };

    // Отправка отзыва
    async function submitReview() {
        if (!currentRating) {
            Utils.showNotification('Поставьте оценку!', 'warning');
            return;
        }

        const reviewText = $('reviewText')?.value || '';
        const user = Auth.getUser();
        const userData = Auth.getUserData();

        try {
            const review = {
                clientId: user.uid,
                clientName: userData?.name || 'Клиент',
                masterId: currentMasterId,
                rating: currentRating,
                text: reviewText,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            await db.collection('orders').doc(currentOrderId).update({
                reviews: firebase.firestore.FieldValue.arrayUnion(review)
            });

            // Обновляем рейтинг мастера
            const masterDoc = await db.collection('users').doc(currentMasterId).get();
            if (masterDoc.exists) {
                const masterData = masterDoc.data();
                const currentRating = masterData.rating || 0;
                const currentReviews = masterData.reviews || 0;
                const newRating = ((currentRating * currentReviews) + currentRating) / (currentReviews + 1);
                
                await db.collection('users').doc(currentMasterId).update({
                    rating: newRating,
                    reviews: currentReviews + 1
                });
            }

            bootstrap.Modal.getInstance($('reviewModal')).hide();
            Utils.showNotification('✅ Спасибо за отзыв!', 'success');
            
            await loadClientOrders(currentFilter);
        } catch (error) {
            console.error('Ошибка при отправке отзыва:', error);
            Utils.showNotification('❌ Ошибка', 'error');
        }
    }

    // Загрузка чатов
    async function loadChats() {
        const chatsList = $('chatsList');
        if (!chatsList) return;

        try {
            const user = Auth.getUser();
            if (!user) return;

            const chats = await Chat.getUserChats(user.uid);
            
            if (chats.length === 0) {
                chatsList.innerHTML = `
                    <div class="text-center p-5">
                        <i class="fas fa-comments fa-3x mb-3" style="color: var(--border);"></i>
                        <h5>Нет активных чатов</h5>
                        <p class="text-secondary">Начните общение после выбора мастера</p>
                    </div>
                `;
                return;
            }

            chatsList.innerHTML = chats.map(chat => `
                <div class="chat-card" onclick="window.location.href='/HomeWork/chat.html?chatId=${chat.id}'">
                    <div class="chat-avatar">
                        <i class="fas ${chat.partnerRole === 'master' ? 'fa-user-tie' : 'fa-user'}"></i>
                    </div>
                    <div class="chat-info">
                        <div class="chat-name">${Utils.escapeHtml(chat.partnerName)}</div>
                        <div class="chat-last-message">${Utils.truncate(chat.lastMessage || 'Нет сообщений', 40)}</div>
                    </div>
                    <div class="chat-meta text-end">
                        <div class="chat-time small text-secondary">${Utils.formatDate(chat.lastMessageAt)}</div>
                        ${chat.unreadCount > 0 ? `<span class="chat-unread">${chat.unreadCount}</span>` : ''}
                    </div>
                </div>
            `).join('');
        } catch (error) {
            console.error('Ошибка загрузки чатов:', error);
        }
    }

    // Инициализация обработчиков
    function initEventListeners() {
        // Фильтры заказов
        document.querySelectorAll('.filter-btn[data-filter]').forEach(btn => {
            btn.addEventListener('click', function() {
                document.querySelectorAll('.filter-btn[data-filter]').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                loadClientOrders(this.dataset.filter);
            });
        });

        // Табы
        document.querySelectorAll('.nav-link[data-tab]').forEach(btn => {
            btn.addEventListener('click', function() {
                document.querySelectorAll('.nav-link').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                
                document.querySelectorAll('.tab-content').forEach(t => t.classList.add('d-none'));
                $(this.dataset.tab + 'Tab')?.classList.remove('d-none');
                
                if (this.dataset.tab === 'chats') {
                    loadChats();
                }
            });
        });

        // Звёзды рейтинга
        document.querySelectorAll('#reviewModal .star').forEach(star => {
            star.addEventListener('click', function() {
                const rating = parseInt(this.dataset.rating);
                currentRating = rating;
                
                document.querySelectorAll('#reviewModal .star').forEach((s, i) => {
                    if (i < rating) s.classList.add('active');
                    else s.classList.remove('active');
                });
            });
        });

        // Отправка отзыва
        $('submitReview')?.addEventListener('click', submitReview);

        // Выход
        $('logoutLink')?.addEventListener('click', (e) => {
            e.preventDefault();
            Auth.logout();
        });

        // Тема
        $('themeToggle')?.addEventListener('click', Auth.toggleTheme);
    }
})();