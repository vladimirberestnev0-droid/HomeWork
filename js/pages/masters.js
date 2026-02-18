// ===== MASTERS.JS — Логика кабинета мастера =====
// ПОЛНОСТЬЮ ИСПРАВЛЕННАЯ ВЕРСИЯ

(function() {
    // Состояние
    let calendar = null;
    let portfolioPhotos = [];

    // ============================================
    // ФУНКЦИИ ОТОБРАЖЕНИЯ
    // ============================================

    // Отображение бейджей
    async function displayBadges(masterId) {
        const badges = await Badges.getMasterBadges(masterId);
        const container = document.getElementById('badgesContainer');
        if (container) {
            Badges.renderBadges(badges, container);
        }
    }

    // Обновление звезд рейтинга
    function updateRatingStars(rating) {
        const starsElement = document.getElementById('ratingStars');
        if (!starsElement) return;
        
        const fullStars = Math.floor(rating);
        const hasHalfStar = rating - fullStars >= 0.5;
        let stars = '';
        
        for (let i = 0; i < 5; i++) {
            if (i < fullStars) stars += '★';
            else if (i === fullStars && hasHalfStar) stars += '½';
            else stars += '☆';
        }
        starsElement.innerHTML = stars;
    }

    // Загрузка данных мастера
    async function loadMasterData(state) {
        const userData = state.userData;
        
        const masterNameEl = document.getElementById('masterName');
        if (masterNameEl) {
            masterNameEl.innerText = userData?.name || 'Мастер';
        }
        
        const masterEmailEl = document.getElementById('masterEmail');
        if (masterEmailEl) {
            masterEmailEl.innerText = userData?.email || '';
        }
        
        const masterPhoneEl = document.getElementById('masterPhone');
        if (masterPhoneEl) {
            masterPhoneEl.innerText = userData?.phone || 'Телефон не указан';
        }
        
        const masterCategoriesEl = document.getElementById('masterCategories');
        if (masterCategoriesEl) {
            masterCategoriesEl.innerHTML = userData?.categories || 'Ремонт и отделка';
        }
        
        const masterSinceEl = document.getElementById('masterSince');
        if (masterSinceEl && userData?.createdAt) {
            const date = userData.createdAt.toDate();
            masterSinceEl.innerHTML = `На платформе с ${date.toLocaleDateString('ru-RU')}`;
        } else if (masterSinceEl) {
            masterSinceEl.innerHTML = 'На платформе с 2025';
        }
        
        const rating = userData?.rating || 0;
        const reviews = userData?.reviews || 0;
        
        const masterRatingEl = document.getElementById('masterRating');
        if (masterRatingEl) {
            masterRatingEl.innerHTML = rating.toFixed(1);
        }
        
        const masterReviewsEl = document.getElementById('masterReviews');
        if (masterReviewsEl) {
            masterReviewsEl.innerHTML = `${reviews} ${Helpers.pluralize(reviews, ['отзыв', 'отзыва', 'отзывов'])}`;
        }
        
        updateRatingStars(rating);
    }

    // ============================================
    // ФУНКЦИИ РАБОТЫ С ОТКЛИКАМИ
    // ============================================

    // Создание карточки отклика
    function createResponseCard(item) {
        const div = document.createElement('div');
        div.className = 'response-item';
        
        const order = item.order;
        const response = item.response;
        
        const responseDate = response.createdAt ? 
            Helpers.formatDate(response.createdAt) : 'сегодня';
        
        let statusClass = '';
        let statusText = '';
        if (item.status === ORDER_STATUS.OPEN) {
            statusClass = 'badge-warning';
            statusText = '⏳ Ожидает ответа клиента';
        } else if (item.status === ORDER_STATUS.IN_PROGRESS) {
            statusClass = 'badge-info';
            statusText = '🔨 Заказ в работе';
        } else if (item.status === ORDER_STATUS.COMPLETED) {
            statusClass = 'badge-success';
            statusText = '✅ Заказ выполнен';
        }
        
        // Фото заказа
        let photosHtml = '';
        if (order.photos?.length > 0) {
            photosHtml = `
                <div class="d-flex gap-2 mt-3 flex-wrap">
                    ${order.photos.slice(0, 3).map(url => 
                        `<img src="${url}" style="width: 60px; height: 60px; object-fit: cover; border-radius: var(--radius-sm); cursor: pointer;" onclick="window.open('${url}')">`
                    ).join('')}
                </div>
            `;
        }
        
        div.innerHTML = `
            <div class="order-header">
                <div>
                    <span class="order-title">${Helpers.escapeHtml(order.title || 'Заказ')}</span>
                    <span class="badge badge-info ms-2">${order.category || 'Без категории'}</span>
                </div>
                <span class="order-price">${response.price} ₽</span>
            </div>
            
            <span class="badge ${statusClass} mb-3">${statusText}</span>
            
            ${photosHtml}
            
            <div class="order-meta my-3">
                <span><i class="fas fa-user"></i> ${Helpers.escapeHtml(order.clientName || 'Клиент')}</span>
                <span><i class="fas fa-map-marker-alt"></i> ${Helpers.escapeHtml(order.address || 'Адрес не указан')}</span>
                <span><i class="fas fa-tag"></i> Бюджет: ${order.price} ₽</span>
                <span><i class="fas fa-calendar"></i> Отклик: ${responseDate}</span>
            </div>
            
            <div class="card p-3 mb-3 bg-light">
                <p class="mb-0">
                    <i class="fas fa-comment me-2" style="color: var(--accent);"></i>
                    ${Helpers.escapeHtml(response.comment || 'Без комментария')}
                </p>
            </div>
            
            <div class="d-flex gap-2">
                <button onclick="window.openChat('${item.orderId}', '${order.clientId}')" class="btn">
                    <i class="fas fa-comment"></i> Чат
                </button>
                
                ${item.status === ORDER_STATUS.IN_PROGRESS ? `
                    <button onclick="window.completeOrder('${item.orderId}')" class="btn btn-success">
                        <i class="fas fa-check-double"></i> Заказ выполнен
                    </button>
                ` : ''}
            </div>
        `;
        
        return div;
    }

    // Обновление статистики
    function updateStats(responses) {
        const total = responses.length;
        const accepted = responses.filter(r => r.status === ORDER_STATUS.IN_PROGRESS || r.status === ORDER_STATUS.COMPLETED).length;
        const completed = responses.filter(r => r.status === ORDER_STATUS.COMPLETED).length;
        
        const statResponses = document.getElementById('statResponses');
        if (statResponses) statResponses.innerText = total;
        
        const statAccepted = document.getElementById('statAccepted');
        if (statAccepted) statAccepted.innerText = accepted;
        
        const statCompleted = document.getElementById('statCompleted');
        if (statCompleted) statCompleted.innerText = completed;
        
        const conversion = total > 0 ? Math.round((accepted / total) * 100) : 0;
        
        const conversionRate = document.getElementById('conversionRate');
        if (conversionRate) conversionRate.innerText = `${conversion}%`;
        
        const conversionBar = document.getElementById('conversionBar');
        if (conversionBar) conversionBar.style.width = `${conversion}%`;
    }

    // Загрузка откликов
    async function loadMasterResponses(filter = 'all') {
        const responsesList = document.getElementById('responsesList');
        if (!responsesList) return;
        
        responsesList.innerHTML = '<div class="text-center p-5"><i class="fas fa-spinner fa-spin fa-3x"></i></div>';
        
        try {
            const user = Auth.getUser();
            if (!user) return;
            
            const responses = await Orders.getMasterResponses(user.uid);
            
            // Фильтрация
            let filtered = responses;
            if (filter === 'pending') {
                filtered = responses.filter(r => r.status === ORDER_STATUS.OPEN);
            } else if (filter === 'accepted') {
                filtered = responses.filter(r => r.status === ORDER_STATUS.IN_PROGRESS);
            } else if (filter === 'completed') {
                filtered = responses.filter(r => r.status === ORDER_STATUS.COMPLETED);
            }
            
            // Обновить статистику
            updateStats(responses);
            
            if (filtered.length === 0) {
                responsesList.innerHTML = `
                    <div class="text-center p-5">
                        <i class="fas fa-inbox fa-3x mb-3" style="color: var(--border);"></i>
                        <h5>Нет откликов</h5>
                        <p class="text-secondary">Вы ещё не откликались на заказы</p>
                        <a href="index.html" class="btn">Найти заказы</a>
                    </div>
                `;
                return;
            }
            
            responsesList.innerHTML = '';
            filtered.forEach(item => {
                responsesList.appendChild(createResponseCard(item));
            });
            
        } catch (error) {
            console.error('❌ Ошибка загрузки откликов:', error);
            responsesList.innerHTML = '<div class="text-center p-5 text-danger">Ошибка загрузки</div>';
        }
    }

    // ============================================
    // ФУНКЦИИ РАБОТЫ С ПОРТФОЛИО
    // ============================================

    // Загрузка портфолио
    async function loadPortfolio() {
        const grid = document.getElementById('portfolioGrid');
        if (!grid) return;
        
        try {
            const user = Auth.getUser();
            if (!user) return;
            
            const snapshot = await db.collection('portfolio')
                .where('masterId', '==', user.uid)
                .orderBy('createdAt', 'desc')
                .get();
            
            if (snapshot.empty) {
                grid.innerHTML = `
                    <div class="text-center p-5">
                        <i class="fas fa-images fa-3x mb-3" style="color: var(--border);"></i>
                        <h5>Портфолио пусто</h5>
                        <p class="text-secondary">Добавьте свои работы</p>
                    </div>
                `;
                return;
            }
            
            grid.innerHTML = '';
            snapshot.forEach(doc => {
                const work = doc.data();
                const div = document.createElement('div');
                div.className = 'portfolio-item';
                div.onclick = () => viewPortfolio(work.imageUrl, work.title, work.description);
                div.innerHTML = `
                    <img src="${work.imageUrl}" class="portfolio-image">
                    <div class="portfolio-info p-3">
                        <h6 class="mb-1">${Helpers.escapeHtml(work.title)}</h6>
                        <small class="text-secondary">${work.category}</small>
                    </div>
                `;
                grid.appendChild(div);
            });
        } catch (error) {
            console.error('❌ Ошибка загрузки портфолио:', error);
        }
    }

    // ============================================
    // ФУНКЦИИ КАЛЕНДАРЯ
    // ============================================

    // Инициализация календаря
    function initCalendar() {
        const calendarEl = document.getElementById('calendar');
        if (!calendarEl) return;
        
        if (calendar) {
            calendar.destroy();
        }
        
        calendar = new FullCalendar.Calendar(calendarEl, {
            initialView: 'dayGridMonth',
            locale: 'ru',
            headerToolbar: {
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,timeGridDay'
            },
            events: async (info, successCallback) => {
                const user = Auth.getUser();
                if (!user) return;
                
                const orders = await db.collection('orders')
                    .where('selectedMasterId', '==', user.uid)
                    .where('status', 'in', [ORDER_STATUS.IN_PROGRESS, ORDER_STATUS.COMPLETED])
                    .get();
                
                const events = [];
                orders.forEach(doc => {
                    const order = doc.data();
                    if (order.createdAt) {
                        events.push({
                            title: order.title || 'Заказ',
                            start: order.createdAt.toDate(),
                            backgroundColor: '#E67A4B',
                            borderColor: '#E67A4B'
                        });
                    }
                });
                successCallback(events);
            }
        });
        calendar.render();
    }

    // ============================================
    // ФУНКЦИИ ПРАЙС-ЛИСТА
    // ============================================

    // Загрузка прайс-листа
    async function loadPriceList() {
        const container = document.getElementById('priceList');
        if (!container) return;
        
        const categories = [
            'Сантехника', 'Электрика', 'Отделочные работы', 
            'Мебель', 'Окна и двери', 'Клининг'
        ];
        
        container.innerHTML = categories.map(cat => `
            <div class="col-md-4">
                <div class="card p-4">
                    <h5 class="mb-3">${cat}</h5>
                    <div class="mb-2">
                        <label class="form-label">Минимальная цена</label>
                        <input type="number" class="form-control price-min" value="1000">
                    </div>
                    <div class="mb-2">
                        <label class="form-label">Цена за час</label>
                        <input type="number" class="form-control price-hour" value="500">
                    </div>
                    <button class="btn w-100 mt-2 save-price" data-category="${cat}">Сохранить</button>
                </div>
            </div>
        `).join('');
    }

    // ============================================
    // ГЛОБАЛЬНЫЕ ФУНКЦИИ (ДЛЯ ONCLICK) — ИСПРАВЛЕНО!
    // ============================================

    // Переменные для хранения данных
    let currentCompleteOrderId = null;
    let customerRating = 0;

    // Установка рейтинга
    window.setCustomerRating = function(rating) {
        customerRating = rating;
        document.querySelectorAll('#completeOrderModal .rating-star').forEach(star => {
            const starRating = parseInt(star.dataset.rating);
            if (starRating <= rating) {
                star.classList.add('active');
            } else {
                star.classList.remove('active');
            }
        });
    };

    // Открытие модалки завершения
    window.completeOrder = async (orderId) => {
        console.log('📝 Открытие модалки завершения для заказа:', orderId);
        currentCompleteOrderId = orderId;
        customerRating = 0;
        
        // Сброс звезд
        document.querySelectorAll('#completeOrderModal .rating-star').forEach(star => {
            star.classList.remove('active');
        });
        
        // Очистка комментария
        const commentEl = document.getElementById('completeComment');
        if (commentEl) commentEl.value = '';
        
        // Показ модалки
        const modalEl = document.getElementById('completeOrderModal');
        if (modalEl) {
            const modal = new bootstrap.Modal(modalEl);
            modal.show();
        } else {
            console.error('❌ Модалка completeOrderModal не найдена в DOM');
            Helpers.showNotification('❌ Ошибка открытия формы', 'error');
        }
    };

    // Подтверждение завершения с отзывом
    document.getElementById('confirmCompleteBtn')?.addEventListener('click', async () => {
        console.log('🔄 Нажата кнопка подтверждения завершения');
        
        if (!currentCompleteOrderId) {
            Helpers.showNotification('❌ Ошибка: заказ не выбран', 'error');
            return;
        }
        
        // Если рейтинг не выбран - спросим
        if (customerRating === 0) {
            if (!confirm('Вы не поставили оценку. Продолжить без оценки?')) {
                return;
            }
        }
        
        try {
            // Получаем данные заказа
            console.log('📦 Загружаем данные заказа:', currentCompleteOrderId);
            const orderDoc = await db.collection('orders').doc(currentCompleteOrderId).get();
            
            if (!orderDoc.exists) {
                throw new Error('Заказ не найден');
            }
            
            const orderData = orderDoc.data();
            const clientId = orderData.clientId;
            
            // Создаем отзыв о заказчике
            if (customerRating > 0) {
                console.log('⭐ Сохраняем отзыв с рейтингом:', customerRating);
                
                const review = {
                    masterId: Auth.getUser().uid,
                    masterName: Auth.getUserData()?.name || 'Мастер',
                    rating: customerRating,
                    text: document.getElementById('completeComment')?.value || '',
                    createdAt: new Date().toISOString()
                };
                
                // Добавляем отзыв в документ заказа
                await db.collection('orders').doc(currentCompleteOrderId).update({
                    customerReviews: firebase.firestore.FieldValue.arrayUnion(review)
                });
                
                // Обновляем рейтинг заказчика (если нужно)
                const clientDoc = await db.collection('users').doc(clientId).get();
                if (clientDoc.exists) {
                    const clientData = clientDoc.data();
                    const newRating = ((clientData.rating || 0) * (clientData.reviews || 0) + customerRating) / ((clientData.reviews || 0) + 1);
                    
                    await db.collection('users').doc(clientId).update({
                        rating: newRating,
                        reviews: (clientData.reviews || 0) + 1
                    });
                }
            }
            
            // Завершаем заказ через Orders.completeOrder
            console.log('🔄 Вызываем Orders.completeOrder для заказа:', currentCompleteOrderId);
            const result = await Orders.completeOrder(currentCompleteOrderId);
            console.log('📊 Результат completeOrder:', result);
            
            if (result && result.success === true) {
                // Закрываем модалку
                const modal = bootstrap.Modal.getInstance(document.getElementById('completeOrderModal'));
                if (modal) modal.hide();
                
                // Показываем успех
                Helpers.showNotification('✅ Заказ выполнен!', 'success');
                
                // Перезагружаем список откликов
                const activeFilter = document.querySelector('.filter-tab.active')?.dataset.filter || 'all';
                await loadMasterResponses(activeFilter);
            } else {
                // Если ошибка в результате
                throw new Error(result?.error || 'Неизвестная ошибка при завершении заказа');
            }
            
        } catch (error) {
            console.error('❌ Ошибка при завершении заказа:', error);
            Helpers.showNotification(`❌ ${error.message}`, 'error');
            // Не закрываем модалку при ошибке
        }
    });

    // Открыть чат
    window.openChat = (orderId, clientId) => {
        const user = Auth.getUser();
        if (!user) {
            Helpers.showNotification('❌ Сначала войдите в систему', 'warning');
            return;
        }
        
        if (!orderId || !clientId) {
            console.error('❌ Ошибка: orderId или clientId не определены', { orderId, clientId });
            Helpers.showNotification('❌ Ошибка открытия чата', 'error');
            return;
        }
        
        console.log('📨 Открываем чат:', { orderId, clientId, masterId: user.uid });
        window.location.href = `chat.html?orderId=${orderId}&masterId=${user.uid}`;
    };

    // Просмотр портфолио
    window.viewPortfolio = (imageUrl, title, description) => {
        const imgEl = document.getElementById('viewPortfolioImage');
        if (imgEl) imgEl.src = imageUrl;
        
        const titleEl = document.getElementById('viewPortfolioTitle');
        if (titleEl) titleEl.innerText = title;
        
        const descEl = document.getElementById('viewPortfolioDesc');
        if (descEl) descEl.innerText = description;
        
        const modalEl = document.getElementById('viewPortfolioModal');
        if (modalEl) new bootstrap.Modal(modalEl).show();
    };

    // ============================================
    // ИНИЦИАЛИЗАЦИЯ ОБРАБОТЧИКОВ
    // ============================================

    function initEventListeners() {
        // Табы
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', function() {
                document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                this.classList.add('active');
                
                document.querySelectorAll('.tab-content').forEach(p => p.classList.remove('active'));
                const tabId = this.dataset.tab + 'Tab';
                document.getElementById(tabId)?.classList.add('active');
                
                if (this.dataset.tab === 'calendar' && calendar) {
                    calendar.render();
                }
            });
        });

        // Фильтры откликов
        document.querySelectorAll('.filter-tab').forEach(tab => {
            tab.addEventListener('click', function() {
                document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
                this.classList.add('active');
                loadMasterResponses(this.dataset.filter);
            });
        });

        // Редактирование профиля
        document.getElementById('editProfileBtn')?.addEventListener('click', () => {
            const userData = Auth.getUserData();
            const nameEl = document.getElementById('editName');
            if (nameEl) nameEl.value = userData?.name || '';
            
            const phoneEl = document.getElementById('editPhone');
            if (phoneEl) phoneEl.value = userData?.phone || '';
            
            const categoriesEl = document.getElementById('editCategories');
            if (categoriesEl) categoriesEl.value = userData?.categories || '';
            
            const bioEl = document.getElementById('editBio');
            if (bioEl) bioEl.value = userData?.bio || '';
            
            const modalEl = document.getElementById('editProfileModal');
            if (modalEl) new bootstrap.Modal(modalEl).show();
        });

        document.getElementById('saveProfileBtn')?.addEventListener('click', async () => {
            const user = Auth.getUser();
            if (!user) return;
            
            const name = document.getElementById('editName')?.value;
            const phone = document.getElementById('editPhone')?.value;
            const categories = document.getElementById('editCategories')?.value;
            const bio = document.getElementById('editBio')?.value;
            
            const result = await Auth.updateProfile(user.uid, { name, phone, categories, bio });
            if (result.success) {
                const modal = bootstrap.Modal.getInstance(document.getElementById('editProfileModal'));
                if (modal) modal.hide();
                await loadMasterData({ userData: Auth.getUserData() });
            }
        });

        // Добавление в портфолио
        document.getElementById('addPortfolioBtn')?.addEventListener('click', () => {
            portfolioPhotos = [];
            const previewEl = document.getElementById('portfolioPhotoPreview');
            if (previewEl) previewEl.innerHTML = '';
            
            const modalEl = document.getElementById('addPortfolioModal');
            if (modalEl) new bootstrap.Modal(modalEl).show();
        });

        const portfolioUploadArea = document.getElementById('portfolioUploadArea');
        const portfolioPhotoInput = document.getElementById('portfolioPhotoInput');

        if (portfolioUploadArea && portfolioPhotoInput) {
            portfolioUploadArea.addEventListener('click', () => portfolioPhotoInput.click());

            portfolioUploadArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                portfolioUploadArea.style.background = 'rgba(230,122,75,0.1)';
            });

            portfolioUploadArea.addEventListener('dragleave', () => {
                portfolioUploadArea.style.background = '';
            });

            portfolioUploadArea.addEventListener('drop', (e) => {
                e.preventDefault();
                portfolioUploadArea.style.background = '';
                handlePortfolioFile(e.dataTransfer.files[0]);
            });

            portfolioPhotoInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    handlePortfolioFile(e.target.files[0]);
                }
            });
        }

        function handlePortfolioFile(file) {
            if (!file || !file.type.startsWith('image/')) return;
            
            const reader = new FileReader();
            reader.onload = (e) => {
                const previewEl = document.getElementById('portfolioPhotoPreview');
                if (previewEl) {
                    previewEl.innerHTML = `
                        <img src="${e.target.result}" style="max-width: 100%; max-height: 200px; border-radius: var(--radius-md);">
                    `;
                }
                portfolioPhotos = [file];
            };
            reader.readAsDataURL(file);
        }

        document.getElementById('savePortfolioBtn')?.addEventListener('click', async () => {
            if (portfolioPhotos.length === 0) {
                alert('Загрузите фото');
                return;
            }
            
            try {
                const user = Auth.getUser();
                const userData = Auth.getUserData();
                if (!user || !userData) return;
                
                const file = portfolioPhotos[0];
                const fileName = `${user.uid}_${Date.now()}.jpg`;
                const storageRef = storage.ref(`portfolio/${fileName}`);
                await storageRef.put(file);
                const imageUrl = await storageRef.getDownloadURL();
                
                await db.collection('portfolio').add({
                    masterId: user.uid,
                    masterName: userData.name,
                    title: document.getElementById('portfolioTitle')?.value || '',
                    description: document.getElementById('portfolioDesc')?.value || '',
                    category: document.getElementById('portfolioCategory')?.value || 'Другое',
                    imageUrl: imageUrl,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                
                const modal = bootstrap.Modal.getInstance(document.getElementById('addPortfolioModal'));
                if (modal) modal.hide();
                
                await loadPortfolio();
                Helpers.showNotification('✅ Работа добавлена', 'success');
                
            } catch (error) {
                console.error('❌ Ошибка:', error);
                Helpers.showNotification('❌ Ошибка при добавлении', 'error');
            }
        });

        // Верификация
        document.getElementById('verifyMasterBtn')?.addEventListener('click', () => {
            const modalEl = document.getElementById('verifyModal');
            if (modalEl) new bootstrap.Modal(modalEl).show();
        });

        const verifyUploadArea = document.getElementById('verifyUploadArea');
        const verifyPhotoInput = document.getElementById('verifyPhotoInput');
        const agreeTerms = document.getElementById('agreeTerms');
        const submitVerification = document.getElementById('submitVerification');
        let verificationPhoto = null;

        if (verifyUploadArea && verifyPhotoInput) {
            verifyUploadArea.addEventListener('click', () => verifyPhotoInput.click());

            verifyUploadArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                verifyUploadArea.style.background = 'rgba(230,122,75,0.1)';
            });

            verifyUploadArea.addEventListener('drop', (e) => {
                e.preventDefault();
                verifyUploadArea.style.background = '';
                handleVerificationFile(e.dataTransfer.files[0]);
            });

            verifyPhotoInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    handleVerificationFile(e.target.files[0]);
                }
            });
        }

        function handleVerificationFile(file) {
            if (!file || !file.type.startsWith('image/')) return;
            
            const reader = new FileReader();
            reader.onload = (e) => {
                const previewEl = document.getElementById('verifyPreview');
                if (previewEl) {
                    previewEl.innerHTML = `
                        <img src="${e.target.result}" style="max-width: 100%; max-height: 200px; border-radius: var(--radius-md);">
                    `;
                }
                verificationPhoto = file;
                if (agreeTerms) agreeTerms.disabled = false;
                if (submitVerification) submitVerification.disabled = false;
            };
            reader.readAsDataURL(file);
        }

        document.getElementById('submitVerification')?.addEventListener('click', async () => {
            try {
                const user = Auth.getUser();
                const userData = Auth.getUserData();
                if (!user || !userData || !verificationPhoto) return;
                
                const storageRef = storage.ref(`verifications/${user.uid}_${Date.now()}.jpg`);
                await storageRef.put(verificationPhoto);
                const url = await storageRef.getDownloadURL();
                
                await db.collection('verifications').add({
                    userId: user.uid,
                    userName: userData.name,
                    photoUrl: url,
                    status: 'pending',
                    createdAt: new Date().toISOString()
                });
                
                const modal = bootstrap.Modal.getInstance(document.getElementById('verifyModal'));
                if (modal) modal.hide();
                
                Helpers.showNotification('✅ Заявка отправлена!', 'success');
                
            } catch (error) {
                console.error('❌ Ошибка:', error);
                Helpers.showNotification('❌ Ошибка при отправке', 'error');
            }
        });

        // Выход
        document.getElementById('logoutLink')?.addEventListener('click', (e) => {
            e.preventDefault();
            Auth.logout().then(() => {
                window.location.href = 'index.html';
            });
        });

        // Темная тема
        document.getElementById('themeToggle')?.addEventListener('click', Auth.toggleTheme);
    }

    // ============================================
    // ИНИЦИАЛИЗАЦИЯ СТРАНИЦЫ
    // ============================================

    document.addEventListener('DOMContentLoaded', () => {
        Auth.onAuthChange(async (state) => {
            const authRequired = document.getElementById('authRequired');
            const masterCabinet = document.getElementById('masterCabinet');
            
            if (state.isAuthenticated && state.isMaster) {
                authRequired?.classList.add('d-none');
                masterCabinet?.classList.remove('d-none');
                
                await Promise.all([
                    loadMasterData(state),
                    loadMasterResponses('all'),
                    loadPortfolio(),
                    loadPriceList()
                ]);
                
                initCalendar();
                await Badges.updateMasterBadges(state.user.uid);
                await displayBadges(state.user.uid);
                
            } else if (state.isAuthenticated && !state.isMaster) {
                Helpers.showNotification('Эта страница только для мастеров', 'warning');
                setTimeout(() => window.location.href = 'index.html', 2000);
            }
        });

        initEventListeners();
    });

})();