(function() {
    // Состояние
    let currentFilter = 'all';
    let allResponses = [];
    let currentOrderId = null;
    let currentClientId = null;
    let currentRating = 0;

    // DOM элементы
    const $ = (id) => document.getElementById(id);

    // Инициализация
    document.addEventListener('DOMContentLoaded', () => {
        Auth.onAuthChange(async (state) => {
            const authRequired = $('authRequired');
            const masterCabinet = $('masterCabinet');

            if (state.isAuthenticated && state.userData) {
                if (state.isMaster) {
                    authRequired?.classList.add('d-none');
                    masterCabinet?.classList.remove('d-none');
                    
                    await loadMasterProfile();
                    await loadMasterResponses('all');
                    await loadChats();
                } else {
                    Utils.showNotification('❌ Эта страница только для мастеров', 'warning');
                    setTimeout(() => window.location.href = '/HomeWork/', 2000);
                }
            } else if (state.isAuthenticated && !state.userData) {
                console.log('⏳ Ожидание данных...');
            } else {
                authRequired?.classList.remove('d-none');
                masterCabinet?.classList.add('d-none');
            }
        });

        initEventListeners();
    });

    // Загрузка профиля
    async function loadMasterProfile() {
        const userData = Auth.getUserData();
        if (!userData) return;

        $('masterName').textContent = userData.name || 'Мастер';
        $('masterCategories').textContent = userData.categories || 'Специалист';
        $('masterRating').textContent = (userData.rating || 0).toFixed(1);
        $('masterReviews').textContent = userData.reviews || 0;
        
        // Статистика
        const stats = await Orders.getMasterStats(Auth.getUser().uid);
        $('masterCompleted').textContent = stats.completed;
    }

    // Загрузка откликов
    async function loadMasterResponses(filter = 'all') {
        currentFilter = filter;
        
        const responsesList = $('responsesList');
        responsesList.innerHTML = '<div class="text-center p-5"><div class="spinner-border"></div><p class="mt-2">Загрузка...</p></div>';

        try {
            const user = Auth.getUser();
            if (!user) return;

            const responses = await Orders.getMasterResponses(user.uid);
            
            let filtered = responses;
            if (filter === 'pending') {
                filtered = responses.filter(r => r.status === ORDER_STATUS.OPEN);
            } else if (filter === 'accepted') {
                filtered = responses.filter(r => r.status === ORDER_STATUS.IN_PROGRESS);
            } else if (filter === 'completed') {
                filtered = responses.filter(r => r.status === ORDER_STATUS.COMPLETED);
            }
            
            allResponses = filtered;

            if (filtered.length === 0) {
                responsesList.innerHTML = `
                    <div class="text-center p-5">
                        <i class="fas fa-inbox fa-3x mb-3" style="color: var(--border);"></i>
                        <h5>Нет откликов</h5>
                        <a href="/HomeWork/" class="btn btn-primary mt-3">Найти заказы</a>
                    </div>
                `;
                return;
            }

            responsesList.innerHTML = filtered.map(item => createResponseCard(item)).join('');
        } catch (error) {
            console.error('Ошибка загрузки откликов:', error);
            responsesList.innerHTML = '<div class="text-center p-5 text-danger">Ошибка загрузки</div>';
        }
    }

    // Создание карточки отклика
    function createResponseCard(item) {
        const order = item.order;
        const response = item.response;
        
        const statusConfig = {
            'open': { class: 'bg-warning', text: '⏳ Ожидает' },
            'in_progress': { class: 'bg-primary', text: '🔨 В работе' },
            'completed': { class: 'bg-success', text: '✅ Выполнен' }
        };
        
        const status = statusConfig[item.status] || statusConfig.open;

        return `
            <div class="order-card">
                <div class="order-header">
                    <h5 class="order-title">${Utils.escapeHtml(order.title || 'Заказ')}</h5>
                    <span class="order-price">${Utils.formatMoney(response.price)}</span>
                </div>
                
                <p class="order-description">${Utils.truncate(Utils.escapeHtml(order.description || ''), 100)}</p>
                
                <div class="order-meta">
                    <span><i class="fas fa-tag me-1"></i>${order.category || 'Без категории'}</span>
                    <span><i class="fas fa-map-marker-alt me-1"></i>${Utils.escapeHtml(order.address || '')}</span>
                </div>
                
                <div class="d-flex justify-content-between align-items-center mt-3">
                    <span class="badge ${status.class}">${status.text}</span>
                    
                    ${response.comment ? `<small class="text-secondary">${Utils.escapeHtml(response.comment)}</small>` : ''}
                </div>
                
                <div class="d-flex gap-2 mt-3">
                    ${item.status === ORDER_STATUS.OPEN ? `
                        <button class="btn btn-sm btn-outline-secondary" disabled>Ожидает ответа</button>
                    ` : ''}
                    
                    ${item.status === ORDER_STATUS.IN_PROGRESS ? `
                        <button class="btn btn-sm btn-success" onclick="openChat('${item.orderId}', '${order.clientId}')">
                            <i class="fas fa-comment me-1"></i>Чат
                        </button>
                        <button class="btn btn-sm btn-primary" onclick="showCompleteOrderModal('${item.orderId}', '${order.clientName || 'Клиент'}')">
                            <i class="fas fa-check-double me-1"></i>Завершить
                        </button>
                    ` : ''}
                    
                    ${item.status === ORDER_STATUS.COMPLETED ? `
                        <button class="btn btn-sm btn-outline-secondary" onclick="openChat('${item.orderId}', '${order.clientId}')">
                            <i class="fas fa-comment me-1"></i>Чат
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }

    // Открыть чат
    window.openChat = (orderId, clientId) => {
        const user = Auth.getUser();
        const chatId = `chat_${orderId}_${user.uid}`;
        window.location.href = `/HomeWork/chat.html?chatId=${chatId}`;
    };

    // Показать модалку завершения заказа
    window.showCompleteOrderModal = (orderId, clientName) => {
        currentOrderId = orderId;
        currentClientId = clientName;
        currentRating = 0;
        
        const modal = new bootstrap.Modal($('reviewClientModal'));
        
        document.querySelectorAll('#reviewClientModal .star').forEach(s => s.classList.remove('active'));
        $('reviewClientText').value = '';
        
        modal.show();
    };

    // Завершение заказа с отзывом
    async function completeOrderWithReview() {
        if (!currentRating) {
            Utils.showNotification('Поставьте оценку клиенту', 'warning');
            return;
        }

        const reviewText = $('reviewClientText')?.value || '';
        
        const result = await Orders.completeOrder(currentOrderId, {
            rating: currentRating,
            text: reviewText
        });
        
        if (result.success) {
            bootstrap.Modal.getInstance($('reviewClientModal')).hide();
            await loadMasterResponses(currentFilter);
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
                    </div>
                `;
                return;
            }

            chatsList.innerHTML = chats.map(chat => `
                <div class="chat-card" onclick="window.location.href='/HomeWork/chat.html?chatId=${chat.id}'">
                    <div class="chat-avatar">
                        <i class="fas fa-user"></i>
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
        // Фильтры откликов
        document.querySelectorAll('.filter-btn[data-filter]').forEach(btn => {
            btn.addEventListener('click', function() {
                document.querySelectorAll('.filter-btn[data-filter]').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                loadMasterResponses(this.dataset.filter);
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

        // Звёзды в модалке отзыва о клиенте
        document.querySelectorAll('#reviewClientModal .star').forEach(star => {
            star.addEventListener('click', function() {
                const rating = parseInt(this.dataset.rating);
                currentRating = rating;
                
                document.querySelectorAll('#reviewClientModal .star').forEach((s, i) => {
                    if (i < rating) s.classList.add('active');
                    else s.classList.remove('active');
                });
            });
        });

        // Отправка отзыва о клиенте
        $('submitClientReview')?.addEventListener('click', completeOrderWithReview);

        // Выход
        $('logoutLink')?.addEventListener('click', (e) => {
            e.preventDefault();
            Auth.logout();
        });

        // Тема
        $('themeToggle')?.addEventListener('click', Auth.toggleTheme);
    }
})();