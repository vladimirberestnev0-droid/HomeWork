// ============================================
// ЛОГИКА КАБИНЕТА МАСТЕРА (ПОЛНАЯ ВЕРСИЯ)
// ============================================

(function() {
    console.log('🚀 Masters.js загружен');

    // ===== СОСТОЯНИЕ =====
    let currentFilter = 'all';
    let allResponses = [];
    let currentOrderId = null;
    let currentClientId = null;
    let currentClientName = '';
    let currentRating = 0;

    // ===== DOM ЭЛЕМЕНТЫ =====
    const $ = (id) => document.getElementById(id);

    const loadingSkeleton = document.getElementById('loadingSkeleton');
    const masterCabinet = document.getElementById('masterCabinet');
    const loadingText = document.getElementById('loadingText');

    // ===== ИНИЦИАЛИЗАЦИЯ =====
    document.addEventListener('DOMContentLoaded', () => {
        console.log('📄 Страница мастера загружается...');

        if (loadingSkeleton) loadingSkeleton.classList.remove('d-none');
        if (masterCabinet) masterCabinet.classList.add('d-none');

        (async () => {
            try {
                const initialState = await new Promise(resolve => {
                    Auth.onAuthChange(resolve);
                });

                if (!initialState.isAuthenticated) {
                    sessionStorage.setItem('redirectAfterLogin', window.location.href);
                    window.location.href = '/HomeWork/';
                    return;
                }

                if (loadingText) loadingText.textContent = 'Загружаем данные пользователя...';
                
                const userData = await Auth.waitForData(5000);
                
                if (!userData) throw new Error('Не удалось загрузить данные пользователя');

                if (userData.role !== 'master') {
                    Utils.showNotification('❌ Эта страница только для мастеров', 'warning');
                    setTimeout(() => window.location.href = '/HomeWork/', 1500);
                    return;
                }

                if (loadingText) loadingText.textContent = 'Загружаем ваш кабинет...';

                await Promise.all([
                    loadMasterProfile(),
                    loadMasterResponses('all'),
                    loadChats()
                ]);

                if (window.BottomNav) BottomNav.highlightActive();

                checkUrlParams();

                setTimeout(() => {
                    if (loadingSkeleton) loadingSkeleton.classList.add('d-none');
                    if (masterCabinet) masterCabinet.classList.remove('d-none');
                    
                    document.querySelectorAll('.order-card, .chat-card').forEach(el => {
                        el.classList.add('fade-in-up');
                    });
                }, 300);

            } catch (error) {
                console.error('❌ Критическая ошибка:', error);
                Utils.showError('Не удалось загрузить кабинет. Обновите страницу.');
                
                if (loadingSkeleton) {
                    loadingSkeleton.innerHTML = `
                        <div class="text-center p-5">
                            <i class="fas fa-exclamation-triangle fa-4x mb-3" style="color: var(--accent-urgent);"></i>
                            <h5>Ошибка загрузки</h5>
                            <p class="text-muted">${error.message || 'Попробуйте обновить страницу'}</p>
                            <button class="btn btn-outline-secondary btn-lg mt-3" onclick="location.reload()">
                                <i class="fas fa-sync-alt me-2"></i>Обновить
                            </button>
                        </div>
                    `;
                }
            }
        })();

        initEventListeners();
        initReviewModal();

        const urlParams = new URLSearchParams(window.location.search);
        const respondOrderId = urlParams.get('respond');
        if (respondOrderId) loadOrderForResponse(respondOrderId);
    });

    // ===== ИНИЦИАЛИЗАЦИЯ МОДАЛКИ ОТЗЫВА =====
    function initReviewModal() {
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

        $('submitClientReview')?.addEventListener('click', submitClientReview);

        const modal = document.getElementById('reviewClientModal');
        if (modal) {
            modal.addEventListener('hidden.bs.modal', function() {
                $('reviewClientText').value = '';
                document.querySelectorAll('#clientRatingStars .star').forEach(s => s.classList.remove('active'));
                currentRating = 0;
                currentOrderId = null;
                currentClientId = null;
            });
        }
    }

    // ===== ПРОВЕРКА ПАРАМЕТРОВ URL =====
    function checkUrlParams() {
        const urlParams = new URLSearchParams(window.location.search);
        const tabParam = urlParams.get('tab');

        if (tabParam === 'chats') {
            setTimeout(() => switchTab('chats'), 500);
        }
    }

    // ===== ЗАГРУЗКА ПРОФИЛЯ =====
    async function loadMasterProfile() {
        try {
            const userData = Auth.getUserData();
            if (!userData) return;

            const nameEl = $('masterName');
            if (nameEl) nameEl.textContent = userData.name || 'Мастер';

            const categoriesEl = $('masterCategories');
            if (categoriesEl) categoriesEl.textContent = userData.categories || 'Специалист';

            const ratingEl = $('masterRating');
            if (ratingEl) ratingEl.textContent = (userData.rating || 0).toFixed(1);

            const reviewsEl = $('masterReviews');
            if (reviewsEl) reviewsEl.textContent = userData.reviews || 0;

            const stats = await Orders.getMasterStats(Auth.getUser()?.uid);

            const completedEl = $('masterCompleted');
            if (completedEl) completedEl.textContent = stats.completed || 0;

            const awaitingEl = $('masterAwaiting');
            if (awaitingEl) awaitingEl.textContent = stats.awaiting || 0;

            const ratingDisplayEl = $('masterRatingDisplay');
            if (ratingDisplayEl) {
                const stars = '★'.repeat(Math.floor(userData.rating || 0)) +
                    '☆'.repeat(5 - Math.floor(userData.rating || 0));
                ratingDisplayEl.innerHTML = `${stars} ${(userData.rating || 0).toFixed(1)}`;
            }

            const statTotal = $('statTotal');
            const statAccepted = $('statAccepted');
            const statAwaiting = $('statAwaiting');
            const statEarnings = $('statEarnings');
            
            if (statTotal) statTotal.textContent = stats.total || 0;
            if (statAccepted) statAccepted.textContent = stats.accepted || 0;
            if (statAwaiting) statAwaiting.textContent = stats.awaiting || 0;
            if (statEarnings) statEarnings.textContent = Utils.formatMoney(stats.earnings || 0);

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
                filtered = responses.filter(r => r.status === Orders.ORDER_STATUS.OPEN);
            } else if (filter === 'accepted') {
                filtered = responses.filter(r => r.status === Orders.ORDER_STATUS.IN_PROGRESS);
            } else if (filter === 'awaiting') {
                filtered = responses.filter(r => r.status === Orders.ORDER_STATUS.AWAITING_CONFIRMATION);
            } else if (filter === 'completed') {
                filtered = responses.filter(r => r.status === Orders.ORDER_STATUS.COMPLETED);
            } else if (filter === 'cancelled') {
                filtered = responses.filter(r => r.status === Orders.ORDER_STATUS.CANCELLED);
            }

            if (filtered.length === 0) {
                responsesList.innerHTML = `
                    <div class="text-center p-5">
                        <i class="fas fa-inbox fa-3x mb-3" style="color: var(--border);"></i>
                        <h5>Нет откликов</h5>
                        <a href="${CONFIG?.getUrl('home', { focus: 'search' }) || '/?focus=search'}" class="btn btn-primary mt-3">
                            <i class="fas fa-search me-2"></i>Найти заказы
                        </a>
                    </div>
                `;
                return;
            }

            responsesList.innerHTML = filtered.map(item => createResponseCard(item)).join('');
            
            setTimeout(() => {
                document.querySelectorAll('#responsesList .order-card').forEach((card, i) => {
                    card.style.animation = `fadeInUp 0.3s ease ${i * 0.05}s forwards`;
                    card.style.opacity = '0';
                });
            }, 100);
            
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
            'awaiting_confirmation': { class: 'bg-info text-dark', text: '🟡 Ждёт подтверждения', icon: 'fa-hourglass-half' },
            'completed': { class: 'bg-success', text: '✅ Выполнен', icon: 'fa-check-circle' },
            'cancelled': { class: 'bg-secondary', text: '❌ Отменён', icon: 'fa-times-circle' }
        };

        const status = statusConfig[item.status] || statusConfig.open;
        const canComplete = item.status === Orders.ORDER_STATUS.IN_PROGRESS;
        const isCancelled = item.status === Orders.ORDER_STATUS.CANCELLED;
        const isTakenByOther = item.status === Orders.ORDER_STATUS.IN_PROGRESS && 
                               order.selectedMasterId && 
                               order.selectedMasterId !== Auth.getUser()?.uid;

        if (isTakenByOther) {
            return `
                <div class="order-card order-taken mb-3">
                    <div class="order-header">
                        <h5 class="order-title">${Utils.escapeHtml(order.title || 'Заказ')}</h5>
                        <span class="order-price">${Utils.formatMoney(response.price || order.price)}</span>
                    </div>
                    
                    <div class="alert alert-warning d-flex align-items-center gap-2">
                        <i class="fas fa-info-circle"></i>
                        <span>Этот заказ уже взят другим мастером</span>
                    </div>
                    
                    <div class="order-meta">
                        <span><i class="fas fa-tag me-1"></i>${order.category || 'Без категории'}</span>
                        <span><i class="fas fa-map-marker-alt me-1"></i>${Utils.escapeHtml(order.address || '')}</span>
                    </div>
                    
                    <div class="mt-3">
                        <span class="badge bg-secondary">
                            <i class="fas fa-lock me-1"></i>Недоступен
                        </span>
                    </div>
                </div>
            `;
        }

        return `
            <div class="order-card mb-3 ${isCancelled ? 'order-cancelled' : ''}">
                <div class="order-header">
                    <h5 class="order-title">${Utils.escapeHtml(order.title || 'Заказ')}</h5>
                    <span class="order-price">${Utils.formatMoney(response.price || order.price)}</span>
                </div>

                <p class="order-description">${Utils.truncate(Utils.escapeHtml(order.description || ''), 100)}</p>

                ${order.photos?.length ? `
                    <div class="d-flex gap-2 mb-3 flex-wrap">
                        ${order.photos.slice(0, 3).map(url =>
                            `<img src="${url}" class="order-photo-thumb" onclick="event.stopPropagation(); window.open('${url}')" loading="lazy">`
                        ).join('')}
                        ${order.photos.length > 3 ? `<span class="text-secondary">+${order.photos.length-3}</span>` : ''}
                    </div>
                ` : ''}

                <div class="order-meta">
                    <span><i class="fas fa-tag me-1"></i>${Utils.getCategoryName(order.category)}</span>
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
                    ${item.status === Orders.ORDER_STATUS.OPEN ? `
                        <button class="btn btn-sm btn-outline-secondary" disabled>
                            <i class="fas fa-hourglass-half me-1"></i>Ожидает ответа
                        </button>
                    ` : ''}

                    ${canComplete ? `
                        <button class="btn btn-sm btn-success" onclick="showCompleteModal('${item.orderId}', '${order.clientId}', '${Utils.escapeHtml(order.clientName || 'Клиент')}')">
                            <i class="fas fa-check-double me-1"></i>Завершить
                        </button>
                        <button class="btn btn-sm btn-primary" onclick="openChat('${item.orderId}', '${order.clientId}')">
                            <i class="fas fa-comment me-1"></i>Чат
                        </button>
                    ` : ''}

                    ${item.status === Orders.ORDER_STATUS.AWAITING_CONFIRMATION ? `
                        <button class="btn btn-sm btn-outline-warning" disabled>
                            <i class="fas fa-hourglass-half me-1"></i>Ожидает подтверждения
                        </button>
                        <button class="btn btn-sm btn-primary" onclick="openChat('${item.orderId}', '${order.clientId}')">
                            <i class="fas fa-comment me-1"></i>Чат
                        </button>
                    ` : ''}

                    ${item.status === Orders.ORDER_STATUS.COMPLETED ? `
                        <button class="btn btn-sm btn-outline-primary" onclick="openChat('${item.orderId}', '${order.clientId}')">
                            <i class="fas fa-comment me-1"></i>Чат
                        </button>
                        <span class="btn btn-sm btn-outline-success" disabled>
                            <i class="fas fa-check me-1"></i>Завершён
                        </span>
                    ` : ''}

                    ${isCancelled ? `
                        <span class="btn btn-sm btn-outline-secondary" disabled>
                            <i class="fas fa-times me-1"></i>Отменён
                        </span>
                        ${order.cancelReason ? `
                            <small class="text-secondary w-100 mt-1">Причина: ${Utils.escapeHtml(order.cancelReason)}</small>
                        ` : ''}
                    ` : ''}
                </div>

                ${item.status === Orders.ORDER_STATUS.COMPLETED && order.clientReview ? `
                    <div class="mt-3 p-3 bg-dark rounded">
                        <small class="text-secondary">Отзыв клиента:</small>
                        <div class="d-flex align-items-center mt-1">
                            <div class="me-2">${'★'.repeat(order.clientReview.rating)}${'☆'.repeat(5 - order.clientReview.rating)}</div>
                            <span class="text-secondary">${Utils.escapeHtml(order.clientReview.text || '')}</span>
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }

    // ===== ОТКРЫТЬ ЧАТ =====
    window.openChat = async (orderId, clientId) => {
        const user = Auth.getUser();
        if (!user) {
            Utils.showError('Необходимо авторизоваться');
            return;
        }

        const chatId = `chat_${orderId}_${user.uid}`;
        const loaderId = Loader?.show('Проверка чата...');

        try {
            const chat = await Chat.getChat(chatId);
            if (!chat) {
                Utils.showError('Чат ещё не создан. Попробуйте позже.');
                return;
            }

            sessionStorage.setItem('currentChat', JSON.stringify({
                chatId, orderId, partnerId: clientId
            }));

            const chatUrl = window.CONFIG 
                ? CONFIG.getUrl('chat', { chatId })
                : `/HomeWork/chat.html?chatId=${chatId}`;

            if (window.Loader) {
                Loader.navigateTo(chatUrl, 'Открываем чат...');
            } else {
                window.location.href = chatUrl;
            }
        } catch (error) {
            console.error('❌ Ошибка при открытии чата:', error);
            Utils.showError('Не удалось открыть чат');
        } finally {
            Loader?.hide(loaderId);
        }
    };

    // ===== ПОКАЗ МОДАЛКИ ЗАВЕРШЕНИЯ =====
    window.showCompleteModal = (orderId, clientId, clientName) => {
        currentOrderId = orderId;
        currentClientId = clientId;
        currentClientName = clientName;
        currentRating = 0;

        const nameEl = $('reviewClientName');
        if (nameEl) nameEl.textContent = clientName || 'Клиент';

        const textEl = $('reviewClientText');
        if (textEl) textEl.value = '';

        document.querySelectorAll('#clientRatingStars .star').forEach(s => s.classList.remove('active'));

        const modalEl = $('reviewClientModal');
        if (modalEl) {
            const modal = new bootstrap.Modal(modalEl);
            modal.show();
        }
    };

    // ===== ОТПРАВКА ОТЗЫВА О КЛИЕНТЕ =====
    async function submitClientReview() {
        if (!currentRating) {
            Utils.showNotification('Поставьте оценку клиенту', 'warning');
            return;
        }

        const comment = $('reviewClientText')?.value || '';

        const result = await Orders.initiateCompletion(currentOrderId, {
            rating: currentRating,
            text: comment
        });

        if (result && result.success) {
            const modalEl = $('reviewClientModal');
            if (modalEl) {
                const modal = bootstrap.Modal.getInstance(modalEl);
                if (modal) modal.hide();
            }
            Utils.showNotification('✅ Запрос на завершение отправлен клиенту', 'success');
            await loadMasterResponses(currentFilter);
            await loadMasterProfile();
        } else {
            Utils.showNotification(result?.error || '❌ Ошибка', 'error');
        }
    }

    // ===== ЗАГРУЗКА ЗАКАЗА ДЛЯ ОТКЛИКА =====
    async function loadOrderForResponse(orderId) {
        try {
            const order = await Orders.getOrderById(orderId);
            if (order) {
                showRespondModal(orderId, order.title, order.category, order.price);
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки заказа:', error);
        }
    }

    // ===== ПОКАЗ МОДАЛКИ ОТКЛИКА =====
    window.showRespondModal = (orderId, orderTitle, orderCategory, orderPrice) => {
        currentOrderId = orderId;

        const infoBlock = $('respondOrderInfo');
        if (infoBlock) infoBlock.classList.remove('d-none');

        const titleEl = $('respondOrderTitle');
        if (titleEl) titleEl.textContent = orderTitle || 'Заказ';

        const categoryEl = $('respondOrderCategory');
        if (categoryEl) categoryEl.textContent = orderCategory || 'Категория';

        const priceEl = $('respondOrderPrice');
        if (priceEl) priceEl.textContent = Utils.formatMoney(orderPrice);

        const priceInput = $('responsePrice');
        if (priceInput) priceInput.value = '';

        const commentInput = $('responseComment');
        if (commentInput) commentInput.value = '';

        const modalEl = $('respondModal');
        if (modalEl) {
            const modal = new bootstrap.Modal(modalEl);
            modal.show();
        }
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
            const modalEl = $('respondModal');
            if (modalEl) {
                const modal = bootstrap.Modal.getInstance(modalEl);
                if (modal) modal.hide();
            }
            Utils.showNotification('✅ Отклик отправлен!', 'success');
            await loadMasterResponses(currentFilter);
        } else {
            Utils.showNotification(result?.error || '❌ Ошибка при отправке', 'error');
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
                        <p class="text-secondary">Чаты появятся после откликов на заказы</p>
                    </div>
                `;
                return;
            }

            chatsList.innerHTML = chats.map(chat => {
                const isRejected = chat.status === 'rejected';
                return `
                <div class="chat-card ${isRejected ? 'rejected' : ''}" onclick="window.location.href='${CONFIG?.getUrl('chat', { chatId: chat.id }) || '/HomeWork/chat.html?chatId=' + chat.id}'">
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
                        ${isRejected ? '<small class="text-secondary d-block">Занято</small>' : ''}
                    </div>
                </div>
            `}).join('');

            const unreadCount = chats.reduce((sum, chat) => sum + (chat.unreadCount || 0), 0);
            const unreadBadge = document.getElementById('chatsUnread');
            if (unreadBadge) {
                if (unreadCount > 0) {
                    unreadBadge.textContent = unreadCount > 99 ? '99+' : unreadCount;
                    unreadBadge.classList.remove('d-none');
                } else {
                    unreadBadge.classList.add('d-none');
                }
            }

        } catch (error) {
            console.error('❌ Ошибка загрузки чатов:', error);
            chatsList.innerHTML = '<div class="text-center p-5 text-danger">Ошибка загрузки</div>';
        }
    }

    // ===== ПЕРЕКЛЮЧЕНИЕ ТАБОВ =====
    function switchTab(tabName) {
        document.querySelectorAll('[data-tab]').forEach(btn => {
            if (btn.dataset.tab === tabName) btn.classList.add('active');
            else btn.classList.remove('active');
        });

        document.querySelectorAll('.tab-content').forEach(content => {
            if (content.id === tabName + 'Tab') content.classList.remove('d-none');
            else content.classList.add('d-none');
        });

        if (tabName === 'chats') loadChats();

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
                loadMasterResponses(this.dataset.filter);
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

        const notificationsBell = document.getElementById('notificationsBell');
        if (notificationsBell) {
            notificationsBell.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                if (!Auth.isAuthenticated()) {
                    AuthUI.showLoginModal();
                    Utils.showInfo('Войдите, чтобы увидеть уведомления');
                    return;
                }
                
                if (window.NotificationsCenter) {
                    window.NotificationsCenter.toggle();
                }
            });
        }
    }

    // ===== СЛУШАТЕЛЬ СОБЫТИЙ =====
    document.addEventListener('switch-master-tab', (e) => {
        if (e.detail && e.detail.tab) {
            switchTab(e.detail.tab);
        }
    });

    // ===== ЭКСПОРТ =====
    window.switchMasterTab = switchTab;
    window.MasterCabinet = {
        switchTab: switchTab,
        filterResponses: loadMasterResponses
    };
})();