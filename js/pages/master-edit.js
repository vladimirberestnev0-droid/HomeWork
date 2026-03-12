// ============================================
// РЕДАКТИРОВАНИЕ ПРОФИЛЯ МАСТЕРА
// ============================================

const MasterEdit = (function() {
    let portfolio = [];
    let schedule = {};
    let currentAvatar = null;
    let currentUser = null;
    let currentMaster = null;

    // DOM элементы
    const $ = (id) => document.getElementById(id);

    // ИНИЦИАЛИЗАЦИЯ
    function init() {
        // Проверка авторизации
        if (!Auth.isAuthenticated()) {
            window.location.href = '/HomeWork/';
            return;
        }

        currentUser = Auth.getUser();
        
        // Проверка что это мастер
        if (!Auth.isMaster()) {
            Utils.showError('Доступ только для мастеров');
            setTimeout(() => window.location.href = '/HomeWork/', 1500);
            return;
        }

        // Загружаем данные
        loadMasterData();
        
        // Настраиваем обработчики
        setupEventListeners();
        
        // Инициализируем загрузку портфолио
        initPortfolioUpload();
    }

    // ЗАГРУЗКА ДАННЫХ МАСТЕРА
    async function loadMasterData() {
        try {
            currentMaster = await DataService.getUser(currentUser.uid);
            
            if (!currentMaster) return;

            // Заполняем форму
            $('editName').value = currentMaster.name || '';
            $('editAbout').value = currentMaster.about || '';
            $('editSpecializations').value = currentMaster.specializations?.join(', ') || '';
            $('editCity').value = currentMaster.city || 'nyagan';
            $('editAddress').value = currentMaster.address || '';
            $('editExperience').value = currentMaster.experience || 0;
            $('editGuarantee').value = currentMaster.guarantee || '';

            // Аватар
            if (currentMaster.avatar) {
                $('avatarPreview').src = currentMaster.avatar;
            }

            // Портфолио
            portfolio = currentMaster.portfolio || [];
            renderPortfolioList();

            // График работы
            schedule = currentMaster.workSchedule || getDefaultSchedule();
            renderSchedule();

        } catch (error) {
            console.error('Ошибка загрузки данных:', error);
            Utils.showError('Не удалось загрузить данные');
        }
    }

    // ГРАФИК ПО УМОЛЧАНИЮ
    function getDefaultSchedule() {
        return {
            monday: '09:00-18:00',
            tuesday: '09:00-18:00',
            wednesday: '09:00-18:00',
            thursday: '09:00-18:00',
            friday: '09:00-18:00',
            saturday: '10:00-16:00',
            sunday: 'выходной'
        };
    }

    // ОТОБРАЖЕНИЕ ГРАФИКА
    function renderSchedule() {
        const container = $('scheduleGrid');
        if (!container) return;

        const days = {
            monday: 'Пн',
            tuesday: 'Вт',
            wednesday: 'Ср',
            thursday: 'Чт',
            friday: 'Пт',
            saturday: 'Сб',
            sunday: 'Вс'
        };

        container.innerHTML = Object.entries(days).map(([key, label]) => `
            <div class="form-group">
                <label>${label}</label>
                <input type="text" class="schedule-input" data-day="${key}" 
                       value="${schedule[key] || ''}" placeholder="09:00-18:00">
            </div>
        `).join('');

        // Сохраняем изменения при вводе
        container.querySelectorAll('.schedule-input').forEach(input => {
            input.addEventListener('change', function() {
                schedule[this.dataset.day] = this.value;
            });
        });
    }

    // ПОРТФОЛИО - ОТОБРАЖЕНИЕ
    function renderPortfolioList() {
        const container = $('portfolioList');
        if (!container) return;

        if (portfolio.length === 0) {
            container.innerHTML = '<p class="text-secondary">Портфолио пока пусто</p>';
            return;
        }

        container.innerHTML = portfolio.map((item, index) => `
            <div class="portfolio-edit-item" data-index="${index}">
                <img src="${item.imageUrl}" onerror="this.src='https://via.placeholder.com/100'">
                <div class="portfolio-edit-info">
                    <input type="text" class="portfolio-title" value="${item.title || ''}" 
                           placeholder="Название работы">
                    <textarea class="portfolio-desc" placeholder="Описание">${item.description || ''}</textarea>
                    <select class="portfolio-cat">
                        <option value="sanitary" ${item.category === 'sanitary' ? 'selected' : ''}>Сантехника</option>
                        <option value="electric" ${item.category === 'electric' ? 'selected' : ''}>Электрика</option>
                        <option value="repair" ${item.category === 'repair' ? 'selected' : ''}>Ремонт</option>
                        <option value="assembly" ${item.category === 'assembly' ? 'selected' : ''}>Сборка</option>
                        <option value="other" ${item.category === 'other' ? 'selected' : ''}>Другое</option>
                    </select>
                </div>
                <button class="btn-delete" onclick="MasterEdit.removePortfolio(${index})">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `).join('');

        // Добавляем обработчики для сохранения изменений
        container.querySelectorAll('.portfolio-edit-item').forEach((item, index) => {
            const title = item.querySelector('.portfolio-title');
            const desc = item.querySelector('.portfolio-desc');
            const cat = item.querySelector('.portfolio-cat');

            title.addEventListener('change', () => updatePortfolio(index, 'title', title.value));
            desc.addEventListener('change', () => updatePortfolio(index, 'description', desc.value));
            cat.addEventListener('change', () => updatePortfolio(index, 'category', cat.value));
        });
    }

    // ОБНОВЛЕНИЕ ПОРТФОЛИО
    function updatePortfolio(index, field, value) {
        if (portfolio[index]) {
            portfolio[index][field] = value;
        }
    }

    // УДАЛЕНИЕ ИЗ ПОРТФОЛИО
    function removePortfolio(index) {
        if (!confirm('Удалить это фото?')) return;
        portfolio.splice(index, 1);
        renderPortfolioList();
    }

    // ИНИЦИАЛИЗАЦИЯ ЗАГРУЗКИ ПОРТФОЛИО
    function initPortfolioUpload() {
        const addBtn = $('addPortfolioBtn');
        const input = $('portfolioInput');

        if (addBtn) {
            addBtn.addEventListener('click', () => input.click());
        }

        if (input) {
            input.addEventListener('change', handlePortfolioUpload);
        }
    }

    // ОБРАБОТКА ЗАГРУЗКИ ПОРТФОЛИО
    async function handlePortfolioUpload(e) {
        const files = Array.from(e.target.files);
        
        if (files.length === 0) return;

        if (portfolio.length + files.length > 20) {
            Utils.showWarning('Максимум 20 фото в портфолио');
            return;
        }

        const loaderId = Loader.show('Загрузка фото...');

        try {
            for (const file of files) {
                // Проверка размера
                if (file.size > 10 * 1024 * 1024) {
                    Utils.showWarning(`Файл ${file.name} слишком большой (макс 10MB)`);
                    continue;
                }

                // Загружаем в Storage
                const result = await UploadService.uploadFile(
                    file, 
                    `portfolio/${currentUser.uid}`,
                    { onProgress: (progress) => console.log(`${file.name}: ${progress}%`) }
                );

                // Добавляем в портфолио
                portfolio.push({
                    imageUrl: result.url,
                    title: '',
                    description: '',
                    category: 'other',
                    date: new Date().toISOString()
                });
            }

            renderPortfolioList();
            Utils.showSuccess(`Загружено ${files.length} фото`);

        } catch (error) {
            console.error('Ошибка загрузки:', error);
            Utils.showError('Ошибка при загрузке');
        } finally {
            Loader.hide(loaderId);
            e.target.value = '';
        }
    }

    // ЗАГРУЗКА АВАТАРА
    async function uploadAvatar(file) {
        if (!file) return null;

        try {
            const result = await UploadService.uploadFile(
                file,
                `avatars/${currentUser.uid}`,
                { compressImages: true, maxWidth: 500, maxHeight: 500 }
            );

            return result.url;

        } catch (error) {
            console.error('Ошибка загрузки аватара:', error);
            Utils.showError('Не удалось загрузить аватар');
            return null;
        }
    }

    // СОХРАНЕНИЕ ПРОФИЛЯ
    async function saveProfile() {
        const loaderId = Loader.show('Сохранение...');

        try {
            // Собираем данные из формы
            const formData = {
                name: $('editName').value.trim(),
                about: $('editAbout').value.trim(),
                specializations: $('editSpecializations').value
                    .split(',')
                    .map(s => s.trim())
                    .filter(s => s),
                city: $('editCity').value,
                address: $('editAddress').value.trim(),
                experience: parseInt($('editExperience').value) || 0,
                guarantee: $('editGuarantee').value.trim(),
                workSchedule: { ...schedule },
                portfolio: portfolio,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            // Проверка обязательных полей
            if (!formData.name) {
                Utils.showWarning('Введите имя');
                return;
            }

            // Загружаем аватар, если выбран
            if (currentAvatar) {
                const avatarUrl = await uploadAvatar(currentAvatar);
                if (avatarUrl) {
                    formData.avatar = avatarUrl;
                }
            }

            // Сохраняем в Firestore
            await DataService.updateUser(currentUser.uid, formData);

            // Очищаем кэш
            if (window.Cache) {
                Cache.remove(`user_${currentUser.uid}`);
            }

            Utils.showSuccess('Профиль сохранён!');

            // Переходим в публичный профиль
            setTimeout(() => {
                window.location.href = `/HomeWork/master-profile.html?id=${currentUser.uid}`;
            }, 1500);

        } catch (error) {
            console.error('Ошибка сохранения:', error);
            Utils.showError('Ошибка при сохранении');
        } finally {
            Loader.hide(loaderId);
        }
    }

    // НАСТРОЙКА ОБРАБОТЧИКОВ
    function setupEventListeners() {
        // Кнопка сохранения
        $('saveProfileBtn')?.addEventListener('click', saveProfile);

        // Кнопка отмены
        $('cancelEditBtn')?.addEventListener('click', () => {
            if (confirm('Отменить изменения?')) {
                window.history.back();
            }
        });

        // Загрузка аватара
        const avatarInput = $('avatarInput');
        const changeAvatarBtn = $('changeAvatarBtn');

        if (changeAvatarBtn && avatarInput) {
            changeAvatarBtn.addEventListener('click', () => avatarInput.click());
            avatarInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        $('avatarPreview').src = e.target.result;
                        currentAvatar = file;
                    };
                    reader.readAsDataURL(file);
                }
            });
        }
    }

    // ПУБЛИЧНОЕ API
    const api = {
        init,
        removePortfolio,
        updatePortfolio
    };

    // Автозапуск
    document.addEventListener('DOMContentLoaded', init);

    return Object.freeze(api);
})();

window.MasterEdit = MasterEdit;