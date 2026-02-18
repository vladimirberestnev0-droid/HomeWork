// ===== AUTH-UI.JS — Отрисовка интерфейса авторизации =====

const AuthUI = (function() {
    
    // Функция для создания блока авторизации
    function renderAuthBlock() {
        const container = document.getElementById('authBlockContainer');
        if (!container) return;
        
        // Если пользователь уже авторизован — не добавляем блок
        if (Auth.isAuthenticated()) {
            container.innerHTML = ''; // очищаем контейнер
            return;
        }
        
        // Создаём блок авторизации
        container.innerHTML = `
            <div id="authBlock" class="bg-white rounded-5 p-4 mb-4 shadow-sm">
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
                    <button id="loginBtn" class="btn w-100 rounded-pill py-2" style="background: var(--accent); color: white;">Войти</button>
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
                    <button id="registerBtn" class="btn w-100 rounded-pill py-2" style="background: var(--accent); color: white;">Зарегистрироваться</button>
                    <p id="registerError" class="text-danger mt-3 d-none"></p>
                </div>
            </div>
        `;
        
        // Переназначаем обработчики событий
        setupAuthTabs();
        setupAuthButtons();
    }

    // Функция для настройки табов авторизации
    function setupAuthTabs() {
        document.getElementById('tabLogin')?.addEventListener('click', () => {
            document.getElementById('tabLogin').classList.add('active');
            document.getElementById('tabRegister').classList.remove('active');
            document.getElementById('tabLogin').style.background = 'var(--accent)';
            document.getElementById('tabLogin').style.color = 'white';
            document.getElementById('tabRegister').style.background = 'transparent';
            document.getElementById('tabRegister').style.color = '#6c757d';
            document.getElementById('loginForm').classList.remove('d-none');
            document.getElementById('registerForm').classList.add('d-none');
        });
        
        document.getElementById('tabRegister')?.addEventListener('click', () => {
            document.getElementById('tabRegister').classList.add('active');
            document.getElementById('tabLogin').classList.remove('active');
            document.getElementById('tabRegister').style.background = 'var(--accent)';
            document.getElementById('tabRegister').style.color = 'white';
            document.getElementById('tabLogin').style.background = 'transparent';
            document.getElementById('tabLogin').style.color = '#6c757d';
            document.getElementById('registerForm').classList.remove('d-none');
            document.getElementById('loginForm').classList.add('d-none');
        });
    }

    // Функция для настройки кнопок авторизации
    function setupAuthButtons() {
        // Регистрация
        document.getElementById('registerBtn')?.addEventListener('click', async () => {
            const email = document.getElementById('regEmail').value;
            const password = document.getElementById('regPassword').value;
            const name = document.getElementById('regName').value;
            const phone = document.getElementById('regPhone').value;
            const role = document.querySelector('input[name="role"]:checked').value;

            const result = await Auth.register(email, password, { name, phone, role });
            if (result.success) {
                document.getElementById('registerForm').classList.add('d-none');
                document.getElementById('loginForm').classList.remove('d-none');
                document.getElementById('tabLogin').click();
            }
        });

        // Вход
        document.getElementById('loginBtn')?.addEventListener('click', async () => {
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            
            await Auth.login(email, password);
        });
    }

    // Публичное API
    return {
        renderAuthBlock
    };
})();

// Экспортируем
window.AuthUI = AuthUI;