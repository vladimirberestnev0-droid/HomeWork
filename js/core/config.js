// ============================================
// КОНФИГУРАЦИЯ ПРИЛОЖЕНИЯ (ИСПРАВЛЕНО - убраны дубли)
// ============================================

const CONFIG = (function() {
    if (window.__CONFIG_INITIALIZED__) return window.CONFIG;
    
    const isLocal = window.location.hostname === 'localhost' || 
                    window.location.hostname === '127.0.0.1';
    
    const BASE_PATH = (() => {
        const path = window.location.pathname;
        if (path.includes('/HomeWork/')) return '/HomeWork/';
        if (path.includes('/svoy-master/')) return '/svoy-master/';
        return '/';
    })();
    
    const firebase = {
        apiKey: "AIzaSyCQrxCTXNBS4sEyR_ElZ3dXRkkK9kEYTTQ",
        authDomain: "homework-6a562.firebaseapp.com",
        projectId: "homework-6a562",
        storageBucket: "homework-6a562.appspot.com",
        messagingSenderId: "3651366285",
        appId: "1:3651366285:web:8b1a73dfdf717eb582e1c4"
    };

    // ===== ИСПРАВЛЕНО: убраны дублирующиеся URL =====
    const urls = {
        home: BASE_PATH,
        client: BASE_PATH + 'client.html',
        master: BASE_PATH + 'masters.html',
        chat: BASE_PATH + 'chat.html',
        admin: BASE_PATH + 'admin.html',
        
        // Для редиректов (с параметрами)
        login: BASE_PATH + '?auth=login',
        register: BASE_PATH + '?auth=register',
        
        // API маршруты
        api: isLocal ? 'http://localhost:3000/api/' : '/api/'
    };

    const app = {
        name: 'СВОЙ МАСТЕР 86',
        shortName: 'СВОЙ86',
        description: 'Мастера рядом в ХМАО',
        supportEmail: 'support@svoymaster86.ru',
        adminUid: "dUUNkDJbXmN3efOr3JPKOyBrc8M2",
        version: '2.1.0',
        
        urls: urls,
        
        pagination: {
            ordersPerPage: 20,
            ordersInitial: 7,
            ordersLoadMore: 5,
            mastersPerPage: 10,
            chatsPerPage: 30,
            messagesPerPage: 50
        },

        limits: {
            maxPhotoSize: 10 * 1024 * 1024,
            maxPhotosPerOrder: 5,
            maxFileSize: 25 * 1024 * 1024,
            responseCooldown: 5000,
            messageCooldown: 1000,
            maxMessageLength: 5000,
            minOrderPrice: 500,
            maxOrderPrice: 1000000,
            maxTitleLength: 100,
            maxDescriptionLength: 1000,
            maxCommentLength: 500,
            maxAddressLength: 200
        },

        timeouts: {
            notification: 5000,
            sessionCheck: 30000,
            firebaseInit: 10000,
            authWait: 5000,
            offlineCheck: 3000,
            cacheTTL: {
                orders: 5 * 60 * 1000,
                masters: 10 * 60 * 1000,
                chats: 5 * 60 * 1000,
                messages: 2 * 60 * 1000,
                unread: 30 * 1000
            }
        },

        defaultCity: 'nyagan',
        defaultCityName: 'Нягань'
    };

    const region = {
        code: '86',
        name: 'ХМАО',
        timezone: 'Asia/Yekaterinburg',
        cities: [
            { id: 'nyagan', name: 'Нягань' },
            { id: 'surgut', name: 'Сургут' },
            { id: 'khanty-mansiysk', name: 'Ханты-Мансийск' },
            { id: 'nefteyugansk', name: 'Нефтеюганск' },
            { id: 'nizhnevartovsk', name: 'Нижневартовск' }
        ]
    };

    const dev = {
        enabled: isLocal,
        logLevel: isLocal ? 'debug' : 'error',
        mockData: isLocal,
        emulators: isLocal ? {
            firestore: 'localhost:8080',
            auth: 'localhost:9099',
            storage: 'localhost:9199'
        } : null
    };

    const config = {
        firebase,
        app,
        region,
        dev,
        isLocal,
        mode: isLocal ? 'development' : 'production',
        
        getUrl: (key, params = {}) => {
            let url = app.urls[key] || app.urls.home;
            
            if (Object.keys(params).length > 0) {
                const urlObj = new URL(url, window.location.origin);
                Object.entries(params).forEach(([key, value]) => {
                    urlObj.searchParams.set(key, value);
                });
                return urlObj.pathname + urlObj.search;
            }
            
            return url;
        },
        
        getApiUrl: (path) => app.urls.api + path,
        getBasePath: () => BASE_PATH,
        
        isCurrentPage: (pageKey) => {
            const targetUrl = app.urls[pageKey];
            if (!targetUrl) return false;
            
            const currentPath = window.location.pathname;
            const relativePath = currentPath.replace(BASE_PATH, '');
            const targetPath = targetUrl.replace(BASE_PATH, '');
            
            return relativePath === targetPath || 
                   (pageKey === 'home' && (relativePath === '' || relativePath === 'index.html'));
        },
        
        buildUrl: (path, params = {}) => {
            let url = path.startsWith('http') ? path : BASE_PATH + path.replace(/^\//, '');
            
            if (Object.keys(params).length > 0) {
                const urlObj = new URL(url, window.location.origin);
                Object.entries(params).forEach(([key, value]) => {
                    urlObj.searchParams.set(key, value);
                });
                return urlObj.pathname + urlObj.search;
            }
            
            return url;
        },
        
        isProduction: () => !isLocal,
        isDevelopment: () => isLocal,
        isOnline: () => navigator.onLine,
        
        getCacheTTL: (type) => app.timeouts.cacheTTL[type] || app.timeouts.cacheTTL.orders
    };

    window.__CONFIG_INITIALIZED__ = true;
    console.log(`✅ Конфиг загружен [${config.mode}]`, { basePath: BASE_PATH });
    
    return Object.freeze(config);
})();

window.CONFIG = CONFIG;