// ============================================
// МЕНЕДЖЕР МОДАЛЬНЫХ ОКОН
// ============================================
const ModalManager = (function() {
    if (window.__MODAL_MANAGER_INITIALIZED__) return window.ModalManager;

    // Конфигурация модалок
    const modals = {
        auth: {
            elementId: 'authModal',
            titleElementId: 'authModalTitle',
            bodyElementId: 'authModalBody',
            init: function() {
                // Инициализация форм
                this.bindEvents();
            },
            bindEvents: function() {
                const modal = document.getElementById(this.elementId);
                if (!modal) return;

                // Очистка при закрытии
                modal.addEventListener('hidden.bs.modal', () => {
                    document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
                    document.body.classList.remove('modal-open');
                    
                    if (window.AppStore) {
                        AppStore.setState({ activeModal: null });
                    }
                });

                modal.addEventListener('shown.bs.modal', () => {
                    if (window.AppStore) {
                        AppStore.setState({ activeModal: 'auth' });
                    }
                });
            },
            show: function(mode = 'login') {
                const modalEl = document.getElementById(this.elementId);
                if (!modalEl) return;

                const titleEl = document.getElementById(this.titleElementId);
                const bodyEl = document.getElementById(this.bodyElementId);

                if (titleEl) {
                    titleEl.innerHTML = mode === 'login' 
                        ? '<i class="fas fa-sign-in-alt me-2"></i>Вход'
                        : '<i class="fas fa-user-plus me-2"></i>Регистрация';
                }

                if (bodyEl) {
                    bodyEl.innerHTML = mode === 'login' 
                        ? this.getLoginForm() 
                        : this.getRegisterForm();
                }

                this.attachFormEvents(mode);

                const modal = new bootstrap.Modal(modalEl);
                modal.show();
            },
            getLoginForm: function() {
                return `
                    <div class="mb-3">
                        <label class="form-label">Email</label>
                        <input type="email" class="form-control" id="loginEmail" required>
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Пароль</label>
                        <input type="password" class="form-control" id="loginPassword" required>
                    </div>
                    <div id="loginError" class="alert alert-danger d-none"></div>
                    <button class="btn btn-primary w-100 mb-3" id="loginSubmitBtn">Войти</button>
                    <p class="text-center mb-0">
                        Нет аккаунта? 
                        <a href="#" id="switchToRegister">Зарегистрироваться</a>
                    </p>
                `;
            },
            getRegisterForm: function() {
                return `
                    <div class="mb-3">
                        <label class="form-label">Имя</label>
                        <input type="text" class="form-control" id="registerName" required>
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Email</label>
                        <input type="email" class="form-control" id="registerEmail" required>
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Пароль</label>
                        <input type="password" class="form-control" id="registerPassword" required>
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Телефон</label>
                        <input type="tel" class="form-control" id="registerPhone">
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Кто вы?</label>
                        <div class="d-flex gap-3">
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
                        <label class="form-label">Категории</label>
                        <input type="text" class="form-control" id="registerCategories" placeholder="Сантехника, Электрика">
                    </div>
                    <div id="registerError" class="alert alert-danger d-none"></div>
                    <button class="btn btn-primary w-100 mb-3" id="registerSubmitBtn">Зарегистрироваться</button>
                    <p class="text-center mb-0">
                        Уже есть аккаунт? 
                        <a href="#" id="switchToLogin">Войти</a>
                    </p>
                `;
            },
            attachFormEvents: function(mode) {
                if (mode === 'login') {
                    document.getElementById('loginSubmitBtn')?.addEventListener('click', () => {
                        this.handleLogin();
                    });
                    document.getElementById('switchToRegister')?.addEventListener('click', (e) => {
                        e.preventDefault();
                        this.show('register');
                    });
                } else {
                    document.getElementById('registerSubmitBtn')?.addEventListener('click', () => {
                        this.handleRegister();
                    });
                    document.getElementById('switchToLogin')?.addEventListener('click', (e) => {
                        e.preventDefault();
                        this.show('login');
                    });

                    // Показ поля категорий для мастера
                    document.querySelectorAll('input[name="role"]').forEach(radio => {
                        radio.addEventListener('change', function() {
                            const field = document.querySelector('.master-only-field');
                            if (field) {
                                field.style.display = this.value === 'master' ? 'block' : 'none';
                            }
                        });
                    });
                }
            },
            handleLogin: async function() {
                const email = document.getElementById('loginEmail')?.value;
                const password = document.getElementById('loginPassword')?.value;
                const errorDiv = document.getElementById('loginError');

                if (!email || !password) {
                    errorDiv.textContent = 'Введите email и пароль';
                    errorDiv.classList.remove('d-none');
                    return;
                }

                const result = await Auth.login(email, password);
                
                if (result.success) {
                    const modal = bootstrap.Modal.getInstance(document.getElementById(this.elementId));
                    modal.hide();
                } else {
                    errorDiv.textContent = result.error || 'Ошибка входа';
                    errorDiv.classList.remove('d-none');
                }
            },
            handleRegister: async function() {
                const email = document.getElementById('registerEmail')?.value;
                const password = document.getElementById('registerPassword')?.value;
                const name = document.getElementById('registerName')?.value;
                const phone = document.getElementById('registerPhone')?.value;
                const role = document.querySelector('input[name="role"]:checked')?.value;
                const categories = document.getElementById('registerCategories')?.value;
                const errorDiv = document.getElementById('registerError');

                if (!email || !password || !name) {
                    errorDiv.textContent = 'Заполните обязательные поля';
                    errorDiv.classList.remove('d-none');
                    return;
                }

                const result = await Auth.register(email, password, { name, phone, role, categories });
                
                if (result.success) {
                    const modal = bootstrap.Modal.getInstance(document.getElementById(this.elementId));
                    modal.hide();
                } else {
                    errorDiv.textContent = result.error || 'Ошибка регистрации';
                    errorDiv.classList.remove('d-none');
                }
            }
        },

        respond: {
            elementId: 'respondModal',
            init: function() {
                const modal = document.getElementById(this.elementId);
                if (!modal) return;

                document.getElementById('submitResponse')?.addEventListener('click', () => {
                    if (this.resolve) {
                        const price = document.getElementById('responsePrice')?.value;
                        const comment = document.getElementById('responseComment')?.value;
                        this.resolve({ price, comment });
                    }
                    this.hide();
                });

                modal.addEventListener('hidden.bs.modal', () => {
                    document.getElementById('responsePrice').value = '';
                    document.getElementById('responseComment').value = '';
                    if (window.AppStore) {
                        AppStore.setState({ activeModal: null });
                    }
                });

                modal.addEventListener('shown.bs.modal', () => {
                    if (window.AppStore) {
                        AppStore.setState({ activeModal: 'respond' });
                    }
                });
            },
            show: function(data) {
                return new Promise((resolve) => {
                    this.resolve = resolve;
                    
                    document.getElementById('respondOrderTitle').textContent = data.title || 'Заказ';
                    document.getElementById('respondOrderCategory').textContent = data.category || 'Категория';
                    document.getElementById('respondOrderPrice').textContent = Utils.formatMoney(data.price);

                    const modalEl = document.getElementById(this.elementId);
                    const modal = new bootstrap.Modal(modalEl);
                    modal.show();
                });
            },
            hide: function() {
                const modalEl = document.getElementById(this.elementId);
                const modal = bootstrap.Modal.getInstance(modalEl);
                if (modal) modal.hide();
                this.resolve = null;
            }
        },

        review: {
            elementId: 'reviewModal',
            currentRating: 0,
            init: function() {
                const modal = document.getElementById(this.elementId);
                if (!modal) return;

                // Звезды рейтинга
                document.querySelectorAll('#reviewModal .star').forEach(star => {
                    star.addEventListener('click', (e) => {
                        const rating = parseInt(e.target.dataset.rating);
                        this.currentRating = rating;
                        
                        document.querySelectorAll('#reviewModal .star').forEach((s, i) => {
                            if (i < rating) {
                                s.innerHTML = '★';
                                s.classList.add('active');
                            } else {
                                s.innerHTML = '☆';
                                s.classList.remove('active');
                            }
                        });
                    });
                });

                document.getElementById('submitReview')?.addEventListener('click', () => {
                    if (this.resolve) {
                        const text = document.getElementById('reviewText')?.value || '';
                        this.resolve({ rating: this.currentRating, text });
                    }
                    this.hide();
                });

                modal.addEventListener('hidden.bs.modal', () => {
                    document.getElementById('reviewText').value = '';
                    document.querySelectorAll('#reviewModal .star').forEach(s => {
                        s.innerHTML = '☆';
                        s.classList.remove('active');
                    });
                    this.currentRating = 0;
                    
                    if (window.AppStore) {
                        AppStore.setState({ activeModal: null });
                    }
                });

                modal.addEventListener('shown.bs.modal', () => {
                    if (window.AppStore) {
                        AppStore.setState({ activeModal: 'review' });
                    }
                });
            },
            show: function(data = {}) {
                return new Promise((resolve) => {
                    this.resolve = resolve;
                    
                    // Настройка заголовка
                    const titleEl = document.getElementById('reviewModalTitle');
                    if (titleEl && data.title) {
                        titleEl.innerHTML = data.title;
                    }

                    // Настройка текста
                    if (data.clientName) {
                        const clientNameEl = document.getElementById('reviewClientName');
                        if (clientNameEl) clientNameEl.textContent = data.clientName;
                    }

                    const modalEl = document.getElementById(this.elementId);
                    const modal = new bootstrap.Modal(modalEl);
                    modal.show();
                });
            },
            hide: function() {
                const modalEl = document.getElementById(this.elementId);
                const modal = bootstrap.Modal.getInstance(modalEl);
                if (modal) modal.hide();
                this.resolve = null;
            }
        },

        city: {
            elementId: 'cityModal',
            init: function() {
                const modal = document.getElementById(this.elementId);
                if (!modal) return;

                this.renderCityList();

                modal.addEventListener('hidden.bs.modal', () => {
                    if (window.AppStore) {
                        AppStore.setState({ activeModal: null });
                    }
                });
            },
            renderCityList: function() {
                const listEl = document.getElementById('cityList');
                if (!listEl) return;

                const cities = window.CITIES || [];
                const currentCity = window.AppStore?.getState().city || 'nyagan';

                listEl.innerHTML = cities.map(city => `
                    <a href="#" class="list-group-item list-group-item-action ${city.id === currentCity ? 'active' : ''}" 
                       data-city-id="${city.id}">
                        <i class="fas fa-map-marker-alt me-2"></i>
                        ${city.name}
                    </a>
                `).join('');

                listEl.querySelectorAll('a').forEach(item => {
                    item.addEventListener('click', (e) => {
                        e.preventDefault();
                        const cityId = item.dataset.cityId;
                        
                        if (window.AppStore) {
                            AppStore.setState({ city: cityId });
                        }

                        this.hide();
                    });
                });
            },
            show: function() {
                this.renderCityList();
                
                const modalEl = document.getElementById(this.elementId);
                const modal = new bootstrap.Modal(modalEl);
                modal.show();
            },
            hide: function() {
                const modalEl = document.getElementById(this.elementId);
                const modal = bootstrap.Modal.getInstance(modalEl);
                if (modal) modal.hide();
            }
        }
    };

    // Инициализация всех модалок
    function init() {
        Object.values(modals).forEach(modal => {
            if (modal.init) modal.init();
        });
        console.log('✅ ModalManager инициализирован');
    }

    // Показать модалку
    function show(modalName, data = {}) {
        const modal = modals[modalName];
        if (!modal) {
            console.error(`Модалка "${modalName}" не найдена`);
            return null;
        }
        return modal.show(data);
    }

    // Скрыть модалку
    function hide(modalName) {
        if (modalName) {
            const modal = modals[modalName];
            if (modal) modal.hide();
        } else {
            // Скрываем все активные
            Object.values(modals).forEach(modal => {
                if (modal.hide) modal.hide();
            });
        }
    }

    // Получить модалку
    function get(modalName) {
        return modals[modalName];
    }

    const api = {
        init,
        show,
        hide,
        get
    };

    window.__MODAL_MANAGER_INITIALIZED__ = true;
    console.log('✅ ModalManager загружен');

    return Object.freeze(api);
})();

window.ModalManager = ModalManager;