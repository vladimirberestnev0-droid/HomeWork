// ============================================
// СЕРВИС АВТОРИЗАЦИИ (ДОБАВЛЕНА ОЧИСТКА SESSIONSTORAGE)
// ============================================
const Auth = (function() {
    if (window.__AUTH_INITIALIZED__) return window.Auth;

    // ===== ПРИВАТНЫЕ ПЕРЕМЕННЫЕ =====
    let currentUser = null;
    let currentUserData = null;
    let authListeners = [];
    let unsubscribe = null;
    let initAttempts = 0;
    let banCheckInterval = null;
    let isHandlingBan = false;
    let isInitialized = false;
    let banCheckInProgress = false; // Флаг для предотвращения рекурсии
    
    const MAX_ATTEMPTS = 5;
    
    const ROLES = {
        CLIENT: 'client',
        MASTER: 'master',
        ADMIN: 'admin'
    };

    // ===== ВСПОМОГАТЕЛЬНЫЕ =====
    function getAdminUid() {
        return window.ADMIN_UID || CONFIG?.app?.adminUid || "dUUNkDJbXmN3efOr3JPKOyBrc8M2";
    }

    // Очистка sessionStorage при выходе
    function clearSessionStorage() {
        const keysToRemove = [
            'respond_order',
            'currentChat',
            'redirectAfterLogin',
            'lastDocId',
            'hasMore',
            'filters',
            'app_filters'
        ];
        
        keysToRemove.forEach(key => {
            try {
                sessionStorage.removeItem(key);
            } catch (e) {
                console.warn(`⚠️ Не удалось очистить ${key}:`, e);
            }
        });
        
        console.log('🧹 SessionStorage очищен');
    }

    // ===== ПРОВЕРКА БАНА (ИСПРАВЛЕНО) =====
    async function checkBanStatus(user) {
        // Защита от рекурсии
        if (banCheckInProgress) {
            console.log('⏳ Проверка бана уже выполняется, пропускаем');
            return false;
        }
        
        if (!user || !window.db || isHandlingBan) return false;
        
        banCheckInProgress = true;
        
        try {
            const userDoc = await db.collection('users').doc(user.uid).get();
            
            if (userDoc.exists && userDoc.data().banned === true) {
                console.warn('🚫 Пользователь забанен, принудительный выход');
                
                isHandlingBan = true;
                
                if (window.Utils) Utils.showError('Ваш аккаунт заблокирован');
                
                // Сбрасываем флаг banCheckInProgress перед выходом
                banCheckInProgress = false;
                
                // Выходим
                await auth.signOut();
                
                // Очищаем sessionStorage
                clearSessionStorage();
                
                // Сбрасываем флаг обработки бана через таймаут
                setTimeout(() => {
                    isHandlingBan = false;
                }, 1000);
                
                // Редирект на главную
                setTimeout(() => {
                    if (window.CONFIG) window.location.href = CONFIG.getUrl('home');
                    else window.location.href = '/';
                }, 1500);
                
                return true;
            }
            
            banCheckInProgress = false;
            return false;
        } catch (error) {
            console.error('Ошибка проверки бана:', error);
            banCheckInProgress = false;
            return false;
        }
    }

    // ===== ЗАГРУЗКА ДАННЫХ (С ОЧИСТКОЙ ТАЙМАУТОВ) =====
    async function loadUserData(uid) {
        // Очищаем кэш перед загрузкой
        if (window.Cache) {
            Cache.remove(`user_${uid}`);
        }
        
        try {
            if (!window.db) throw new Error('Firestore не инициализирован');
            
            if (window.DataService) {
                currentUserData = await DataService.getUser(uid);
            } else {
                const userDoc = await db.collection('users').doc(uid).get();
                currentUserData = userDoc.exists ? userDoc.data() : null;
            }
            
            if (!currentUserData) {
                console.log('📦 Документ не найден, создаём...');
                currentUserData = {
                    name: 'Пользователь',
                    email: currentUser?.email || '',
                    role: ROLES.CLIENT,
                    rating: 0,
                    reviews: 0,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    banned: false,
                    settings: {
                        notifications: true,
                        theme: localStorage.getItem('theme') || 'dark'
                    }
                };
                
                if (window.DataService) {
                    await DataService.createUser(uid, currentUserData);
                } else {
                    await db.collection('users').doc(uid).set(currentUserData);
                }
            }
            
            // Кэшируем
            if (window.Cache) {
                Cache.set(`user_${uid}`, currentUserData, Cache.TTL.LONG);
            }
            
            console.log(`📦 Данные загружены: ${currentUserData?.name || 'Без имени'}`);
            
        } catch (error) {
            console.error('❌ Ошибка загрузки данных:', error);
            currentUserData = null;
            throw error;
        }
    }

    // ===== ИНИЦИАЛИЗАЦИЯ (С ОЧИСТКОЙ) =====
    function init() {
        if (isInitialized) return;
        
        // Очищаем предыдущие подписки
        if (unsubscribe) {
            unsubscribe();
            unsubscribe = null;
        }
        
        if (!window.auth) {
            initAttempts++;
            if (initAttempts <= MAX_ATTEMPTS) {
                console.log(`⏳ Ожидание Firebase Auth... попытка ${initAttempts}/${MAX_ATTEMPTS}`);
                setTimeout(init, 1000);
                return;
            } else {
                console.error('❌ Firebase Auth не загрузился');
                if (window.Utils) Utils.showError('Ошибка авторизации. Обновите страницу.');
                return;
            }
        }

        unsubscribe = auth.onAuthStateChanged(async (user) => {
            const wasLoggedIn = !!currentUser;
            
            console.log(`🔄 Auth state changed: ${user ? 'вошёл' : 'вышел'}`);
            
            const previousUser = currentUser;
            currentUser = user;
            
            if (user) {
                try {
                    // Проверка бана (с защитой от рекурсии)
                    const isBanned = await checkBanStatus(user);
                    if (isBanned) return;
                    
                    // Проверяем кэш
                    let cachedData = null;
                    if (window.Cache) {
                        cachedData = Cache.get(`user_${user.uid}`);
                    }
                    
                    if (cachedData) {
                        console.log(`📦 Данные из кэша: ${cachedData.name}`);
                        currentUserData = cachedData;
                        // В фоне обновляем
                        setTimeout(() => loadUserData(user.uid), 1000);
                    } else {
                        await loadUserData(user.uid);
                    }
                    
                    startBanCheck(user);
                    
                } catch (error) {
                    console.error('❌ Ошибка загрузки данных:', error);
                    currentUserData = null;
                }
            } else {
                currentUserData = null;
                stopBanCheck();
                
                if (previousUser && window.Cache) {
                    Cache.remove(`user_${previousUser.uid}`);
                }
            }
            
            notifyListeners();
            updateStore();
            
            if (!wasLoggedIn && user) handlePostLogin();
        });

        initTheme();
        isInitialized = true;
        console.log('✅ Auth инициализирован');
    }

    function startBanCheck(user) {
        if (banCheckInterval) clearInterval(banCheckInterval);
        
        banCheckInterval = setInterval(async () => {
            if (currentUser && window.navigator.onLine && !isHandlingBan && !banCheckInProgress) {
                await checkBanStatus(currentUser);
            }
        }, 30000);
    }

    function stopBanCheck() {
        if (banCheckInterval) {
            clearInterval(banCheckInterval);
            banCheckInterval = null;
        }
        banCheckInProgress = false;
    }

    // ===== ОБНОВЛЕНИЕ STORE =====
    function updateStore() {
        if (window.AppStore) {
            AppStore.setState({
                user: currentUser,
                userData: currentUserData,
                isAuthenticated: !!currentUser,
                isMaster: isMaster(),
                isClient: isClient(),
                isAdmin: isAdmin(),
                role: getRole()
            });
        }
    }

    // ===== ГЕТТЕРЫ =====
    function getUser() { return currentUser; }
    function getUserData() { return currentUserData; }
    function isAuthenticated() { return !!currentUser; }
    
    function isMaster() { 
        return currentUserData?.role === ROLES.MASTER; 
    }
    
    function isClient() { 
        return currentUserData?.role === ROLES.CLIENT; 
    }
    
    function isAdmin() { 
        const adminUid = getAdminUid();
        return adminUid ? currentUser?.uid === adminUid : false; 
    }

    function getRole() { return currentUserData?.role || null; }
    function getRoleDisplay() { return getRoleDisplayName(getRole()); }

    function getRoleDisplayName(role) {
        const names = {
            [ROLES.CLIENT]: 'Клиент',
            [ROLES.MASTER]: 'Мастер',
            [ROLES.ADMIN]: 'Администратор'
        };
        return names[role] || 'Пользователь';
    }

    // ===== РЕГИСТРАЦИЯ =====
    async function register(email, password, userData = {}) {
        const taskId = window.Loader?.show('Регистрация...');
        
        try {
            if (!window.auth || !window.db) throw new Error('Firebase не инициализирован');

            if (!Utils.validateEmail(email)) throw new Error('Некорректный email');
            if (!Utils.validatePassword(password)) throw new Error('Пароль должен быть не менее 6 символов');
            if (userData.name && !Utils.validateName(userData.name)) throw new Error('Имя должно быть от 2 до 50 символов');
            if (userData.phone && !Utils.validatePhone(userData.phone)) throw new Error('Некорректный формат телефона');

            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;

            const firestoreData = {
                name: userData.name?.trim() || 'Пользователь',
                email: email.toLowerCase().trim(),
                phone: userData.phone?.trim() || '',
                role: userData.role || ROLES.CLIENT,
                categories: userData.role === ROLES.MASTER ? (userData.categories || '') : '',
                rating: 0,
                reviews: 0,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                banned: false,
                settings: {
                    notifications: true,
                    theme: localStorage.getItem('theme') || 'dark'
                }
            };

            if (window.DataService) {
                await DataService.createUser(user.uid, firestoreData);
            } else {
                await db.collection('users').doc(user.uid).set(firestoreData);
            }

            if (window.Cache) {
                Cache.set(`user_${user.uid}`, firestoreData, Cache.TTL.LONG);
            }

            Utils.showSuccess('Регистрация прошла успешно!');
            
            return { success: true, user };
            
        } catch (error) {
            console.error('❌ Ошибка регистрации:', error);
            
            let errorMessage = 'Ошибка регистрации';
            if (error.code === 'auth/email-already-in-use') errorMessage = 'Этот email уже используется';
            else if (error.code === 'auth/invalid-email') errorMessage = 'Некорректный email';
            else if (error.code === 'auth/weak-password') errorMessage = 'Слишком простой пароль';
            else errorMessage = error.message;
            
            Utils.showError(errorMessage);
            return { success: false, error: errorMessage };
        } finally {
            if (taskId) window.Loader?.hide(taskId);
        }
    }

    // ===== ВХОД =====
    async function login(email, password) {
        const taskId = window.Loader?.show('Вход в систему...');
        
        try {
            if (!window.auth || !window.db) throw new Error('Firebase не инициализирован');
            if (!email || !password) throw new Error('Введите email и пароль');
            
            const userCredential = await auth.signInWithEmailAndPassword(email, password);
            
            const isBanned = await checkBanStatus(userCredential.user);
            if (isBanned) return { success: false, error: 'Аккаунт заблокирован' };
            
            Utils.showSuccess('Вход выполнен успешно!');
            
            return { success: true };
            
        } catch (error) {
            console.error('❌ Ошибка входа:', error);
            
            let errorMessage = 'Ошибка входа';
            if (error.code === 'auth/user-not-found') errorMessage = 'Пользователь не найден';
            else if (error.code === 'auth/wrong-password') errorMessage = 'Неверный пароль';
            else if (error.code === 'auth/invalid-email') errorMessage = 'Некорректный email';
            else if (error.code === 'auth/too-many-requests') errorMessage = 'Слишком много попыток. Попробуйте позже';
            else errorMessage = error.message;
            
            Utils.showError(errorMessage);
            return { success: false, error: errorMessage };
        } finally {
            if (taskId) window.Loader?.hide(taskId);
        }
    }

    // ===== ВЫХОД (ИСПРАВЛЕНО: добавлена очистка sessionStorage) =====
    async function logout(silent = false) {
        const taskId = !silent ? window.Loader?.show('Выход...') : null;
        
        try {
            if (!window.auth) throw new Error('Firebase не инициализирован');
            
            stopBanCheck();
            isHandlingBan = false;
            banCheckInProgress = false;
            
            if (currentUser && window.Cache) {
                Cache.remove(`user_${currentUser.uid}`);
            }
            
            // Очищаем sessionStorage перед выходом
            clearSessionStorage();
            
            await auth.signOut();
            
            if (!silent) {
                Utils.showSuccess('👋 До свидания!');
                setTimeout(() => {
                    if (window.CONFIG) window.location.href = CONFIG.getUrl('home');
                    else window.location.href = '/';
                }, 1000);
            }
            
            return { success: true };
        } catch (error) {
            console.error('❌ Ошибка выхода:', error);
            if (!silent) Utils.showError('Ошибка при выходе');
            return { success: false };
        } finally {
            if (taskId) window.Loader?.hide(taskId);
        }
    }

    // ===== СЛУШАТЕЛИ =====
    function onAuthChange(callback) {
        if (typeof callback === 'function') {
            authListeners.push(callback);
            callback(getAuthState());
            return function unsubscribe() {
                const index = authListeners.indexOf(callback);
                if (index > -1) authListeners.splice(index, 1);
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
            try { listener(state); } 
            catch (error) { console.error('❌ Ошибка в listener:', error); }
        });
    }

    // ===== ТЕМА =====
    function initTheme() {
        const savedTheme = localStorage.getItem('theme');
        const isDark = savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches);
        
        if (isDark) document.body.classList.add('dark-theme');
        else document.body.classList.remove('dark-theme');
        
        updateThemeIcon(isDark);
        if (window.AppStore) AppStore.setState({ theme: isDark ? 'dark' : 'light' });
    }

    function toggleTheme() {
        const isDark = document.body.classList.toggle('dark-theme');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        updateThemeIcon(isDark);
        
        if (window.AppStore) AppStore.setState({ theme: isDark ? 'dark' : 'light' });
        document.dispatchEvent(new CustomEvent('theme-changed', { detail: { isDark } }));
    }

    function updateThemeIcon(isDark) {
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            const icon = themeToggle.querySelector('i');
            if (icon) icon.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
            themeToggle.setAttribute('title', isDark ? 'Светлая тема' : 'Тёмная тема');
        }
    }

    // ===== ОБНОВЛЕНИЕ ПРОФИЛЯ =====
    async function updateProfile(data) {
        const taskId = window.Loader?.show('Обновляем профиль...');
        
        try {
            if (!currentUser || !window.db) throw new Error('Не авторизован');

            if (window.DataService) {
                await DataService.updateUser(currentUser.uid, data);
            } else {
                await db.collection('users').doc(currentUser.uid).update({
                    ...data,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            }

            if (currentUserData) {
                currentUserData = { ...currentUserData, ...data };
                if (window.Cache) {
                    Cache.set(`user_${currentUser.uid}`, currentUserData, Cache.TTL.LONG);
                }
            }

            Utils.showSuccess('Профиль обновлён');
            notifyListeners();
            updateStore();
            
            return { success: true };
        } catch (error) {
            console.error('❌ Ошибка обновления профиля:', error);
            Utils.showError('Ошибка обновления');
            return { success: false, error: error.message };
        } finally {
            if (taskId) window.Loader?.hide(taskId);
        }
    }

    // ===== ОЧИСТКА =====
    function cleanup() {
        if (unsubscribe) {
            unsubscribe();
            unsubscribe = null;
        }
        stopBanCheck();
        isHandlingBan = false;
        banCheckInProgress = false;
        authListeners = [];
        isInitialized = false;
        
        // Очищаем кэш пользователя
        if (currentUser && window.Cache) {
            Cache.remove(`user_${currentUser.uid}`);
        }
        
        // Очищаем sessionStorage
        clearSessionStorage();
        
        currentUser = null;
        currentUserData = null;
    }

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
        cleanup,
        ROLES
    };

    window.__AUTH_INITIALIZED__ = true;
    console.log('✅ Auth сервис загружен (исправленная версия)');
    
    return Object.freeze(api);
})();

// Автоинициализация
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => Auth.init(), 500);
});

window.Auth = Auth;