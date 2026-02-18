// ===== MASTERS.JS — Логика кабинета мастера =====

(function() {
    // Состояние
    let calendar = null;
    let portfolioPhotos = [];

    // Инициализация
    document.addEventListener('DOMContentLoaded', () => {
        Auth.onAuthChange(async (state) => {
            const authRequired = document.getElementById('authRequired');
            const masterCabinet = document.getElementById('masterCabinet');
            
            if (state.isAuthenticated && state.isMaster) {
                // Показать кабинет
                authRequired?.classList.add('d-none');
                masterCabinet?.classList.remove('d-none');
                
                // Загрузить данные
                await Promise.all([
                    loadMasterData(state),
                    loadMasterResponses('all'),
                    loadPortfolio(),
                    loadPriceList()
                ]);
                
                // Инициализировать календарь
                initCalendar();
                
                // Обновить бейджи
                await Badges.updateMasterBadges(state.user.uid);
                await displayBadges(state.user.uid);
                
            } else if (state.isAuthenticated && !state.isMaster) {
                Helpers.showNotification('Эта страница только для мастеров', 'warning');
                setTimeout(() => window.location.href = 'index.html', 2000);
            }
        });

        // Инициализация обработчиков
        initEventListeners();
    });

    // Отображение бейджей
    async function displayBadges(masterId) {
        const badges = await Badges.getMasterBadges(masterId);
        const container = document.getElementById('badgesContainer');
        if (container) {
            Badges.renderBadges(badges, container);
        }
    }

    // Загрузка данных мастера
    async function loadMasterData(state) {
        const userData = state.userData;
        
        document.getElementById('masterName').innerText = userData?.name || 'Мастер';
        document.getElementById('masterEmail').innerText = userData?.email || '';
        document.getElementById('masterPhone').innerText = userData?.phone || 'Телефон не указан';
        document.getElementById('masterCategories').innerHTML = userData?.categories || 'Ремонт и отделка';
        
        if (userData?.createdAt) {
            const date = userData.createdAt.toDate();
            document.getElementById('masterSince').innerHTML = `На платформе с ${date.toLocaleDateString('ru-RU')}`;
        }
        
        const rating = userData?.rating || 0;
        const reviews = userData?.reviews || 0;
        document.getElementById('masterRating').innerHTML = rating.toFixed(1);
        document.getElementById('masterReviews').innerHTML = `${reviews} ${Helpers.pluralize(reviews, ['отзыв', 'отзыва', 'отзывов'])}`;
        
        updateRatingStars(rating);
    }

    // Обновление звезд рейтинга
    function updateRatingStars(rating) {
        const starsElement = document.getElementById('ratingStars');
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
        
        document.getElementById('statResponses').innerText = total;
        document.getElementById('statAccepted').innerText = accepted;
        document.getElementById('statCompleted').innerText = completed;
        
        const conversion = total > 0 ? Math.round((accepted / total) * 100) : 0;
        document.getElementById('conversionRate').innerText = `${conversion}%`;
        document.getElementById('conversionBar').style.width = `${conversion}%`;
    }

    // Завершить заказ
    window.completeOrder = async (orderId) => {
        if (!confirm('Подтвердите, что заказ выполнен')) return;
        
        const result = await Orders.completeOrder(orderId);
        if (result.success) {
            const activeFilter = document.querySelector('.filter-tab.active')?.dataset.filter || 'all';
            await loadMasterResponses(activeFilter);
        }
    };

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

    // Просмотр портфолио
    window.viewPortfolio = (imageUrl, title, description) => {
        document.getElementById('viewPortfolioImage').src = imageUrl;
        document.getElementById('viewPortfolioTitle').innerText = title;
        document.getElementById('viewPortfolioDesc').innerText = description;
        new bootstrap.Modal(document.getElementById('viewPortfolioModal')).show();
    };

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

    // Инициализация обработчиков
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
            document.getElementById('editName').value = userData?.name || '';
            document.getElementById('editPhone').value = userData?.phone || '';
            document.getElementById('editCategories').value = userData?.categories || '';
            document.getElementById('editBio').value = userData?.bio || '';
            new bootstrap.Modal(document.getElementById('editProfileModal')).show();
        });

        document.getElementById('saveProfileBtn')?.addEventListener('click', async () => {
            const user = Auth.getUser();
            if (!user) return;
            
            const name = document.getElementById('editName').value;
            const phone = document.getElementById('editPhone').value;
            const categories = document.getElementById('editCategories').value;
            const bio = document.getElementById('editBio').value;
            
            const result = await Auth.updateProfile(user.uid, { name, phone, categories, bio });
            if (result.success) {
                bootstrap.Modal.getInstance(document.getElementById('editProfileModal')).hide();
                await loadMasterData({ userData: Auth.getUserData() });
            }
        });

        // Добавление в портфолио
        document.getElementById('addPortfolioBtn')?.addEventListener('click', () => {
            portfolioPhotos = [];
            document.getElementById('portfolioPhotoPreview').innerHTML = '';
            new bootstrap.Modal(document.getElementById('addPortfolioModal')).show();
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
                handlePortfolioFile(e.target.files[0]);
            });
        }

        function handlePortfolioFile(file) {
            if (!file || !file.type.startsWith('image/')) return;
            
            const reader = new FileReader();
            reader.onload = (e) => {
                document.getElementById('portfolioPhotoPreview').innerHTML = `
                    <img src="${e.target.result}" style="max-width: 100%; max-height: 200px; border-radius: var(--radius-md);">
                `;
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
                    title: document.getElementById('portfolioTitle').value,
                    description: document.getElementById('portfolioDesc').value,
                    category: document.getElementById('portfolioCategory').value,
                    imageUrl: imageUrl,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                
                bootstrap.Modal.getInstance(document.getElementById('addPortfolioModal')).hide();
                await loadPortfolio();
                Helpers.showNotification('✅ Работа добавлена', 'success');
                
            } catch (error) {
                console.error('❌ Ошибка:', error);
                Helpers.showNotification('❌ Ошибка при добавлении', 'error');
            }
        });

        // Верификация
        document.getElementById('verifyMasterBtn')?.addEventListener('click', () => {
            new bootstrap.Modal(document.getElementById('verifyModal')).show();
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
                handleVerificationFile(e.target.files[0]);
            });
        }

        function handleVerificationFile(file) {
            if (!file || !file.type.startsWith('image/')) return;
            
            const reader = new FileReader();
            reader.onload = (e) => {
                document.getElementById('verifyPreview').innerHTML = `
                    <img src="${e.target.result}" style="max-width: 100%; max-height: 200px; border-radius: var(--radius-md);">
                `;
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
                
                bootstrap.Modal.getInstance(document.getElementById('verifyModal')).hide();
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
})();