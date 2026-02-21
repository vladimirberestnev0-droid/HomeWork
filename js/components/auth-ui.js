// ===== js/components/auth-ui.js =====
// UI для авторизации (использует глобальный Auth из services/auth.js)
// ВЕРСИЯ 3.0 — С КРАСИВЫМИ МОДАЛКАМИ И КНОПКАМИ СПРАВА

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
            <div class="modal fade modal-workhom" id="authLoginModal" tabindex="-1" aria-hidden="true">
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
                                <a href="#" id="forgotPasswordLink" style="color: var(--accent); text-decoration: none; font-size: 0.9rem;">
                                    <i class="fas fa-question-circle me-1"></i>Забыли пароль?
                                </a>
                            </div>
                            <div id="loginError" class="alert alert-danger d-none"></div>
                        </div>
                        <div class="modal-footer justify-content-center border-0 pt-0 pb-4">
                            <button type="button" class="btn px-5" id="loginSubmitBtn" style="background: var(--accent); color: white;">
                                <i class="fas fa-sign-in-alt me-2"></i>Войти
                            </button>
                            <button type="button" class="btn btn-outline-secondary px-5" data-bs-dismiss="modal">
                                <i class="fas fa-times me-2"></i>Отмена
                            </button>
                        </div>
                        <div class="text-center pb-4">
                            <span class="text-secondary">Нет аккаунта?</span>
                            <a href="#" id="switchToRegisterLink" style="color: var(--accent); font-weight: 600; text-decoration: none;">
                                Зарегистрироваться
                            </a>
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
        
        // Очистка ошибок при открытии
        modalEl.addEventListener('show.bs.modal', () => {
            const errorDiv = document.getElementById('loginError');
            if (errorDiv) {
                errorDiv.classList.add('d-none');
                errorDiv.textContent = '';
            }
            document.getElementById('loginEmail')?.focus();
        });
    }
    
    // Создание модалки регистрации
    function createRegisterModal() {
        const modalHtml = `
            <div class="modal fade modal-workhom" id="authRegisterModal" tabindex="-1" aria-hidden="true">
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
                                <div class="form-text" id="passwordHelp">
                                    <i class="fas fa-info-circle me-1"></i>Минимум 6 символов
                                </div>
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
                                <div class="d-flex gap-4">
                                    <div class="form-check">
                                        <input class="form-check-input" type="radio" name="role" id="roleClient" value="client" checked>
                                        <label class="form-check-label" for="roleClient">
                                            <i class="fas fa-user me-1" style="color: var(--accent);"></i> Клиент
                                        </label>
                                    </div>
                                    <div class="form-check">
                                        <input class="form-check-input" type="radio" name="role" id="roleMaster" value="master">
                                        <label class="form-check-label" for="roleMaster">
                                            <i class="fas fa-tools me-1" style="color: var(--accent);"></i> Мастер
                                        </label>
                                    </div>
                                </div>
                            </div>
                            <div class="mb-3 master-only-field" style="display: none;">
                                <label class="form-label">Категории (через запятую)</label>
                                <input type="text" class="form-control" id="registerCategories" placeholder="Сантехника, Электрика, Отделка">
                                <div class="form-text">
                                    <i class="fas fa-lightbulb me-1"></i>Например: Сантехника, Электрика, Ремонт
                                </div>
                            </div>
                            <div id="registerError" class="alert alert-danger d-none"></div>
                        </div>
                        <div class="modal-footer justify-content-center border-0 pt-0 pb-4">
                            <button type="button" class="btn px-5" id="registerSubmitBtn" style="background: var(--accent); color: white;">
                                <i class="fas fa-user-plus me-2"></i>Зарегистрироваться
                            </button>
                            <button type="button" class="btn btn-outline-secondary px-5" data-bs-dismiss="modal">
                                <i class="fas fa-times me-2"></i>Отмена
                            </button>
                        </div>
                        <div class="text-center pb-4">
                            <span class="text-secondary">Уже есть аккаунт?</span>
                            <a href="#" id="switchToLoginLink" style="color: var(--accent); font-weight: 600; text-decoration: none;">
                                Войти
                            </a>
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
                    
                    // Очищаем ошибку при смене роли
                    const errorDiv = document.getElementById('registerError');
                    if (errorDiv) {
                        errorDiv.classList.add('d-none');
                        errorDiv.textContent = '';
                    }
                }
            });
        });
        
        // Закрытие по Escape
        modalEl.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && registerModal) {
                registerModal.hide();
            }
        });
        
        // Очистка при открытии
        modalEl.addEventListener('show.bs.modal', () => {
            const errorDiv = document.getElementById('registerError');
            if (errorDiv) {
                errorDiv.classList.add('d-none');
                errorDiv.textContent = '';
            }
            document.getElementById('registerEmail')?.focus();
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
        
        if (!window.Helpers?.validateEmail?.(email)) {
            if (errorDiv) {
                errorDiv.textContent = 'Некорректный email';
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
            
            if (result?.success) {
                if (loginModal) loginModal.hide();
                // Обновляем UI
                renderAuthBlock();
                
                // Показываем приветствие
                const userData = Auth.getUserData();
                if (userData?.name) {
                    setTimeout(() => {
                        safeHelpers.showNotification?.(`👋 С возвращением, ${userData.name}!`, 'success');
                    }, 500);
                }
            } else {
                if (errorDiv) {
                    errorDiv.textContent = result?.error || 'Ошибка входа';
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
        
        if (!window.Helpers?.validateEmail?.(email)) {
            if (errorDiv) {
                errorDiv.textContent = 'Некорректный email';
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
        
        if (role === 'master' && phone && !window.Helpers?.validatePhone?.(phone)) {
            if (errorDiv) {
                errorDiv.textContent = 'Некорректный формат телефона';
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
            
            if (result?.success) {
                if (registerModal) registerModal.hide();
                // Обновляем UI
                renderAuthBlock();
                
                // Показываем приветственное сообщение
                setTimeout(() => {
                    safeHelpers.showNotification?.(
                        `✅ Добро пожаловать, ${name}!${role === 'master' ? ' Теперь вы можете откликаться на заказы' : ''}`, 
                        'success'
                    );
                }, 500);
            } else {
                if (errorDiv) {
                    errorDiv.textContent = result?.error || 'Ошибка регистрации';
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
            safeHelpers.showNotification?.('Введите email в поле выше', 'warning');
            return;
        }
        
        // Здесь должен быть запрос на восстановление
        safeHelpers.showNotification?.(
            `📧 Инструкция по восстановлению пароля отправлена на ${email}`,
            'info'
        );
    }
    
    // ===== МОДАЛКА ПОДТВЕРЖДЕНИЯ ВЫХОДА =====
    
    // Функция подтверждения выхода
    window.showLogoutConfirm = function() {
        const modalHtml = `
            <div class="modal fade modal-logout" id="logoutConfirmModal" tabindex="-1">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content" style="border-radius: 30px; overflow: hidden;">
                        <div class="modal-header" style="background: linear-gradient(135deg, #DC3545, #ff6b6b); color: white; border-bottom: none;">
                            <h5 class="modal-title">
                                <i class="fas fa-sign-out-alt me-2"></i>
                                Подтверждение выхода
                            </h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body text-center py-4">
                            <div class="mb-4">
                                <i class="fas fa-door-open fa-4x" style="color: #DC3545; opacity: 0.8; animation: bounce 1s ease-in-out infinite;"></i>
                            </div>
                            <h5 class="mb-3">Вы действительно хотите выйти?</h5>
                            <p class="text-secondary mb-0">Вы всегда можете войти снова</p>
                        </div>
                        <div class="modal-footer justify-content-center border-0 pb-4">
                            <button type="button" class="btn btn-outline-secondary px-4" data-bs-dismiss="modal">
                                <i class="fas fa-times me-2"></i>Отмена
                            </button>
                            <button type="button" class="btn px-4" style="background: #DC3545; color: white;" onclick="confirmLogout()">
                                <i class="fas fa-sign-out-alt me-2"></i>Выйти
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        const oldModal = document.getElementById('logoutConfirmModal');
        if (oldModal) oldModal.remove();
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modal = new bootstrap.Modal(document.getElementById('logoutConfirmModal'));
        modal.show();
    };

    // Подтверждение выхода
    window.confirmLogout = function() {
        const modal = bootstrap.Modal.getInstance(document.getElementById('logoutConfirmModal'));
        if (modal) modal.hide();
        
        setTimeout(() => {
            if (typeof Auth?.logout === 'function') {
                Auth.logout().then(() => {
                    safeHelpers.showNotification?.('👋 До свидания!', 'info');
                    renderAuthBlock();
                });
            }
        }, 300);
    };

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
    
    // Рендер блока авторизации (КНОПКИ СПРАВА!)
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
                <div class="card mb-4 p-3" style="border-radius: 20px; border-left: 4px solid var(--accent); background: var(--bg-white); box-shadow: var(--shadow);">
                    <div class="d-flex align-items-center gap-3">
                        <div class="avatar" style="width: 50px; height: 50px; background: var(--accent-gradient); box-shadow: 0 4px 10px rgba(230,122,75,0.3);">
                            <i class="fas fa-user"></i>
                        </div>
                        <div class="flex-grow-1">
                            <h6 class="mb-0 fw-bold">${safeHelpers.escapeHtml(userData?.name || 'Пользователь')}</h6>
                            <small class="text-secondary">
                                ${isMaster ? '🔨 Мастер' : isClient ? '👤 Клиент' : '👤 ' + (userData?.role || 'Пользователь')}
                            </small>
                            <div><small class="text-muted">${user?.email || ''}</small></div>
                        </div>
                        <button class="btn btn-sm btn-outline-danger" onclick="showLogoutConfirm()" title="Выйти">
                            <i class="fas fa-sign-out-alt"></i>
                        </button>
                    </div>
                </div>
            `;
        } else {
            container.innerHTML = `
                <div class="card mb-4 p-3" style="border-radius: 20px; background: linear-gradient(135deg, #f8f9fa, #e9ecef); border: 1px solid rgba(230,122,75,0.2);">
                    <div class="d-flex justify-content-between align-items-center flex-wrap gap-2">
                        <div class="d-flex align-items-center gap-2">
                            <i class="fas fa-user-circle fa-2x" style="color: var(--accent);"></i>
                            <span class="text-secondary">Войдите в личный кабинет</span>
                        </div>
                        <div class="d-flex gap-2">
                            <button class="btn btn-outline-secondary px-4" onclick="AuthUI.showLoginModal()">
                                <i class="fas fa-sign-in-alt me-2"></i>Вход
                            </button>
                            <button class="btn px-4" style="background: var(--accent); color: white;" onclick="AuthUI.showRegisterModal()">
                                <i class="fas fa-user-plus me-2"></i>Регистрация
                            </button>
                        </div>
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
    
    // Безопасный Helpers (для уведомлений)
    const safeHelpers = {
        escapeHtml: (text) => {
            if (!text) return '';
            if (window.Helpers?.escapeHtml) return Helpers.escapeHtml(text);
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        },
        showNotification: (msg, type) => {
            if (window.Helpers?.showNotification) {
                Helpers.showNotification(msg, type);
            } else {
                console.log(`🔔 ${type}: ${msg}`);
                if (type === 'error') alert(`❌ ${msg}`);
                else if (type === 'success') alert(`✅ ${msg}`);
                else alert(msg);
            }
        }
    };
    
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

// Экспортируем в глобальную область
window.AuthUI = AuthUI;