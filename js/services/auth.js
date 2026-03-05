// ============================================
// СЕРВИС АВТОРИЗАЦИИ (ИСПРАВЛЕНО - флаг бана)
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
    let isHandlingBan = false; // ИСПРАВЛЕНО: флаг обработки бана
    const MAX_ATTEMPTS = 5;
    let isInitialized = false;
    
    const userCache = new Map();
    const USER_CACHE_TTL = 5 * 60 * 1000;

    function getAdminUid() {
        return window.ADMIN_UID || CONFIG?.app?.adminUid || "dUUNkDJbXmN3efOr3JPKOyBrc8M2";
    }

    function getUserRoleConstants() {
        return window.USER_ROLE || CONSTANTS?.USER_ROLE || {
            CLIENT: 'client',
            MASTER: 'master',
            ADMIN: 'admin'
        };
    }

    function getUserFromCache(uid) {
        const cached = userCache.get(uid);
        if (!cached) return null;
        if (Date.now() - cached.timestamp > USER_CACHE_TTL) {
            userCache.delete(uid);
            return null;
        }
        return cached.data;
    }

    function setUserToCache(uid, userData) {
        userCache.set(uid, { data: userData, timestamp: Date.now() });
    }

    function clearUserCache(uid) {
        if (uid) userCache.delete(uid);
        else userCache.clear();
    }

    // ===== ИСПРАВЛЕННАЯ ПРОВЕРКА БАНА =====
    async function checkBanStatus(user) {
        if (!user || !window.db || isHandlingBan) return false; // ИСПРАВЛЕНО: проверяем флаг
        
        try {
            const userDoc = await db.collection('users').doc(user.uid).get();
            
            if (userDoc.exists && userDoc.data().banned === true) {
                console.warn('🚫 Пользователь забанен, принудительный выход');
                
                // Устанавливаем флаг, чтобы избежать рекурсии
                isHandlingBan = true;
                
                if (window.Utils) Utils.showError('Ваш аккаунт заблокирован');
                
                await auth.signOut();
                
                currentUser = null;
                currentUserData = null;
                
                notifyListeners();
                
                setTimeout(() => {
                    if (window.CONFIG) window.location.href = CONFIG.getUrl('home');
                    else window.location.href = '/';
                    // Сбрасываем флаг после редиректа
                    setTimeout(() => { isHandlingBan = false; }, 1000);
                }, 1500);
                
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('Ошибка проверки бана:', error);
            return false;
        } finally {
            // Сбрасываем флаг в любом случае, кроме случая когда был бан
            // (там он сбросится после редиректа)
            if (!isHandlingBan) isHandlingBan = false;
        }
    }

    function startBanCheck(user) {
        if (banCheckInterval) clearInterval(banCheckInterval);
        
        banCheckInterval = setInterval(async () => {
            if (currentUser && window.navigator.onLine && !isHandlingBan) {
                await checkBanStatus(currentUser);
            }
        }, 30000);
    }

    function stopBanCheck() {
        if (banCheckInterval) {
            clearInterval(banCheckInterval);
            banCheckInterval = null;
        }
    }

    function init() {
        if (isInitialized) return;
        
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

        if (unsubscribe) {
            unsubscribe();
            unsubscribe = null;
        }

        unsubscribe = auth.onAuthStateChanged(async (user) => {
            const wasLoggedIn = !!currentUser;
            const isLoggedIn = !!user;
            
            console.log(`🔄 Auth state changed: ${isLoggedIn ? 'вошёл' : 'вышел'}`);
            
            const previousUser = currentUser;
            currentUser = user;
            
            if (user) {
                try {
                    const isBanned = await checkBanStatus(user);
                    if (isBanned) return;
                    
                    const cachedData = getUserFromCache(user.uid);
                    if (cachedData) {
                        console.log(`📦 Данные из кэша: ${cachedData?.name || 'Без имени'}`);
                        currentUserData = cachedData;
                        setTimeout(() => refreshUserData(user.uid), 1000);
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
                
                if (previousUser) clearUserCache(previousUser.uid);
            }
            
            notifyListeners();
            updateUI();
            
            if (!wasLoggedIn && isLoggedIn) handlePostLogin();
        });

        initTheme();
        isInitialized = true;
        console.log('✅ Auth инициализирован (с защитой от рекурсии)');
    }

    async function refreshUserData(uid) {
        try {
            if (!window.db || !window.navigator.onLine || isHandlingBan) return;
            
            const userDoc = await db.collection('users').doc(uid).get();
            if (userDoc.exists) {
                const freshData = userDoc.data();
                
                if (freshData.banned) {
                    await checkBanStatus({ uid });
                    return;
                }
                
                currentUserData = freshData;
                setUserToCache(uid, freshData);
                notifyListeners();
                updateUI();
                
                console.log('📦 Данные обновлены в фоне');
            }
        } catch (error) {
            console.error('Ошибка фонового обновления:', error);
        }
    }

    async function loadUserData(uid) {
        try {
            if (!window.db) throw new Error('Firestore не инициализирован');
            
            const userDoc = await db.collection('users').doc(uid).get();
            
            if (userDoc.exists) {
                currentUserData = userDoc.data();
                console.log(`📦 Данные загружены из Firestore: ${currentUserData?.name || 'Без имени'}`);
                setUserToCache(uid, currentUserData);
            } else {
                console.log('📦 Документ не найден, создаём...');
                const roleConst = getUserRoleConstants();
                currentUserData = {
                    name: 'Пользователь',
                    email: currentUser?.email || '',
                    role: roleConst.CLIENT,
                    rating: 0,
                    reviews: 0,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    banned: false,
                    settings: {
                        notifications: true,
                        theme: localStorage.getItem('theme') || 'dark'
                    }
                };
                
                await db.collection('users').doc(uid).set(currentUserData);
                setUserToCache(uid, currentUserData);
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки данных:', error);
            currentUserData = null;
            throw error;
        }
    }

    function handlePostLogin() {
        if (currentUser && window.db && navigator.onLine && !isHandlingBan) {
            db.collection('users').doc(currentUser.uid).update({
                lastLogin: firebase.firestore.FieldValue.serverTimestamp()
            }).catch(err => console.log('ℹ️ Не удалось обновить lastLogin'));
            
            if (currentUserData) {
                setUserToCache(currentUser.uid, {
                    ...currentUserData,
                    lastLogin: new Date().toISOString()
                });
            }
        }
        
        const urlParams = new URLSearchParams(window.location.search);
        const redirect = urlParams.get('redirect');
        const savedRedirect = sessionStorage.getItem('redirectAfterLogin');
        
        if (savedRedirect) {
            sessionStorage.removeItem('redirectAfterLogin');
            setTimeout(() => {
                if (!isSamePath(savedRedirect)) {
                    if (window.Loader) Loader.navigateTo(savedRedirect, 'Перенаправляем...');
                    else window.location.href = savedRedirect;
                }
            }, 1000);
        } else if (redirect) {
            setTimeout(() => {
                try {
                    const decodedUrl = decodeURIComponent(redirect);
                    if (!isSamePath(decodedUrl) && !decodedUrl.includes('auth=login')) {
                        if (window.Loader) Loader.navigateTo(decodedUrl, 'Перенаправляем...');
                        else window.location.href = decodedUrl;
                    }
                } catch (e) {
                    console.error('Ошибка редиректа:', e);
                }
            }, 500);
        }
    }

    function isSamePath(url) {
        try {
            const currentPath = window.location.pathname;
            const urlPath = new URL(url, window.location.origin).pathname;
            return currentPath === urlPath;
        } catch (e) {
            return false;
        }
    }

    function getUser() { return currentUser; }
    function getUserData() { return currentUserData; }
    function isAuthenticated() { return !!currentUser; }
    
    function isMaster() { 
        const roleConst = getUserRoleConstants();
        return currentUserData?.role === roleConst?.MASTER; 
    }
    
    function isClient() { 
        const roleConst = getUserRoleConstants();
        return currentUserData?.role === roleConst?.CLIENT; 
    }
    
    function isAdmin() { 
        const adminUid = getAdminUid();
        return adminUid ? currentUser?.uid === adminUid : false; 
    }

    function getRole() { return currentUserData?.role || null; }

    function getRoleDisplay() {
        const role = getRole();
        const roleConst = getUserRoleConstants();
        return roleConst?.getDisplayName ? roleConst.getDisplayName(role) : role;
    }

    async function register(email, password, userData = {}) {
        if (window.Loader) Loader.show('Регистрация...');
        
        try {
            if (!window.auth || !window.db) throw new Error('Firebase не инициализирован');

            if (!Utils.validateEmail(email)) throw new Error('Некорректный email');
            if (!Utils.validatePassword(password)) throw new Error('Пароль должен быть не менее 6 символов');
            if (userData.name && !Utils.validateName(userData.name)) throw new Error('Имя должно быть от 2 до 50 символов');
            if (userData.phone && !Utils.validatePhone(userData.phone)) throw new Error('Некорректный формат телефона');

            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;
            const roleConst = getUserRoleConstants();

            const firestoreData = {
                name: userData.name?.trim() || 'Пользователь',
                email: email.toLowerCase().trim(),
                phone: userData.phone?.trim() || '',
                role: userData.role || roleConst.CLIENT,
                categories: userData.role === roleConst.MASTER ? (userData.categories || '') : '',
                rating: 0,
                reviews: 0,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                banned: false,
                settings: {
                    notifications: true,
                    theme: localStorage.getItem('theme') || 'dark'
                }
            };

            await db.collection('users').doc(user.uid).set(firestoreData);
            setUserToCache(user.uid, firestoreData);

            Utils.showSuccess('Регистрация прошла успешно!');
            if (window.Loader) Loader.showTemporary('✅ Регистрация успешна!', 1500);
            
            return { success: true, user };
            
        } catch (error) {
            console.error('❌ Ошибка регистрации:', error);
            if (window.Loader) Loader.hide();
            
            let errorMessage = 'Ошибка регистрации';
            if (error.code === 'auth/email-already-in-use') errorMessage = 'Этот email уже используется';
            else if (error.code === 'auth/invalid-email') errorMessage = 'Некорректный email';
            else if (error.code === 'auth/weak-password') errorMessage = 'Слишком простой пароль';
            else errorMessage = error.message;
            
            Utils.showError(errorMessage);
            return { success: false, error: errorMessage };
        }
    }

    async function login(email, password) {
        if (window.Loader) Loader.show('Вход в систему...');
        
        try {
            if (!window.auth || !window.db) throw new Error('Firebase не инициализирован');
            if (!email || !password) throw new Error('Введите email и пароль');
            
            const userCredential = await auth.signInWithEmailAndPassword(email, password);
            
            const isBanned = await checkBanStatus(userCredential.user);
            if (isBanned) return { success: false, error: 'Аккаунт заблокирован' };
            
            Utils.showSuccess('Вход выполнен успешно!');
            if (window.Loader) Loader.showTemporary('✅ Вход выполнен! Перенаправляем...', 1500);
            
            return { success: true };
            
        } catch (error) {
            console.error('❌ Ошибка входа:', error);
            if (window.Loader) Loader.hide();
            
            let errorMessage = 'Ошибка входа';
            if (error.code === 'auth/user-not-found') errorMessage = 'Пользователь не найден';
            else if (error.code === 'auth/wrong-password') errorMessage = 'Неверный пароль';
            else if (error.code === 'auth/invalid-email') errorMessage = 'Некорректный email';
            else if (error.code === 'auth/too-many-requests') errorMessage = 'Слишком много попыток. Попробуйте позже';
            else errorMessage = error.message;
            
            Utils.showError(errorMessage);
            return { success: false, error: errorMessage };
        }
    }

    async function logout(silent = false) {
        if (!silent && window.Loader) Loader.show('Выход...');
        
        try {
            if (!window.auth) throw new Error('Firebase не инициализирован');
            
            stopBanCheck();
            isHandlingBan = false; // ИСПРАВЛЕНО: сбрасываем флаг
            
            if (currentUser) clearUserCache(currentUser.uid);
            
            await auth.signOut();
            
            currentUser = null;
            currentUserData = null;
            
            if (!silent) {
                if (window.Loader) Loader.showTemporary('👋 До свидания!', 1000);
                setTimeout(() => {
                    if (window.CONFIG) window.location.href = CONFIG.getUrl('home');
                    else window.location.href = '/';
                }, 1000);
            }
            
            return { success: true };
        } catch (error) {
            console.error('❌ Ошибка выхода:', error);
            if (window.Loader) Loader.hide();
            if (!silent) Utils.showError('Ошибка при выходе');
            return { success: false };
        }
    }

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

    function updateUI() {
        const isAuth = !!currentUser;
        const isMasterRole = isMaster();
        const isClientRole = isClient();
        const isAdminRole = isAdmin();

        document.querySelectorAll('.auth-required').forEach(el => el.classList.toggle('d-none', !isAuth));
        document.querySelectorAll('.no-auth-required').forEach(el => el.classList.toggle('d-none', isAuth));
        document.querySelectorAll('.client-only').forEach(el => el.classList.toggle('d-none', !isClientRole));
        document.querySelectorAll('.master-only').forEach(el => el.classList.toggle('d-none', !isMasterRole));
        document.querySelectorAll('.admin-only').forEach(el => el.classList.toggle('d-none', !isAdminRole));

        const userEmailEl = document.getElementById('userEmail');
        const userNameEl = document.getElementById('userName');
        const userAvatarEl = document.getElementById('userAvatar');
        
        if (userEmailEl && currentUser) userEmailEl.textContent = currentUser.email || '';
        if (userNameEl && currentUserData) userNameEl.textContent = currentUserData.name || 'Пользователь';
        if (userAvatarEl && currentUserData) {
            const icon = userAvatarEl.querySelector('i');
            if (icon) icon.className = `fas ${isMasterRole ? 'fa-user-tie' : 'fa-user'}`;
        }
    }

    function initTheme() {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            document.body.classList.add('dark-theme');
            updateThemeIcon(true);
        } else {
            document.body.classList.remove('dark-theme');
            updateThemeIcon(false);
        }
    }

    function toggleTheme() {
        const isDark = document.body.classList.toggle('dark-theme');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        updateThemeIcon(isDark);
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

    async function updateProfile(data) {
        if (window.Loader) Loader.show('Обновляем профиль...');
        
        try {
            if (!currentUser || !window.db) throw new Error('Не авторизован');

            await db.collection('users').doc(currentUser.uid).update({
                ...data,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            if (currentUserData) {
                currentUserData = { ...currentUserData, ...data };
                setUserToCache(currentUser.uid, currentUserData);
            }

            if (window.Loader) Loader.showTemporary('✅ Профиль обновлён', 1500);
            Utils.showSuccess('Профиль обновлён');
            notifyListeners();
            return { success: true };
        } catch (error) {
            console.error('❌ Ошибка обновления профиля:', error);
            if (window.Loader) Loader.hide();
            Utils.showError('Ошибка обновления');
            return { success: false, error: error.message };
        }
    }

    async function changePassword(oldPassword, newPassword) {
        if (window.Loader) Loader.show('Меняем пароль...');
        
        try {
            if (!currentUser || !window.auth) throw new Error('Не авторизован');

            const credential = firebase.auth.EmailAuthProvider.credential(currentUser.email, oldPassword);
            await currentUser.reauthenticateWithCredential(credential);
            await currentUser.updatePassword(newPassword);

            if (window.Loader) Loader.showTemporary('✅ Пароль изменён', 1500);
            Utils.showSuccess('Пароль изменён');
            return { success: true };
        } catch (error) {
            console.error('❌ Ошибка смены пароля:', error);
            if (window.Loader) Loader.hide();
            
            let errorMessage = 'Ошибка';
            if (error.code === 'auth/wrong-password') errorMessage = 'Неверный текущий пароль';
            else if (error.code === 'auth/weak-password') errorMessage = 'Новый пароль слишком простой';
            
            Utils.showError(errorMessage);
            return { success: false, error: errorMessage };
        }
    }

    function cleanup() {
        if (unsubscribe) {
            unsubscribe();
            unsubscribe = null;
        }
        stopBanCheck();
        isHandlingBan = false;
        authListeners = [];
        isInitialized = false;
        userCache.clear();
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
        changePassword,
        cleanup,
        clearUserCache,
        getUserFromCache,
        setUserToCache
    };

    window.__AUTH_INITIALIZED__ = true;
    console.log('✅ Auth сервис загружен (с защитой от рекурсии)');
    
    return Object.freeze(api);
})();

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => Auth.init(), 500);
});

window.Auth = Auth;