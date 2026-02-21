// УЛУЧШЕННАЯ АВТОРИЗАЦИЯ С ПРОВЕРКАМИ

const Auth = (function() {
    // Приватные переменные
    let currentUser = null;
    let currentUserData = null;
    let authListeners = [];
    let unsubscribe = null;

    // Безопасный Helpers
    const safeHelpers = {
        showNotification: (msg, type) => {
            if (window.Helpers && Helpers.showNotification) {
                Helpers.showNotification(msg, type);
            } else {
                console.log(`🔔 ${type}: ${msg}`);
                // Пробуем показать alert как fallback
                if (type === 'error') alert(`❌ ${msg}`);
                else if (type === 'success') alert(`✅ ${msg}`);
                else alert(msg);
            }
        },
        validateEmail: (email) => {
            if (window.Helpers && Helpers.validateEmail) {
                return Helpers.validateEmail(email);
            }
            return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        },
        validatePhone: (phone) => {
            if (window.Helpers && Helpers.validatePhone) {
                return Helpers.validatePhone(phone);
            }
            return /^(\+7|8)[\s(]?(\d{3})[\s)]?[\s-]?(\d{3})[\s-]?(\d{2})[\s-]?(\d{2})$/.test(phone);
        }
    };

    // Инициализация
    function init() {
        if (!window.auth) {
            console.error('❌ auth не определен! Проверь порядок подключения скриптов');
            return;
        }
        
        unsubscribe = auth.onAuthStateChanged(async (user) => {
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
            
            // Уведомляем подписчиков
            notifyListeners();
            
            // Обновляем UI
            updateUI();
        });
        
        initTheme();
        
        console.log('✅ Auth инициализирован');
    }

    // Получить пользователя
    function getUser() {
        return currentUser;
    }

    // Получить данные пользователя
    function getUserData() {
        return currentUserData;
    }

    // Проверка авторизации
    function isAuthenticated() {
        return !!currentUser;
    }

    // Проверка роли
    function hasRole(role) {
        return currentUserData?.role === role;
    }

    function isMaster() {
        return currentUserData?.role === USER_ROLE?.MASTER;
    }

    function isClient() {
        return currentUserData?.role === USER_ROLE?.CLIENT;
    }

    function isAdmin() {
        return currentUser?.uid === ADMIN_UID;
    }

    // Регистрация
    async function register(email, password, userData) {
        try {
            // Валидация
            if (!safeHelpers.validateEmail(email)) {
                throw new Error('Некорректный email');
            }
            
            if (password.length < 6) {
                throw new Error('Пароль должен быть не менее 6 символов');
            }
            
            if (userData.role === 'master' && userData.phone && !safeHelpers.validatePhone(userData.phone)) {
                throw new Error('Некорректный формат телефона');
            }
            
            // Создаем пользователя
            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;
            
            // Подготавливаем данные
            const firestoreData = {
                name: userData.name || '',
                email: email,
                phone: userData.phone || '',
                role: userData.role || (USER_ROLE?.CLIENT || 'client'),
                rating: 0,
                reviews: 0,
                categories: userData.role === (USER_ROLE?.MASTER || 'master') ? (userData.categories || '') : '',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                favorites: [],
                viewedOrders: [],
                verified: false,
                banned: false,
                badges: []
            };
            
            // Сохраняем в Firestore
            await db.collection('users').doc(user.uid).set(firestoreData);
            
            safeHelpers.showNotification('✅ Регистрация прошла успешно!', 'success');
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
            
            safeHelpers.showNotification(`❌ ${errorMessage}`, 'error');
            return { success: false, error: errorMessage };
        }
    }

    // Вход
    async function login(email, password) {
        try {
            if (!email || !password) {
                throw new Error('Введите email и пароль');
            }
            
            const userCredential = await auth.signInWithEmailAndPassword(email, password);
            
            // Проверяем бан
            const userData = await db.collection('users').doc(userCredential.user.uid).get();
            if (userData.exists && userData.data().banned) {
                await auth.signOut();
                throw new Error('Ваш аккаунт заблокирован');
            }
            
            safeHelpers.showNotification('✅ Вход выполнен успешно!', 'success');
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
            
            safeHelpers.showNotification(`❌ ${errorMessage}`, 'error');
            return { success: false, error: errorMessage };
        }
    }

    // Выход
    async function logout() {
        try {
            await auth.signOut();
            // Очищаем кэш
            localStorage.clear();
            sessionStorage.clear();
            
            safeHelpers.showNotification('👋 До свидания!', 'info');
            return { success: true };
        } catch (error) {
            console.error('Ошибка выхода:', error);
            safeHelpers.showNotification('❌ Ошибка при выходе', 'error');
            return { success: false, error: error.message };
        }
    }

    // Обновление профиля
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
            
            safeHelpers.showNotification('✅ Профиль обновлен', 'success');
            return { success: true };
            
        } catch (error) {
            console.error('Ошибка обновления профиля:', error);
            safeHelpers.showNotification('❌ Ошибка обновления профиля', 'error');
            return { success: false, error: error.message };
        }
    }

    // Добавление в избранное
    async function addToFavorites(masterId) {
        try {
            if (!currentUser) throw new Error('Необходимо авторизоваться');
            
            await db.collection('users').doc(currentUser.uid).update({
                favorites: firebase.firestore.FieldValue.arrayUnion(masterId)
            });
            
            safeHelpers.showNotification('✅ Мастер добавлен в избранное', 'success');
            return { success: true };
            
        } catch (error) {
            console.error('Ошибка добавления в избранное:', error);
            safeHelpers.showNotification('❌ Ошибка', 'error');
            return { success: false, error: error.message };
        }
    }

    async function removeFromFavorites(masterId) {
        try {
            if (!currentUser) throw new Error('Необходимо авторизоваться');
            
            await db.collection('users').doc(currentUser.uid).update({
                favorites: firebase.firestore.FieldValue.arrayRemove(masterId)
            });
            
            safeHelpers.showNotification('❌ Мастер удален из избранного', 'info');
            return { success: true };
            
        } catch (error) {
            console.error('Ошибка удаления из избранного:', error);
            safeHelpers.showNotification('❌ Ошибка', 'error');
            return { success: false, error: error.message };
        }
    }

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

    // Подписка на изменения авторизации
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

    // Обновление UI на основе статуса авторизации
    function updateUI() {
        // Скрываем/показываем блоки авторизации
        document.querySelectorAll('.auth-required').forEach(el => {
            if (el) el.classList.toggle('d-none', !currentUser);
        });
        
        document.querySelectorAll('.no-auth-required').forEach(el => {
            if (el) el.classList.toggle('d-none', !!currentUser);
        });
        
        document.querySelectorAll('.client-only').forEach(el => {
            if (el) el.classList.toggle('d-none', !isClient());
        });
        
        document.querySelectorAll('.master-only').forEach(el => {
            if (el) el.classList.toggle('d-none', !isMaster());
        });
        
        document.querySelectorAll('.admin-only').forEach(el => {
            if (el) el.classList.toggle('d-none', !isAdmin());
        });
        
        // Обновляем информацию о пользователе
        const userEmailDisplay = document.getElementById('userEmailDisplay');
        if (userEmailDisplay && currentUser) {
            userEmailDisplay.innerText = currentUser.email || '';
        }
        
        const userRoleDisplay = document.getElementById('userRoleDisplay');
        if (userRoleDisplay && currentUserData) {
            userRoleDisplay.innerText = currentUserData.role === (USER_ROLE?.MASTER || 'master') ? 'Мастер' : 'Клиент';
        }
        
        // Обновляем ссылки с проверками
        const clientLink = document.getElementById('clientLink');
        if (clientLink) {
            clientLink.href = isAuthenticated() ? '/HomeWork/client.html' : '#';
            clientLink.onclick = (e) => {
                if (!isAuthenticated()) {
                    e.preventDefault();
                    safeHelpers.showNotification('Войдите в систему', 'warning');
                }
            };
        }
        
        const masterLink = document.getElementById('masterLink');
        if (masterLink) {
            masterLink.href = isAuthenticated() ? '/HomeWork/masters.html' : '#';
            masterLink.onclick = (e) => {
                if (!isAuthenticated()) {
                    e.preventDefault();
                    safeHelpers.showNotification('Войдите в систему', 'warning');
                }
            };
        }
    }

    // Инициализация темы
    function initTheme() {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark') {
            document.body.classList.add('dark-theme');
            updateThemeIcon(true);
        }
    }

    function toggleTheme() {
        const isDark = document.body.classList.toggle('dark-theme');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        updateThemeIcon(isDark);
    }

    function updateThemeIcon(isDark) {
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            const icon = themeToggle.querySelector('i');
            if (icon) {
                icon.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
            }
        }
    }

    // Очистка при выходе
    function cleanup() {
        if (unsubscribe) {
            unsubscribe();
        }
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
        onAuthChange,
        toggleTheme,
        cleanup
    };
})();

// Автоинициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    // Проверяем наличие auth перед инициализацией
    if (window.auth) {
        Auth.init();
    } else {
        console.warn('⏳ Ожидание инициализации Firebase...');
        // Пробуем еще раз через секунду
        setTimeout(() => {
            if (window.auth) {
                Auth.init();
            } else {
                console.error('❌ Firebase auth не загрузился');
            }
        }, 1000);
    }
});

window.Auth = Auth;