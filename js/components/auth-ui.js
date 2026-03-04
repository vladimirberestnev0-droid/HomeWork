const AuthUI = (function() {
    let authModal = null;
    let currentMode = 'login';

    function init() {
        const modalEl = document.getElementById('authModal');
        if (modalEl && window.bootstrap) {
            authModal = new bootstrap.Modal(modalEl);
        }
        
        renderAuthBlock();
        
        // Вешаем обработчики на кнопки в блоке авторизации
        document.addEventListener('click', (e) => {
            if (e.target.closest('[onclick="AuthUI.showLoginModal()"]')) {
                e.preventDefault();
                showLoginModal();
            }
            if (e.target.closest('[onclick="AuthUI.showRegisterModal()"]')) {
                e.preventDefault();
                showRegisterModal();
            }
        });
        
        console.log('✅ AuthUI инициализирован');
    }

    function showLoginModal() {
        currentMode = 'login';
        renderModal();
        if (authModal) authModal.show();
    }

    function showRegisterModal() {
        currentMode = 'register';
        renderModal();
        if (authModal) authModal.show();
    }

    function renderModal() {
        const titleEl = document.getElementById('authModalTitle');
        const bodyEl = document.getElementById('authModalBody');
        
        if (!titleEl || !bodyEl) return;
        
        if (currentMode === 'login') {
            titleEl.innerHTML = '<i class="fas fa-sign-in-alt me-2"></i>Вход';
            bodyEl.innerHTML = getLoginForm();
        } else {
            titleEl.innerHTML = '<i class="fas fa-user-plus me-2"></i>Регистрация';
            bodyEl.innerHTML = getRegisterForm();
        }
        
        attachModalEvents();
    }

    function getLoginForm() {
        return `
            <div class="mb-3">
                <label class="form-label">Email</label>
                <input type="email" class="form-control" id="loginEmail" placeholder="email@example.com">
            </div>
            <div class="mb-3">
                <label class="form-label">Пароль</label>
                <input type="password" class="form-control" id="loginPassword" placeholder="••••••">
            </div>
            <div id="loginError" class="alert alert-danger d-none"></div>
            <div class="d-grid gap-2">
                <button class="btn btn-primary" id="loginSubmitBtn">
                    <i class="fas fa-sign-in-alt me-2"></i>Войти
                </button>
                <button class="btn btn-link" id="switchToRegisterBtn">
                    Нет аккаунта? Зарегистрироваться
                </button>
            </div>
        `;
    }

    function getRegisterForm() {
        return `
            <div class="mb-3">
                <label class="form-label">Email</label>
                <input type="email" class="form-control" id="registerEmail" placeholder="email@example.com">
            </div>
            <div class="mb-3">
                <label class="form-label">Пароль (мин. 6 символов)</label>
                <input type="password" class="form-control" id="registerPassword" placeholder="••••••">
            </div>
            <div class="mb-3">
                <label class="form-label">Имя</label>
                <input type="text" class="form-control" id="registerName" placeholder="Иван Петров">
            </div>
            <div class="mb-3">
                <label class="form-label">Кто вы?</label>
                <div class="d-flex gap-4">
                    <div class="form-check">
                        <input class="form-check-input" type="radio" name="role" id="roleClient" value="client" checked>
                        <label class="form-check-label" for="roleClient">Клиент</label>
                    </div>
                    <div class="form-check">
                        <input class="form-check-input" type="radio" name="role" id="roleMaster" value="master">
                        <label class="form-check-label" for="roleMaster">Мастер</label>
                    </div>
                </div>
            </div>
            <div class="mb-3 master-only-field" style="display: none;">
                <label class="form-label">Категории (через запятую)</label>
                <input type="text" class="form-control" id="registerCategories" placeholder="Сантехника, Электрика, Отделка">
            </div>
            <div id="registerError" class="alert alert-danger d-none"></div>
            <div class="d-grid gap-2">
                <button class="btn btn-primary" id="registerSubmitBtn">
                    <i class="fas fa-user-plus me-2"></i>Зарегистрироваться
                </button>
                <button class="btn btn-link" id="switchToLoginBtn">
                    Уже есть аккаунт? Войти
                </button>
            </div>
        `;
    }

    function attachModalEvents() {
        document.getElementById('switchToRegisterBtn')?.addEventListener('click', (e) => {
            e.preventDefault();
            currentMode = 'register';
            renderModal();
        });

        document.getElementById('switchToLoginBtn')?.addEventListener('click', (e) => {
            e.preventDefault();
            currentMode = 'login';
            renderModal();
        });

        document.querySelectorAll('input[name="role"]').forEach(radio => {
            radio.addEventListener('change', function() {
                const masterField = document.querySelector('.master-only-field');
                if (masterField) {
                    masterField.style.display = this.value === 'master' ? 'block' : 'none';
                }
            });
        });

        document.getElementById('loginSubmitBtn')?.addEventListener('click', handleLogin);
        document.getElementById('registerSubmitBtn')?.addEventListener('click', handleRegister);
    }

    async function handleLogin() {
        const email = document.getElementById('loginEmail')?.value.trim();
        const password = document.getElementById('loginPassword')?.value;
        const errorDiv = document.getElementById('loginError');

        if (!email || !password) {
            errorDiv.textContent = 'Введите email и пароль';
            errorDiv.classList.remove('d-none');
            return;
        }

        const loginBtn = document.getElementById('loginSubmitBtn');
        const originalText = loginBtn.innerHTML;
        loginBtn.disabled = true;
        loginBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Вход...';

        try {
            // Демо-режим
            Utils.showNotification('✅ Демо: вход выполнен', 'success');
            if (authModal) authModal.hide();
            renderAuthBlock();
            
        } catch (error) {
            errorDiv.textContent = 'Ошибка входа';
            errorDiv.classList.remove('d-none');
        } finally {
            loginBtn.disabled = false;
            loginBtn.innerHTML = originalText;
        }
    }

    async function handleRegister() {
        const email = document.getElementById('registerEmail')?.value.trim();
        const password = document.getElementById('registerPassword')?.value;
        const name = document.getElementById('registerName')?.value.trim() || 'Пользователь';
        const role = document.querySelector('input[name="role"]:checked')?.value || 'client';
        const errorDiv = document.getElementById('registerError');

        if (!email || !password) {
            errorDiv.textContent = 'Email и пароль обязательны';
            errorDiv.classList.remove('d-none');
            return;
        }

        if (password.length < 6) {
            errorDiv.textContent = 'Пароль должен быть не менее 6 символов';
            errorDiv.classList.remove('d-none');
            return;
        }

        const registerBtn = document.getElementById('registerSubmitBtn');
        const originalText = registerBtn.innerHTML;
        registerBtn.disabled = true;
        registerBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Регистрация...';

        try {
            // Демо-режим
            Utils.showNotification('✅ Демо: регистрация успешна', 'success');
            if (authModal) authModal.hide();
            renderAuthBlock();
            
        } catch (error) {
            errorDiv.textContent = 'Ошибка регистрации';
            errorDiv.classList.remove('d-none');
        } finally {
            registerBtn.disabled = false;
            registerBtn.innerHTML = originalText;
        }
    }

    function renderAuthBlock() {
        const container = document.getElementById('authBlockContainer');
        if (!container) return;

        if (Auth.isAuthenticated()) {
            const userData = Auth.getUserData();
            const isMaster = Auth.isMaster();
            
            container.innerHTML = `
                <div class="card p-3">
                    <div class="d-flex align-items-center gap-3">
                        <div class="avatar-circle" style="width: 50px; height: 50px;">
                            <i class="fas fa-user"></i>
                        </div>
                        <div class="flex-grow-1">
                            <h6 class="mb-0">${userData?.name || 'Пользователь'}</h6>
                            <small class="text-secondary">${isMaster ? '🔨 Мастер' : '👤 Клиент'}</small>
                        </div>
                        <button class="btn btn-sm btn-outline-danger" onclick="Auth.logout()">
                            <i class="fas fa-sign-out-alt"></i>
                        </button>
                    </div>
                </div>
            `;
        } else {
            container.innerHTML = `
                <div class="card p-3">
                    <div class="d-flex justify-content-between align-items-center">
                        <span class="text-secondary">Войдите в личный кабинет</span>
                        <div class="d-flex gap-2">
                            <button class="btn btn-outline-secondary btn-sm" onclick="AuthUI.showLoginModal()">
                                <i class="fas fa-sign-in-alt me-1"></i>Вход
                            </button>
                            <button class="btn btn-primary btn-sm" onclick="AuthUI.showRegisterModal()">
                                <i class="fas fa-user-plus me-1"></i>Регистрация
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }
    }

    return {
        init,
        showLoginModal,
        showRegisterModal,
        renderAuthBlock
    };
})();

document.addEventListener('DOMContentLoaded', () => {
    AuthUI.init();
});

window.AuthUI = AuthUI;