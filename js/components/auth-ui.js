// ============================================
// КОМПОНЕНТ ИНТЕРФЕЙСА АВТОРИЗАЦИИ (ИСПРАВЛЕННАЯ ВЕРСИЯ)
// ============================================
const AuthUI = (function() {
    if (window.__AUTH_UI_INITIALIZED__) return window.AuthUI;

    let isInitialized = false;

    function init() {
        if (isInitialized) return;

        renderAuthBlock();
        setupGlobalListeners();

        Auth.onAuthChange(() => {
            renderAuthBlock();
        });

        // Слушаем изменение размера экрана
        window.addEventListener('resize', Utils.debounce(() => {
            renderAuthBlock();
        }, 200));

        isInitialized = true;
        console.log('✅ AuthUI инициализирован');
    }

    function setupGlobalListeners() {
        document.addEventListener('click', (e) => {
            const target = e.target.closest('[data-action]');
            if (!target) return;

            const action = target.dataset.action;

            switch (action) {
                case 'login':
                    showLoginModal();
                    break;
                case 'register':
                    showRegisterModal();
                    break;
                case 'logout':
                    Auth.logout();
                    break;
            }
        });
    }

    function showLoginModal() {
        if (window.ModalManager) {
            ModalManager.show('auth', 'login');
        } else {
            if (window.AuthUI && AuthUI.showLoginModal) {
                AuthUI.showLoginModal();
            }
        }
    }

    function showRegisterModal() {
        if (window.ModalManager) {
            ModalManager.show('auth', 'register');
        } else {
            if (window.AuthUI && AuthUI.showRegisterModal) {
                AuthUI.showRegisterModal();
            }
        }
    }

    function renderAuthBlock() {
        const container = document.getElementById('authBlockContainer');
        if (!container) return;

        const state = Auth.getAuthState();
        const isDesktop = window.innerWidth >= 992;

        // НА ДЕСКТОПЕ ДЛЯ ГОСТЯ НЕ ПОКАЗЫВАЕМ БЛОК (ТАМ ЕСТЬ КНОПКА ВХОДА)
        if (isDesktop && !state.isAuthenticated) {
            container.innerHTML = ''; // Пусто!
            return;
        }

        if (state.isAuthenticated && state.userData) {
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
                                <span class="badge ${isMaster ? 'bg-accent' : 'bg-secondary'}">${Utils.escapeHtml(state.roleDisplay)}</span>
                                <small class="text-secondary text-truncate">${Utils.escapeHtml(userEmail)}</small>
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
            // НА МОБИЛКАХ ПОКАЗЫВАЕМ ГОСТЮ
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

    const api = {
        init,
        showLoginModal,
        showRegisterModal,
        renderAuthBlock
    };

    window.__AUTH_UI_INITIALIZED__ = true;

    return Object.freeze(api);
})();

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => AuthUI.init(), 500);
});

window.AuthUI = AuthUI;