// ===== js/components/auth-ui.js =====
// UI для авторизации - ОПТИМИЗИРОВАННАЯ ВЕРСИЯ

const AuthUI = (function() {
    // Приватные переменные
    let loginModal = null;
    let registerModal = null;
    let logoutModal = null;
    let initialized = false;

    // ===== ИНИЦИАЛИЗАЦИЯ =====
    function init() {
        if (initialized) return;
        
        // Создаем модалки заранее
        createLoginModal();
        createRegisterModal();
        createLogoutModal();
        
        initialized = true;
        console.log('✅ AuthUI инициализирован');
    }

    // ===== СОЗДАНИЕ МОДАЛОК (ОДИН РАЗ) =====

    function createLoginModal() {
        // Проверяем, не существует ли уже
        if (document.getElementById('authLoginModal')) {
            loginModal = new bootstrap.Modal(document.getElementById('authLoginModal'));
            return;
        }

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
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // Инициализируем Bootstrap модалку
        const modalEl = document.getElementById('authLoginModal');
        if (window.bootstrap) {
            loginModal = new bootstrap.Modal(modalEl);
        }
        
        // Добавляем обработчики
        setupLoginModalHandlers(modalEl);
    }

    function createRegisterModal() {
        // Проверяем, не существует ли уже
        if (document.getElementById('authRegisterModal')) {
            registerModal = new bootstrap.Modal(document.getElementById('authRegisterModal'));
            return;
        }

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
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        const modalEl = document.getElementById('authRegisterModal');
        if (window.bootstrap) {
            registerModal = new bootstrap.Modal(modalEl);
        }
        
        setupRegisterModalHandlers(modalEl);
    }

    function createLogoutModal() {
        // Проверяем, не существует ли уже
        if (document.getElementById('logoutConfirmModal')) {
            logoutModal = new bootstrap.Modal(document.getElementById('logoutConfirmModal'));
            return;
        }

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
                                <i class="fas fa-door-open fa-4x" style="color: #DC3545; opacity: 0.8;"></i>
                            </div>
                            <h5 class="mb-3">Вы действительно хотите выйти?</h5>
                            <p class="text-secondary mb-0">Вы всегда можете войти снова</p>
                        </div>
                        <div class="modal-footer justify-content-center border-0 pb-4">
                            <button type="button" class="btn btn-outline-secondary px-4" data-bs-dismiss="modal">
                                <i class="fas fa-times me-2"></i>Отмена
                            </button>
                            <button type="button" class="btn px-4" style="background: #DC3545; color: white;" onclick="window.Auth?.logout()">
                                <i class="fas fa-sign-out-alt me-2"></i>Выйти
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        const modalEl = document.getElementById('logoutConfirmModal');
        if (window.bootstrap) {
            logoutModal = new bootstrap.Modal(modalEl);
        }
    }

    // ... (остальные функции обработчиков остаются без изменений)

    // ===== ПУБЛИЧНЫЕ API =====
    
    function showLoginModal() {
        if (!initialized) init();
        if (loginModal) loginModal.show();
    }
    
    function showRegisterModal() {
        if (!initialized) init();
        if (registerModal) registerModal.show();
    }

    function showLogoutModal() {
        if (!initialized) init();
        if (logoutModal) logoutModal.show();
    }
    
    function hideAllModals() {
        if (loginModal) loginModal.hide();
        if (registerModal) registerModal.hide();
        if (logoutModal) logoutModal.hide();
        
        // Убираем бэкдропы
        document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
        document.body.classList.remove('modal-open');
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';
    }
    
    // Публичное API
    return {
        init,
        showLoginModal,
        showRegisterModal,
        showLogoutModal,
        hideAllModals,
        renderAuthBlock
    };
})();

// Автоинициализация при загрузке
document.addEventListener('DOMContentLoaded', () => {
    // Инициализируем UI
    AuthUI.init();
    
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
});

window.AuthUI = AuthUI;