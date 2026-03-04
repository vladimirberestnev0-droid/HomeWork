const Auth = (function() {
    let currentUser = null;
    let currentUserData = null;
    let authListeners = [];
    let unsubscribe = null;

    // Инициализация
    function init() {
        if (!window.auth) {
            console.error('❌ auth не определен!');
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
            
            notifyListeners();
            updateUI();
        });
        
        initTheme();
        console.log('✅ Auth инициализирован');
    }

    // Геттеры
    function getUser() { return currentUser; }
    function getUserData() { return currentUserData; }
    function isAuthenticated() { return !!currentUser; }
    function isMaster() { return currentUserData?.role === USER_ROLE.MASTER; }
    function isClient() { return currentUserData?.role === USER_ROLE.CLIENT; }
    function isAdmin() { return currentUser?.uid === ADMIN_UID; }

    // Регистрация
    async function register(email, password, userData) {
        try {
            if (!Utils.validateEmail(email)) throw new Error('Некорректный email');
            if (password.length < 6) throw new Error('Пароль должен быть не менее 6 символов');

            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;

            const firestoreData = {
                name: userData.name || '',
                email: email,
                phone: userData.phone || '',
                role: userData.role || USER_ROLE.CLIENT,
                categories: userData.role === USER_ROLE.MASTER ? (userData.categories || '') : '',
                rating: 0,
                reviews: 0,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                banned: false
            };

            await db.collection('users').doc(user.uid).set(firestoreData);

            Utils.showNotification('✅ Регистрация прошла успешно!', 'success');
            return { success: true, user };
        } catch (error) {
            console.error('Ошибка регистрации:', error);
            
            let errorMessage = 'Ошибка регистрации';
            if (error.code === 'auth/email-already-in-use') errorMessage = 'Этот email уже используется';
            else if (error.code === 'auth/invalid-email') errorMessage = 'Некорректный email';
            else if (error.code === 'auth/weak-password') errorMessage = 'Слишком простой пароль';
            else errorMessage = error.message;
            
            Utils.showNotification(`❌ ${errorMessage}`, 'error');
            return { success: false, error: errorMessage };
        }
    }

    // Вход
    async function login(email, password) {
        try {
            if (!email || !password) throw new Error('Введите email и пароль');
            
            const userCredential = await auth.signInWithEmailAndPassword(email, password);
            
            // Проверяем бан
            const userDoc = await db.collection('users').doc(userCredential.user.uid).get();
            if (userDoc.exists && userDoc.data().banned) {
                await auth.signOut();
                throw new Error('Ваш аккаунт заблокирован');
            }
            
            Utils.showNotification('✅ Вход выполнен успешно!', 'success');
            return { success: true };
        } catch (error) {
            console.error('Ошибка входа:', error);
            
            let errorMessage = 'Ошибка входа';
            if (error.code === 'auth/user-not-found') errorMessage = 'Пользователь не найден';
            else if (error.code === 'auth/wrong-password') errorMessage = 'Неверный пароль';
            else if (error.code === 'auth/invalid-email') errorMessage = 'Некорректный email';
            else if (error.code === 'auth/too-many-requests') errorMessage = 'Слишком много попыток';
            else errorMessage = error.message;
            
            Utils.showNotification(`❌ ${errorMessage}`, 'error');
            return { success: false, error: errorMessage };
        }
    }

    // Выход
    async function logout() {
        try {
            await auth.signOut();
            localStorage.clear();
            sessionStorage.clear();
            Utils.showNotification('👋 До свидания!', 'info');
            return { success: true };
        } catch (error) {
            console.error('Ошибка выхода:', error);
            Utils.showNotification('❌ Ошибка при выходе', 'error');
            return { success: false };
        }
    }

    // Подписка на изменения
    function onAuthChange(callback) {
        if (typeof callback === 'function') {
            authListeners.push(callback);
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
            try { listener(state); } catch (error) { console.error('Ошибка в listener:', error); }
        });
    }

    // Обновление UI
    function updateUI() {
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
        
        if (clientLink) clientLink.style.display = isAuthenticated() ? 'inline-block' : 'none';
        if (masterLink) masterLink.style.display = isAuthenticated() ? 'inline-block' : 'none';
        if (logoutBtn) logoutBtn.style.display = isAuthenticated() ? 'inline-block' : 'none';
    }

    // Тема
    function initTheme() {
        if (localStorage.getItem('theme') === 'dark') {
            document.body.classList.add('dark-theme');
        }
    }

    function toggleTheme() {
        const isDark = document.body.classList.toggle('dark-theme');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        
        const icon = document.querySelector('#themeToggle i');
        if (icon) {
            icon.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
        }
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
        toggleTheme
    };
})();

// Автоинициализация
document.addEventListener('DOMContentLoaded', () => {
    if (window.auth) {
        Auth.init();
    } else {
        setTimeout(() => {
            if (window.auth) Auth.init();
        }, 1000);
    }
});

window.Auth = Auth;