/**
 * client.js — логика кабинета клиента (ИСПРАВЛЕННАЯ ВЕРСИЯ)
 * Версия 3.5 с плавной загрузкой и проверкой чата
 */

(function() {
    // ===== СОСТОЯНИЕ =====
    let currentFilter = 'all';
    let allOrders = [];
    let currentOrderForReview = null;

    // ===== DOM ЭЛЕМЕНТЫ =====
    const $ = (id) => document.getElementById(id);
    
    // ===== ЭЛЕМЕНТЫ ДЛЯ УПРАВЛЕНИЯ ЗАГРУЗКОЙ =====
    const loadingSkeleton = document.getElementById('loadingSkeleton');
    const clientCabinet = document.getElementById('clientCabinet');
    const loadingText = document.getElementById('loadingText');

    // ===== ИНИЦИАЛИЗАЦИЯ =====
    document.addEventListener('DOMContentLoaded', () => {
        console.log('🚀 Client.js загружен');
        
        // Сразу показываем скелетон
        if (loadingSkeleton) {
            loadingSkeleton.classList.remove('d-none');
        }
        if (clientCabinet) {
            clientCabinet.classList.add('d-none');
        }
        
        Auth.onAuthChange(async (state) => {
            console.log('🔄 Auth state changed:', state);

            if (state.isAuthenticated && state.userData) {
                if (state.isClient) {
                    // Правильная роль - загружаем кабинет
                    if (loadingText) loadingText.textContent = 'Загружаем ваш кабинет...';
                    
                    await loadClientProfile();
                    await loadClientOrders('all');
                    await loadChats();
                    
                    if (window.BottomNav) {
                        BottomNav.highlightActive();
                    }
                    
                    checkUrlParams();
                    
                    // Плавно показываем контент
                    setTimeout(() => {
                        if (loadingSkeleton) loadingSkeleton.classList.add('d-none');
                        if (clientCabinet) clientCabinet.classList.remove('d-none');
                    }, 300);
                    
                } else {
                    // Неправильная роль - редирект на главную
                    Utils.showNotification('❌ Эта страница только для клиентов', 'warning');
                    setTimeout(() => {
                        window.location.href = '/HomeWork/';
                    }, 1500);
                }
            } else if (state.isAuthenticated && !state.userData) {
                console.log('⏳ Ожидание данных...');
                if (loadingText) loadingText.textContent = 'Загружаем данные...';
            } else {
                // Не авторизован - редирект на главную с модалкой
                sessionStorage.setItem('redirectAfterLogin', window.location.href);
                window.location.href = '/HomeWork/';
                // AuthUI.showLoginModal() сработает после редиректа
            }
        });

        initEventListeners();
        initReviewModal();
    });

    // ===== ИНИЦИАЛИЗАЦИЯ МОДАЛКИ ОТЗЫВА =====
    function initReviewModal() {
        document.querySelectorAll('#reviewModal .star').forEach(star => {
            star.addEventListener('click', function() {
                const rating = parseInt(this.dataset.rating);
                window.currentRating = rating;
                
                document.querySelectorAll('#reviewModal .star').forEach((s, i) => {
                    if (i < rating) {
                        s.innerHTML = '★';
                        s.classList.add('active');
                    } else {
                        s.innerHTML = '☆';
                        s.classList.remove('active');
                    }
                });
            });
        });

        const submitBtn = document.getElementById('submitReview');
        if (submitBtn) {
            submitBtn.addEventListener('click', submitReview);
        }

        const modal = document.getElementById('reviewModal');
        if (modal) {
            modal.addEventListener('hidden.bs.modal', function() {
                const reviewText = document.getElementById('reviewText');
                if (reviewText) reviewText.value = '';
                
                document.querySelectorAll('#reviewModal .star').forEach(s => {
                    s.innerHTML = '☆';
                    s.classList.remove('active');
                });
                
                window.currentRating = 0;
                currentOrderForReview = null;
                
                const modalTitle = document.getElementById('reviewModalTitle');
                if (modalTitle) {
                    modalTitle.innerHTML = `
                        <i class="fas fa-star me-2" style="color: gold;"></i>
                        Оцените мастера
                    `;
                }
            });
        }
    }

    // ===== ПРОВЕРКА ПАРАМЕТРОВ URL =====
    function checkUrlParams() {
        const urlParams = new URLSearchParams(window.location.search);
        const tabParam = urlParams.get('tab');
        
        if (tabParam === 'new') {
            setTimeout(() => {
                switchTab('new');
            }, 500);
        } else if (tabParam === 'chats') {
            setTimeout(() => {
                switchTab('chats');
            }, 500);
        }
    }

    // ===== ЗАГРУЗКА ПРОФИЛЯ =====
    async function loadClientProfile() {
        try {
            const userData = Auth.getUserData();
            if (!userData) return;

            const nameEl = $('clientName');
            if (nameEl) nameEl.textContent = userData.name || 'Клиент';
            
            const emailEl = $('clientEmail');
            if (emailEl) emailEl.textContent = userData.email || '';
            
            const ratingEl = $('clientRating');
            if (ratingEl) {
                const rating = userData.rating || 0;
                const stars = '★'.repeat(Math.floor(rating)) + 
                             (rating % 1 >= 0.5 ? '½' : '') + 
                             '☆'.repeat(5 - Math.ceil(rating));
                ratingEl.innerHTML = `${stars} ${rating.toFixed(1)}`;
            }
            
            const reviewsEl = $('clientReviews');
            if (reviewsEl) reviewsEl.textContent = userData.reviews || 0;
        } catch (error) {
            console.error('❌ Ошибка загрузки профиля:', error);
        }
    }

    // ===== ЗАГРУЗКА ЗАКАЗОВ =====
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
                        <a href="${CONFIG?.getUrl('client', { tab: 'new' }) || '/client.html?tab=new'}" class="btn btn-primary mt-3">Создать заказ</a>
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

    // ===== СОЗДАНИЕ КАРТОЧКИ ЗАКАЗА =====
    function createOrderCard(order) {
        const statusText = {
            'open': '🔵 Активен',
            'in_progress': '🟠 В работе',
            'awaiting_confirmation': '🟡 Ожидает подтверждения',
            'completed': '✅ Завершён'
        }[order.status] || order.status;

        const statusClass = {
            'open': 'bg-primary',
            'in_progress': 'bg-warning text-dark',
            'awaiting_confirmation': 'bg-info text-dark',
            'completed': 'bg-success'
        }[order.status] || 'bg-secondary';

        const hasResponses = order.responses && order.responses.length > 0;
        const hasMaster = !!order.selectedMasterId;
        const needsConfirmation = order.status === 'awaiting_confirmation';
        const canReview = order.status === 'completed' && !order.clientReview;

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
                    
                    <div class="d-flex gap-2">
                        ${needsConfirmation ? `
                            <button class="btn btn-sm btn-success" onclick="showConfirmCompletionModal('${order.id}')">
                                <i class="fas fa-check-circle me-1"></i>Подтвердить выполнение
                            </button>
                        ` : ''}
                        
                        ${order.status === 'open' && hasResponses ? 
                            `<button class="btn btn-sm btn-outline-primary" onclick="toggleResponses('${order.id}')">
                                <i class="fas fa-chevron-down me-1"></i>Отклики (${order.responses.length})
                            </button>` : ''}
                        
                        ${order.status === 'in_progress' && hasMaster ?
                            `<button class="btn btn-sm btn-primary" onclick="openChat('${order.id}', '${order.selectedMasterId}')">
                                <i class="fas fa-comment me-1"></i>Чат
                            </button>` : ''}
                        
                        ${canReview ?
                            `<button class="btn btn-sm btn-warning" onclick="openReviewModal('${order.id}', '${order.selectedMasterId}')">
                                <i class="fas fa-star me-1"></i>Оставить отзыв
                            </button>` : ''}
                    </div>
                </div>
                
                ${order.status === 'open' && hasResponses ? `
                    <div id="responses-${order.id}" class="responses-list mt-3" style="display: none;">
                        ${order.responses.map(response => createResponseCard(order, response)).join('')}
                    </div>
                ` : ''}
                
                ${order.status === 'completed' && order.clientReview ? `
                    <div class="mt-3 p-3 bg-dark rounded">
                        <small class="text-secondary">Ваш отзыв:</small>
                        <div class="d-flex align-items-center mt-1">
                            <div class="me-2">${'★'.repeat(order.clientReview.rating)}${'☆'.repeat(5 - order.clientReview.rating)}</div>
                            <span class="text-secondary">${Utils.escapeHtml(order.clientReview.text || '')}</span>
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }

    // ===== СОЗДАНИЕ КАРТОЧКИ ОТКЛИКА =====
    function createResponseCard(order, response) {
        const isSelected = order.selectedMasterId === response.masterId;
        
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
                        
                        <button class="btn btn-sm btn-outline-secondary" onclick="openChat('${order.id}', '${response.masterId}')">
                            <i class="fas fa-comment"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    // ===== ПОКАЗ МОДАЛКИ ПОДТВЕРЖДЕНИЯ ЗАВЕРШЕНИЯ =====
    window.showConfirmCompletionModal = function(orderId) {
        currentOrderForReview = orderId;
        
        const modalEl = document.getElementById('reviewModal');
        if (!modalEl) return;
        
        const modalTitle = document.getElementById('reviewModalTitle');
        if (modalTitle) {
            modalTitle.innerHTML = `
                <i class="fas fa-check-circle me-2" style="color: var(--success);"></i>
                Подтверждение выполнения
            `;
        }
        
        document.querySelector('#reviewModal .modal-body').innerHTML = `
            <p class="mb-4">Заказ выполнен качественно?</p>
            <div class="mb-3">
                <label class="form-label">Оцените мастера</label>
                <div class="rating-stars mb-2" id="confirmRatingStars">
                    <span class="star" data-rating="1">☆</span>
                    <span class="star" data-rating="2">☆</span>
                    <span class="star" data-rating="3">☆</span>
                    <span class="star" data-rating="4">☆</span>
                    <span class="star" data-rating="5">☆</span>
                </div>
            </div>
            <div class="mb-3">
                <label class="form-label">Отзыв (необязательно)</label>
                <textarea class="form-control" id="reviewText" rows="3" placeholder="Напишите пару слов о работе..."></textarea>
            </div>
        `;
        
        document.querySelectorAll('#confirmRatingStars .star').forEach(star => {
            star.addEventListener('click', function() {
                const rating = parseInt(this.dataset.rating);
                window.currentRating = rating;
                
                document.querySelectorAll('#confirmRatingStars .star').forEach((s, i) => {
                    if (i < rating) {
                        s.innerHTML = '★';
                        s.classList.add('active');
                    } else {
                        s.innerHTML = '☆';
                        s.classList.remove('active');
                    }
                });
            });
        });
        
        const submitBtn = document.getElementById('submitReview');
        submitBtn.innerHTML = '<i class="fas fa-check-circle me-2"></i>Подтвердить выполнение';
        
        const modal = new bootstrap.Modal(modalEl);
        modal.show();
    };

    // ===== ИСПРАВЛЕННАЯ ОТПРАВКА ОТЗЫВА И ПОДТВЕРЖДЕНИЕ =====
    async function submitReview() {
        if (!window.currentRating && !currentOrderForReview) {
            Utils.showNotification('Поставьте оценку!', 'warning');
            return;
        }

        const reviewText = document.getElementById('reviewText')?.value || '';
        
        try {
            let result;
            
            if (currentOrderForReview) {
                result = await Orders.confirmCompletion(currentOrderForReview, {
                    rating: window.currentRating,
                    text: reviewText
                });
                
                if (result.success) {
                    Utils.showSuccess('✅ Заказ завершён! Спасибо за отзыв!');
                }
            }

            const modalEl = document.getElementById('reviewModal');
            if (modalEl) {
                let modal = bootstrap.Modal.getInstance(modalEl);
                if (!modal) modal = new bootstrap.Modal(modalEl);
                modal.hide();
            }
            
            await loadClientOrders(currentFilter);
            await loadClientProfile();
            
        } catch (error) {
            console.error('❌ Ошибка:', error);
            Utils.showNotification('❌ Ошибка', 'error');
        } finally {
            window.currentRating = 0;
            currentOrderForReview = null;
        }
    }

    // ===== ОТКРЫТЬ МОДАЛКУ ОТЗЫВА (для уже завершенных) =====
    window.openReviewModal = function(orderId, masterId) {
        currentOrderForReview = orderId;
        
        const modalEl = document.getElementById('reviewModal');
        if (!modalEl) return;
        
        const modalTitle = document.getElementById('reviewModalTitle');
        if (modalTitle) {
            modalTitle.innerHTML = `
                <i class="fas fa-star me-2" style="color: var(--warning);"></i>
                Оцените работу мастера
            `;
        }
        
        document.querySelector('#reviewModal .modal-body').innerHTML = `
            <p class="mb-4">Как прошло сотрудничество?</p>
            <div class="mb-3">
                <label class="form-label">Оценка</label>
                <div class="rating-stars mb-2" id="reviewRatingStars">
                    <span class="star" data-rating="1">☆</span>
                    <span class="star" data-rating="2">☆</span>
                    <span class="star" data-rating="3">☆</span>
                    <span class="star" data-rating="4">☆</span>
                    <span class="star" data-rating="5">☆</span>
                </div>
            </div>
            <div class="mb-3">
                <label class="form-label">Отзыв</label>
                <textarea class="form-control" id="reviewText" rows="3" placeholder="Напишите пару слов о работе..."></textarea>
            </div>
        `;
        
        document.querySelectorAll('#reviewRatingStars .star').forEach(star => {
            star.addEventListener('click', function() {
                const rating = parseInt(this.dataset.rating);
                window.currentRating = rating;
                
                document.querySelectorAll('#reviewRatingStars .star').forEach((s, i) => {
                    if (i < rating) {
                        s.innerHTML = '★';
                        s.classList.add('active');
                    } else {
                        s.innerHTML = '☆';
                        s.classList.remove('active');
                    }
                });
            });
        });
        
        const submitBtn = document.getElementById('submitReview');
        submitBtn.innerHTML = '<i class="fas fa-paper-plane me-2"></i>Отправить отзыв';
        
        const modal = new bootstrap.Modal(modalEl);
        modal.show();
    };

    // ===== ВЫБОР МАСТЕРА =====
    window.selectMaster = async (orderId, masterId, price) => {
        if (!confirm('Вы уверены, что хотите выбрать этого мастера?')) return;
        
        try {
            const result = await Orders.selectMaster(orderId, masterId, price);
            
            if (result.success) {
                Utils.showSuccess('✅ Мастер выбран! Чат открыт.');
                await loadClientOrders(currentFilter);
                
                setTimeout(() => {
                    if (result.chatId) {
                        if (window.CONFIG) {
                            window.location.href = CONFIG.getUrl('chat', { chatId: result.chatId });
                        } else {
                            window.location.href = `/chat.html?chatId=${result.chatId}`;
                        }
                    }
                }, 1500);
            }
        } catch (error) {
            console.error('Ошибка:', error);
            Utils.showError('Ошибка при выборе мастера');
        }
    };

    // ===== ОТКРЫТЬ ЧАТ (ИСПРАВЛЕНО: проверка существования) =====
    window.openChat = async (orderId, partnerId) => {
        const user = Auth.getUser();
        if (!user) {
            Utils.showError('Необходимо авторизоваться');
            return;
        }
        
        const chatId = `chat_${orderId}_${partnerId}`;
        
        const loaderId = Loader?.show('Проверка чата...');
        
        try {
            const chat = await Chat.getChat(chatId);
            
            if (!chat) {
                Utils.showError('Чат ещё не создан. Попробуйте позже.');
                return;
            }
            
            sessionStorage.setItem('currentChat', JSON.stringify({
                chatId,
                orderId,
                partnerId
            }));
            
            if (window.CONFIG) {
                const chatUrl = CONFIG.getUrl('chat', { chatId });
                if (window.Loader) {
                    Loader.navigateTo(chatUrl, 'Открываем чат...');
                } else {
                    window.location.href = chatUrl;
                }
            } else {
                const chatUrl = `/HomeWork/chat.html?chatId=${chatId}`;
                if (window.Loader) {
                    Loader.navigateTo(chatUrl, 'Открываем чат...');
                } else {
                    window.location.href = chatUrl;
                }
            }
        } catch (error) {
            console.error('Ошибка при открытии чата:', error);
            Utils.showError('Не удалось открыть чат');
        } finally {
            Loader?.hide(loaderId);
        }
    };

    // ===== ПОКАЗ/СКРЫТИЕ ОТКЛИКОВ =====
    window.toggleResponses = (orderId) => {
        const container = document.getElementById(`responses-${orderId}`);
        if (container) {
            if (container.style.display === 'none') {
                container.style.display = 'block';
            } else {
                container.style.display = 'none';
            }
        }
    };

    // ===== ЗАГРУЗКА ЧАТОВ =====
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

            chatsList.innerHTML = chats.map(chat => {
                const partnerName = chat.partnerName || 'Пользователь';
                const lastMessage = chat.lastMessage || 'Нет сообщений';
                const lastMessageAt = chat.lastMessageAt ? Utils.formatDate(chat.lastMessageAt) : '';
                
                return `
                <div class="chat-card" onclick="window.location.href='${CONFIG?.getUrl('chat', { chatId: chat.id }) || '/chat.html?chatId=' + chat.id}'">
                    <div class="chat-avatar">
                        <i class="fas ${chat.partnerRole === 'master' ? 'fa-user-tie' : 'fa-user'}"></i>
                    </div>
                    <div class="chat-info">
                        <div class="chat-name">${Utils.escapeHtml(partnerName)}</div>
                        <div class="chat-last-message">${Utils.truncate(Utils.escapeHtml(lastMessage), 40)}</div>
                    </div>
                    <div class="chat-meta text-end">
                        <div class="chat-time small text-secondary">${lastMessageAt}</div>
                        ${chat.unreadCount > 0 ? `<span class="chat-unread">${chat.unreadCount}</span>` : ''}
                    </div>
                </div>
            `}).join('');
            
        } catch (error) {
            console.error('❌ Ошибка загрузки чатов:', error);
            chatsList.innerHTML = '<div class="text-center p-5 text-danger">Ошибка загрузки</div>';
        }
    }

    // ===== ПЕРЕКЛЮЧЕНИЕ ТАБОВ =====
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
        
        if (tabName === 'chats') {
            loadChats();
        }
        
        if (window.CONFIG) {
            const url = new URL(window.location);
            url.searchParams.set('tab', tabName);
            window.history.replaceState({}, '', url);
        }
    }

    // ===== ИНИЦИАЛИЗАЦИЯ ОБРАБОТЧИКОВ =====
    function initEventListeners() {
        document.querySelectorAll('[data-filter]').forEach(btn => {
            btn.addEventListener('click', function() {
                document.querySelectorAll('[data-filter]').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                loadClientOrders(this.dataset.filter);
            });
        });

        document.querySelectorAll('[data-tab]').forEach(btn => {
            btn.addEventListener('click', function() {
                switchTab(this.dataset.tab);
            });
        });

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

    document.addEventListener('switch-client-tab', (e) => {
        if (e.detail && e.detail.tab) {
            switchTab(e.detail.tab);
        }
    });

    window.switchClientTab = switchTab;
    window.ClientCabinet = {
        switchTab: switchTab
    };
})();