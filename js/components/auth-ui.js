// ===== js/components/auth-ui.js =====
// КОМПОНЕНТЫ UI ДЛЯ АВТОРИЗАЦИИ

const AuthUI = (function() {
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
                                <span class="badge badge-${userData?.role === USER_ROLE.MASTER ? 'success' : 'primary'}">
                                    ${userData?.role === USER_ROLE.MASTER ? 'Мастер' : 'Клиент'}
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
        showRegisterModal
    };
})();

window.AuthUI = AuthUI;