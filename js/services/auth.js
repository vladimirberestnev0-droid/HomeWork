// ===== AUTH.JS — ВСЯ АВТОРИЗАЦИЯ В ОДНОМ МЕСТЕ =====

const Auth = (function() {
    // Приватные переменные
    let currentUser = null;
    let currentUserData = null;
    let authListeners = [];

    /**
     * Инициализация модуля авторизации
     */
    async function init() {
        // Слушаем изменения статуса аутентификации
        auth.onAuthStateChanged(async (user) => {
            currentUser = user;
            
            if (user) {
                try {
                    const userDoc = await db.collection('users').doc(user.uid).get();
                    currentUserData = userDoc.exists ? userDoc.data() : null;
                } catch (error) {
                    console.error('Ошибка загрузки данных пользователя:', error);
                    currentUserData = null;
                }
            } else {
                currentUserData = null;
            }
            
            // Уведомляем всех подписчиков
            notifyListeners();
            
            // Обновляем UI
            updateUI();
        });
        
        // Восстанавливаем тему
        initTheme();
    }

    /**
     * Получить текущего пользователя
     */
    function getUser() {
        return currentUser;
    }

    /**
     * Получить данные текущего пользователя
     */
    function getUserData() {
        return currentUserData;
    }

    /**
     * Проверить, авторизован ли пользователь
     */
    function isAuthenticated() {
        return !!currentUser;
    }

    /**
     * Проверить роль пользователя
     */
    function hasRole(role) {
        return currentUserData?.role === role;
    }

    /**
     * Проверить, является ли пользователь мастером
     */
    function isMaster() {
        return currentUserData?.role === USER_ROLE.MASTER;
    }

    /**
     * Проверить, является ли пользователь клиентом
     */
    function isClient() {
        return currentUserData?.role === USER_ROLE.CLIENT;
    }

    /**
     * Проверить, является ли пользователь админом
     */
    function isAdmin() {
        return currentUser?.uid === ADMIN_UID;
    }

    /**
     * Регистрация нового пользователя
     */
    async function register(email, password, userData) {
        try {
            // Валидация
            if (!Utils.validateEmail(email)) {
                throw new Error('Некорректный email');
            }
            
            if (password.length < 6) {
                throw new Error('Пароль должен быть не менее 6 символов');
            }
            
            if (userData.role === 'master' && userData.phone && !Utils.validatePhone(userData.phone)) {
                throw new Error('Некорректный формат телефона');
            }
            
            // Создаем пользователя в Firebase Auth
            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;
            
            // Подготавливаем данные для Firestore
            const firestoreData = {
                name: userData.name || '',
                email: email,
                phone: userData.phone || '',
                role: userData.role || USER_ROLE.CLIENT,
                rating: 0,
                reviews: 0,
                categories: userData.role === USER_ROLE.MASTER ? (userData.categories || '') : '',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                favorites: [],
                viewedOrders: [],
                verified: false,
                banned: false,
                badges: []
            };
            
            // Сохраняем в Firestore
            await db.collection('users').doc(user.uid).set(firestoreData);
            
            Utils.showNotification('✅ Регистрация прошла успешно!', 'success');
            return { success: true, user };
            
        } catch (error) {
            console.error('Ошибка регистрации:', error);
            
            let errorMessage = 'Ошибка регистрации';
            if (error.code === 'auth/email-already-in-use') {
                errorMessage = 'Этот email уже используется';
            } else if (error.code === 'auth/invalid-email') {
                errorMessage = 'Некорректный email';
            } else if (error.code === 'auth/weak-password') {
                errorMessage = 'Слишком простой пароль';
            } else {
                errorMessage = error.message;
            }
            
            Utils.showNotification(`❌ ${errorMessage}`, 'error');
            return { success: false, error: errorMessage };
        }
    }

    /**
     * Вход в систему
     */
    async function login(email, password) {
        try {
            // Валидация
            if (!email || !password) {
                throw new Error('Введите email и пароль');
            }
            
            const userCredential = await auth.signInWithEmailAndPassword(email, password);
            
            Utils.showNotification('✅ Вход выполнен успешно!', 'success');
            return { success: true, user: userCredential.user };
            
        } catch (error) {
            console.error('Ошибка входа:', error);
            
            let errorMessage = 'Ошибка входа';
            if (error.code === 'auth/user-not-found') {
                errorMessage = 'Пользователь не найден';
            } else if (error.code === 'auth/wrong-password') {
                errorMessage = 'Неверный пароль';
            } else if (error.code === 'auth/invalid-email') {
                errorMessage = 'Некорректный email';
            } else if (error.code === 'auth/too-many-requests') {
                errorMessage = 'Слишком много попыток. Попробуйте позже';
            } else {
                errorMessage = error.message;
            }
            
            Utils.showNotification(`❌ ${errorMessage}`, 'error');
            return { success: false, error: errorMessage };
        }
    }

    /**
     * Выход из системы
     */
    async function logout() {
        try {
            await auth.signOut();
            Utils.showNotification('👋 До свидания!', 'info');
            return { success: true };
        } catch (error) {
            console.error('Ошибка выхода:', error);
            Utils.showNotification('❌ Ошибка при выходе', 'error');
            return { success: false, error: error.message };
        }
    }

    /**
     * Обновление профиля
     */
    async function updateProfile(userId, data) {
        try {
            if (!userId) throw new Error('ID пользователя не указан');
            
            await db.collection('users').doc(userId).update({
                ...data,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            // Обновляем локальные данные
            if (userId === currentUser?.uid) {
                currentUserData = { ...currentUserData, ...data };
            }
            
            Utils.showNotification('✅ Профиль обновлен', 'success');
            return { success: true };
            
        } catch (error) {
            console.error('Ошибка обновления профиля:', error);
            Utils.showNotification('❌ Ошибка обновления профиля', 'error');
            return { success: false, error: error.message };
        }
    }

    /**
     * Добавление в избранное
     */
    async function addToFavorites(masterId) {
        try {
            if (!currentUser) throw new Error('Необходимо авторизоваться');
            
            await db.collection('users').doc(currentUser.uid).update({
                favorites: firebase.firestore.FieldValue.arrayUnion(masterId)
            });
            
            Utils.showNotification('✅ Мастер добавлен в избранное', 'success');
            return { success: true };
            
        } catch (error) {
            console.error('Ошибка добавления в избранное:', error);
            Utils.showNotification('❌ Ошибка', 'error');
            return { success: false, error: error.message };
        }
    }

    /**
     * Удаление из избранного
     */
    async function removeFromFavorites(masterId) {
        try {
            if (!currentUser) throw new Error('Необходимо авторизоваться');
            
            await db.collection('users').doc(currentUser.uid).update({
                favorites: firebase.firestore.FieldValue.arrayRemove(masterId)
            });
            
            Utils.showNotification('❌ Мастер удален из избранного', 'info');
            return { success: true };
            
        } catch (error) {
            console.error('Ошибка удаления из избранного:', error);
            Utils.showNotification('❌ Ошибка', 'error');
            return { success: false, error: error.message };
        }
    }

    /**
     * Получение избранных мастеров
     */
    async function getFavorites() {
        try {
            if (!currentUser) return [];
            
            const userDoc = await db.collection('users').doc(currentUser.uid).get();
            const favorites = userDoc.data()?.favorites || [];
            
            const masters = [];
            for (const masterId of favorites) {
                const masterDoc = await db.collection('users').doc(masterId).get();
                if (masterDoc.exists) {
                    masters.push({
                        id: masterDoc.id,
                        ...masterDoc.data()
                    });
                }
            }
            
            return masters;
            
        } catch (error) {
            console.error('Ошибка загрузки избранного:', error);
            return [];
        }
    }

    /**
     * Добавление просмотренного заказа
     */
    async function addViewedOrder(orderId) {
        try {
            if (!currentUser) return;
            
            const userRef = db.collection('users').doc(currentUser.uid);
            
            await userRef.update({
                viewedOrders: firebase.firestore.FieldValue.arrayUnion({
                    orderId,
                    viewedAt: new Date().toISOString(),
                    notified: false
                })
            });
            
        } catch (error) {
            console.error('Ошибка добавления просмотра:', error);
        }
    }

    /**
     * Подписка на изменения авторизации
     */
    function onAuthChange(callback) {
        if (typeof callback === 'function') {
            authListeners.push(callback);
            
            // Сразу вызываем с текущим состоянием
            callback({
                user: currentUser,
                userData: currentUserData,
                isAuthenticated: !!currentUser,
                isMaster: isMaster(),
                isClient: isClient(),
                isAdmin: isAdmin()
            });
        }
    }

    /**
     * Уведомление всех подписчиков
     */
    function notifyListeners() {
        const state = {
            user: currentUser,
            userData: currentUserData,
            isAuthenticated: !!currentUser,
            isMaster: isMaster(),
            isClient: isClient(),
            isAdmin: isAdmin()
        };
        
        authListeners.forEach(listener => {
            try {
                listener(state);
            } catch (error) {
                console.error('Ошибка в listener авторизации:', error);
            }
        });
    }

    /**
     * Обновление UI на основе статуса авторизации
     */
    function updateUI() {
        // Скрываем/показываем блоки авторизации
        document.querySelectorAll('.auth-required').forEach(el => {
            el.classList.toggle('d-none', !currentUser);
        });
        
        document.querySelectorAll('.no-auth-required').forEach(el => {
            el.classList.toggle('d-none', !!currentUser);
        });
        
        document.querySelectorAll('.client-only').forEach(el => {
            el.classList.toggle('d-none', !isClient());
        });
        
        document.querySelectorAll('.master-only').forEach(el => {
            el.classList.toggle('d-none', !isMaster());
        });
        
        document.querySelectorAll('.admin-only').forEach(el => {
            el.classList.toggle('d-none', !isAdmin());
        });
        
        // Обновляем информацию о пользователе
        const userEmailDisplay = document.getElementById('userEmailDisplay');
        if (userEmailDisplay && currentUser) {
            userEmailDisplay.innerText = currentUser.email || '';
        }
        
        const userRoleDisplay = document.getElementById('userRoleDisplay');
        if (userRoleDisplay && currentUserData) {
            userRoleDisplay.innerText = currentUserData.role === USER_ROLE.MASTER ? 'Мастер' : 'Клиент';
        }
        
        // Обновляем ссылки
        const clientLink = document.getElementById('clientLink');
        if (clientLink) {
            clientLink.href = isAuthenticated() ? 'client.html' : '#';
            clientLink.onclick = (e) => {
                if (!isAuthenticated()) {
                    e.preventDefault();
                    Utils.showNotification('Войдите в систему', 'warning');
                }
            };
        }
        
        const masterLink = document.getElementById('masterLink');
        if (masterLink) {
            masterLink.href = isAuthenticated() ? 'masters.html' : '#';
            masterLink.onclick = (e) => {
                if (!isAuthenticated()) {
                    e.preventDefault();
                    Utils.showNotification('Войдите в систему', 'warning');
                }
            };
        }
    }

    /**
     * Инициализация темы
     */
    function initTheme() {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark') {
            document.body.classList.add('dark-theme');
            const themeToggle = document.getElementById('themeToggle');
            if (themeToggle) {
                themeToggle.querySelector('i').className = 'fas fa-sun';
            }
        }
    }

    /**
     * Переключение темы
     */
    function toggleTheme() {
        document.body.classList.toggle('dark-theme');
        const isDark = document.body.classList.contains('dark-theme');
        
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            const icon = themeToggle.querySelector('i');
            icon.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
        }
        
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
    }

    // Публичное API
    return {
        init,
        getUser,
        getUserData,
        isAuthenticated,
        hasRole,
        isMaster,
        isClient,
        isAdmin,
        register,
        login,
        logout,
        updateProfile,
        addToFavorites,
        removeFromFavorites,
        getFavorites,
        addViewedOrder,
        onAuthChange,
        toggleTheme
    };
})();

// Автоматическая инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    Auth.init();
});

// Экспортируем в глобальную область
window.Auth = Auth;