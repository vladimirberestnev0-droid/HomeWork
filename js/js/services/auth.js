// ============================================
// СЕРВИС АВТОРИЗАЦИИ
// ============================================

const Auth = (function() {
    // Защита от повторных инициализаций
    if (window.__AUTH_INITIALIZED__) {
        return window.Auth;
    }

    // ===== ПРИВАТНЫЕ ПЕРЕМЕННЫЕ =====
    let currentUser = null;
    let currentUserData = null;
    let authListeners = [];
    let unsubscribe = null;
    let initAttempts = 0;
    const MAX_ATTEMPTS = 5;
    let isInitialized = false;

    // ===== ИНИЦИАЛИЗАЦИЯ =====
    function init() {
        if (isInitialized) return;
        
        // Проверяем наличие Firebase Auth
        if (!window.auth) {
            initAttempts++;
            if (initAttempts <= MAX_ATTEMPTS) {
                console.log(`⏳ Ожидание Firebase Auth... попытка ${initAttempts}/${MAX_ATTEMPTS}`);
                setTimeout(init, 1000);
                return;
            } else {
                console.error('❌ Firebase Auth не загрузился');
                if (window.Utils) {
                    Utils.showError('Ошибка авторизации. Обновите страницу.');
                }
                return;
            }
        }

        // Отписываемся от предыдущей подписки
        if (unsubscribe) {
            unsubscribe();
            unsubscribe = null;
        }

        // Подписываемся на изменения
        unsubscribe = auth.onAuthStateChanged(async (user) => {
            const wasLoggedIn = !!currentUser;
            const isLoggedIn = !!user;
            
            console.log(`🔄 Auth state changed: ${isLoggedIn ? 'вошёл' : 'вышел'}`);
            
            currentUser = user;
            
            if (user) {
                try {
                    await loadUserData(user.uid);
                } catch (error) {
                    console.error('❌ Ошибка загрузки данных:', error);
                    currentUserData = null;
                }
            } else {
                currentUserData = null;
            }
            
            notifyListeners();
            updateUI();
            
            // Если пользователь только что вошёл
            if (!wasLoggedIn && isLoggedIn) {
                handlePostLogin();
            }
        });

        initTheme();
        isInitialized = true;
        console.log('✅ Auth инициализирован');
    }

    // ===== ЗАГРУЗКА ДАННЫХ ПОЛЬЗОВАТЕЛЯ =====
    async function loadUserData(uid) {
        try {
            if (!window.db) {
                throw new Error('Firestore не инициализирован');
            }
            
            const userDoc = await db.collection('users').doc(uid).get();
            
            if (userDoc.exists) {
                currentUserData = userDoc.data();
                console.log(`📦 Данные загружены: ${currentUserData?.name || 'Без имени'}`);
                
                // Проверка на бан
                if (currentUserData.banned) {
                    console.warn('🚫 Пользователь забанен');
                    await logout(true);
                    Utils.showError('Ваш аккаунт заблокирован');
                }
            } else {
                console.log('📦 Документ не найден, создаём...');
                // Создаём базовые данные
                currentUserData = {
                    name: 'Пользователь',
                    email: currentUser?.email || '',
                    role: USER_ROLE.CLIENT,
                    rating: 0,
                    reviews: 0,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    banned: false,
                    lastLogin: firebase.firestore.FieldValue.serverTimestamp()
                };
                
                await db.collection('users').doc(uid).set(currentUserData);
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки данных:', error);
            currentUserData = null;
            throw error;
        }
    }

    // ===== ДЕЙСТВИЯ ПОСЛЕ ВХОДА =====
    function handlePostLogin() {
        // Обновляем время последнего входа
        if (currentUser && window.db) {
            db.collection('users').doc(currentUser.uid).update({
                lastLogin: firebase.firestore.FieldValue.serverTimestamp()
            }).catch(err => console.warn('Не удалось обновить lastLogin:', err));
        }
        
        // Проверяем, есть ли параметр redirect в URL
        const urlParams = new URLSearchParams(window.location.search);
        const redirect = urlParams.get('redirect');
        if (redirect) {
            setTimeout(() => {
                window.location.href = decodeURIComponent(redirect);
            }, 500);
        }
    }

    // ===== ГЕТТЕРЫ =====
    function getUser() { return currentUser; }
    function getUserData() { return currentUserData; }
    function isAuthenticated() { return !!currentUser; }
    
    function isMaster() { 
        return currentUserData?.role === USER_ROLE?.MASTER; 
    }
    
    function isClient() { 
        return currentUserData?.role === USER_ROLE?.CLIENT; 
    }
    
    function isAdmin() { 
        return currentUser?.uid === ADMIN_UID; 
    }

    function getRole() {
        if (!currentUserData) return null;
        return currentUserData.role;
    }

    function getRoleDisplay() {
        const role = getRole();
        return USER_ROLE?.getDisplayName ? USER_ROLE.getDisplayName(role) : role;
    }

    // ===== РЕГИСТРАЦИЯ =====
    async function register(email, password, userData = {}) {
        try {
            // Проверки
            if (!window.auth || !window.db) {
                throw new Error('Firebase не инициализирован');
            }

            if (!Utils.validateEmail(email)) {
                throw new Error('Некорректный email');
            }
            
            if (!Utils.validatePassword(password)) {
                throw new Error('Пароль должен быть не менее 6 символов');
            }

            if (userData.name && !Utils.validateName(userData.name)) {
                throw new Error('Имя должно быть от 2 до 50 символов');
            }

            if (userData.phone && !Utils.validatePhone(userData.phone)) {
                throw new Error('Некорректный формат телефона');
            }

            // Создаём пользователя
            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;

            // Подготавливаем данные
            const firestoreData = {
                name: userData.name?.trim() || 'Пользователь',
                email: email.toLowerCase().trim(),
                phone: userData.phone?.trim() || '',
                role: userData.role || USER_ROLE.CLIENT,
                categories: userData.role === USER_ROLE.MASTER ? (userData.categories || '') : '',
                rating: 0,
                reviews: 0,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
                banned: false,
                settings: {
                    notifications: true,
                    theme: 'dark'
                }
            };

            // Сохраняем в Firestore
            await db.collection('users').doc(user.uid).set(firestoreData);

            Utils.showSuccess('Регистрация прошла успешно!');
            return { success: true, user };
            
        } catch (error) {
            console.error('❌ Ошибка регистрации:', error);
            
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
            
            Utils.showError(errorMessage);
            return { success: false, error: errorMessage };
        }
    }

    // ===== ВХОД =====
    async function login(email, password) {
        try {
            if (!window.auth || !window.db) {
                throw new Error('Firebase не инициализирован');
            }

            if (!email || !password) {
                throw new Error('Введите email и пароль');
            }
            
            const userCredential = await auth.signInWithEmailAndPassword(email, password);
            
            // Проверка на бан
            const userDoc = await db.collection('users').doc(userCredential.user.uid).get();
            if (userDoc.exists && userDoc.data().banned) {
                await auth.signOut();
                throw new Error('Ваш аккаунт заблокирован');
            }
            
            Utils.showSuccess('Вход выполнен успешно!');
            return { success: true };
            
        } catch (error) {
            console.error('❌ Ошибка входа:', error);
            
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
            
            Utils.showError(errorMessage);
            return { success: false, error: errorMessage };
        }
    }

    // ===== ВЫХОД =====
    async function logout(silent = false) {
        try {
            if (!window.auth) {
                throw new Error('Firebase не инициализирован');
            }
            
            await auth.signOut();
            
            // Очищаем данные
            currentUser = null;
            currentUserData = null;
            
            if (!silent) {
                Utils.showNotification('👋 До свидания!', 'info');
                
                // Перенаправляем через секунду
                setTimeout(() => {
                    if (window.location.pathname !== '/HomeWork/') {
                        window.location.href = '/HomeWork/';
                    }
                }, 1000);
            }
            
            return { success: true };
        } catch (error) {
            console.error('❌ Ошибка выхода:', error);
            if (!silent) {
                Utils.showError('Ошибка при выходе');
            }
            return { success: false };
        }
    }

    // ===== ПОДПИСКА НА ИЗМЕНЕНИЯ =====
    function onAuthChange(callback) {
        if (typeof callback === 'function') {
            authListeners.push(callback);
            
            // Сразу вызываем с текущим состоянием
            callback(getAuthState());
            
            // Возвращаем функцию отписки
            return function unsubscribe() {
                const index = authListeners.indexOf(callback);
                if (index > -1) {
                    authListeners.splice(index, 1);
                }
            };
        }
        return null;
    }

    function getAuthState() {
        return {
            user: currentUser,
            userData: currentUserData,
            isAuthenticated: !!currentUser,
            isMaster: isMaster(),
            isClient: isClient(),
            isAdmin: isAdmin(),
            role: getRole(),
            roleDisplay: getRoleDisplay()
        };
    }

    function notifyListeners() {
        const state = getAuthState();
        authListeners.forEach(listener => {
            try {
                listener(state);
            } catch (error) {
                console.error('❌ Ошибка в listener:', error);
            }
        });
    }

    // ===== ОБНОВЛЕНИЕ UI =====
    function updateUI() {
        const isAuth = !!currentUser;
        const isMasterRole = isMaster();
        const isClientRole = isClient();
        const isAdminRole = isAdmin();

        // Показываем/скрываем элементы
        document.querySelectorAll('.auth-required').forEach(el => {
            el.classList.toggle('d-none', !isAuth);
        });
        
        document.querySelectorAll('.no-auth-required').forEach(el => {
            el.classList.toggle('d-none', isAuth);
        });
        
        document.querySelectorAll('.client-only').forEach(el => {
            el.classList.toggle('d-none', !isClientRole);
        });
        
        document.querySelectorAll('.master-only').forEach(el => {
            el.classList.toggle('d-none', !isMasterRole);
        });
        
        document.querySelectorAll('.admin-only').forEach(el => {
            el.classList.toggle('d-none', !isAdminRole);
        });

        // Обновляем информацию о пользователе
        const userEmailEl = document.getElementById('userEmail');
        const userNameEl = document.getElementById('userName');
        const userAvatarEl = document.getElementById('userAvatar');
        
        if (userEmailEl && currentUser) {
            userEmailEl.textContent = currentUser.email || '';
        }
        if (userNameEl && currentUserData) {
            userNameEl.textContent = currentUserData.name || 'Пользователь';
        }
        if (userAvatarEl && currentUserData) {
            const icon = userAvatarEl.querySelector('i');
            if (icon) {
                icon.className = `fas ${isMasterRole ? 'fa-user-tie' : 'fa-user'}`;
            }
        }
    }

    // ===== ТЕМА =====
    function initTheme() {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            document.body.classList.add('dark-theme');
            updateThemeIcon(true);
        } else {
            updateThemeIcon(false);
        }
    }

    function toggleTheme() {
        const isDark = document.body.classList.toggle('dark-theme');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        updateThemeIcon(isDark);
        
        // Уведомляем остальные компоненты
        document.dispatchEvent(new CustomEvent('theme-changed', { detail: { isDark } }));
    }

    function updateThemeIcon(isDark) {
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            const icon = themeToggle.querySelector('i');
            if (icon) {
                icon.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
            }
            themeToggle.setAttribute('title', isDark ? 'Светлая тема' : 'Тёмная тема');
        }
    }

    // ===== ОБНОВЛЕНИЕ ПРОФИЛЯ =====
    async function updateProfile(data) {
        try {
            if (!currentUser || !window.db) {
                throw new Error('Не авторизован');
            }

            await db.collection('users').doc(currentUser.uid).update({
                ...data,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // Обновляем локальные данные
            if (currentUserData) {
                currentUserData = { ...currentUserData, ...data };
            }

            Utils.showSuccess('Профиль обновлён');
            notifyListeners();
            return { success: true };
        } catch (error) {
            console.error('❌ Ошибка обновления профиля:', error);
            Utils.showError('Ошибка обновления');
            return { success: false, error: error.message };
        }
    }

    // ===== СМЕНА ПАРОЛЯ =====
    async function changePassword(oldPassword, newPassword) {
        try {
            if (!currentUser || !window.auth) {
                throw new Error('Не авторизован');
            }

            // Переаутентификация
            const credential = firebase.auth.EmailAuthProvider.credential(
                currentUser.email,
                oldPassword
            );
            await currentUser.reauthenticateWithCredential(credential);

            // Смена пароля
            await currentUser.updatePassword(newPassword);

            Utils.showSuccess('Пароль изменён');
            return { success: true };
        } catch (error) {
            console.error('❌ Ошибка смены пароля:', error);
            
            let errorMessage = 'Ошибка';
            if (error.code === 'auth/wrong-password') {
                errorMessage = 'Неверный текущий пароль';
            } else if (error.code === 'auth/weak-password') {
                errorMessage = 'Новый пароль слишком простой';
            }
            
            Utils.showError(errorMessage);
            return { success: false, error: errorMessage };
        }
    }

    // ===== ОЧИСТКА =====
    function cleanup() {
        if (unsubscribe) {
            unsubscribe();
            unsubscribe = null;
        }
        authListeners = [];
        isInitialized = false;
    }

    // ===== ПУБЛИЧНОЕ API =====
    const api = {
        init,
        getUser,
        getUserData,
        isAuthenticated,
        isMaster,
        isClient,
        isAdmin,
        getRole,
        getRoleDisplay,
        register,
        login,
        logout,
        onAuthChange,
        getAuthState,
        toggleTheme,
        updateProfile,
        changePassword,
        cleanup
    };

    window.__AUTH_INITIALIZED__ = true;
    console.log('✅ Auth сервис загружен');
    
    return Object.freeze(api);
})();

// ===== АВТОИНИЦИАЛИЗАЦИЯ =====
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        Auth.init();
    }, 500);
});

// Глобальный доступ
window.Auth = Auth;