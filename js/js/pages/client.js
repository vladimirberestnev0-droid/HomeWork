/**
 * client.js — логика кабинета клиента
 * Версия 2.0 с исправленными обработчиками
 */

(function() {
    // Состояние
    let currentFilter = 'all';
    let allOrders = [];

    // DOM элементы
    const $ = (id) => document.getElementById(id);

    // Инициализация
    document.addEventListener('DOMContentLoaded', () => {
        console.log('🚀 Client.js загружен');
        
        Auth.onAuthChange(async (state) => {
            console.log('🔄 Auth state changed:', state);
            
            const authRequired = $('authRequired');
            const clientCabinet = $('clientCabinet');

            if (state.isAuthenticated && state.userData) {
                if (state.isClient) {
                    authRequired?.classList.add('d-none');
                    clientCabinet?.classList.remove('d-none');
                    
                    await loadClientProfile();
                    await loadClientOrders('all');
                    await loadChats();
                    
                    // Обновляем мобильную навигацию
                    if (window.MobileNav) {
                        MobileNav.setActiveTab('orders');
                    }
                } else {
                    Utils.showNotification('❌ Эта страница только для клиентов', 'warning');
                    setTimeout(() => window.location.href = '/HomeWork/', 2000);
                }
            } else if (state.isAuthenticated && !state.userData) {
                console.log('⏳ Ожидание данных...');
            } else {
                authRequired?.classList.remove('d-none');
                clientCabinet?.classList.add('d-none');
            }
        });

        initEventListeners();
    });

    // Загрузка профиля
    async function loadClientProfile() {
        try {
            const userData = Auth.getUserData();
            if (!userData) return;

            const nameEl = $('clientName');
            if (nameEl) nameEl.textContent = userData.name || 'Клиент';
            
            const emailEl = $('clientEmail');
            if (emailEl) emailEl.textContent = userData.email || '';
            
            const ratingEl = $('clientRating');
            if (ratingEl) ratingEl.innerHTML = '★'.repeat(5) + ' ' + (userData.rating || 0).toFixed(1);
            
            const reviewsEl = $('clientReviews');
            if (reviewsEl) reviewsEl.textContent = userData.reviews || 0;
        } catch (error) {
            console.error('❌ Ошибка загрузки профиля:', error);
        }
    }

    // Загрузка заказов
    async function loadClientOrders(filter = 'all') {
        currentFilter = filter;
        
        const ordersList = $('ordersList');
        if (!ordersList) return;

        ordersList.innerHTML = '<div class="text-center p-5"><div class="spinner-border"></div><p class="mt-2">Загрузка...</p></div>';

        try {
            const user = Auth.getUser();
            if (!user) return;

            const orders = await Orders.getClientOrders(user.uid, filter);
            allOrders = orders;
            
            const countEl = $('clientOrdersCount');
            if (countEl) countEl.textContent = orders.length;

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
            console.error('❌ Ошибка загрузки заказов:', error);
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

        const statusClass = {
            'open': 'bg-primary',
            'in_progress': 'bg-warning text-dark',
            'completed': 'bg-success'
        }[order.status] || 'bg-secondary';

        const hasResponses = order.responses && order.responses.length > 0;
        const hasMaster = !!order.selectedMasterId;

        return `
            <div class="order-card mb-3" data-order-id="${order.id}">
                <div class="order-header">
                    <h5 class="order-title">${Utils.escapeHtml(order.title || 'Заказ')}</h5>
                    <span class="order-price">${Utils.formatMoney(order.price)}</span>
                </div>
                
                <p class="order-description">${Utils.truncate(Utils.escapeHtml(order.description || ''), 100)}</p>
                
                ${order.photos && order.photos.length ? `
                    <div class="d-flex gap-2 mb-3">
                        ${order.photos.slice(0, 3).map(url => 
                            `<img src="${url}" class="order-photo-thumb" onclick="window.open('${url}')" loading="lazy">`
                        ).join('')}
                        ${order.photos.length > 3 ? `<span class="text-secondary">+${order.photos.length-3}</span>` : ''}
                    </div>
                ` : ''}
                
                <div class="order-meta">
                    <span><i class="fas fa-tag me-1"></i>${order.category || 'Без категории'}</span>
                    <span><i class="fas fa-calendar me-1"></i>${Utils.formatDate(order.createdAt)}</span>
                </div>
                
                <div class="d-flex justify-content-between align-items-center mt-3">
                    <span class="badge ${statusClass}">${statusText}</span>
                    
                    ${order.status === 'open' && hasResponses ? 
                        `<button class="btn btn-sm btn-outline-primary" onclick="toggleResponses('${order.id}')">
                            <i class="fas fa-chevron-down me-1"></i>Отклики (${order.responses.length})
                        </button>` : ''}
                    
                    ${order.status === 'in_progress' && hasMaster ?
                        `<button class="btn btn-sm btn-primary" onclick="openChat('${order.id}', '${order.selectedMasterId}')">
                            <i class="fas fa-comment me-1"></i>Чат
                        </button>` : ''}
                    
                    ${order.status === 'completed' ?
                        `<span class="badge bg-success">Завершён</span>` : ''}
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
        
        // Проверяем, оставлен ли уже отзыв
        const hasReview = order.reviews && order.reviews.some(r => r.masterId === response.masterId) || false;
        
        // Формируем звезды рейтинга
        const ratingStars = response.masterRating ? 
            '★'.repeat(Math.floor(response.masterRating)) + 
            (response.masterRating % 1 >= 0.5 ? '½' : '') + 
            '☆'.repeat(5 - Math.ceil(response.masterRating)) : 
            '☆☆☆☆☆';

        return `
            <div class="response-card ${isSelected ? 'selected' : ''} p-3 mb-2 border rounded">
                <div class="response-header d-flex justify-content-between mb-2">
                    <div>
                        <span class="fw-bold">${Utils.escapeHtml(response.masterName || 'Мастер')}</span>
                        <small class="text-secondary ms-2">${ratingStars} ${(response.masterRating || 0).toFixed(1)}</small>
                    </div>
                    <span class="fw-bold text-accent">${Utils.formatMoney(response.price)}</span>
                </div>
                
                ${response.comment ? `<p class="small text-secondary mb-2">${Utils.escapeHtml(response.comment)}</p>` : ''}
                
                <div class="d-flex justify-content-between align-items-center">
                    <small class="text-muted">${Utils.formatDate(response.createdAt)}</small>
                    
                    <div class="d-flex gap-2">
                        ${order.status === 'open' && !isSelected ? `
                            <button class="btn btn-sm btn-success" onclick="selectMaster('${order.id}', '${response.masterId}', ${response.price})">
                                <i class="fas fa-check me-1"></i>Выбрать
                            </button>
                        ` : ''}
                        
                        ${order.status === 'completed' && !hasReview ? `
                            <button class="btn btn-sm btn-warning" onclick="openReviewModal('${order.id}', '${response.masterId}', '${Utils.escapeHtml(response.masterName)}')">
                                <i class="fas fa-star me-1"></i>Оценить
                            </button>
                        ` : ''}
                        
                        <button class="btn btn-sm btn-outline-secondary" onclick="openChat('${order.id}', '${response.masterId}')">
                            <i class="fas fa-comment"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    // Отправка отзыва
    async function submitReview() {
        if (!window.currentRating) {
            Utils.showNotification('Поставьте оценку!', 'warning');
            return;
        }

        const reviewText = document.getElementById('reviewText')?.value || '';
        const user = Auth.getUser();
        const userData = Auth.getUserData();

        try {
            if (!user || !userData) throw new Error('Пользователь не авторизован');

            const review = {
                clientId: user.uid,
                clientName: userData?.name || 'Клиент',
                masterId: window.currentMasterId,
                rating: window.currentRating,
                text: reviewText,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            // Добавляем отзыв в заказ
            await db.collection('orders').doc(window.currentOrderId).update({
                reviews: firebase.firestore.FieldValue.arrayUnion(review)
            });

            // Обновляем рейтинг мастера
            const masterDoc = await db.collection('users').doc(window.currentMasterId).get();
            if (masterDoc.exists) {
                const masterData = masterDoc.data();
                const currentMasterRating = masterData.rating || 0;
                const currentMasterReviews = masterData.reviews || 0;
                const newRating = ((currentMasterRating * currentMasterReviews) + window.currentRating) / (currentMasterReviews + 1);
                
                await db.collection('users').doc(window.currentMasterId).update({
                    rating: newRating,
                    reviews: currentMasterReviews + 1
                });
            }

            // Скрываем модалку
            const modalEl = document.getElementById('reviewModal');
            if (modalEl && window.bootstrap) {
                const modal = bootstrap.Modal.getInstance(modalEl);
                if (modal) modal.hide();
            }
            
            Utils.showNotification('✅ Спасибо за отзыв!', 'success');
            
            // Перезагружаем заказы
            await loadClientOrders(currentFilter);
            
        } catch (error) {
            console.error('❌ Ошибка при отправке отзыва:', error);
            Utils.showNotification('❌ Ошибка при отправке отзыва', 'error');
        }
    }

    // Загрузка чатов
    async function loadChats() {
        const chatsList = document.getElementById('chatsList');
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
            console.error('❌ Ошибка загрузки чатов:', error);
            chatsList.innerHTML = '<div class="text-center p-5 text-danger">Ошибка загрузки</div>';
        }
    }

    // Переключение табов
    function switchTab(tabName) {
        const tabs = document.querySelectorAll('[data-tab]');
        const contents = document.querySelectorAll('.tab-content');
        
        tabs.forEach(tab => {
            if (tab.dataset.tab === tabName) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });
        
        contents.forEach(content => {
            if (content.id === tabName + 'Tab') {
                content.classList.remove('d-none');
            } else {
                content.classList.add('d-none');
            }
        });
        
        // Загружаем данные если нужно
        if (tabName === 'chats') {
            loadChats();
        }
    }

    // Инициализация обработчиков
    function initEventListeners() {
        // Фильтры заказов
        document.querySelectorAll('[data-filter]').forEach(btn => {
            btn.addEventListener('click', function() {
                document.querySelectorAll('[data-filter]').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                loadClientOrders(this.dataset.filter);
            });
        });

        // Табы
        document.querySelectorAll('[data-tab]').forEach(btn => {
            btn.addEventListener('click', function() {
                switchTab(this.dataset.tab);
            });
        });

        // Звёзды рейтинга в модалке
        document.querySelectorAll('#reviewModal .star').forEach(star => {
            star.addEventListener('click', function() {
                const rating = parseInt(this.dataset.rating);
                window.currentRating = rating;
                
                document.querySelectorAll('#reviewModal .star').forEach((s, i) => {
                    if (i < rating) s.classList.add('active');
                    else s.classList.remove('active');
                });
            });
        });

        // Отправка отзыва
        const submitBtn = document.getElementById('submitReview');
        if (submitBtn) {
            submitBtn.addEventListener('click', submitReview);
        }

        // Выход
        const logoutLink = document.getElementById('logoutLink');
        if (logoutLink) {
            logoutLink.addEventListener('click', (e) => {
                e.preventDefault();
                Auth.logout();
            });
        }

        // Тема
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', Auth.toggleTheme);
        }
    }

    // Экспортируем функцию переключения табов глобально
    window.switchClientTab = switchTab;
})();