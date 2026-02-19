// ===== js/components/auth-ui.js =====

const AuthUI = (function() {
    /**
     * Показать модалку входа
     */
    function showLoginModal() {
        // Создаем модалку входа
        const modalHtml = `
            <div class="modal fade" id="loginModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                <i class="fas fa-sign-in-alt me-2" style="color: var(--accent);"></i>
                                Вход в ВоркХом
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="mb-3">
                                <label class="form-label">Email</label>
                                <input type="email" class="form-control" id="loginEmail" placeholder="email@example.com">
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Пароль</label>
                                <input type="password" class="form-control" id="loginPassword" placeholder="••••••">
                            </div>
                            <button class="btn w-100" onclick="AuthUI.submitLogin()">
                                <i class="fas fa-sign-in-alt me-2"></i> Войти
                            </button>
                        </div>
                        <div class="modal-footer">
                            <p class="text-secondary mb-0">Нет аккаунта? 
                                <a href="#" onclick="AuthUI.showRegisterModal()">Зарегистрироваться</a>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Удаляем старую модалку, если есть
        const oldModal = document.getElementById('loginModal');
        if (oldModal) oldModal.remove();

        // Добавляем и показываем
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modal = new bootstrap.Modal(document.getElementById('loginModal'));
        modal.show();
    }

    /**
     * Показать модалку регистрации
     */
    function showRegisterModal() {
        const modalHtml = `
            <div class="modal fade" id="registerModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                <i class="fas fa-user-plus me-2" style="color: var(--accent);"></i>
                                Регистрация
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="mb-3">
                                <label class="form-label">Имя</label>
                                <input type="text" class="form-control" id="regName">
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Email</label>
                                <input type="email" class="form-control" id="regEmail">
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Пароль</label>
                                <input type="password" class="form-control" id="regPassword">
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Телефон</label>
                                <input type="tel" class="form-control" id="regPhone" placeholder="+7 (999) 123-45-67">
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Вы</label>
                                <select class="form-select" id="regRole">
                                    <option value="client">Клиент (ищу мастера)</option>
                                    <option value="master">Мастер (ищу заказы)</option>
                                </select>
                            </div>
                            <div class="mb-3" id="masterCategoriesField" style="display: none;">
                                <label class="form-label">Категории (через запятую)</label>
                                <input type="text" class="form-control" id="regCategories" placeholder="Сантехника, Электрика">
                            </div>
                            <button class="btn w-100" onclick="AuthUI.submitRegister()">
                                <i class="fas fa-user-plus me-2"></i> Зарегистрироваться
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        const oldModal = document.getElementById('registerModal');
        if (oldModal) oldModal.remove();

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // Показываем/скрываем поле категорий при выборе роли
        document.getElementById('regRole').addEventListener('change', function() {
            const field = document.getElementById('masterCategoriesField');
            field.style.display = this.value === 'master' ? 'block' : 'none';
        });
        
        const modal = new bootstrap.Modal(document.getElementById('registerModal'));
        modal.show();
    }

    /**
     * Отправка формы входа
     */
    async function submitLogin() {
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        
        const result = await Auth.login(email, password);
        if (result.success) {
            bootstrap.Modal.getInstance(document.getElementById('loginModal')).hide();
        }
    }

    /**
     * Отправка формы регистрации
     */
    async function submitRegister() {
        const userData = {
            name: document.getElementById('regName').value,
            phone: document.getElementById('regPhone').value,
            role: document.getElementById('regRole').value
        };
        
        if (userData.role === 'master') {
            userData.categories = document.getElementById('regCategories').value;
        }
        
        const email = document.getElementById('regEmail').value;
        const password = document.getElementById('regPassword').value;
        
        const result = await Auth.register(email, password, userData);
        if (result.success) {
            bootstrap.Modal.getInstance(document.getElementById('registerModal')).hide();
        }
    }

    /**
     * Отрисовка блока авторизации
     */
    function renderAuthBlock() {
        const container = document.getElementById('authBlockContainer');
        if (!container) return;

        if (Auth.isAuthenticated()) {
            renderUserInfo(container);
        } else {
            renderAuthButtons(container);
        }
    }

    /**
     * Рендер кнопок для неавторизованных
     */
    function renderAuthButtons(container) {
        container.innerHTML = `
            <div class="card mb-4">
                <div class="d-flex justify-content-between align-items-center p-4">
                    <div>
                        <i class="fas fa-user-circle fa-2x me-3" style="color: var(--accent);"></i>
                        <span>Войдите, чтобы создавать заказы или откликаться</span>
                    </div>
                    <div class="btn-group">
                        <button class="btn btn-outline-secondary" onclick="AuthUI.showLoginModal()">
                            <i class="fas fa-sign-in-alt me-2"></i>Вход
                        </button>
                        <button class="btn" onclick="AuthUI.showRegisterModal()">
                            <i class="fas fa-user-plus me-2"></i>Регистрация
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Рендер информации о пользователе
     */
    function renderUserInfo(container) {
        const user = Auth.getUser();
        const userData = Auth.getUserData();
        
        container.innerHTML = `
            <div class="card mb-4">
                <div class="d-flex justify-content-between align-items-center p-4">
                    <div class="d-flex align-items-center gap-3">
                        <div class="avatar">
                            <i class="fas fa-user"></i>
                        </div>
                        <div>
                            <div class="fw-bold">${Helpers.escapeHtml(userData?.name || 'Пользователь')}</div>
                            <div class="small text-secondary">${user?.email || ''}</div>
                            <div class="small">
                                <span class="badge badge-${userData?.role === 'master' ? 'success' : 'primary'}">
                                    ${userData?.role === 'master' ? 'Мастер' : 'Клиент'}
                                </span>
                            </div>
                        </div>
                    </div>
                    <button class="btn btn-outline-secondary" onclick="Auth.logout()">
                        <i class="fas fa-sign-out-alt me-2"></i>Выйти
                    </button>
                </div>
            </div>
        `;
    }

    // Публичное API
    return {
        renderAuthBlock,
        showLoginModal,
        showRegisterModal,
        submitLogin,
        submitRegister
    };
})();

window.AuthUI = AuthUI;