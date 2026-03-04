// ============================================
// КОМПОНЕНТ ИНТЕРФЕЙСА АВТОРИЗАЦИИ
// ============================================

const AuthUI = (function() {
    // Защита от повторных инициализаций
    if (window.__AUTH_UI_INITIALIZED__) {
        return window.AuthUI;
    }

    // ===== ПРИВАТНЫЕ ПЕРЕМЕННЫЕ =====
    let authModal = null;
    let currentMode = 'login'; // 'login' или 'register'
    let isInitialized = false;

    // ===== ИНИЦИАЛИЗАЦИЯ =====
    function init() {
        if (isInitialized) return;
        
        const modalEl = document.getElementById('authModal');
        if (modalEl && window.bootstrap) {
            authModal = new bootstrap.Modal(modalEl, {
                backdrop: 'static',
                keyboard: true
            });
        }
        
        // Рендерим начальное состояние
        renderAuthBlock();
        
        // Добавляем глобальные обработчики
        setupGlobalListeners();
        
        // Подписываемся на изменения авторизации
        Auth.onAuthChange(() => {
            renderAuthBlock();
        });
        
        isInitialized = true;
        console.log('✅ AuthUI инициализирован');
    }

    // ===== ГЛОБАЛЬНЫЕ ОБРАБОТЧИКИ =====
    function setupGlobalListeners() {
        document.addEventListener('click', (e) => {
            const target = e.target.closest('[data-action]');
            if (!target) return;
            
            const action = target.dataset.action;
            
            e.preventDefault();
            
            switch(action) {
                case 'login':
                    showLoginModal();
                    break;
                case 'register':
                    showRegisterModal();
                    break;
                case 'logout':
                    Auth.logout();
                    break;
                case 'close-modals':
                    hideModals();
                    break;
            }
        });
    }

    // ===== ПОКАЗ МОДАЛОК =====
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

    function hideModals() {
        if (authModal) authModal.hide();
        
        // Убираем бэкдропы
        document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
        document.body.classList.remove('modal-open');
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';
    }

    // ===== РЕНДЕР МОДАЛКИ =====
    function renderModal() {
        const titleEl = document.getElementById('authModalTitle');
        const bodyEl = document.getElementById('authModalBody');
        
        if (!titleEl || !bodyEl) return;
        
        if (currentMode === 'login') {
            titleEl.innerHTML = `
                <i class="fas fa-sign-in-alt me-2" style="color: var(--accent);"></i>
                Вход в СВОЙ МАСТЕР 86
            `;
            bodyEl.innerHTML = getLoginForm();
        } else {
            titleEl.innerHTML = `
                <i class="fas fa-user-plus me-2" style="color: var(--accent);"></i>
                Регистрация в СВОЙ МАСТЕР 86
            `;
            bodyEl.innerHTML = getRegisterForm();
        }
        
        attachModalEvents();
    }

    // ===== ФОРМА ВХОДА =====
    function getLoginForm() {
        return `
            <div class="mb-4">
                <label class="form-label">
                    <i class="fas fa-envelope me-1" style="color: var(--accent);"></i>
                    Email
                </label>
                <input type="email" class="form-control form-control-lg" id="loginEmail" 
                       placeholder="email@example.com" autocomplete="email" required>
            </div>
            
            <div class="mb-4">
                <label class="form-label">
                    <i class="fas fa-lock me-1" style="color: var(--accent);"></i>
                    Пароль
                </label>
                <input type="password" class="form-control form-control-lg" id="loginPassword" 
                       placeholder="••••••" autocomplete="current-password" required>
            </div>
            
            <div id="loginError" class="alert alert-danger d-none">
                <i class="fas fa-exclamation-circle me-2"></i>
                <span></span>
            </div>
            
            <div class="d-grid gap-3">
                <button class="btn btn-primary btn-lg" id="loginSubmitBtn">
                    <i class="fas fa-sign-in-alt me-2"></i>
                    Войти
                </button>
                
                <div class="text-center">
                    <button class="btn btn-link" id="switchToRegisterBtn">
                        Нет аккаунта? Зарегистрироваться
                    </button>
                </div>
            </div>
        `;
    }

    // ===== ФОРМА РЕГИСТРАЦИИ =====
    function getRegisterForm() {
        return `
            <div class="mb-3">
                <label class="form-label">
                    <i class="fas fa-envelope me-1" style="color: var(--accent);"></i>
                    Email <span class="text-danger">*</span>
                </label>
                <input type="email" class="form-control" id="registerEmail" 
                       placeholder="email@example.com" autocomplete="email" required>
            </div>
            
            <div class="mb-3">
                <label class="form-label">
                    <i class="fas fa-lock me-1" style="color: var(--accent);"></i>
                    Пароль <span class="text-danger">*</span>
                </label>
                <input type="password" class="form-control" id="registerPassword" 
                       placeholder="Минимум 6 символов" autocomplete="new-password" required>
                <small class="text-secondary">Минимум 6 символов</small>
            </div>
            
            <div class="mb-3">
                <label class="form-label">
                    <i class="fas fa-user me-1" style="color: var(--accent);"></i>
                    Имя <span class="text-danger">*</span>
                </label>
                <input type="text" class="form-control" id="registerName" 
                       placeholder="Иван Петров" autocomplete="name" required>
            </div>
            
            <div class="mb-3">
                <label class="form-label">
                    <i class="fas fa-phone me-1" style="color: var(--accent);"></i>
                    Телефон
                </label>
                <input type="tel" class="form-control" id="registerPhone" 
                       placeholder="+7 (999) 123-45-67" autocomplete="tel">
                <small class="text-secondary">Необязательно, но поможет мастерам связаться</small>
            </div>
            
            <div class="mb-4">
                <label class="form-label">
                    <i class="fas fa-user-tag me-1" style="color: var(--accent);"></i>
                    Кто вы? <span class="text-danger">*</span>
                </label>
                <div class="d-flex gap-4">
                    <div class="form-check">
                        <input class="form-check-input" type="radio" name="role" 
                               id="roleClient" value="client" checked>
                        <label class="form-check-label" for="roleClient">
                            <i class="fas fa-user me-1"></i> Клиент
                        </label>
                    </div>
                    <div class="form-check">
                        <input class="form-check-input" type="radio" name="role" 
                               id="roleMaster" value="master">
                        <label class="form-check-label" for="roleMaster">
                            <i class="fas fa-tools me-1"></i> Мастер
                        </label>
                    </div>
                </div>
            </div>
            
            <div class="mb-3 master-only-field" style="display: none;">
                <label class="form-label">
                    <i class="fas fa-tags me-1" style="color: var(--accent);"></i>
                    Категории (через запятую)
                </label>
                <input type="text" class="form-control" id="registerCategories" 
                       placeholder="Сантехника, Электрика, Отделка">
                <small class="text-secondary">
                    <i class="fas fa-info-circle me-1"></i>
                    Например: Сантехника, Электрика, Ремонт
                </small>
            </div>
            
            <div id="registerError" class="alert alert-danger d-none">
                <i class="fas fa-exclamation-circle me-2"></i>
                <span></span>
            </div>
            
            <div class="d-grid gap-3">
                <button class="btn btn-primary btn-lg" id="registerSubmitBtn">
                    <i class="fas fa-user-plus me-2"></i>
                    Зарегистрироваться
                </button>
                
                <div class="text-center">
                    <button class="btn btn-link" id="switchToLoginBtn">
                        Уже есть аккаунт? Войти
                    </button>
                </div>
            </div>
        `;
    }

    // ===== ОБРАБОТЧИКИ МОДАЛКИ =====
    function attachModalEvents() {
        // Переключение между формами
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

        // Показ поля категорий для мастера
        document.querySelectorAll('input[name="role"]').forEach(radio => {
            radio.addEventListener('change', function() {
                const masterField = document.querySelector('.master-only-field');
                if (masterField) {
                    masterField.style.display = this.value === 'master' ? 'block' : 'none';
                }
            });
        });

        // Отправка форм
        document.getElementById('loginSubmitBtn')?.addEventListener('click', handleLogin);
        document.getElementById('registerSubmitBtn')?.addEventListener('click', handleRegister);
        
        // Закрытие по Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && authModal) {
                authModal.hide();
            }
        });
        
        // Очистка при закрытии
        const modalEl = document.getElementById('authModal');
        if (modalEl) {
            modalEl.addEventListener('hidden.bs.modal', () => {
                document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
            });
        }
    }

    // ===== ОБРАБОТКА ВХОДА =====
    async function handleLogin() {
        const email = document.getElementById('loginEmail')?.value.trim();
        const password = document.getElementById('loginPassword')?.value;
        const errorDiv = document.getElementById('loginError');

        // Валидация
        if (!email || !password) {
            showError(errorDiv, 'Введите email и пароль');
            return;
        }

        if (!Utils.validateEmail(email)) {
            showError(errorDiv, 'Некорректный email');
            return;
        }

        if (password.length < 6) {
            showError(errorDiv, 'Пароль должен быть не менее 6 символов');
            return;
        }

        // Блокируем кнопку
        const loginBtn = document.getElementById('loginSubmitBtn');
        const originalText = loginBtn.innerHTML;
        loginBtn.disabled = true;
        loginBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Вход...';

        try {
            const result = await Auth.login(email, password);
            
            if (result.success) {
                // Успешный вход
                if (authModal) authModal.hide();
                renderAuthBlock();
                Utils.showSuccess('Вход выполнен успешно!');
            } else {
                showError(errorDiv, result.error || 'Ошибка входа');
            }
        } catch (error) {
            showError(errorDiv, 'Произошла ошибка. Попробуйте позже.');
            console.error('Login error:', error);
        } finally {
            // Разблокируем кнопку
            loginBtn.disabled = false;
            loginBtn.innerHTML = originalText;
        }
    }

    // ===== ОБРАБОТКА РЕГИСТРАЦИИ =====
    async function handleRegister() {
        const email = document.getElementById('registerEmail')?.value.trim();
        const password = document.getElementById('registerPassword')?.value;
        const name = document.getElementById('registerName')?.value.trim();
        const phone = document.getElementById('registerPhone')?.value.trim() || '';
        const role = document.querySelector('input[name="role"]:checked')?.value || 'client';
        const categories = document.getElementById('registerCategories')?.value.trim() || '';
        const errorDiv = document.getElementById('registerError');

        // Валидация
        if (!email || !password || !name) {
            showError(errorDiv, 'Заполните все обязательные поля');
            return;
        }

        if (!Utils.validateEmail(email)) {
            showError(errorDiv, 'Некорректный email');
            return;
        }

        if (!Utils.validatePassword(password)) {
            showError(errorDiv, 'Пароль должен быть не менее 6 символов');
            return;
        }

        if (!Utils.validateName(name)) {
            showError(errorDiv, 'Имя должно быть от 2 до 50 символов');
            return;
        }

        if (phone && !Utils.validatePhone(phone)) {
            showError(errorDiv, 'Некорректный формат телефона');
            return;
        }

        // Блокируем кнопку
        const registerBtn = document.getElementById('registerSubmitBtn');
        const originalText = registerBtn.innerHTML;
        registerBtn.disabled = true;
        registerBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Регистрация...';

        try {
            const result = await Auth.register(email, password, { 
                name, 
                phone, 
                role, 
                categories 
            });
            
            if (result.success) {
                // Успешная регистрация
                if (authModal) authModal.hide();
                renderAuthBlock();
                Utils.showSuccess('Регистрация прошла успешно!');
            } else {
                showError(errorDiv, result.error || 'Ошибка регистрации');
            }
        } catch (error) {
            showError(errorDiv, 'Произошла ошибка. Попробуйте позже.');
            console.error('Register error:', error);
        } finally {
            // Разблокируем кнопку
            registerBtn.disabled = false;
            registerBtn.innerHTML = originalText;
        }
    }

    // ===== ПОКАЗ ОШИБКИ =====
    function showError(errorDiv, message) {
        if (!errorDiv) return;
        
        const span = errorDiv.querySelector('span');
        if (span) span.textContent = message;
        errorDiv.classList.remove('d-none');
        
        // Автоскрытие через 5 секунд
        setTimeout(() => {
            errorDiv.classList.add('d-none');
        }, 5000);
    }

    // ===== РЕНДЕР БЛОКА АВТОРИЗАЦИИ В ШАПКЕ =====
    function renderAuthBlock() {
        const container = document.getElementById('authBlockContainer');
        if (!container) return;

        const state = Auth.getAuthState();

        if (state.isAuthenticated && state.userData) {
            // Пользователь авторизован
            const isMaster = state.isMaster;
            const userName = state.userData.name || 'Пользователь';
            const userEmail = state.user?.email || '';
            
            container.innerHTML = `
                <div class="card p-2 p-sm-3 auth-block">
                    <div class="d-flex align-items-center gap-2 gap-sm-3">
                        <div class="avatar-circle" style="width: 44px; height: 44px; min-width: 44px;">
                            <i class="fas ${isMaster ? 'fa-user-tie' : 'fa-user'}" style="font-size: 1.3rem;"></i>
                        </div>
                        <div class="flex-grow-1" style="min-width: 0;">
                            <h6 class="mb-0 fw-bold">${Utils.escapeHtml(userName)}</h6>
                            <div class="d-flex align-items-center gap-2">
                                <span class="badge ${isMaster ? 'bg-accent' : 'bg-secondary'}">${state.roleDisplay}</span>
                                <small class="text-secondary text-truncate">${userEmail}</small>
                            </div>
                        </div>
                        <button class="btn btn-sm btn-outline-danger rounded-pill" data-action="logout" 
                                style="padding: 8px 14px;" title="Выйти">
                            <i class="fas fa-sign-out-alt"></i>
                            <span class="d-none d-sm-inline ms-1">Выйти</span>
                        </button>
                    </div>
                </div>
            `;
        } else {
            // Пользователь не авторизован
            container.innerHTML = `
                <div class="card p-3 auth-block">
                    <div class="d-flex flex-column flex-sm-row justify-content-between align-items-center gap-3">
                        <div class="d-flex align-items-center gap-2">
                            <i class="fas fa-user-circle fa-2x" style="color: var(--accent);"></i>
                            <span class="text-secondary">Войдите в личный кабинет</span>
                        </div>
                        <div class="auth-buttons d-flex gap-2 w-100 w-sm-auto">
                            <button class="btn btn-outline-secondary btn-sm flex-grow-1 rounded-pill" 
                                    data-action="login">
                                <i class="fas fa-sign-in-alt me-1"></i>
                                <span>Вход</span>
                            </button>
                            <button class="btn btn-primary btn-sm flex-grow-1 rounded-pill" 
                                    data-action="register">
                                <i class="fas fa-user-plus me-1"></i>
                                <span>Регистрация</span>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }
    }

    // ===== ПУБЛИЧНОЕ API =====
    const api = {
        init,
        showLoginModal,
        showRegisterModal,
        hideModals,
        renderAuthBlock
    };

    window.__AUTH_UI_INITIALIZED__ = true;
    
    return Object.freeze(api);
})();

// ===== АВТОИНИЦИАЛИЗАЦИЯ =====
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        AuthUI.init();
    }, 500);
});

window.AuthUI = AuthUI;
console.log('✅ AuthUI компонент загружен');