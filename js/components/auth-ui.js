// ===== js/components/auth-ui.js =====
// UI для авторизации (использует глобальный Auth из services/auth.js)

const AuthUI = (function() {
    // Приватные переменные
    let loginModal = null;
    let registerModal = null;
    let currentAuthModal = null;

    // ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =====
    
    // Проверка наличия Auth
    function checkAuth() {
        if (!window.Auth) {
            console.error('❌ Auth не загружен! Проверь порядок скриптов');
            alert('Ошибка загрузки системы авторизации');
            return false;
        }
        return true;
    }

    // Безопасное получение элемента
    function getElement(id) {
        const el = document.getElementById(id);
        if (!el) console.warn(`⚠️ Элемент #${id} не найден в DOM`);
        return el;
    }

    // ===== МОДАЛЬНЫЕ ОКНА =====
    
    // Создание модалки входа
    function createLoginModal() {
        const modalHtml = `
            <div class="modal fade" id="authLoginModal" tabindex="-1" aria-hidden="true">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content" style="border-radius: 30px; overflow: hidden;">
                        <div class="modal-header" style="background: linear-gradient(135deg, #E67A4B, #FF9F4B); color: white; border-bottom: none;">
                            <h5 class="modal-title">
                                <i class="fas fa-sign-in-alt me-2"></i>
                                Вход в ВоркХом
                            </h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body p-4">
                            <div class="mb-3">
                                <label class="form-label">Email</label>
                                <input type="email" class="form-control" id="loginEmail" placeholder="email@example.com">
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Пароль</label>
                                <input type="password" class="form-control" id="loginPassword" placeholder="••••••">
                            </div>
                            <div class="mb-3 text-end">
                                <a href="#" id="forgotPasswordLink" style="color: var(--accent);">Забыли пароль?</a>
                            </div>
                            <div id="loginError" class="alert alert-danger d-none"></div>
                        </div>
                        <div class="modal-footer justify-content-center border-0 pt-0 pb-4">
                            <button type="button" class="btn px-5" id="loginSubmitBtn" style="background: var(--accent); color: white;">
                                <i class="fas fa-sign-in-alt me-2"></i>Войти
                            </button>
                            <button type="button" class="btn btn-outline-secondary px-5" data-bs-dismiss="modal">
                                Отмена
                            </button>
                        </div>
                        <div class="text-center pb-4">
                            <span class="text-secondary">Нет аккаунта?</span>
                            <a href="#" id="switchToRegisterLink" style="color: var(--accent); font-weight: 600;">Зарегистрироваться</a>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Удаляем старую модалку если есть
        const oldModal = document.getElementById('authLoginModal');
        if (oldModal) oldModal.remove();
        
        // Добавляем в DOM
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // Инициализируем Bootstrap модалку
        const modalEl = document.getElementById('authLoginModal');
        if (window.bootstrap) {
            loginModal = new bootstrap.Modal(modalEl);
        }
        
        // Добавляем обработчики
        setupLoginModalHandlers(modalEl);
    }
    
    // Настройка обработчиков для модалки входа
    function setupLoginModalHandlers(modalEl) {
        const loginBtn = document.getElementById('loginSubmitBtn');
        const switchLink = document.getElementById('switchToRegisterLink');
        const forgotLink = document.getElementById('forgotPasswordLink');
        
        if (loginBtn) {
            loginBtn.addEventListener('click', handleLogin);
        }
        
        if (switchLink) {
            switchLink.addEventListener('click', (e) => {
                e.preventDefault();
                if (loginModal) loginModal.hide();
                setTimeout(() => showRegisterModal(), 300);
            });
        }
        
        if (forgotLink) {
            forgotLink.addEventListener('click', (e) => {
                e.preventDefault();
                handleForgotPassword();
            });
        }
        
        // Закрытие по Escape
        modalEl.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && loginModal) {
                loginModal.hide();
            }
        });
    }
    
    // Создание модалки регистрации
    function createRegisterModal() {
        const modalHtml = `
            <div class="modal fade" id="authRegisterModal" tabindex="-1" aria-hidden="true">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content" style="border-radius: 30px; overflow: hidden;">
                        <div class="modal-header" style="background: linear-gradient(135deg, #E67A4B, #FF9F4B); color: white; border-bottom: none;">
                            <h5 class="modal-title">
                                <i class="fas fa-user-plus me-2"></i>
                                Регистрация в ВоркХом
                            </h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body p-4">
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
                                <label class="form-label">Телефон (необязательно)</label>
                                <input type="tel" class="form-control" id="registerPhone" placeholder="+7 (999) 123-45-67">
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Кто вы?</label>
                                <div class="d-flex gap-3">
                                    <div class="form-check">
                                        <input class="form-check-input" type="radio" name="role" id="roleClient" value="client" checked>
                                        <label class="form-check-label" for="roleClient">👤 Клиент</label>
                                    </div>
                                    <div class="form-check">
                                        <input class="form-check-input" type="radio" name="role" id="roleMaster" value="master">
                                        <label class="form-check-label" for="roleMaster">🔨 Мастер</label>
                                    </div>
                                </div>
                            </div>
                            <div class="mb-3 master-only-field" style="display: none;">
                                <label class="form-label">Категории (через запятую)</label>
                                <input type="text" class="form-control" id="registerCategories" placeholder="Сантехника, Электрика">
                            </div>
                            <div id="registerError" class="alert alert-danger d-none"></div>
                        </div>
                        <div class="modal-footer justify-content-center border-0 pt-0 pb-4">
                            <button type="button" class="btn px-5" id="registerSubmitBtn" style="background: var(--accent); color: white;">
                                <i class="fas fa-user-plus me-2"></i>Зарегистрироваться
                            </button>
                            <button type="button" class="btn btn-outline-secondary px-5" data-bs-dismiss="modal">
                                Отмена
                            </button>
                        </div>
                        <div class="text-center pb-4">
                            <span class="text-secondary">Уже есть аккаунт?</span>
                            <a href="#" id="switchToLoginLink" style="color: var(--accent); font-weight: 600;">Войти</a>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Удаляем старую модалку если есть
        const oldModal = document.getElementById('authRegisterModal');
        if (oldModal) oldModal.remove();
        
        // Добавляем в DOM
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // Инициализируем Bootstrap модалку
        const modalEl = document.getElementById('authRegisterModal');
        if (window.bootstrap) {
            registerModal = new bootstrap.Modal(modalEl);
        }
        
        // Добавляем обработчики
        setupRegisterModalHandlers(modalEl);
    }
    
    // Настройка обработчиков для модалки регистрации
    function setupRegisterModalHandlers(modalEl) {
        const registerBtn = document.getElementById('registerSubmitBtn');
        const switchLink = document.getElementById('switchToLoginLink');
        const roleRadios = document.querySelectorAll('input[name="role"]');
        const masterField = document.querySelector('.master-only-field');
        
        if (registerBtn) {
            registerBtn.addEventListener('click', handleRegister);
        }
        
        if (switchLink) {
            switchLink.addEventListener('click', (e) => {
                e.preventDefault();
                if (registerModal) registerModal.hide();
                setTimeout(() => showLoginModal(), 300);
            });
        }
        
        // Показываем/скрываем поле категорий при выборе роли
        roleRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                if (masterField) {
                    masterField.style.display = radio.value === 'master' ? 'block' : 'none';
                }
            });
        });
        
        // Закрытие по Escape
        modalEl.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && registerModal) {
                registerModal.hide();
            }
        });
    }
    
    // ===== ОБРАБОТЧИКИ ДЕЙСТВИЙ =====
    
    // Обработка входа
    async function handleLogin() {
        if (!checkAuth()) return;
        
        const email = document.getElementById('loginEmail')?.value.trim();
        const password = document.getElementById('loginPassword')?.value;
        const errorDiv = document.getElementById('loginError');
        
        // Валидация
        if (!email || !password) {
            if (errorDiv) {
                errorDiv.textContent = 'Введите email и пароль';
                errorDiv.classList.remove('d-none');
            }
            return;
        }
        
        // Показываем загрузку
        const loginBtn = document.getElementById('loginSubmitBtn');
        const originalText = loginBtn?.innerHTML;
        if (loginBtn) {
            loginBtn.disabled = true;
            loginBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Вход...';
        }
        
        try {
            const result = await Auth.login(email, password);
            
            if (result.success) {
                if (loginModal) loginModal.hide();
                // Обновляем UI
                renderAuthBlock();
            } else {
                if (errorDiv) {
                    errorDiv.textContent = result.error || 'Ошибка входа';
                    errorDiv.classList.remove('d-none');
                }
            }
        } catch (error) {
            console.error('❌ Ошибка при входе:', error);
            if (errorDiv) {
                errorDiv.textContent = 'Произошла ошибка. Попробуйте позже.';
                errorDiv.classList.remove('d-none');
            }
        } finally {
            if (loginBtn) {
                loginBtn.disabled = false;
                loginBtn.innerHTML = originalText;
            }
        }
    }
    
    // Обработка регистрации
    async function handleRegister() {
        if (!checkAuth()) return;
        
        const email = document.getElementById('registerEmail')?.value.trim();
        const password = document.getElementById('registerPassword')?.value;
        const name = document.getElementById('registerName')?.value.trim() || 'Пользователь';
        const phone = document.getElementById('registerPhone')?.value.trim() || '';
        const role = document.querySelector('input[name="role"]:checked')?.value || 'client';
        const categories = document.getElementById('registerCategories')?.value.trim() || '';
        const errorDiv = document.getElementById('registerError');
        
        // Валидация
        if (!email || !password) {
            if (errorDiv) {
                errorDiv.textContent = 'Email и пароль обязательны';
                errorDiv.classList.remove('d-none');
            }
            return;
        }
        
        if (password.length < 6) {
            if (errorDiv) {
                errorDiv.textContent = 'Пароль должен быть не менее 6 символов';
                errorDiv.classList.remove('d-none');
            }
            return;
        }
        
        // Показываем загрузку
        const registerBtn = document.getElementById('registerSubmitBtn');
        const originalText = registerBtn?.innerHTML;
        if (registerBtn) {
            registerBtn.disabled = true;
            registerBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Регистрация...';
        }
        
        try {
            const result = await Auth.register(email, password, {
                name,
                phone,
                role,
                categories
            });
            
            if (result.success) {
                if (registerModal) registerModal.hide();
                // Обновляем UI
                renderAuthBlock();
                
                // Показываем приветственное сообщение
                alert(`✅ Добро пожаловать, ${name || 'Пользователь'}!`);
            } else {
                if (errorDiv) {
                    errorDiv.textContent = result.error || 'Ошибка регистрации';
                    errorDiv.classList.remove('d-none');
                }
            }
        } catch (error) {
            console.error('❌ Ошибка при регистрации:', error);
            if (errorDiv) {
                errorDiv.textContent = 'Произошла ошибка. Попробуйте позже.';
                errorDiv.classList.remove('d-none');
            }
        } finally {
            if (registerBtn) {
                registerBtn.disabled = false;
                registerBtn.innerHTML = originalText;
            }
        }
    }
    
    // Обработка восстановления пароля
    function handleForgotPassword() {
        const email = document.getElementById('loginEmail')?.value.trim();
        
        if (!email) {
            alert('Введите email в поле выше');
            return;
        }
        
        alert(`📧 Инструкция по восстановлению пароля отправлена на ${email}\n\n(В демо-версии функция не активна)`);
    }
    
    // ===== ПУБЛИЧНЫЕ API =====
    
    // Показать модалку входа
    function showLoginModal() {
        if (!checkAuth()) return;
        
        if (!loginModal) {
            createLoginModal();
        }
        
        if (loginModal) {
            loginModal.show();
        }
    }
    
    // Показать модалку регистрации
    function showRegisterModal() {
        if (!checkAuth()) return;
        
        if (!registerModal) {
            createRegisterModal();
        }
        
        if (registerModal) {
            registerModal.show();
        }
    }
    
    // Рендер блока авторизации в контейнере
    function renderAuthBlock() {
        const container = document.getElementById('authBlockContainer');
        if (!container) return;
        
        if (!checkAuth()) {
            container.innerHTML = '<div class="alert alert-warning">Ошибка загрузки авторизации</div>';
            return;
        }
        
        if (Auth.isAuthenticated && Auth.isAuthenticated()) {
            const userData = Auth.getUserData();
            const user = Auth.getUser();
            const isMaster = Auth.isMaster ? Auth.isMaster() : false;
            const isClient = Auth.isClient ? Auth.isClient() : false;
            
            container.innerHTML = `
                <div class="card mb-4 p-3" style="border-radius: 20px;">
                    <div class="d-flex align-items-center gap-3">
                        <div class="avatar" style="width: 50px; height: 50px; background: var(--accent-gradient);">
                            <i class="fas fa-user"></i>
                        </div>
                        <div class="flex-grow-1">
                            <h6 class="mb-0 fw-bold">${userData?.name || 'Пользователь'}</h6>
                            <small class="text-secondary">
                                ${isMaster ? '🔨 Мастер' : isClient ? '👤 Клиент' : '👤 ' + (userData?.role || 'Пользователь')}
                            </small>
                            <div><small class="text-muted">${user?.email || ''}</small></div>
                        </div>
                        <button class="btn btn-sm btn-outline-danger" onclick="Auth.logout()">
                            <i class="fas fa-sign-out-alt"></i>
                        </button>
                    </div>
                </div>
            `;
        } else {
            container.innerHTML = `
                <div class="card mb-4 p-3" style="border-radius: 20px;">
                    <div class="d-flex justify-content-center gap-3">
                        <button class="btn btn-outline-secondary px-4" onclick="AuthUI.showLoginModal()">
                            <i class="fas fa-sign-in-alt me-2"></i>Вход
                        </button>
                        <button class="btn px-4" style="background: var(--accent); color: white;" onclick="AuthUI.showRegisterModal()">
                            <i class="fas fa-user-plus me-2"></i>Регистрация
                        </button>
                    </div>
                </div>
            `;
        }
    }
    
    // Скрыть все модалки
    function hideAllModals() {
        if (loginModal) loginModal.hide();
        if (registerModal) registerModal.hide();
        
        // Убираем бэкдропы
        document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
        document.body.classList.remove('modal-open');
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';
    }
    
    // Публичное API
    return {
        showLoginModal,
        showRegisterModal,
        renderAuthBlock,
        hideAllModals
    };
})();

// Автоинициализация при загрузке
document.addEventListener('DOMContentLoaded', () => {
    // Проверяем наличие Auth через секунду
    setTimeout(() => {
        if (window.Auth) {
            console.log('✅ AuthUI готов к работе');
            // Рендерим блок авторизации если есть контейнер
            if (document.getElementById('authBlockContainer')) {
                AuthUI.renderAuthBlock();
            }
        } else {
            console.warn('⚠️ AuthUI: Auth не загружен, UI будет недоступен');
        }
    }, 500);
    
    // Закрытие модалок по клику вне
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal') && window.bootstrap) {
            AuthUI.hideAllModals();
        }
    });
});

window.AuthUI = AuthUI;