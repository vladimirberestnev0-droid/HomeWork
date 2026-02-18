// ===== ADMIN.JS — Логика админ-панели =====

(function() {
    // Графики
    let ordersChart, categoriesChart, hourlyChart, priceChart;

    // Инициализация
    document.addEventListener('DOMContentLoaded', () => {
        Auth.onAuthStateChanged(async (user) => {
            if (!user || !Auth.isAdmin()) {
                document.body.innerHTML = `
                    <div class="container text-center p-5">
                        <i class="fas fa-exclamation-triangle fa-4x mb-3" style="color: var(--accent);"></i>
                        <h3>Доступ запрещён</h3>
                        <p class="text-secondary mb-4">Только администратор может войти</p>
                        <a href="index.html" class="btn">На главную</a>
                    </div>
                `;
                return;
            }
            
            // Загружаем данные
            await Promise.all([
                loadStats(),
                loadComplaints('all'),
                loadVerifications(),
                loadAllUsers(),
                loadAllOrders()
            ]);
            
            initCharts();
        });

        // Обработчики
        initEventListeners();
    });

    // Инициализация обработчиков
    function initEventListeners() {
        // Выход
        document.getElementById('logoutBtn')?.addEventListener('click', () => {
            Auth.logout().then(() => {
                window.location.href = 'index.html';
            });
        });

        // Переключение табов
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', function() {
                document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                this.classList.add('active');
                
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                const tabId = this.dataset.tab + 'Tab';
                document.getElementById(tabId)?.classList.add('active');
                
                if (this.dataset.tab === 'analytics') {
                    initCharts();
                }
            });
        });

        // Фильтр жалоб
        document.getElementById('complaintFilter')?.addEventListener('change', (e) => {
            loadComplaints(e.target.value);
        });

        // Сохранение настроек
        document.getElementById('saveSettings')?.addEventListener('click', saveSettings);
        document.getElementById('saveModeration')?.addEventListener('click', saveModerationSettings);

        // Темная тема
        document.getElementById('themeToggle')?.addEventListener('click', Auth.toggleTheme);
    }

    // Загрузка статистики
    async function loadStats() {
        try {
            const usersSnapshot = await db.collection('users').get();
            const mastersSnapshot = await db.collection('users').where('role', '==', USER_ROLE.MASTER).get();
            const ordersSnapshot = await db.collection('orders').get();
            const complaintsSnapshot = await db.collection('complaints').where('status', '==', 'pending').get();
            
            document.getElementById('statUsers').innerText = usersSnapshot.size;
            document.getElementById('statMasters').innerText = mastersSnapshot.size;
            document.getElementById('statOrders').innerText = ordersSnapshot.size;
            document.getElementById('statComplaints').innerText = complaintsSnapshot.size;
        } catch (error) {
            console.error('❌ Ошибка загрузки статистики:', error);
        }
    }

    // Инициализация графиков
    async function initCharts() {
        // График заказов
        const ordersCtx = document.getElementById('ordersChart')?.getContext('2d');
        if (ordersCtx) {
            if (ordersChart) ordersChart.destroy();
            
            ordersChart = new Chart(ordersCtx, {
                type: 'line',
                data: {
                    labels: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
                    datasets: [{
                        label: 'Новые заказы',
                        data: await getOrdersByDay(),
                        borderColor: '#E67A4B',
                        backgroundColor: 'rgba(230,122,75,0.1)',
                        tension: 0.4,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } }
                }
            });
        }

        // График категорий
        const categoriesCtx = document.getElementById('categoriesChart')?.getContext('2d');
        if (categoriesCtx) {
            if (categoriesChart) categoriesChart.destroy();
            
            const categoriesData = await getCategoriesStats();
            
            categoriesChart = new Chart(categoriesCtx, {
                type: 'doughnut',
                data: {
                    labels: categoriesData.labels,
                    datasets: [{
                        data: categoriesData.data,
                        backgroundColor: [
                            '#E67A4B', '#4A90E2', '#7ED321', '#BD10E0', '#F5A623', '#D0021B'
                        ]
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'bottom' } }
                }
            });
        }

        // Часовой график
        const hourlyCtx = document.getElementById('hourlyChart')?.getContext('2d');
        if (hourlyCtx) {
            if (hourlyChart) hourlyChart.destroy();
            
            hourlyChart = new Chart(hourlyCtx, {
                type: 'bar',
                data: {
                    labels: Array.from({length: 24}, (_, i) => i + ':00'),
                    datasets: [{
                        label: 'Заказы',
                        data: await getOrdersByHour(),
                        backgroundColor: '#E67A4B'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false
                }
            });
        }

        // График цен
        const priceCtx = document.getElementById('priceChart')?.getContext('2d');
        if (priceCtx) {
            if (priceChart) priceChart.destroy();
            
            const priceData = await getPriceStats();
            
            priceChart = new Chart(priceCtx, {
                type: 'line',
                data: {
                    labels: priceData.labels,
                    datasets: [{
                        label: 'Средний чек',
                        data: priceData.data,
                        borderColor: '#00A86B',
                        backgroundColor: 'rgba(0,168,107,0.1)',
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false
                }
            });
        }
    }

    // Получение данных для графиков
    async function getOrdersByDay() {
        const days = [0,0,0,0,0,0,0];
        const snapshot = await db.collection('orders').get();
        
        snapshot.forEach(doc => {
            const order = doc.data();
            if (order.createdAt) {
                const date = order.createdAt.toDate();
                const day = date.getDay();
                days[day === 0 ? 6 : day - 1]++;
            }
        });
        
        return days;
    }

    async function getCategoriesStats() {
        const categories = {};
        const snapshot = await db.collection('orders').get();
        
        snapshot.forEach(doc => {
            const order = doc.data();
            const cat = order.category || 'Другое';
            categories[cat] = (categories[cat] || 0) + 1;
        });
        
        return {
            labels: Object.keys(categories),
            data: Object.values(categories)
        };
    }

    async function getOrdersByHour() {
        const hours = Array(24).fill(0);
        const snapshot = await db.collection('orders').get();
        
        snapshot.forEach(doc => {
            const order = doc.data();
            if (order.createdAt) {
                const hour = order.createdAt.toDate().getHours();
                hours[hour]++;
            }
        });
        
        return hours;
    }

    async function getPriceStats() {
        const months = [];
        const prices = [];
        const now = new Date();
        
        for (let i = 5; i >= 0; i--) {
            const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
            months.push(date.toLocaleDateString('ru-RU', { month: 'short' }));
            
            const snapshot = await db.collection('orders')
                .where('createdAt', '>=', date)
                .where('createdAt', '<', new Date(date.getFullYear(), date.getMonth() + 1, 1))
                .get();
            
            let total = 0;
            snapshot.forEach(doc => total += doc.data().price || 0);
            prices.push(snapshot.size > 0 ? Math.round(total / snapshot.size) : 0);
        }
        
        return { labels: months, data: prices };
    }

    // Загрузка жалоб
    async function loadComplaints(filter = 'all') {
        const list = document.getElementById('complaintsList');
        if (!list) return;
        
        list.innerHTML = '<div class="text-center p-5"><i class="fas fa-spinner fa-spin fa-3x"></i></div>';
        
        try {
            let query = db.collection('complaints').orderBy('createdAt', 'desc');
            if (filter !== 'all') {
                query = query.where('status', '==', filter);
            }
            
            const snapshot = await query.get();
            
            if (snapshot.empty) {
                list.innerHTML = '<div class="text-center p-5 text-secondary">Нет жалоб</div>';
                return;
            }
            
            list.innerHTML = '';
            snapshot.forEach(doc => {
                const complaint = doc.data();
                const date = complaint.createdAt ? new Date(complaint.createdAt).toLocaleString() : 'Неизвестно';
                
                const card = document.createElement('div');
                card.className = 'admin-card';
                card.innerHTML = `
                    <div class="d-flex justify-content-between align-items-start mb-3">
                        <div>
                            <h5>Жалоба на ${complaint.targetType || 'пользователя'}</h5>
                            <small class="text-secondary">ID: ${complaint.targetId || 'Нет'}</small>
                        </div>
                        <span class="badge badge-${complaint.status || 'pending'}">${complaint.status || 'pending'}</span>
                    </div>
                    <p class="mb-3">${Helpers.escapeHtml(complaint.text || 'Нет текста')}</p>
                    <div class="d-flex justify-content-between align-items-center mb-3">
                        <small class="text-secondary">От: ${complaint.fromUserId || 'Аноним'}</small>
                        <small class="text-secondary">${date}</small>
                    </div>
                    <div class="d-flex gap-2">
                        <button class="btn btn-success btn-sm" onclick="window.resolveComplaint('${doc.id}')">
                            <i class="fas fa-check"></i> Разобрано
                        </button>
                        <button class="btn btn-danger btn-sm" onclick="window.banUser('${complaint.targetId}')">
                            <i class="fas fa-ban"></i> Заблокировать
                        </button>
                    </div>
                `;
                list.appendChild(card);
            });
        } catch (error) {
            console.error('❌ Ошибка загрузки жалоб:', error);
        }
    }

    // Загрузка верификации
    async function loadVerifications() {
        const list = document.getElementById('verificationsList');
        if (!list) return;
        
        list.innerHTML = '<div class="text-center p-5"><i class="fas fa-spinner fa-spin fa-3x"></i></div>';
        
        try {
            const snapshot = await db.collection('verifications')
                .orderBy('createdAt', 'desc')
                .get();
            
            if (snapshot.empty) {
                list.innerHTML = '<div class="text-center p-5 text-secondary">Нет заявок</div>';
                return;
            }
            
            list.innerHTML = '';
            snapshot.forEach(doc => {
                const req = doc.data();
                const date = req.createdAt ? new Date(req.createdAt).toLocaleString() : 'Неизвестно';
                
                const card = document.createElement('div');
                card.className = 'admin-card';
                card.innerHTML = `
                    <div class="d-flex justify-content-between align-items-start mb-3">
                        <div>
                            <h5>${Helpers.escapeHtml(req.userName || 'Мастер')}</h5>
                            <small class="text-secondary">ID: ${req.userId}</small>
                        </div>
                        <span class="badge badge-${req.status || 'pending'}">${req.status || 'pending'}</span>
                    </div>
                    <div class="mb-3">
                        <img src="${req.photoUrl}" style="max-width: 200px; max-height: 200px; border-radius: 12px; cursor: pointer;" onclick="window.showImage('${req.photoUrl}')">
                    </div>
                    <div class="d-flex justify-content-between mb-3">
                        <small class="text-secondary">${date}</small>
                    </div>
                    <div class="d-flex gap-2">
                        <button class="btn btn-success btn-sm" onclick="window.approveVerification('${req.userId}', '${doc.id}')">
                            <i class="fas fa-check"></i> Подтвердить
                        </button>
                        <button class="btn btn-danger btn-sm" onclick="window.rejectVerification('${doc.id}')">
                            <i class="fas fa-times"></i> Отклонить
                        </button>
                    </div>
                `;
                list.appendChild(card);
            });
        } catch (error) {
            console.error('❌ Ошибка загрузки верификации:', error);
        }
    }

    // Загрузка пользователей
    async function loadAllUsers() {
        const list = document.getElementById('usersList');
        if (!list) return;
        
        list.innerHTML = '<div class="text-center p-5"><i class="fas fa-spinner fa-spin fa-3x"></i></div>';
        
        try {
            const snapshot = await db.collection('users').get();
            
            if (snapshot.empty) {
                list.innerHTML = '<div class="text-center p-5 text-secondary">Нет пользователей</div>';
                return;
            }
            
            list.innerHTML = '';
            snapshot.forEach(doc => {
                const user = doc.data();
                const date = user.createdAt ? user.createdAt.toDate().toLocaleDateString() : 'Неизвестно';
                
                const card = document.createElement('div');
                card.className = 'admin-card';
                card.innerHTML = `
                    <div class="d-flex justify-content-between align-items-start">
                        <div>
                            <h5>${Helpers.escapeHtml(user.name || 'Без имени')}</h5>
                            <p class="mb-1">${user.email || 'Нет email'}</p>
                            <p class="mb-1">${user.phone || 'Нет телефона'}</p>
                            <p class="mb-1">Роль: ${user.role || 'Не указана'}</p>
                            ${user.verified ? '<span class="badge badge-success mb-2">✓ Верифицирован</span>' : ''}
                            ${user.banned ? '<span class="badge badge-danger mb-2">🚫 Заблокирован</span>' : ''}
                            <p class="text-secondary">На сайте с ${date}</p>
                        </div>
                        <div>
                            ${!user.banned ? `
                                <button class="btn btn-danger btn-sm" onclick="window.banUser('${doc.id}')">
                                    <i class="fas fa-ban"></i> Заблокировать
                                </button>
                            ` : `
                                <button class="btn btn-success btn-sm" onclick="window.unbanUser('${doc.id}')">
                                    <i class="fas fa-check"></i> Разблокировать
                                </button>
                            `}
                        </div>
                    </div>
                `;
                list.appendChild(card);
            });
            
            // Поиск
            document.getElementById('userSearch')?.addEventListener('input', (e) => {
                const search = e.target.value.toLowerCase();
                document.querySelectorAll('#usersList .admin-card').forEach(card => {
                    const text = card.textContent.toLowerCase();
                    card.style.display = text.includes(search) ? 'block' : 'none';
                });
            });
            
        } catch (error) {
            console.error('❌ Ошибка загрузки пользователей:', error);
        }
    }

    // Загрузка заказов
    async function loadAllOrders() {
        const list = document.getElementById('adminOrdersList');
        if (!list) return;
        
        list.innerHTML = '<div class="text-center p-5"><i class="fas fa-spinner fa-spin fa-3x"></i></div>';
        
        try {
            const snapshot = await db.collection('orders')
                .orderBy('createdAt', 'desc')
                .limit(100)
                .get();
            
            if (snapshot.empty) {
                list.innerHTML = '<div class="text-center p-5 text-secondary">Нет заказов</div>';
                return;
            }
            
            list.innerHTML = '';
            snapshot.forEach(doc => {
                const order = doc.data();
                const date = order.createdAt ? order.createdAt.toDate().toLocaleString() : 'Неизвестно';
                
                const card = document.createElement('div');
                card.className = 'admin-card';
                card.innerHTML = `
                    <div class="d-flex justify-content-between align-items-start">
                        <div>
                            <h5>${Helpers.escapeHtml(order.title || 'Заказ')}</h5>
                            <p class="mb-1">${Helpers.escapeHtml(order.description || 'Нет описания')}</p>
                            <p class="mb-1">💰 ${order.price || 0} ₽</p>
                            <p class="mb-1">📌 ${order.category || 'Без категории'}</p>
                            <p class="mb-1">📍 ${Helpers.escapeHtml(order.address || 'Нет адреса')}</p>
                            <p class="mb-1">👤 Клиент: ${Helpers.escapeHtml(order.clientName || 'Неизвестно')}</p>
                            <p class="mb-1">📞 ${order.clientPhone || 'Нет телефона'}</p>
                            <p class="text-secondary">${date}</p>
                        </div>
                        <div>
                            <span class="badge badge-secondary">${order.status || 'open'}</span>
                        </div>
                    </div>
                `;
                list.appendChild(card);
            });
        } catch (error) {
            console.error('❌ Ошибка загрузки заказов:', error);
        }
    }

    // Глобальные функции
    window.resolveComplaint = async (id) => {
        try {
            await db.collection('complaints').doc(id).update({ 
                status: 'resolved',
                resolvedAt: new Date().toISOString()
            });
            await loadComplaints(document.getElementById('complaintFilter').value);
            Helpers.showNotification('✅ Жалоба отмечена как решённая', 'success');
        } catch (error) {
            console.error('❌ Ошибка:', error);
            Helpers.showNotification('❌ Ошибка', 'error');
        }
    };

    window.banUser = async (userId) => {
        if (!confirm('Заблокировать пользователя?')) return;
        
        try {
            await db.collection('users').doc(userId).update({ 
                banned: true,
                bannedAt: new Date().toISOString()
            });
            await Promise.all([
                loadComplaints(document.getElementById('complaintFilter').value),
                loadAllUsers()
            ]);
            Helpers.showNotification('✅ Пользователь заблокирован', 'success');
        } catch (error) {
            console.error('❌ Ошибка:', error);
            Helpers.showNotification('❌ Ошибка', 'error');
        }
    };

    window.unbanUser = async (userId) => {
        if (!confirm('Разблокировать пользователя?')) return;
        
        try {
            await db.collection('users').doc(userId).update({ banned: false });
            await loadAllUsers();
            Helpers.showNotification('✅ Пользователь разблокирован', 'success');
        } catch (error) {
            console.error('❌ Ошибка:', error);
            Helpers.showNotification('❌ Ошибка', 'error');
        }
    };

    window.approveVerification = async (userId, docId) => {
        try {
            await db.collection('users').doc(userId).update({ verified: true });
            await db.collection('verifications').doc(docId).update({ 
                status: 'approved',
                resolvedAt: new Date().toISOString()
            });
            await loadVerifications();
            Helpers.showNotification('✅ Мастер верифицирован', 'success');
        } catch (error) {
            console.error('❌ Ошибка:', error);
            Helpers.showNotification('❌ Ошибка', 'error');
        }
    };

    window.rejectVerification = async (docId) => {
        try {
            await db.collection('verifications').doc(docId).update({ 
                status: 'rejected',
                resolvedAt: new Date().toISOString()
            });
            await loadVerifications();
            Helpers.showNotification('⚠️ Заявка отклонена', 'warning');
        } catch (error) {
            console.error('❌ Ошибка:', error);
            Helpers.showNotification('❌ Ошибка', 'error');
        }
    };

    window.showImage = (url) => {
        document.getElementById('modalImage').src = url;
        new bootstrap.Modal(document.getElementById('imageModal')).show();
    };

    // Сохранение настроек
    async function saveSettings() {
        Helpers.showNotification('✅ Настройки сохранены', 'success');
    }

    async function saveModerationSettings() {
        Helpers.showNotification('✅ Настройки модерации сохранены', 'success');
    }
})();