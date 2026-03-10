// ============================================
// ЛОГИКА КАБИНЕТА КЛИЕНТА (ИСПРАВЛЕННАЯ ВЕРСИЯ)
// ============================================

(function() {
    console.log('🚀 Client.js загружен');

    // ===== СОСТОЯНИЕ =====
    let currentFilter = 'all';
    let allOrders = [];
    let currentOrderForReview = null;
    let currentOrderForCancel = null;  // НОВАЯ ПЕРЕМЕННАЯ
    let currentRating = 0;

    // ===== DOM ЭЛЕМЕНТЫ =====
    const $ = (id) => document.getElementById(id);

    const loadingSkeleton = document.getElementById('loadingSkeleton');
    const clientCabinet = document.getElementById('clientCabinet');
    const loadingText = document.getElementById('loadingText');

    // ===== ИНИЦИАЛИЗАЦИЯ =====
    document.addEventListener('DOMContentLoaded', () => {
        console.log('📄 Страница клиента загружается...');

        if (loadingSkeleton) {
            loadingSkeleton.classList.remove('d-none');
        }
        if (clientCabinet) {
            clientCabinet.classList.add('d-none');
        }

        populateCategorySelect();

        (async () => {
            try {
                if (!window.Auth) {
                    throw new Error('Auth не загружен');
                }

                const initState = await Auth.waitForInit(5000);
                
                console.log('📦 Auth инициализирован:', initState);

                if (!initState.isAuthenticated) {
                    console.log('🚫 Не авторизован, редирект');
                    sessionStorage.setItem('redirectAfterLogin', window.location.href);
                    window.location.href = '/HomeWork/';
                    return;
                }

                if (loadingText) loadingText.textContent = 'Загружаем данные пользователя...';
                
                const userData = await Auth.waitForData(5000);
                
                if (!userData) {
                    throw new Error('Не удалось загрузить данные пользователя');
                }

                console.log('📦 Данные пользователя:', userData);

                if (userData.role !== USER_ROLE.CLIENT) {
                    console.log('❌ Неправильная роль:', userData.role);
                    Utils.showNotification('❌ Эта страница только для клиентов', 'warning');
                    setTimeout(() => window.location.href = '/HomeWork/', 1500);
                    return;
                }

                console.log('✅ Клиент подтверждён, загружаем кабинет');
                
                if (loadingText) loadingText.textContent = 'Загружаем ваш кабинет...';

                await Promise.all([
                    loadClientProfile(),
                    loadClientOrders('all'),
                    loadChats()
                ]);

                if (window.BottomNav) {
                    BottomNav.highlightActive();
                }

                checkUrlParams();

                setTimeout(() => {
                    if (loadingSkeleton) loadingSkeleton.classList.add('d-none');
                    if (clientCabinet) clientCabinet.classList.remove('d-none');
                    
                    document.querySelectorAll('.order-card-premium, .tab-content').forEach(el => {
                        el.classList.add('fade-in');
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
        initCancelModal();      // НОВАЯ ФУНКЦИЯ
        initCreateOrderForm();
    });

    // ===== ЗАПОЛНЕНИЕ SELECT КАТЕГОРИЙ =====
    function populateCategorySelect() {
        const select = $('orderCategory');
        if (!select) return;

        let options = '<option value="">Выберите категорию</option>';
        
        ORDER_CATEGORIES.forEach(cat => {
            if (cat.id !== 'all') {
                options += `<option value="${cat.id}">${cat.name}</option>`;
            }
        });
        
        select.innerHTML = options;
    }

    // ===== ИНИЦИАЛИЗАЦИЯ МОДАЛКИ ОТЗЫВА =====
    function initReviewModal() {
        document.querySelectorAll('#reviewModal .star, #reviewStars .star').forEach(star => {
            star.addEventListener('click', function() {
                const rating = parseInt(this.dataset.rating);
                currentRating = rating;
                
                document.querySelectorAll('#reviewModal .star, #reviewStars .star').forEach((s, i) => {
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
                
                document.querySelectorAll('#reviewModal .star, #reviewStars .star').forEach(s => {
                    s.innerHTML = '☆';
                    s.classList.remove('active');
                });
                
                currentRating = 0;
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

    // ===== ИНИЦИАЛИЗАЦИЯ МОДАЛКИ ОТМЕНЫ (НОВАЯ) =====
    function initCancelModal() {
        const cancelConfirmCheck = document.getElementById('cancelConfirm');
        const confirmCancelBtn = document.getElementById('confirmCancelBtn');
        
        if (cancelConfirmCheck && confirmCancelBtn) {
            cancelConfirmCheck.addEventListener('change', function() {
                confirmCancelBtn.disabled = !this.checked;
            });
            
            confirmCancelBtn.addEventListener('click', confirmCancel);
        }
        
        const modal = document.getElementById('cancelOrderModal');
        if (modal) {
            modal.addEventListener('hidden.bs.modal', function() {
                document.getElementById('cancelReason').value = '';
                document.getElementById('cancelConfirm').checked = false;
                document.getElementById('confirmCancelBtn').disabled = true;
                currentOrderForCancel = null;
            });
        }
    }

    // ===== ПОКАЗ МОДАЛКИ ОТМЕНЫ (НОВАЯ) =====
    window.showCancelModal = function(orderId) {
        currentOrderForCancel = orderId;
        
        const modalEl = document.getElementById('cancelOrderModal');
        if (!modalEl) return;
        
        // Сбрасываем форму
        document.getElementById('cancelReason').value = '';
        document.getElementById('cancelConfirm').checked = false;
        document.getElementById('confirmCancelBtn').disabled = true;
        
        const modal = new bootstrap.Modal(modalEl);
        modal.show();
    };

    // ===== ПОДТВЕРЖДЕНИЕ ОТМЕНЫ (НОВАЯ) =====
    async function confirmCancel() {
        if (!currentOrderForCancel) return;
        
        const reason = document.getElementById('cancelReason')?.value || '';
        
        const result = await Orders.cancelOrder(currentOrderForCancel, reason);
        
        if (result && result.success) {
            const modalEl = document.getElementById('cancelOrderModal');
            const modal = bootstrap.Modal.getInstance(modalEl);
            if (modal) modal.hide();
            
            Utils.showSuccess('✅ Заказ отменён');
            await loadClientOrders(currentFilter);
        } else {
            Utils.showError(result?.error || '❌ Ошибка при отмене');
        }
    }

    // ===== ИНИЦИАЛИЗАЦИЯ ФОРМЫ СОЗДАНИЯ ЗАКАЗА =====
    function initCreateOrderForm() {
        const photoInput = $('orderPhotos');
        const uploadBtn = $('uploadPhotoBtn');
        const preview = $('photoPreview');
        
        if (uploadBtn && photoInput) {
            uploadBtn.addEventListener('click', () => photoInput.click());
            
            photoInput.addEventListener('change', function(e) {
                const files = Array.from(e.target.files);
                
                if (files.length > 5) {
                    Utils.showWarning('Максимум 5 фотографий');
                    this.value = '';
                    return;
                }
                
                preview.innerHTML = files.map((file, index) => `
                    <div class="photo-preview-item" data-index="${index}">
                        <i class="fas fa-image"></i>
                        <span>${Utils.truncate(file.name, 15)}</span>
                        <span class="remove-photo" onclick="this.parentElement.remove()">×</span>
                    </div>
                `).join('');
            });
        }

        const submitBtn = $('createOrderSubmit');
        if (submitBtn) {
            submitBtn.addEventListener('click', handleCreateOrder);
        }
    }

    // ===== ОБРАБОТКА СОЗДАНИЯ ЗАКАЗА =====
    async function handleCreateOrder() {
        const category = $('orderCategory')?.value;
        const title = $('orderTitle')?.value?.trim();
        const description = $('orderDescription')?.value?.trim();
        const price = parseInt($('orderPrice')?.value);
        const address = $('orderAddress')?.value?.trim();
        const urgent = $('orderUrgent')?.checked;
        const photos = Array.from($('orderPhotos')?.files || []);

        if (!category) {
            Utils.showNotification('Выберите категорию', 'warning');
            return;
        }

        if (!title || title.length < 5) {
            Utils.showNotification('Название должно быть не менее 5 символов', 'warning');
            return;
        }

        if (!price || price < 500 || price > 1000000) {
            Utils.showNotification('Цена должна быть от 500 до 1 000 000 ₽', 'warning');
            return;
        }

        if (!address) {
            Utils.showNotification('Укажите адрес', 'warning');
            return;
        }

        const orderData = {
            category,
            title,
            description,
            price,
            address,
            urgent: urgent || false,
            photos: photos
        };

        const result = await Orders.create(orderData);

        if (result && result.success) {
            Utils.showSuccess('✅ Заказ создан!');
            
            $('orderCategory').value = '';
            $('orderTitle').value = '';
            $('orderDescription').value = '';
            $('orderPrice').value = '';
            $('orderAddress').value = '';
            $('orderUrgent').checked = false;
            $('orderPhotos').value = '';
            $('photoPreview').innerHTML = '';
            
            switchTab('orders');
            await loadClientOrders('all');
        } else {
            Utils.showNotification(result?.error || '❌ Ошибка создания заказа', 'error');
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
                ratingEl.textContent = rating.toFixed(1);
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
                        <p class="text-secondary">Создайте свой первый заказ</p>
                        <button class="btn btn-primary mt-3" onclick="window.switchClientTab('new')">
                            <i class="fas fa-plus-circle me-2"></i>Создать заказ
                        </button>
                    </div>
                `;
                return;
            }

            ordersList.innerHTML = orders.map(order => createOrderCard(order)).join('');
            
            setTimeout(() => {
                document.querySelectorAll('#ordersList .order-card').forEach((card, i) => {
                    card.style.animation = `fadeInUp 0.3s ease ${i * 0.05}s forwards`;
                    card.style.opacity = '0';
                });
            }, 100);
            
        } catch (error) {
            console.error('❌ Ошибка загрузки заказов:', error);
            ordersList.innerHTML = '<div class="text-center p-5 text-danger">Ошибка загрузки</div>';
        }
    }

    // ===== СОЗДАНИЕ КАРТОЧКИ ЗАКАЗА (ОБНОВЛЕНО) =====
    function createOrderCard(order) {
        const statusConfig = {
            'open': { class: 'bg-primary', text: '🔵 Активен', icon: 'fa-clock' },
            'in_progress': { class: 'bg-warning text-dark', text: '🟠 В работе', icon: 'fa-spinner fa-spin' },
            'awaiting_confirmation': { class: 'bg-info text-dark', text: '🟡 Ожидает подтверждения', icon: 'fa-hourglass-half' },
            'completed': { class: 'bg-success', text: '✅ Завершён', icon: 'fa-check-circle' },
            'cancelled': { class: 'bg-secondary', text: '❌ Отменён', icon: 'fa-times-circle' }
        };

        const status = statusConfig[order.status] || statusConfig.open;
        const hasResponses = order.responses && order.responses.length > 0;
        const hasMaster = !!order.selectedMasterId;
        const needsConfirmation = order.status === 'awaiting_confirmation';
        const canReview = order.status === 'completed' && !order.clientReview;
        const canCancel = order.status === 'open';  // Только открытые можно отменить

        return `
            <div class="order-card mb-3" data-order-id="${order.id}">
                <div class="order-header">
                    <h5 class="order-title">${Utils.escapeHtml(order.title || 'Заказ')}</h5>
                    <span class="order-price">${Utils.formatMoney(order.price)}</span>
                </div>
                
                <p class="order-description">${Utils.truncate(Utils.escapeHtml(order.description || ''), 100)}</p>
                
                ${order.photos && order.photos.length ? `
                    <div class="d-flex gap-2 mb-3 flex-wrap">
                        ${order.photos.slice(0, 3).map(url => 
                            `<img src="${url}" class="order-photo-thumb" onclick="window.open('${url}')" loading="lazy">`
                        ).join('')}
                        ${order.photos.length > 3 ? `<span class="text-secondary">+${order.photos.length-3}</span>` : ''}
                    </div>
                ` : ''}
                
                <div class="order-meta">
                    <span><i class="fas fa-tag me-1"></i>${Utils.getCategoryName(order.category)}</span>
                    <span><i class="fas fa-calendar me-1"></i>${Utils.formatDate(order.createdAt)}</span>
                    ${order.city ? `<span><i class="fas fa-map-marker-alt me-1"></i>${Utils.escapeHtml(order.city)}</span>` : ''}
                </div>
                
                <div class="d-flex justify-content-between align-items-center mt-3">
                    <span class="badge ${status.class}">
                        <i class="fas ${status.icon} me-1"></i>${status.text}
                    </span>
                    
                    <div class="d-flex gap-2 flex-wrap">
                        ${needsConfirmation ? `
                            <button class="btn btn-sm btn-success" onclick="showConfirmCompletionModal('${order.id}')">
                                <i class="fas fa-check-circle me-1"></i>Подтвердить
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
                                <i class="fas fa-star me-1"></i>Отзыв
                            </button>` : ''}
                        
                        ${canCancel ? `
                            <button class="btn btn-sm btn-cancel-order" onclick="event.stopPropagation(); showCancelModal('${order.id}')">
                                <i class="fas fa-times me-1"></i>Отменить
                            </button>
                        ` : ''}
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
                
                ${order.status === 'cancelled' && order.cancelReason ? `
                    <div class="mt-3 p-3 bg-dark rounded">
                        <small class="text-secondary">Причина отмены:</small>
                        <p class="mb-0 text-secondary">${Utils.escapeHtml(order.cancelReason)}</p>
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
        
        const modalBody = document.querySelector('#reviewModal .modal-body');
        if (modalBody) {
            modalBody.innerHTML = `
                <p class="mb-4 text-center">Заказ выполнен качественно?</p>
                <div class="mb-3">
                    <label class="form-label text-center d-block">Оцените мастера</label>
                    <div class="rating-stars text-center mb-2" id="confirmRatingStars">
                        <span class="star" data-rating="1">☆</span>
                        <span class="star" data-rating="2">☆</span>
                        <span class="star" data-rating="3">☆</span>
                        <span class="star" data-rating="4">☆</span>
                        <span class="star" data-rating="5">☆</span>
                    </div>
                </div>
                <div class="mb-3">
                    <label class="form-label">Отзыв (необязательно)</label>
                    <textarea class="form-control" id="reviewText" rows="3" 
                              placeholder="Напишите пару слов о работе..."></textarea>
                </div>
            `;
        }
        
        document.querySelectorAll('#confirmRatingStars .star').forEach(star => {
            star.addEventListener('click', function() {
                const rating = parseInt(this.dataset.rating);
                currentRating = rating;
                
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
        if (submitBtn) {
            submitBtn.innerHTML = '<i class="fas fa-check-circle me-2"></i>Подтвердить выполнение';
        }
        
        const modal = new bootstrap.Modal(modalEl);
        modal.show();
    };

    // ===== ОТПРАВКА ОТЗЫВА И ПОДТВЕРЖДЕНИЕ =====
    async function submitReview() {
        if (!currentRating && !currentOrderForReview) {
            Utils.showNotification('Поставьте оценку!', 'warning');
            return;
        }

        const reviewText = document.getElementById('reviewText')?.value || '';
        
        try {
            let result;
            
            if (currentOrderForReview) {
                result = await Orders.confirmCompletion(currentOrderForReview, {
                    rating: currentRating,
                    text: reviewText
                });
                
                if (result.success) {
                    Utils.showSuccess('✅ Заказ завершён! Спасибо за отзыв!');
                }
            }

            const modalEl = document.getElementById('reviewModal');
            if (modalEl) {
                const modal = bootstrap.Modal.getInstance(modalEl);
                if (modal) modal.hide();
            }
            
            await loadClientOrders(currentFilter);
            await loadClientProfile();
            
        } catch (error) {
            console.error('❌ Ошибка:', error);
            Utils.showNotification('❌ Ошибка', 'error');
        } finally {
            currentRating = 0;
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
                <i class="fas fa-star me-2" style="color: gold;"></i>
                Оцените работу мастера
            `;
        }
        
        const modalBody = document.querySelector('#reviewModal .modal-body');
        if (modalBody) {
            modalBody.innerHTML = `
                <p class="mb-4 text-center">Как прошло сотрудничество?</p>
                <div class="mb-3">
                    <label class="form-label text-center d-block">Оценка</label>
                    <div class="rating-stars text-center mb-2" id="reviewRatingStars">
                        <span class="star" data-rating="1">☆</span>
                        <span class="star" data-rating="2">☆</span>
                        <span class="star" data-rating="3">☆</span>
                        <span class="star" data-rating="4">☆</span>
                        <span class="star" data-rating="5">☆</span>
                    </div>
                </div>
                <div class="mb-3">
                    <label class="form-label">Отзыв</label>
                    <textarea class="form-control" id="reviewText" rows="3" 
                              placeholder="Напишите пару слов о работе..."></textarea>
                </div>
            `;
        }
        
        document.querySelectorAll('#reviewRatingStars .star').forEach(star => {
            star.addEventListener('click', function() {
                const rating = parseInt(this.dataset.rating);
                currentRating = rating;
                
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
        if (submitBtn) {
            submitBtn.innerHTML = '<i class="fas fa-paper-plane me-2"></i>Отправить отзыв';
        }
        
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
                            window.location.href = `/HomeWork/chat.html?chatId=${result.chatId}`;
                        }
                    }
                }, 1500);
            }
        } catch (error) {
            console.error('Ошибка:', error);
            Utils.showError('Ошибка при выборе мастера');
        }
    };

    // ===== ОТКРЫТЬ ЧАТ =====
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
            
            const chatUrl = window.CONFIG 
                ? CONFIG.getUrl('chat', { chatId })
                : `/HomeWork/chat.html?chatId=${chatId}`;
            
            if (window.Loader) {
                Loader.navigateTo(chatUrl, 'Открываем чат...');
            } else {
                window.location.href = chatUrl;
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
                container.style.animation = 'slideDown 0.3s ease';
            } else {
                container.style.animation = 'slideUp 0.3s ease';
                setTimeout(() => {
                    container.style.display = 'none';
                }, 280);
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
                <div class="chat-card" onclick="window.location.href='${CONFIG?.getUrl('chat', { chatId: chat.id }) || '/HomeWork/chat.html?chatId=' + chat.id}'">
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
                content.style.animation = 'fadeIn 0.3s ease';
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

    // ===== ИНИЦИАЛИЗАЦИЯ ОБРАБОТЧИКОВ (ОБНОВЛЕНО) =====
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

        // НОВЫЙ ОБРАБОТЧИК ДЛЯ УВЕДОМЛЕНИЙ
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

    document.addEventListener('switch-client-tab', (e) => {
        if (e.detail && e.detail.tab) {
            switchTab(e.detail.tab);
        }
    });

    window.switchClientTab = switchTab;
    window.ClientCabinet = {
        switchTab: switchTab,
        filterOrders: loadClientOrders,
        loadChats: loadChats
    };
})();