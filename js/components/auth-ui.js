// ===== js/components/auth-ui.js =====
// ОТРИСОВКА ИНТЕРФЕЙСА АВТОРИЗАЦИИ (УЛУЧШЕННАЯ ВЕРСИЯ)

const AuthUI = (function() {
    
    function renderAuthBlock() {
        const container = document.getElementById('authBlockContainer');
        if (!container) return;
        
        if (Auth.isAuthenticated()) {
            container.innerHTML = '';
            return;
        }
        
        container.innerHTML = `
            <div id="authBlock" class="bg-white rounded-5 p-4 mb-4 shadow-sm animate-slide-down">
                <div class="d-flex gap-3 mb-4">
                    <button id="tabLogin" class="btn px-4 py-2 rounded-pill active" style="background: var(--accent); color: white;">Вход</button>
                    <button id="tabRegister" class="btn btn-outline-secondary px-4 py-2 rounded-pill">Регистрация</button>
                </div>
                
                <!-- Форма входа -->
                <div id="loginForm">
                    <div class="mb-3">
                        <label class="form-label text-secondary">Email</label>
                        <input type="email" id="loginEmail" class="form-control rounded-pill" placeholder="example@mail.com">
                    </div>
                    <div class="mb-3">
                        <label class="form-label text-secondary">Пароль</label>
                        <input type="password" id="loginPassword" class="form-control rounded-pill" placeholder="••••••••">
                    </div>
                    <button id="loginBtn" class="btn w-100 rounded-pill py-2" style="background: var(--accent); color: white;">
                        <i class="fas fa-sign-in-alt me-2"></i>Войти
                    </button>
                    <p id="loginError" class="text-danger mt-3 d-none"></p>
                </div>
                
                <!-- Форма регистрации -->
                <div id="registerForm" class="d-none">
                    <div class="mb-3">
                        <label class="form-label text-secondary">Имя</label>
                        <input type="text" id="regName" class="form-control rounded-pill" placeholder="Имя">
                    </div>
                    <div class="mb-3">
                        <label class="form-label text-secondary">Email</label>
                        <input type="email" id="regEmail" class="form-control rounded-pill" placeholder="example@mail.com">
                    </div>
                    <div class="mb-3">
                        <label class="form-label text-secondary">Телефон</label>
                        <input type="tel" id="regPhone" class="form-control rounded-pill" placeholder="+7 (999) 123-45-67">
                    </div>
                    <div class="mb-3">
                        <label class="form-label text-secondary">Пароль</label>
                        <input type="password" id="regPassword" class="form-control rounded-pill" placeholder="минимум 6 символов">
                    </div>
                    <div class="mb-3">
                        <div class="form-check form-check-inline">
                            <input class="form-check-input" type="radio" name="role" id="roleClient" value="client" checked>
                            <label class="form-check-label" for="roleClient">Я — клиент</label>
                        </div>
                        <div class="form-check form-check-inline">
                            <input class="form-check-input" type="radio" name="role" id="roleMaster" value="master">
                            <label class="form-check-label" for="roleMaster">Я — мастер</label>
                        </div>
                    </div>
                    <button id="registerBtn" class="btn w-100 rounded-pill py-2" style="background: var(--accent); color: white;">
                        <i class="fas fa-user-plus me-2"></i>Зарегистрироваться
                    </button>
                    <p id="registerError" class="text-danger mt-3 d-none"></p>
                </div>
            </div>
        `;
        
        setupAuthTabs();
        setupAuthButtons();
    }

    function setupAuthTabs() {
        const tabLogin = document.getElementById('tabLogin');
        const tabRegister = document.getElementById('tabRegister');
        const loginForm = document.getElementById('loginForm');
        const registerForm = document.getElementById('registerForm');
        const loginError = document.getElementById('loginError');
        const registerError = document.getElementById('registerError');

        tabLogin?.addEventListener('click', () => {
            tabLogin.classList.add('active');
            tabRegister.classList.remove('active');
            tabLogin.style.background = 'var(--accent)';
            tabLogin.style.color = 'white';
            tabRegister.style.background = 'transparent';
            tabRegister.style.color = '#6c757d';
            loginForm?.classList.remove('d-none');
            registerForm?.classList.add('d-none');
            
            loginError?.classList.add('d-none');
            registerError?.classList.add('d-none');
        });
        
        tabRegister?.addEventListener('click', () => {
            tabRegister.classList.add('active');
            tabLogin.classList.remove('active');
            tabRegister.style.background = 'var(--accent)';
            tabRegister.style.color = 'white';
            tabLogin.style.background = 'transparent';
            tabLogin.style.color = '#6c757d';
            registerForm?.classList.remove('d-none');
            loginForm?.classList.add('d-none');
            
            loginError?.classList.add('d-none');
            registerError?.classList.add('d-none');
        });
    }

    function setupAuthButtons() {
        // Регистрация
        document.getElementById('registerBtn')?.addEventListener('click', async () => {
            const email = document.getElementById('regEmail').value.trim();
            const password = document.getElementById('regPassword').value;
            const name = document.getElementById('regName').value.trim();
            const phone = document.getElementById('regPhone').value.trim();
            const role = document.querySelector('input[name="role"]:checked')?.value || 'client';
            
            if (!email || !password || !name) {
                showError('registerError', 'Заполните все обязательные поля');
                return;
            }
            
            if (password.length < 6) {
                showError('registerError', 'Пароль должен быть минимум 6 символов');
                return;
            }

            const result = await Auth.register(email, password, { name, phone, role });
            
            if (result.success) {
                document.getElementById('regEmail').value = '';
                document.getElementById('regPassword').value = '';
                document.getElementById('regName').value = '';
                document.getElementById('regPhone').value = '';
                
                document.getElementById('registerForm').classList.add('d-none');
                document.getElementById('loginForm').classList.remove('d-none');
                document.getElementById('tabLogin').click();
                
                showError('loginError', 'Регистрация успешна! Войдите в систему', 'text-success');
            } else {
                showError('registerError', result.error || 'Ошибка регистрации');
            }
        });

        // Вход
        document.getElementById('loginBtn')?.addEventListener('click', async () => {
            const email = document.getElementById('loginEmail').value.trim();
            const password = document.getElementById('loginPassword').value;
            
            if (!email || !password) {
                showError('loginError', 'Введите email и пароль');
                return;
            }
            
            const result = await Auth.login(email, password);
            
            if (!result.success) {
                showError('loginError', result.error || 'Ошибка входа');
            }
        });
        
        // Enter
        document.getElementById('loginPassword')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                document.getElementById('loginBtn')?.click();
            }
        });
        
        document.getElementById('regPassword')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                document.getElementById('registerBtn')?.click();
            }
        });
    }
    
    function showError(elementId, message, className = 'text-danger') {
        const errorElement = document.getElementById(elementId);
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.className = `mt-3 ${className}`;
            errorElement.classList.remove('d-none');
            
            setTimeout(() => {
                errorElement.classList.add('d-none');
            }, 5000);
        }
    }

    return {
        renderAuthBlock
    };
})();

window.AuthUI = AuthUI;