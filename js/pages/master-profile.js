// ============================================
// ПУБЛИЧНЫЙ ПРОФИЛЬ МАСТЕРА
// ============================================

const MasterProfile = (function() {
    let masterId = null;
    let currentMaster = null;
    let currentUser = null;
    let reviews = [];
    let currentFilter = 'all';
    let lastReviewDoc = null;
    let hasMoreReviews = true;

    // DOM элементы
    const $ = (id) => document.getElementById(id);

    // ИНИЦИАЛИЗАЦИЯ
    function init() {
        // Получаем ID из URL
        const urlParams = new URLSearchParams(window.location.search);
        masterId = urlParams.get('id');
        
        if (!masterId) {
            Utils.showError('Мастер не найден');
            setTimeout(() => window.location.href = '/HomeWork/', 2000);
            return;
        }

        // Показываем скелетон
        showSkeleton(true);
        
        // Загружаем данные
        loadMasterData();
        
        // Настраиваем слушатели
        setupEventListeners();
    }

    // ЗАГРУЗКА ДАННЫХ МАСТЕРА
    async function loadMasterData() {
        try {
            // Получаем данные мастера
            currentMaster = await DataService.getUser(masterId);
            
            if (!currentMaster || currentMaster.role !== 'master') {
                throw new Error('Мастер не найден');
            }

            // Получаем текущего пользователя
            currentUser = Auth.getUser();

            // Отображаем профиль
            renderProfile();
            
            // Загружаем отзывы
            await loadReviews(true);
            
            // Скрываем скелетон
            showSkeleton(false);
            
        } catch (error) {
            console.error('Ошибка загрузки профиля:', error);
            Utils.showError('Не удалось загрузить профиль');
            
            $('loadingSkeleton').innerHTML = `
                <div class="text-center p-5">
                    <i class="fas fa-exclamation-triangle fa-4x mb-3" style="color: #FF8A5C;"></i>
                    <h5>Ошибка загрузки</h5>
                    <p class="text-muted">Попробуйте обновить страницу</p>
                    <button class="btn btn-primary mt-3" onclick="location.reload()">
                        <i class="fas fa-sync-alt me-2"></i>Обновить
                    </button>
                </div>
            `;
        }
    }

    // ОТОБРАЖЕНИЕ ПРОФИЛЯ
    function renderProfile() {
        // Аватар
        const avatar = $('masterAvatar');
        if (avatar) {
            avatar.src = currentMaster.avatar || 'https://via.placeholder.com/150';
            avatar.onerror = () => { avatar.src = 'https://via.placeholder.com/150'; };
        }

        // Имя
        $('masterName').textContent = currentMaster.name || 'Мастер';

        // Рейтинг
        const rating = currentMaster.rating || 0;
        const fullStars = Math.floor(rating);
        const hasHalf = rating % 1 >= 0.5;
        let stars = '';
        for (let i = 0; i < 5; i++) {
            if (i < fullStars) stars += '★';
            else if (i === fullStars && hasHalf) stars += '½';
            else stars += '☆';
        }
        $('masterRating').innerHTML = `
            <span class="stars">${stars}</span>
            <span class="rating-value">${rating.toFixed(1)}</span>
        `;

        // Статистика
        $('completedOrders').textContent = currentMaster.completedOrders || 0;
        $('reviewsCount').textContent = currentMaster.reviews || 0;
        $('responseTime').textContent = currentMaster.responseTime || '15 мин';

        // Верификация
        if (currentMaster.verified) {
            $('verifiedBadge').style.display = 'flex';
        }

        // О мастере
        $('masterAbout').textContent = currentMaster.about || 'Пока нет информации.';

        // Информационная сетка
        renderInfoGrid();

        // Гарантия
        if (currentMaster.guarantee) {
            $('masterGuarantee').style.display = 'flex';
            $('guaranteeText').textContent = currentMaster.guarantee;
        }

        // Портфолио
        renderPortfolio();

        // Кнопки действий
        renderActionButtons();
    }

    // ИНФОРМАЦИОННАЯ СЕТКА
    function renderInfoGrid() {
        const grid = $('infoGrid');
        if (!grid) return;

        const city = currentMaster.cityName || 'Нягань';
        const experience = currentMaster.experience ? `${currentMaster.experience} лет` : 'Не указано';
        const specializations = currentMaster.specializations?.join(', ') || 'Не указано';

        grid.innerHTML = `
            <div class="info-item">
                <i class="fas fa-map-marker-alt"></i>
                <span>${Utils.escapeHtml(city)}</span>
            </div>
            <div class="info-item">
                <i class="fas fa-briefcase"></i>
                <span>${Utils.escapeHtml(experience)} опыта</span>
            </div>
            <div class="info-item">
                <i class="fas fa-tags"></i>
                <span>${Utils.escapeHtml(specializations)}</span>
            </div>
        `;
    }

    // ПОРТФОЛИО
    function renderPortfolio() {
        const grid = $('portfolioGrid');
        const count = $('portfolioCount');
        
        const portfolio = currentMaster.portfolio || [];
        
        if (count) {
            count.textContent = `(${portfolio.length})`;
        }

        if (!grid) return;

        if (portfolio.length === 0) {
            grid.innerHTML = '<p class="text-secondary">Портфолио пока пусто</p>';
            return;
        }

        grid.innerHTML = portfolio.map((item, index) => `
            <div class="portfolio-item" onclick="MasterProfile.openPortfolio(${index})">
                <img src="${item.imageUrl}" loading="lazy" 
                     onerror="this.src='https://via.placeholder.com/300'">
                <div class="portfolio-overlay">
                    <h4>${Utils.escapeHtml(item.title || 'Работа')}</h4>
                    <p>${item.category || ''} · ${item.date ? new Date(item.date).getFullYear() : ''}</p>
                </div>
            </div>
        `).join('');
    }

    // КНОПКИ ДЕЙСТВИЙ
    function renderActionButtons() {
        const contactBtn = $('contactMasterBtn');
        const editBtn = $('editProfileBtn');

        if (!currentUser) {
            // Гость - только контакты не показываем
            if (contactBtn) contactBtn.style.display = 'none';
            if (editBtn) editBtn.style.display = 'none';
            return;
        }

        if (Auth.isClient()) {
            // Клиент - кнопка связаться
            if (contactBtn) contactBtn.style.display = 'flex';
            if (editBtn) editBtn.style.display = 'none';
        } else if (Auth.isMaster() && currentUser.uid === masterId) {
            // Сам мастер - кнопка редактировать
            if (contactBtn) contactBtn.style.display = 'none';
            if (editBtn) editBtn.style.display = 'flex';
        } else {
            // Другой мастер - без кнопок
            if (contactBtn) contactBtn.style.display = 'none';
            if (editBtn) editBtn.style.display = 'none';
        }
    }

    // ЗАГРУЗКА ОТЗЫВОВ
    async function loadReviews(reset = true) {
        try {
            if (reset) {
                lastReviewDoc = null;
                hasMoreReviews = true;
            }

            if (!hasMoreReviews) return;

            const result = await DataService.getReviews(masterId, {
                filter: currentFilter,
                limit: 10,
                startAfter: lastReviewDoc
            });

            if (reset) {
                reviews = result.items;
            } else {
                reviews = [...reviews, ...result.items];
            }

            lastReviewDoc = result.lastDoc;
            hasMoreReviews = result.hasMore;

            renderReviews();

            const loadMoreBtn = $('loadMoreReviews');
            if (loadMoreBtn) {
                loadMoreBtn.style.display = hasMoreReviews ? 'block' : 'none';
            }

            $('reviewsTotal').textContent = `(${reviews.length})`;

        } catch (error) {
            console.error('Ошибка загрузки отзывов:', error);
        }
    }

    // ОТОБРАЖЕНИЕ ОТЗЫВОВ
    function renderReviews() {
        const list = $('reviewsList');
        const filters = $('reviewsFilters');

        if (!list) return;

        // Фильтры
        if (filters) {
            filters.innerHTML = `
                <button class="filter-chip ${currentFilter === 'all' ? 'active' : ''}" 
                        onclick="MasterProfile.setFilter('all')">Все</button>
                <button class="filter-chip ${currentFilter === '5' ? 'active' : ''}" 
                        onclick="MasterProfile.setFilter('5')">5 ★</button>
                <button class="filter-chip ${currentFilter === '4' ? 'active' : ''}" 
                        onclick="MasterProfile.setFilter('4')">4 ★</button>
                <button class="filter-chip ${currentFilter === '3' ? 'active' : ''}" 
                        onclick="MasterProfile.setFilter('3')">3 ★</button>
                <button class="filter-chip ${currentFilter === '2' ? 'active' : ''}" 
                        onclick="MasterProfile.setFilter('2')">2 ★</button>
                <button class="filter-chip ${currentFilter === '1' ? 'active' : ''}" 
                        onclick="MasterProfile.setFilter('1')">1 ★</button>
                <button class="filter-chip ${currentFilter === 'with-photo' ? 'active' : ''}" 
                        onclick="MasterProfile.setFilter('with-photo')">С фото</button>
            `;
        }

        if (reviews.length === 0) {
            list.innerHTML = '<p class="text-secondary text-center p-4">Отзывов пока нет</p>';
            return;
        }

        list.innerHTML = reviews.map(review => `
            <div class="review-card">
                <div class="review-header">
                    <div class="reviewer-info">
                        <img src="${review.clientAvatar || 'https://via.placeholder.com/50'}" 
                             class="reviewer-avatar" 
                             onerror="this.src='https://via.placeholder.com/50'">
                        <div>
                            <div class="reviewer-name">${Utils.escapeHtml(review.clientName || 'Клиент')}</div>
                            <div class="review-date">${Utils.formatDate(review.createdAt)}</div>
                        </div>
                    </div>
                    <div class="review-rating">${'★'.repeat(review.rating)}${'☆'.repeat(5-review.rating)}</div>
                </div>
                <p class="review-text">${Utils.escapeHtml(review.text || '')}</p>
                ${review.photos?.length ? `
                    <div class="review-photos">
                        ${review.photos.map(photo => 
                            `<img src="${photo}" onclick="window.open('${photo}')">`
                        ).join('')}
                    </div>
                ` : ''}
                ${review.response ? `
                    <div class="master-response">
                        <strong>Ответ мастера:</strong>
                        <p>${Utils.escapeHtml(review.response.text)}</p>
                        <small>${Utils.formatDate(review.response.createdAt)}</small>
                    </div>
                ` : ''}
            </div>
        `).join('');
    }

    // УСТАНОВКА ФИЛЬТРА
    function setFilter(filter) {
        currentFilter = filter;
        loadReviews(true);
    }

    // ОТКРЫТИЕ ПОРТФОЛИО
    function openPortfolio(index) {
        const portfolio = currentMaster.portfolio || [];
        const item = portfolio[index];
        
        if (!item) return;

        const modal = new bootstrap.Modal($('portfolioModal'));
        $('portfolioModalTitle').textContent = item.title || 'Работа';
        $('portfolioModalImage').src = item.imageUrl;
        $('portfolioModalDesc').textContent = item.description || '';
        
        modal.show();
    }

    // СВЯЗАТЬСЯ С МАСТЕРОМ
    async function contactMaster() {
        if (!currentUser) {
            AuthUI.showLoginModal();
            Utils.showInfo('Войдите, чтобы связаться с мастером');
            return;
        }

        if (!Auth.isClient()) {
            Utils.showWarning('Только клиенты могут связываться с мастерами');
            return;
        }

        // Создаём или открываем чат
        const orderId = 'direct_' + Date.now(); // Временный ID для прямого общения
        const chatId = `chat_${orderId}_${masterId}`;

        try {
            // Проверяем существование чата
            let chat = await Chat.getChat(chatId);
            
            if (!chat) {
                // Создаём новый чат
                await DataService.createChat(chatId, {
                    participants: [currentUser.uid, masterId],
                    orderId: orderId,
                    orderTitle: 'Прямое обращение',
                    status: 'active',
                    lastMessage: '🔔 Клиент хочет связаться',
                    lastMessageAt: firebase.firestore.FieldValue.serverTimestamp()
                });

                await DataService.sendMessage(chatId, {
                    senderId: 'system',
                    senderName: 'Система',
                    text: '🔔 Клиент хочет связаться с вами',
                    type: 'system',
                    read: false
                });
            }

            // Переходим в чат
            window.location.href = `/HomeWork/chat.html?chatId=${chatId}`;

        } catch (error) {
            console.error('Ошибка при создании чата:', error);
            Utils.showError('Не удалось создать чат');
        }
    }

    // РЕДАКТИРОВАНИЕ ПРОФИЛЯ
    function editProfile() {
        window.location.href = `/HomeWork/master-edit.html?id=${masterId}`;
    }

    // ПОКАЗ/СКРЫТИЕ СКЕЛЕТОНА
    function showSkeleton(show) {
        const skeleton = $('loadingSkeleton');
        const profile = $('masterProfile');
        
        if (skeleton) skeleton.style.display = show ? 'block' : 'none';
        if (profile) profile.style.display = show ? 'none' : 'block';
    }

    // НАСТРОЙКА ОБРАБОТЧИКОВ
    function setupEventListeners() {
        $('contactMasterBtn')?.addEventListener('click', contactMaster);
        $('editProfileBtn')?.addEventListener('click', editProfile);
        $('loadMoreReviews')?.addEventListener('click', () => loadReviews(false));
    }

    // ПУБЛИЧНОЕ API
    const api = {
        init,
        setFilter,
        openPortfolio
    };

    // Автозапуск
    document.addEventListener('DOMContentLoaded', init);

    return Object.freeze(api);
})();

window.MasterProfile = MasterProfile;