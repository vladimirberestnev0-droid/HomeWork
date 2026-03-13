// ============================================
// КАБИНЕТ МАСТЕРА - ЭЛЕГАНТНАЯ ВЕРСИЯ
// ============================================

const MasterCabinet = (function() {
    if (window.__MASTER_CABINET_INITIALIZED__) return window.MasterCabinet;

    // ===== СОСТОЯНИЕ =====
    let state = {
        currentFilter: 'all',
        allResponses: [],
        currentOrderId: null,
        currentClientId: null,
        currentClientName: '',
        currentRating: 0,
        isLoading: false
    };

    // ===== DOM ЭЛЕМЕНТЫ (кешируем один раз) =====
    const DOM = {
        loadingSkeleton: document.getElementById('loadingSkeleton'),
        masterCabinet: document.getElementById('masterCabinet'),
        loadingText: document.getElementById('loadingText'),
        responsesList: document.getElementById('responsesList'),
        chatsList: document.getElementById('chatsList'),
        reviewClientModal: document.getElementById('reviewClientModal'),
        reviewClientName: document.getElementById('reviewClientName'),
        reviewClientText: document.getElementById('reviewClientText'),
        submitClientReview: document.getElementById('submitClientReview'),
        clientRatingStars: document.getElementById('clientRatingStars'),
        mapSection: document.getElementById('mapSection')
    };

    // ===== ИНИЦИАЛИЗАЦИЯ =====
    async function init() {
        console.log('🚀 MasterCabinet инициализация...');
        
        showLoading(true);

        try {
            await checkAuthorization();
            await loadUserData();
            await loadInitialData();
            setupEventListeners();
            initReviewModal();
            checkUrlParams();
            
            showLoading(false);
            animateElements();
            
        } catch (error) {
            handleFatalError(error);
        }
    }

    // ===== ПРОВЕРКА АВТОРИЗАЦИИ =====
    async function checkAuthorization() {
        const authState = await Auth.waitForInit(5000);
        
        if (!authState.isAuthenticated) {
            sessionStorage.setItem('redirectAfterLogin', window.location.href);
            window.location.href = '/HomeWork/';
            throw new Error('Не авторизован');
        }
        
        return authState;
    }

    // ===== ЗАГРУЗКА ДАННЫХ ПОЛЬЗОВАТЕЛЯ =====
    async function loadUserData() {
        setLoadingText('Загружаем данные пользователя...');
        
        const userData = await Auth.waitForData(5000);
        if (!userData) throw new Error('Не удалось загрузить данные');
        
        if (userData.role !== 'master') {
            Utils.showNotification('❌ Эта страница только для мастеров', 'warning');
            setTimeout(() => window.location.href = '/HomeWork/', 1500);
            throw new Error('Неверная роль');
        }
        
        return userData;
    }

    // ===== ЗАГРУЗКА НАЧАЛЬНЫХ ДАННЫХ =====
    async function loadInitialData() {
        setLoadingText('Загружаем ваш кабинет...');
        
        await Promise.all([
            loadMasterProfile(),
            loadMasterResponses('all'),
            loadChats()
        ]);
        
        if (window.BottomNav) BottomNav.highlightActive();
    }

    // ===== ЗАГРУЗКА ПРОФИЛЯ МАСТЕРА =====
    async function loadMasterProfile() {
        try {
            const userData = Auth.getUserData();
            if (!userData) return;

            updateProfileUI(userData);
            
            const stats = await Orders.getMasterStats(Auth.getUser()?.uid);
            updateStatsUI(stats);
            
        } catch (error) {
            console.error('❌ Ошибка загрузки профиля:', error);
        }
    }

    // ===== ОБНОВЛЕНИЕ UI ПРОФИЛЯ =====
    function updateProfileUI(userData) {
        setText('masterName', userData.name || 'Мастер');
        setText('masterCategories', userData.categories || 'Специалист');
        setText('masterRating', (userData.rating || 0).toFixed(1));
        setText('masterReviews', userData.reviews || 0);
        
        updateRatingDisplay('masterRatingDisplay', userData.rating || 0);
    }

    // ===== ОБНОВЛЕНИЕ СТАТИСТИКИ =====
    function updateStatsUI(stats) {
        setText('statTotal', stats.total || 0);
        setText('statAccepted', stats.accepted || 0);
        setText('statAwaiting', stats.awaiting || 0);
        setText('statEarnings', Utils.formatMoney(stats.earnings || 0));
        
        setText('masterCompleted', stats.completed || 0);
        setText('masterAwaiting', stats.awaiting || 0);
    }

    // ===== ЗАГРУЗКА ОТКЛИКОВ =====
    async function loadMasterResponses(filter = 'all') {
        state.currentFilter = filter;
        
        if (!DOM.responsesList) return;

        showLoadingResponses();

        try {
            const user = Auth.getUser();
            if (!user) return;

            const responses = await Orders.getMasterResponses(user.uid);
            state.allResponses = responses;

            const filtered = filterResponses(responses, filter);
            
            if (filtered.length === 0) {
                showEmptyResponses();
                return;
            }

            renderResponses(filtered);
            
        } catch (error) {
            console.error('❌ Ошибка загрузки откликов:', error);
            showError('Ошибка загрузки откликов');
        }
    }

    // ===== ФИЛЬТРАЦИЯ ОТКЛИКОВ =====
    function filterResponses(responses, filter) {
        const filters = {
            'pending': r => r.status === Orders.ORDER_STATUS.OPEN,
            'accepted': r => r.status === Orders.ORDER_STATUS.IN_PROGRESS,
            'awaiting': r => r.status === Orders.ORDER_STATUS.AWAITING_CONFIRMATION,
            'completed': r => r.status === Orders.ORDER_STATUS.COMPLETED,
            'cancelled': r => r.status === Orders.ORDER_STATUS.CANCELLED,
            'all': () => true
        };
        
        return responses.filter(filters[filter] || filters.all);
    }

    // ===== ОТРИСОВКА ОТКЛИКОВ =====
    function renderResponses(responses) {
        DOM.responsesList.innerHTML = responses.map(createResponseCard).join('');
        animateCards('#responsesList .order-card');
    }

    // ===== СОЗДАНИЕ КАРТОЧКИ ОТКЛИКА =====
    function createResponseCard(item) {
        const order = item.order || {};
        const response = item.response || {};
        
        if (isOrderTakenByOther(order, item)) {
            return createTakenOrderCard(order, response);
        }

        return createActiveOrderCard(order, response, item);
    }

    // ===== ПРОВЕРКА, ВЗЯТ ЛИ ЗАКАЗ ДРУГИМ =====
    function isOrderTakenByOther(order, item) {
        return item.status === Orders.ORDER_STATUS.IN_PROGRESS && 
               order.selectedMasterId && 
               order.selectedMasterId !== Auth.getUser()?.uid;
    }

    // ===== КАРТОЧКА "ЗАКАЗ ВЗЯТ ДРУГИМ" =====
    function createTakenOrderCard(order, response) {
        return `
            <div class="order-card order-taken mb-3">
                <div class="order-header">
                    <h5 class="order-title">${Utils.escapeHtml(order.title || 'Заказ')}</h5>
                    <span class="order-price">${Utils.formatMoney(response.price || order.price)}</span>
                </div>
                <div class="alert alert-warning">
                    <i class="fas fa-info-circle"></i>
                    <span>Этот заказ уже взят другим мастером</span>
                </div>
                ${renderOrderMeta(order)}
            </div>
        `;
    }

    // ===== КАРТОЧКА АКТИВНОГО ЗАКАЗА =====
    function createActiveOrderCard(order, response, item) {
        const status = getStatusConfig(item.status);
        const canComplete = item.status === Orders.ORDER_STATUS.IN_PROGRESS;
        
        return `
            <div class="order-card mb-3 ${item.status === 'cancelled' ? 'order-cancelled' : ''}">
                ${renderOrderHeader(order, response)}
                ${renderOrderDescription(order)}
                ${renderOrderPhotos(order)}
                ${renderOrderMeta(order)}
                ${renderStatusAndComment(status, response)}
                ${renderActionButtons(order, item, canComplete)}
                ${renderClientReview(order)}
            </div>
        `;
    }

    // ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ РЕНДЕРА =====
    function renderOrderHeader(order, response) {
        return `
            <div class="order-header">
                <h5 class="order-title">${Utils.escapeHtml(order.title || 'Заказ')}</h5>
                <span class="order-price">${Utils.formatMoney(response.price || order.price)}</span>
            </div>
        `;
    }

    function renderOrderDescription(order) {
        return order.description ? `
            <p class="order-description">${Utils.truncate(Utils.escapeHtml(order.description), 100)}</p>
        ` : '';
    }

    function renderOrderPhotos(order) {
        if (!order.photos?.length) return '';
        
        return `
            <div class="d-flex gap-2 mb-3 flex-wrap">
                ${order.photos.slice(0, 3).map(url => `
                    <img src="${url}" class="order-photo-thumb" 
                         onclick="event.stopPropagation(); window.open('${url}')" loading="lazy">
                `).join('')}
                ${order.photos.length > 3 ? `<span class="text-secondary">+${order.photos.length-3}</span>` : ''}
            </div>
        `;
    }

    function renderOrderMeta(order) {
        return `
            <div class="order-meta">
                <span><i class="fas fa-tag me-1"></i>${Utils.getCategoryName(order.category)}</span>
                <span><i class="fas fa-map-marker-alt me-1"></i>${Utils.escapeHtml(order.address || '')}</span>
                <span><i class="fas fa-user me-1"></i>${Utils.escapeHtml(order.clientName || 'Клиент')}</span>
            </div>
        `;
    }

    function renderStatusAndComment(status, response) {
        return `
            <div class="d-flex justify-content-between align-items-center mt-3">
                <span class="badge ${status.class}">
                    <i class="fas ${status.icon} me-1"></i>${status.text}
                </span>
                ${response.comment ? `
                    <small class="text-secondary">
                        <i class="fas fa-comment me-1"></i>${Utils.escapeHtml(response.comment)}
                    </small>
                ` : ''}
            </div>
        `;
    }

    function renderActionButtons(order, item, canComplete) {
        const buttons = [];
        
        if (canComplete) {
            buttons.push(`
                <button class="btn btn-sm btn-success" 
                        onclick="MasterCabinet.showCompleteModal('${item.orderId}', '${order.clientId}', '${Utils.escapeHtml(order.clientName || 'Клиент')}')">
                    <i class="fas fa-check-double me-1"></i>Завершить
                </button>
            `);
        }

        if (['in_progress', 'awaiting_confirmation', 'completed'].includes(item.status)) {
            buttons.push(`
                <button class="btn btn-sm btn-primary" onclick="MasterCabinet.openChat('${item.orderId}', '${order.clientId}')">
                    <i class="fas fa-comment me-1"></i>Чат
                </button>
            `);
        }

        return buttons.length ? `<div class="d-flex gap-2 mt-3 flex-wrap">${buttons.join('')}</div>` : '';
    }

    function renderClientReview(order) {
        if (order.status !== Orders.ORDER_STATUS.COMPLETED || !order.clientReview) return '';
        
        return `
            <div class="mt-3 p-3 bg-dark rounded">
                <small class="text-secondary">Отзыв клиента:</small>
                <div class="d-flex align-items-center mt-1">
                    <div class="me-2">${'★'.repeat(order.clientReview.rating)}${'☆'.repeat(5 - order.clientReview.rating)}</div>
                    <span class="text-secondary">${Utils.escapeHtml(order.clientReview.text || '')}</span>
                </div>
            </div>
        `;
    }

    // ===== ЗАГРУЗКА ЧАТОВ =====
    async function loadChats() {
        if (!DOM.chatsList) return;

        try {
            const user = Auth.getUser();
            if (!user) return;

            const chats = await Chat.getUserChats(user.uid);
            
            if (chats.length === 0) {
                showEmptyChats();
                return;
            }

            renderChats(chats);
            updateChatsBadge(chats);
            
        } catch (error) {
            console.error('❌ Ошибка загрузки чатов:', error);
            DOM.chatsList.innerHTML = '<div class="text-center p-5 text-danger">Ошибка загрузки</div>';
        }
    }

    // ===== ОТРИСОВКА ЧАТОВ =====
    function renderChats(chats) {
        DOM.chatsList.innerHTML = chats.map(chat => `
            <div class="chat-card ${chat.status === 'rejected' ? 'rejected' : ''}" 
                 onclick="window.location.href='${CONFIG?.getUrl('chat', { chatId: chat.id }) || '/HomeWork/chat.html?chatId=' + chat.id}'">
                <div class="chat-avatar"><i class="fas fa-user"></i></div>
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
    }

    // ===== ОБНОВЛЕНИЕ БЕЙДЖА ЧАТОВ =====
    function updateChatsBadge(chats) {
        const unreadCount = chats.reduce((sum, chat) => sum + (chat.unreadCount || 0), 0);
        const badge = document.getElementById('chatsUnread');
        if (badge) {
            badge.classList.toggle('d-none', unreadCount === 0);
            badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
        }
    }

    // ===== ИНИЦИАЛИЗАЦИЯ МОДАЛКИ ОТЗЫВА =====
    function initReviewModal() {
        initRatingStars();
        initSubmitButton();
        initModalCleanup();
    }

    // ===== ИНИЦИАЛИЗАЦИЯ ЗВЁЗД РЕЙТИНГА =====
    function initRatingStars() {
        const stars = document.querySelectorAll('#clientRatingStars .star');
        
        stars.forEach(star => {
            star.style.cursor = 'pointer';
            star.style.fontSize = '2rem';
            
            star.addEventListener('click', () => {
                const rating = parseInt(star.dataset.rating);
                state.currentRating = rating;
                updateStarsDisplay(rating);
            });
            
            star.addEventListener('mouseenter', () => {
                const hoverRating = parseInt(star.dataset.rating);
                updateStarsDisplay(hoverRating, true);
            });
            
            star.addEventListener('mouseleave', () => {
                updateStarsDisplay(state.currentRating);
            });
        });
    }

    // ===== ОБНОВЛЕНИЕ ОТОБРАЖЕНИЯ ЗВЁЗД =====
    function updateStarsDisplay(rating, isHover = false) {
        document.querySelectorAll('#clientRatingStars .star').forEach((star, index) => {
            if (index < rating) {
                star.innerHTML = '★';
                star.style.color = 'gold';
                star.style.textShadow = '0 0 10px gold';
            } else {
                star.innerHTML = '☆';
                star.style.color = 'gray';
                star.style.textShadow = 'none';
            }
        });
    }

    // ===== ИНИЦИАЛИЗАЦИЯ КНОПКИ ОТПРАВКИ =====
    function initSubmitButton() {
        if (!DOM.submitClientReview) return;
        
        const newBtn = DOM.submitClientReview.cloneNode(true);
        DOM.submitClientReview.parentNode.replaceChild(newBtn, DOM.submitClientReview);
        newBtn.addEventListener('click', submitClientReview);
    }

    // ===== ОЧИСТКА МОДАЛКИ ПРИ ЗАКРЫТИИ =====
    function initModalCleanup() {
        if (!DOM.reviewClientModal) return;
        
        DOM.reviewClientModal.addEventListener('hidden.bs.modal', () => {
            if (DOM.reviewClientText) DOM.reviewClientText.value = '';
            state.currentRating = 0;
            state.currentOrderId = null;
            state.currentClientId = null;
            updateStarsDisplay(0);
        });
    }

    // ===== ПОКАЗ МОДАЛКИ ЗАВЕРШЕНИЯ =====
    window.showCompleteModal = function(orderId, clientId, clientName) {
        state.currentOrderId = orderId;
        state.currentClientId = clientId;
        state.currentClientName = clientName;
        state.currentRating = 0;

        if (DOM.reviewClientName) {
            DOM.reviewClientName.textContent = clientName || 'Клиент';
        }
        if (DOM.reviewClientText) {
            DOM.reviewClientText.value = '';
        }

        updateStarsDisplay(0);

        if (DOM.reviewClientModal) {
            new bootstrap.Modal(DOM.reviewClientModal).show();
        }
    };

    // ===== ОТПРАВКА ОТЗЫВА О КЛИЕНТЕ =====
    async function submitClientReview() {
        if (!state.currentRating) {
            Utils.showNotification('Поставьте оценку клиенту', 'warning');
            return;
        }

        const comment = DOM.reviewClientText?.value || '';

        const result = await Orders.initiateCompletion(state.currentOrderId, {
            rating: state.currentRating,
            text: comment
        });

        if (result?.success) {
            bootstrap.Modal.getInstance(DOM.reviewClientModal)?.hide();
            Utils.showNotification('✅ Запрос на завершение отправлен клиенту', 'success');
            await loadMasterResponses(state.currentFilter);
            await loadMasterProfile();
        } else {
            Utils.showNotification(result?.error || '❌ Ошибка', 'error');
        }
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

            const chatUrl = CONFIG?.getUrl('chat', { chatId }) || `/HomeWork/chat.html?chatId=${chatId}`;
            
            Loader?.navigateTo(chatUrl, 'Открываем чат...');
            
        } catch (error) {
            console.error('❌ Ошибка при открытии чата:', error);
            Utils.showError('Не удалось открыть чат');
        } finally {
            Loader?.hide(loaderId);
        }
    };

    // ===== ПЕРЕКЛЮЧЕНИЕ ТАБОВ =====
    function switchTab(tabName) {
        document.querySelectorAll('[data-tab]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });

        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('d-none', content.id !== tabName + 'Tab');
        });

        if (tabName === 'chats') loadChats();

        updateUrlParam('tab', tabName);
        toggleMap(tabName === 'responses');
    }

    // ===== ОБНОВЛЕНИЕ URL =====
    function updateUrlParam(key, value) {
        if (!CONFIG) return;
        const url = new URL(window.location);
        url.searchParams.set(key, value);
        window.history.replaceState({}, '', url);
    }

    // ===== ФУНКЦИИ ДЛЯ КАРТЫ =====
    async function toggleMap(show) {
        if (!DOM.mapSection) return;
        
        DOM.mapSection.style.display = show ? 'block' : 'none';
        
        if (show) {
            await initMap();
        } else if (window.MasterMap) {
            MasterMap.destroy();
        }
    }

    async function initMap() {
        if (!window.ymaps) await loadYandexMapsAPI();
        
        const success = await MasterMap.init('masterMap');
        
        if (success) {
            await MasterMap.loadOrders(3);
            initRadiusButtons();
        }
    }

    function initRadiusButtons() {
        document.querySelectorAll('.radius-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                document.querySelectorAll('.radius-btn').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                MasterMap.setRadius(parseInt(this.dataset.radius));
            });
        });
    }

    async function loadYandexMapsAPI() {
        return new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = `https://api-maps.yandex.ru/2.1/?apikey=${YANDEX_MAPS_API_KEY}&lang=ru_RU`;
            script.onload = resolve;
            document.head.appendChild(script);
        });
    }

    // ===== ПРОВЕРКА ПАРАМЕТРОВ URL =====
    function checkUrlParams() {
        const urlParams = new URLSearchParams(window.location.search);
        const tabParam = urlParams.get('tab');
        
        if (tabParam === 'chats') {
            setTimeout(() => switchTab('chats'), 500);
        }
    }

    // ===== НАСТРОЙКА ОБРАБОТЧИКОВ =====
    function setupEventListeners() {
        document.querySelectorAll('[data-filter]').forEach(btn => {
            btn.addEventListener('click', function() {
                document.querySelectorAll('[data-filter]').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                loadMasterResponses(this.dataset.filter);
            });
        });

        document.querySelectorAll('[data-tab]').forEach(btn => {
            btn.addEventListener('click', () => switchTab(btn.dataset.tab));
        });

        document.getElementById('logoutBtn')?.addEventListener('click', (e) => {
            e.preventDefault();
            Auth.logout();
        });

        document.getElementById('themeToggle')?.addEventListener('click', Auth.toggleTheme);
        
        document.getElementById('notificationsBell')?.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            if (!Auth.isAuthenticated()) {
                AuthUI.showLoginModal();
                Utils.showInfo('Войдите, чтобы увидеть уведомления');
                return;
            }
            
            window.NotificationsCenter?.toggle();
        });
    }
        document.getElementById('editProfileBtn')?.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
    
            const user = Auth.getUser();
        if (!user) {
            AuthUI.showLoginModal();
            Utils.showInfo('Войдите, чтобы редактировать профиль');
            return;
        }
    
        // Переходим на страницу редактирования
        const editUrl = CONFIG?.getUrl('masterEdit', { id: user.uid }) || `/HomeWork/master-edit.html?id=${user.uid}`;
    
        if (window.Loader) {
            Loader.navigateTo(editUrl, 'Загружаем редактор...');
        } else {
            window.location.href = editUrl;
        }
    });

        // Кнопка настроек (если есть)
            document.getElementById('profileSettingsBtn')?.addEventListener('click', (e) => {
            e.preventDefault();
        // Можно объединить с editProfileBtn или сделать отдельную логику
            document.getElementById('editProfileBtn')?.click();
    });
    // ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =====
    function setText(elementId, text) {
        const el = document.getElementById(elementId);
        if (el) el.textContent = text;
    }

    function updateRatingDisplay(elementId, rating) {
        const el = document.getElementById(elementId);
        if (!el) return;
        
        const stars = '★'.repeat(Math.floor(rating)) + '☆'.repeat(5 - Math.floor(rating));
        el.innerHTML = `${stars} ${rating.toFixed(1)}`;
    }

    function showLoading(show) {
        if (DOM.loadingSkeleton) {
            DOM.loadingSkeleton.classList.toggle('d-none', !show);
        }
        if (DOM.masterCabinet) {
            DOM.masterCabinet.classList.toggle('d-none', show);
        }
    }

    function setLoadingText(text) {
        if (DOM.loadingText) DOM.loadingText.textContent = text;
    }

    function showLoadingResponses() {
        if (DOM.responsesList) {
            DOM.responsesList.innerHTML = '<div class="text-center p-5"><div class="spinner-border"></div><p class="mt-2">Загрузка...</p></div>';
        }
    }

    function showEmptyResponses() {
        if (!DOM.responsesList) return;
        
        DOM.responsesList.innerHTML = `
            <div class="text-center p-5">
                <i class="fas fa-inbox fa-3x mb-3" style="color: var(--border);"></i>
                <h5>Нет откликов</h5>
                <a href="${CONFIG?.getUrl('home', { focus: 'search' }) || '/?focus=search'}" class="btn btn-primary mt-3">
                    <i class="fas fa-search me-2"></i>Найти заказы
                </a>
            </div>
        `;
    }

    function showEmptyChats() {
        if (!DOM.chatsList) return;
        
        DOM.chatsList.innerHTML = `
            <div class="text-center p-5">
                <i class="fas fa-comments fa-3x mb-3" style="color: var(--border);"></i>
                <h5>Нет активных чатов</h5>
                <p class="text-secondary">Чаты появятся после откликов на заказы</p>
            </div>
        `;
    }

    function showError(message) {
        if (DOM.responsesList) {
            DOM.responsesList.innerHTML = `<div class="text-center p-5 text-danger">${message}</div>`;
        }
    }

    function animateCards(selector) {
        setTimeout(() => {
            document.querySelectorAll(selector).forEach((card, i) => {
                card.style.animation = `fadeInUp 0.3s ease ${i * 0.05}s forwards`;
                card.style.opacity = '0';
            });
        }, 100);
    }

    function animateElements() {
        document.querySelectorAll('.order-card, .chat-card').forEach(el => {
            el.classList.add('fade-in-up');
        });
    }

    function handleFatalError(error) {
        console.error('❌ Критическая ошибка:', error);
        Utils.showError('Не удалось загрузить кабинет. Обновите страницу.');
        
        if (DOM.loadingSkeleton) {
            DOM.loadingSkeleton.innerHTML = `
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

    function getStatusConfig(status) {
        const configs = {
            'open': { class: 'bg-warning text-dark', text: '⏳ Ожидает', icon: 'fa-clock' },
            'in_progress': { class: 'bg-primary', text: '🔨 В работе', icon: 'fa-spinner fa-spin' },
            'awaiting_confirmation': { class: 'bg-info text-dark', text: '🟡 Ждёт подтверждения', icon: 'fa-hourglass-half' },
            'completed': { class: 'bg-success', text: '✅ Выполнен', icon: 'fa-check-circle' },
            'cancelled': { class: 'bg-secondary', text: '❌ Отменён', icon: 'fa-times-circle' }
        };
        return configs[status] || configs.open;
    }

    // ===== ПУБЛИЧНОЕ API =====
    const api = {
        init,
        switchTab,
        filterResponses: loadMasterResponses,
        showCompleteModal,
        openChat,
        loadChats
    };

    window.__MASTER_CABINET_INITIALIZED__ = true;
    
    // Автозапуск
    document.addEventListener('DOMContentLoaded', () => init());

    console.log('✅ MasterCabinet загружен (элегантная версия)');
    return Object.freeze(api);
})();

window.MasterCabinet = MasterCabinet;