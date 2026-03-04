/**
 * masters.js — логика кабинета мастера
 * Версия 3.0 с поддержкой новой навигации и кнопкой выхода
 */

(function() {
    // ===== СОСТОЯНИЕ =====
    let currentFilter = 'all';
    let allResponses = [];
    let currentOrderId = null;
    let currentClientId = null;
    let currentClientName = '';
    let currentRating = 0;

    // ===== DOM ЭЛЕМЕНТЫ =====
    const $ = (id) => document.getElementById(id);

    // ===== ИНИЦИАЛИЗАЦИЯ =====
    document.addEventListener('DOMContentLoaded', () => {
        console.log('🚀 Masters.js загружен');
        
        Auth.onAuthChange(async (state) => {
            console.log('🔄 Auth state changed:', state);
            
            const authRequired = $('authRequired');
            const masterCabinet = $('masterCabinet');

            if (state.isAuthenticated && state.userData) {
                if (state.isMaster) {
                    authRequired?.classList.add('d-none');
                    masterCabinet?.classList.remove('d-none');
                    
                    await loadMasterProfile();
                    await loadMasterResponses('all');
                    await loadChats();
                    
                    if (window.BottomNav) {
                        BottomNav.highlightActive();
                    }
                    
                    checkUrlParams();
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
        
        const urlParams = new URLSearchParams(window.location.search);
        const respondOrderId = urlParams.get('respond');
        if (respondOrderId) {
            loadOrderForResponse(respondOrderId);
        }
    });

    // ===== ПРОВЕРКА ПАРАМЕТРОВ URL =====
    function checkUrlParams() {
        const urlParams = new URLSearchParams(window.location.search);
        const tabParam = urlParams.get('tab');
        
        if (tabParam === 'chats') {
            setTimeout(() => {
                switchTab('chats');
            }, 500);
        }
    }

    // ===== ЗАГРУЗКА ПРОФИЛЯ =====
    async function loadMasterProfile() {
        try {
            const userData = Auth.getUserData();
            if (!userData) return;

            $('masterName').textContent = userData.name || 'Мастер';
            $('masterCategories').textContent = userData.categories || 'Специалист';
            $('masterRating').textContent = (userData.rating || 0).toFixed(1);
            $('masterReviews').textContent = userData.reviews || 0;
            
            const stats = await Orders.getMasterStats(Auth.getUser()?.uid);
            $('masterCompleted').textContent = stats.completed || 0;
            
            const stars = '★'.repeat(Math.floor(userData.rating || 0)) + 
                         '☆'.repeat(5 - Math.floor(userData.rating || 0));
            $('masterRatingDisplay').innerHTML = `${stars} ${(userData.rating || 0).toFixed(1)}`;
            
        } catch (error) {
            console.error('❌ Ошибка загрузки профиля:', error);
        }
    }

    // ===== ЗАГРУЗКА ОТКЛИКОВ =====
    async function loadMasterResponses(filter = 'all') {
        currentFilter = filter;
        
        const responsesList = $('responsesList');
        if (!responsesList) return;

        responsesList.innerHTML = '<div class="text-center p-5"><div class="spinner-border"></div><p class="mt-2">Загрузка...</p></div>';

        try {
            const user = Auth.getUser();
            if (!user) return;

            const responses = await Orders.getMasterResponses(user.uid);
            allResponses = responses;
            
            let filtered = responses;
            if (filter === 'pending') {
                filtered = responses.filter(r => r.status === ORDER_STATUS.OPEN);
            } else if (filter === 'accepted') {
                filtered = responses.filter(r => r.status === ORDER_STATUS.IN_PROGRESS);
            } else if (filter === 'completed') {
                filtered = responses.filter(r => r.status === ORDER_STATUS.COMPLETED);
            }

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
            console.error('❌ Ошибка загрузки откликов:', error);
            responsesList.innerHTML = '<div class="text-center p-5 text-danger">Ошибка загрузки</div>';
        }
    }

    // ===== СОЗДАНИЕ КАРТОЧКИ ОТКЛИКА =====
    function createResponseCard(item) {
        const order = item.order || {};
        const response = item.response || {};
        
        const statusConfig = {
            'open': { class: 'bg-warning text-dark', text: '⏳ Ожидает', icon: 'fa-clock' },
            'in_progress': { class: 'bg-primary', text: '🔨 В работе', icon: 'fa-spinner fa-spin' },
            'completed': { class: 'bg-success', text: '✅ Выполнен', icon: 'fa-check-circle' }
        };
        
        const status = statusConfig[item.status] || statusConfig.open;

        return `
            <div class="order-card mb-3">
                <div class="order-header">
                    <h5 class="order-title">${Utils.escapeHtml(order.title || 'Заказ')}</h5>
                    <span class="order-price">${Utils.formatMoney(response.price || order.price)}</span>
                </div>
                
                <p class="order-description">${Utils.truncate(Utils.escapeHtml(order.description || ''), 100)}</p>
                
                ${order.photos?.length ? `
                    <div class="d-flex gap-2 mb-3">
                        ${order.photos.slice(0, 3).map(url => 
                            `<img src="${url}" class="order-photo-thumb" onclick="window.open('${url}')">`
                        ).join('')}
                    </div>
                ` : ''}
                
                <div class="order-meta">
                    <span><i class="fas fa-tag me-1"></i>${order.category || 'Без категории'}</span>
                    <span><i class="fas fa-map-marker-alt me-1"></i>${Utils.escapeHtml(order.address || '')}</span>
                    <span><i class="fas fa-user me-1"></i>${Utils.escapeHtml(order.clientName || 'Клиент')}</span>
                </div>
                
                <div class="d-flex justify-content-between align-items-center mt-3">
                    <span class="badge ${status.class}">
                        <i class="fas ${status.icon} me-1"></i>${status.text}
                    </span>
                    
                    ${response.comment ? 
                        `<small class="text-secondary"><i class="fas fa-comment me-1"></i>${Utils.escapeHtml(response.comment)}</small>` : 
                        ''}
                </div>
                
                <div class="d-flex gap-2 mt-3 flex-wrap">
                    ${item.status === ORDER_STATUS.OPEN ? `
                        <button class="btn btn-sm btn-outline-secondary" disabled>
                            <i class="fas fa-hourglass-half me-1"></i>Ожидает ответа
                        </button>
                    ` : ''}
                    
                    ${item.status === ORDER_STATUS.IN_PROGRESS ? `
                        <button class="btn btn-sm btn-primary" onclick="openChat('${item.orderId}', '${order.clientId}')">
                            <i class="fas fa-comment me-1"></i>Чат
                        </button>
                        <button class="btn btn-sm btn-success" onclick="showClientReviewModal('${item.orderId}', '${order.clientId}', '${Utils.escapeHtml(order.clientName || 'Клиент')}')">
                            <i class="fas fa-check-double me-1"></i>Завершить
                        </button>
                    ` : ''}
                    
                    ${item.status === ORDER_STATUS.COMPLETED ? `
                        <button class="btn btn-sm btn-outline-primary" onclick="openChat('${item.orderId}', '${order.clientId}')">
                            <i class="fas fa-comment me-1"></i>Чат
                        </button>
                        <span class="btn btn-sm btn-outline-success" disabled>
                            <i class="fas fa-check me-1"></i>Завершён
                        </span>
                    ` : ''}
                </div>
            </div>
        `;
    }

    // ===== ОТКРЫТЬ ЧАТ =====
    window.openChat = (orderId, clientId) => {
        const user = Auth.getUser();
        if (!user) return;
        
        const chatId = `chat_${orderId}_${user.uid}`;
        window.location.href = `/HomeWork/chat.html?chatId=${chatId}`;
    };

    // ===== ЗАГРУЗКА ЗАКАЗА ДЛЯ ОТКЛИКА =====
    async function loadOrderForResponse(orderId) {
        try {
            const order = await Orders.getOrderById(orderId);
            if (order) {
                showRespondModal(orderId, order.title, order.category, order.price);
            }
        } catch (error) {
            console.error('Ошибка загрузки заказа:', error);
        }
    }

    // ===== ПОКАЗ МОДАЛКИ ОТКЛИКА =====
    window.showRespondModal = (orderId, orderTitle, orderCategory, orderPrice) => {
        currentOrderId = orderId;

        const infoBlock = $('respondOrderInfo');
        infoBlock.classList.remove('d-none');
        $('respondOrderTitle').textContent = orderTitle || 'Заказ';
        $('respondOrderCategory').textContent = orderCategory || 'Категория';
        $('respondOrderPrice').textContent = Utils.formatMoney(orderPrice);

        $('responsePrice').value = '';
        $('responseComment').value = '';

        const modal = new bootstrap.Modal($('respondModal'));
        modal.show();
    };

    // ===== ОТПРАВКА ОТКЛИКА =====
    $('submitResponse')?.addEventListener('click', async () => {
        const price = parseInt($('responsePrice')?.value);
        const comment = $('responseComment')?.value || '';

        if (!price || price < 500) {
            Utils.showNotification('Введите цену (минимум 500 ₽)', 'warning');
            return;
        }

        if (price > 1000000) {
            Utils.showNotification('Цена не может превышать 1 000 000 ₽', 'warning');
            return;
        }

        const result = await Orders.respondToOrder(currentOrderId, price, comment);
        
        if (result && result.success) {
            bootstrap.Modal.getInstance($('respondModal'))?.hide();
            Utils.showNotification('✅ Отклик отправлен!', 'success');
            await loadMasterResponses(currentFilter);
        } else {
            Utils.showNotification(result?.error || '❌ Ошибка при отправке', 'error');
        }
    });

    // ===== ПОКАЗ МОДАЛКИ ОТЗЫВА О КЛИЕНТЕ =====
    window.showClientReviewModal = (orderId, clientId, clientName) => {
        currentOrderId = orderId;
        currentClientId = clientId;
        currentClientName = clientName;
        currentRating = 0;

        $('reviewClientName').textContent = clientName || 'Клиент';

        document.querySelectorAll('#clientRatingStars .star').forEach(s => s.classList.remove('active'));
        $('reviewClientText').value = '';

        const modal = new bootstrap.Modal($('reviewClientModal'));
        modal.show();
    };

    // ===== ОБРАБОТЧИК ЗВЁЗД =====
    document.querySelectorAll('#clientRatingStars .star').forEach(star => {
        star.addEventListener('click', function() {
            const rating = parseInt(this.dataset.rating);
            currentRating = rating;
            
            document.querySelectorAll('#clientRatingStars .star').forEach((s, i) => {
                if (i < rating) s.classList.add('active');
                else s.classList.remove('active');
            });
        });
    });

    // ===== ОТПРАВКА ОТЗЫВА О КЛИЕНТЕ =====
    $('submitClientReview')?.addEventListener('click', async () => {
        if (!currentRating) {
            Utils.showNotification('Поставьте оценку клиенту', 'warning');
            return;
        }

        const comment = $('reviewClientText')?.value || '';

        const result = await Orders.completeOrder(currentOrderId, {
            rating: currentRating,
            text: comment
        });
        
        if (result && result.success) {
            bootstrap.Modal.getInstance($('reviewClientModal'))?.hide();
            Utils.showNotification('✅ Заказ завершён! Отзыв оставлен', 'success');
            await loadMasterResponses(currentFilter);
            await loadMasterProfile();
        } else {
            Utils.showNotification(result?.error || '❌ Ошибка', 'error');
        }
    });

    // ===== ЗАГРУЗКА ЧАТОВ =====
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
                        <p class="text-secondary">Чаты появятся после выбора вас клиентом</p>
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
            console.error('❌ Ошибка загрузки чатов:', error);
            chatsList.innerHTML = '<div class="text-center p-5 text-danger">Ошибка загрузки</div>';
        }
    }

    // ===== ПЕРЕКЛЮЧЕНИЕ ТАБОВ =====
    function switchTab(tabName) {
        document.querySelectorAll('[data-tab]').forEach(btn => {
            if (btn.dataset.tab === tabName) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
        
        document.querySelectorAll('.tab-content').forEach(content => {
            if (content.id === tabName + 'Tab') {
                content.classList.remove('d-none');
            } else {
                content.classList.add('d-none');
            }
        });
        
        if (tabName === 'chats') {
            loadChats();
        }
        
        const url = new URL(window.location);
        url.searchParams.set('tab', tabName);
        window.history.replaceState({}, '', url);
    }

    // ===== ИНИЦИАЛИЗАЦИЯ ОБРАБОТЧИКОВ =====
    function initEventListeners() {
        document.querySelectorAll('[data-filter]').forEach(btn => {
            btn.addEventListener('click', function() {
                document.querySelectorAll('[data-filter]').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                loadMasterResponses(this.dataset.filter);
            });
        });

        document.querySelectorAll('[data-tab]').forEach(btn => {
            btn.addEventListener('click', function() {
                switchTab(this.dataset.tab);
            });
        });

        // ===== КНОПКА ВЫХОДА =====
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                Auth.logout();
            });
        }

        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', Auth.toggleTheme);
        }
    }

    // ===== СЛУШАТЕЛЬ СОБЫТИЙ ОТ НАВИГАЦИИ =====
    document.addEventListener('switch-master-tab', (e) => {
        if (e.detail && e.detail.tab) {
            switchTab(e.detail.tab);
        }
    });

    // ===== ЭКСПОРТ =====
    window.switchMasterTab = switchTab;
    window.MasterCabinet = {
        switchTab: switchTab
    };
})();