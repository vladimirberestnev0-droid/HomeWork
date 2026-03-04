/**
 * auth.js — сервис авторизации
 * Версия 2.0 с исправленными подписками
 */

const Auth = (function() {
    let currentUser = null;
    let currentUserData = null;
    let authListeners = [];
    let unsubscribe = null;
    let initAttempts = 0;
    const MAX_ATTEMPTS = 5;

    // Инициализация с повторными попытками
    function init() {
        // Проверяем, загружен ли Firebase Auth
        if (!window.auth) {
            initAttempts++;
            if (initAttempts <= MAX_ATTEMPTS) {
                console.log(`⏳ Ожидание Firebase Auth... попытка ${initAttempts}/${MAX_ATTEMPTS}`);
                setTimeout(init, 1000);
            } else {
                console.error('❌ Firebase Auth не загрузился после 5 попыток');
                if (typeof Utils !== 'undefined') {
                    Utils.showError('Ошибка авторизации. Обновите страницу.');
                }
            }
            return;
        }

        // Отписываемся от предыдущей подписки
        if (unsubscribe) {
            unsubscribe();
            unsubscribe = null;
        }

        // Подписываемся на изменения авторизации
        unsubscribe = auth.onAuthStateChanged(async (user) => {
            console.log('🔄 Auth state changed:', user ? 'logged in' : 'logged out');
            currentUser = user;
            
            if (user) {
                try {
                    // Загружаем дополнительные данные пользователя из Firestore
                    if (!window.db) {
                        console.warn('⏳ Firestore ещё не готов, ждём...');
                        // Пробуем загрузить через небольшую задержку
                        setTimeout(() => loadUserData(user.uid), 500);
                        return;
                    }
                    await loadUserData(user.uid);
                } catch (error) {
                    console.error('❌ Ошибка загрузки данных пользователя:', error);
                    currentUserData = null;
                }
            } else {
                currentUserData = null;
            }
            
            notifyListeners();
            updateUI();
        });

        initTheme();
        console.log('✅ Auth инициализирован');
    }

    // Загрузка данных пользователя из Firestore
    async function loadUserData(uid) {
        try {
            if (!window.db) {
                throw new Error('Firestore не инициализирован');
            }
            
            const userDoc = await db.collection('users').doc(uid).get();
            
            if (userDoc.exists) {
                currentUserData = userDoc.data();
                console.log('📦 Данные пользователя загружены:', currentUserData?.name);
            } else {
                console.log('📦 Документ пользователя не найден, создаем базовые данные');
                // Создаем базовые данные если их нет
                currentUserData = {
                    name: 'Пользователь',
                    email: currentUser?.email || '',
                    role: 'client',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                };
                
                // Сохраняем в Firestore
                await db.collection('users').doc(uid).set(currentUserData);
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки данных:', error);
            currentUserData = null;
        }
    }

    // Геттеры
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

    // Регистрация
    async function register(email, password, userData) {
        try {
            // Проверяем Firebase
            if (!window.auth || !window.db) {
                throw new Error('Firebase не инициализирован');
            }

            if (!Utils.validateEmail(email)) {
                throw new Error('Некорректный email');
            }
            
            if (password.length < 6) {
                throw new Error('Пароль должен быть не менее 6 символов');
            }

            // Создаем пользователя
            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;

            // Подготавливаем данные для Firestore
            const firestoreData = {
                name: userData.name || 'Пользователь',
                email: email,
                phone: userData.phone || '',
                role: userData.role || USER_ROLE.CLIENT,
                categories: userData.role === USER_ROLE.MASTER ? (userData.categories || '') : '',
                rating: 0,
                reviews: 0,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                banned: false
            };

            // Сохраняем в Firestore
            await db.collection('users').doc(user.uid).set(firestoreData);

            Utils.showNotification('✅ Регистрация прошла успешно!', 'success');
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
            
            Utils.showNotification(`❌ ${errorMessage}`, 'error');
            return { success: false, error: errorMessage };
        }
    }

    // Вход
    async function login(email, password) {
        try {
            if (!window.auth || !window.db) {
                throw new Error('Firebase не инициализирован');
            }

            if (!email || !password) {
                throw new Error('Введите email и пароль');
            }
            
            const userCredential = await auth.signInWithEmailAndPassword(email, password);
            
            // Проверяем, не забанен ли пользователь
            const userDoc = await db.collection('users').doc(userCredential.user.uid).get();
            if (userDoc.exists && userDoc.data().banned) {
                await auth.signOut();
                throw new Error('Ваш аккаунт заблокирован');
            }
            
            Utils.showNotification('✅ Вход выполнен успешно!', 'success');
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
            
            Utils.showNotification(`❌ ${errorMessage}`, 'error');
            return { success: false, error: errorMessage };
        }
    }

    // Выход
    async function logout() {
        try {
            if (!window.auth) {
                throw new Error('Firebase не инициализирован');
            }
            
            await auth.signOut();
            
            // Очищаем локальные данные
            currentUser = null;
            currentUserData = null;
            
            // Очищаем слушатели
            if (unsubscribe) {
                unsubscribe();
                unsubscribe = null;
            }
            
            Utils.showNotification('👋 До свидания!', 'info');
            
            // Перенаправляем на главную
            setTimeout(() => {
                window.location.href = '/HomeWork/';
            }, 1000);
            
            return { success: true };
        } catch (error) {
            console.error('❌ Ошибка выхода:', error);
            Utils.showNotification('❌ Ошибка при выходе', 'error');
            return { success: false };
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
            
            // Возвращаем функцию для отписки
            return function unsubscribe() {
                const index = authListeners.indexOf(callback);
                if (index > -1) {
                    authListeners.splice(index, 1);
                }
            };
        }
        return null;
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
                console.error('❌ Ошибка в listener авторизации:', error);
            }
        });
    }

    // Обновление UI на основе статуса авторизации
    function updateUI() {
        // Показываем/скрываем элементы
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

        // Обновляем ссылки
        const clientLink = document.getElementById('clientLink');
        const masterLink = document.getElementById('masterLink');
        const logoutBtn = document.getElementById('headerLogoutBtn');
        
        if (clientLink) {
            clientLink.style.display = isAuthenticated() ? 'inline-block' : 'none';
        }
        if (masterLink) {
            masterLink.style.display = isAuthenticated() ? 'inline-block' : 'none';
        }
        if (logoutBtn) {
            logoutBtn.style.display = isAuthenticated() ? 'inline-block' : 'none';
        }

        // Обновляем информацию о пользователе
        const userEmailEl = document.getElementById('userEmail');
        const userNameEl = document.getElementById('userName');
        
        if (userEmailEl && currentUser) {
            userEmailEl.textContent = currentUser.email || '';
        }
        if (userNameEl && currentUserData) {
            userNameEl.textContent = currentUserData.name || 'Пользователь';
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

    // Очистка
    function cleanup() {
        if (unsubscribe) {
            unsubscribe();
            unsubscribe = null;
        }
        authListeners = [];
    }

    // Публичное API
    return {
        init,
        getUser,
        getUserData,
        isAuthenticated,
        isMaster,
        isClient,
        isAdmin,
        register,
        login,
        logout,
        onAuthChange,
        toggleTheme,
        cleanup
    };
})();

// Автоинициализация
document.addEventListener('DOMContentLoaded', () => {
    // Даём время на загрузку Firebase SDK
    setTimeout(() => {
        Auth.init();
    }, 500);
});

window.Auth = Auth;