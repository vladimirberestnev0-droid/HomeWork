// ============================================
// КОНФИГУРАЦИЯ ПРИЛОЖЕНИЯ (ИСПРАВЛЕНО - путь к masters)
// ============================================

const CONFIG = (function() {
    // Защита от повторных инициализаций
    if (window.__CONFIG_INITIALIZED__) {
        return window.CONFIG;
    }
    
    // Режим работы
    const isLocal = window.location.hostname === 'localhost' || 
                    window.location.hostname === '127.0.0.1';
    
    // Базовый путь для GitHub Pages (автоопределение)
    const BASE_PATH = (() => {
        const path = window.location.pathname;
        if (path.includes('/HomeWork/')) {
            return '/HomeWork/';
        }
        if (path.includes('/svoy-master/')) {
            return '/svoy-master/';
        }
        return '/';
    })();
    
    // Firebase конфигурация
    const firebase = {
        apiKey: "AIzaSyCQrxCTXNBS4sEyR_ElZ3dXRkkK9kEYTTQ",
        authDomain: "homework-6a562.firebaseapp.com",
        projectId: "homework-6a562",
        storageBucket: "homework-6a562.appspot.com",
        messagingSenderId: "3651366285",
        appId: "1:3651366285:web:8b1a73dfdf717eb582e1c4"
    };

    // ===== УНИФИЦИРОВАННЫЕ URL =====
    const urls = {
        // Основные страницы
        home: BASE_PATH,
        index: BASE_PATH + 'index.html',
        client: BASE_PATH + 'client.html',
        master: BASE_PATH + 'masters.html', // ИСПРАВЛЕНО: было master.html
        chat: BASE_PATH + 'chat.html',
        admin: BASE_PATH + 'admin.html',
        
        // Для редиректов
        login: BASE_PATH + '?auth=login',
        register: BASE_PATH + '?auth=register',
        
        // API маршруты (для будущего использования)
        api: isLocal ? 'http://localhost:3000/api/' : '/api/'
    };

    // Настройки приложения
    const app = {
        name: 'СВОЙ МАСТЕР 86',
        shortName: 'СВОЙ86',
        description: 'Мастера рядом в ХМАО',
        supportEmail: 'support@svoymaster86.ru',
        adminUid: "dUUNkDJbXmN3efOr3JPKOyBrc8M2",
        version: '2.1.0',
        
        // URL-ы (для доступа через ключи)
        urls: urls,
        
        // Пагинация
        pagination: {
            ordersPerPage: 20,
            ordersInitial: 7,
            ordersLoadMore: 5,
            mastersPerPage: 10,
            chatsPerPage: 30,
            messagesPerPage: 50
        },

        // Лимиты
        limits: {
            maxPhotoSize: 10 * 1024 * 1024, // 10MB
            maxPhotosPerOrder: 5,
            maxFileSize: 25 * 1024 * 1024, // 25MB для чата
            responseCooldown: 5000, // 5 секунд между откликами
            messageCooldown: 1000, // 1 секунда между сообщениями
            maxMessageLength: 5000,
            minOrderPrice: 500,
            maxOrderPrice: 1000000,
            maxTitleLength: 100,
            maxDescriptionLength: 1000,
            maxCommentLength: 500,
            maxAddressLength: 200
        },

        // Таймауты
        timeouts: {
            notification: 5000,
            sessionCheck: 30000,
            firebaseInit: 10000,
            authWait: 5000,
            offlineCheck: 3000,
            cacheTTL: {
                orders: 5 * 60 * 1000, // 5 минут
                masters: 10 * 60 * 1000, // 10 минут
                chats: 5 * 60 * 1000,
                messages: 2 * 60 * 1000,
                unread: 30 * 1000 // 30 секунд
            }
        },

        // Город по умолчанию
        defaultCity: 'nyagan',
        defaultCityName: 'Нягань'
    };

    // Региональные настройки
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

    // Режим разработки
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

    // Сборка финального конфига
    const config = {
        firebase,
        app,
        region,
        dev,
        isLocal,
        mode: isLocal ? 'development' : 'production',
        
        // ===== ХЕЛПЕРЫ ДЛЯ URL =====
        getUrl: (key, params = {}) => {
            let url = app.urls[key] || app.urls.home;
            
            // Добавляем параметры если есть
            if (Object.keys(params).length > 0) {
                const urlObj = new URL(url, window.location.origin);
                Object.entries(params).forEach(([key, value]) => {
                    urlObj.searchParams.set(key, value);
                });
                return urlObj.pathname + urlObj.search;
            }
            
            return url;
        },
        
        getApiUrl: (path) => {
            return app.urls.api + path;
        },
        
        // Получение базового пути
        getBasePath: () => BASE_PATH,
        
        // Проверка текущего URL (ИСПРАВЛЕНО: сравниваем только pathname)
        isCurrentPage: (pageKey) => {
            const targetUrl = app.urls[pageKey];
            if (!targetUrl) return false;
            
            const currentPath = window.location.pathname;
            // Убираем базовый путь для сравнения
            const relativePath = currentPath.replace(BASE_PATH, '');
            const targetPath = targetUrl.replace(BASE_PATH, '');
            
            return relativePath === targetPath || 
                   (pageKey === 'home' && (relativePath === '' || relativePath === 'index.html'));
        },
        
        // Построение полного URL
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
        
        // ===== ПРОВЕРКИ =====
        isProduction: () => !isLocal,
        isDevelopment: () => isLocal,
        isOnline: () => navigator.onLine,
        
        // ===== КЭШИРОВАНИЕ =====
        getCacheTTL: (type) => {
            return app.timeouts.cacheTTL[type] || app.timeouts.cacheTTL.orders;
        }
    };

    // Заморозка объекта (нельзя изменить)
    window.__CONFIG_INITIALIZED__ = true;
    
    console.log(`✅ Конфиг загружен [${config.mode}]`, {
        basePath: BASE_PATH,
        urls: app.urls
    });
    
    return Object.freeze(config);
})();

// Глобальный доступ
window.CONFIG = CONFIG;