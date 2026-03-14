// ============================================
// КОМПОНЕНТ ИНТЕРФЕЙСА АВТОРИЗАЦИИ - ИСПРАВЛЕННАЯ ВЕРСИЯ
// Пункты 3, 4, 12
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
        }
    }

    function showRegisterModal() {
        if (window.ModalManager) {
            ModalManager.show('auth', 'register');
        }
    }

    function renderAuthBlock() {
        const container = document.getElementById('authBlockContainer');
        if (!container) return;

        const state = Auth.getAuthState();
        
        // НИКОГДА не показываем блок авторизованным пользователям
        if (state.isAuthenticated) {
            container.innerHTML = ''; // Пусто!
            return;
        }

        // Только для гостей показываем блок входа
        container.innerHTML = `
            <div class="auth-block card p-3" style="background: rgba(26,44,62,0.8); backdrop-filter: blur(10px); border: 1px solid rgba(44,213,196,0.2); border-radius: 24px; margin-bottom: 20px;">
                <div class="d-flex flex-column flex-sm-row justify-content-between align-items-center gap-3">
                    <div class="d-flex align-items-center gap-2">
                        <i class="fas fa-user-circle fa-2x" style="color: var(--aurora-accent);"></i>
                        <span style="color: var(--aurora-text-soft);">Войдите в личный кабинет</span>
                    </div>
                    <div class="auth-buttons d-flex gap-2 w-100 w-sm-auto">
                        <button class="btn btn-outline-secondary btn-sm flex-grow-1 rounded-pill" data-action="login" style="border-color: var(--aurora-accent); color: var(--aurora-accent);">
                            <i class="fas fa-sign-in-alt me-1"></i><span>Вход</span>
                        </button>
                        <button class="btn btn-primary btn-sm flex-grow-1 rounded-pill" data-action="register" style="background: var(--aurora-accent); color: var(--aurora-deep); border: none;">
                            <i class="fas fa-user-plus me-1"></i><span>Регистрация</span>
                        </button>
                    </div>
                </div>
            </div>
        `;
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