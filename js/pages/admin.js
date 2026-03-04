(function() {
    // DOM элементы
    const $ = (id) => document.getElementById(id);

    // Инициализация
    document.addEventListener('DOMContentLoaded', () => {
        Auth.onAuthChange(async (user) => {
            if (!user || !Auth.isAdmin()) {
                document.body.innerHTML = `
                    <div class="container text-center p-5">
                        <i class="fas fa-exclamation-triangle fa-4x mb-3" style="color: var(--accent);"></i>
                        <h3>Доступ запрещён</h3>
                        <p class="text-secondary mb-4">Только администратор может войти</p>
                        <a href="/HomeWork/" class="btn btn-primary">На главную</a>
                    </div>
                `;
                return;
            }
            
            // Загружаем данные
            await Promise.all([
                loadStats(),
                loadUsers(),
                loadAllOrders()
            ]);
            
            initEventListeners();
        });
    });

    // Загрузка статистики
    async function loadStats() {
        try {
            const usersSnapshot = await db.collection('users').get();
            const mastersSnapshot = await db.collection('users').where('role', '==', USER_ROLE.MASTER).get();
            const ordersSnapshot = await db.collection('orders').get();
            
            $('statUsers').innerText = usersSnapshot.size;
            $('statMasters').innerText = mastersSnapshot.size;
            $('statOrders').innerText = ordersSnapshot.size;
        } catch (error) {
            console.error('Ошибка загрузки статистики:', error);
        }
    }

    // Загрузка пользователей
    async function loadUsers() {
        const list = $('usersList');
        if (!list) return;
        
        list.innerHTML = '<div class="text-center p-5"><div class="spinner-border"></div><p class="mt-2">Загрузка...</p></div>';
        
        try {
            const snapshot = await db.collection('users').get();
            
            if (snapshot.empty) {
                list.innerHTML = '<div class="text-center p-5">Нет пользователей</div>';
                return;
            }
            
            let html = '';
            snapshot.forEach(doc => {
                const user = doc.data();
                const date = user.createdAt ? Utils.formatDate(user.createdAt) : 'Неизвестно';
                
                html += `
                    <div class="card p-3 mb-3">
                        <div class="d-flex justify-content-between">
                            <div>
                                <h5>${Utils.escapeHtml(user.name || 'Без имени')}</h5>
                                <p class="mb-1">${user.email || 'Нет email'}</p>
                                <p class="mb-1">${user.phone || 'Нет телефона'}</p>
                                <p class="mb-1">Роль: ${user.role || 'Не указана'}</p>
                                ${user.banned ? '<span class="badge bg-danger">Заблокирован</span>' : ''}
                                <p class="text-secondary mt-2">На сайте с ${date}</p>
                            </div>
                            <div>
                                ${!user.banned ? `
                                    <button class="btn btn-danger btn-sm" onclick="banUser('${doc.id}')">
                                        <i class="fas fa-ban me-1"></i>Заблокировать
                                    </button>
                                ` : `
                                    <button class="btn btn-success btn-sm" onclick="unbanUser('${doc.id}')">
                                        <i class="fas fa-check me-1"></i>Разблокировать
                                    </button>
                                `}
                            </div>
                        </div>
                    </div>
                `;
            });
            
            list.innerHTML = html;
            
            // Поиск
            $('userSearch')?.addEventListener('input', (e) => {
                const search = e.target.value.toLowerCase();
                document.querySelectorAll('#usersList .card').forEach(card => {
                    const text = card.textContent.toLowerCase();
                    card.style.display = text.includes(search) ? 'block' : 'none';
                });
            });
        } catch (error) {
            console.error('Ошибка загрузки пользователей:', error);
            list.innerHTML = '<div class="text-center p-5 text-danger">Ошибка загрузки</div>';
        }
    }

    // Загрузка всех заказов
    async function loadAllOrders() {
        const list = $('adminOrdersList');
        if (!list) return;
        
        list.innerHTML = '<div class="text-center p-5"><div class="spinner-border"></div><p class="mt-2">Загрузка...</p></div>';
        
        try {
            const snapshot = await db.collection('orders')
                .orderBy('createdAt', 'desc')
                .limit(100)
                .get();
            
            if (snapshot.empty) {
                list.innerHTML = '<div class="text-center p-5">Нет заказов</div>';
                return;
            }
            
            let html = '';
            snapshot.forEach(doc => {
                const order = doc.data();
                const date = order.createdAt ? Utils.formatDate(order.createdAt) : 'Неизвестно';
                
                html += `
                    <div class="card p-3 mb-3">
                        <h5>${Utils.escapeHtml(order.title || 'Заказ')}</h5>
                        <p class="mb-1">${Utils.truncate(Utils.escapeHtml(order.description || ''), 100)}</p>
                        <p class="mb-1">💰 ${Utils.formatMoney(order.price)}</p>
                        <p class="mb-1">📌 ${order.category || 'Без категории'}</p>
                        <p class="mb-1">📍 ${Utils.escapeHtml(order.address || 'Нет адреса')}</p>
                        <p class="mb-1">👤 Клиент: ${Utils.escapeHtml(order.clientName || 'Неизвестно')}</p>
                        <p class="mb-1">📞 ${order.clientPhone || 'Нет телефона'}</p>
                        <p class="text-secondary">${date}</p>
                        <span class="badge ${order.status === 'completed' ? 'bg-success' : 'bg-primary'}">${order.status}</span>
                    </div>
                `;
            });
            
            list.innerHTML = html;
        } catch (error) {
            console.error('Ошибка загрузки заказов:', error);
            list.innerHTML = '<div class="text-center p-5 text-danger">Ошибка загрузки</div>';
        }
    }

    // Бан пользователя
    window.banUser = async (userId) => {
        if (!confirm('Заблокировать пользователя?')) return;
        
        try {
            await db.collection('users').doc(userId).update({ 
                banned: true,
                bannedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            await loadUsers();
            Utils.showNotification('✅ Пользователь заблокирован', 'success');
        } catch (error) {
            console.error('Ошибка:', error);
            Utils.showNotification('❌ Ошибка', 'error');
        }
    };

    // Разбан пользователя
    window.unbanUser = async (userId) => {
        if (!confirm('Разблокировать пользователя?')) return;
        
        try {
            await db.collection('users').doc(userId).update({ banned: false });
            await loadUsers();
            Utils.showNotification('✅ Пользователь разблокирован', 'success');
        } catch (error) {
            console.error('Ошибка:', error);
            Utils.showNotification('❌ Ошибка', 'error');
        }
    };

    // Инициализация обработчиков
    function initEventListeners() {
        // Табы
        document.querySelectorAll('.nav-link[data-tab]').forEach(btn => {
            btn.addEventListener('click', function() {
                document.querySelectorAll('.nav-link').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                
                document.querySelectorAll('.tab-content').forEach(t => t.classList.add('d-none'));
                $(this.dataset.tab + 'Tab')?.classList.remove('d-none');
            });
        });

        // Выход
        $('logoutLink')?.addEventListener('click', (e) => {
            e.preventDefault();
            Auth.logout();
        });

        // Тема
        $('themeToggle')?.addEventListener('click', Auth.toggleTheme);
    }
})();