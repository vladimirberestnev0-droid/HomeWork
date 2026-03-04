// ============================================
// КОНФИГУРАЦИЯ ПРИЛОЖЕНИЯ
// ============================================

const CONFIG = (function() {
    // Защита от повторных инициализаций
    if (window.__CONFIG_INITIALIZED__) {
        return window.CONFIG;
    }
    
    // Режим работы
    const isLocal = window.location.hostname === 'localhost' || 
                    window.location.hostname === '127.0.0.1';
    
    // Firebase конфигурация
    const firebase = {
        apiKey: "AIzaSyCQrxCTXNBS4sEyR_ElZ3dXRkkK9kEYTTQ",
        authDomain: "homework-6a562.firebaseapp.com",
        projectId: "homework-6a562",
        storageBucket: "homework-6a562.appspot.com",
        messagingSenderId: "3651366285",
        appId: "1:3651366285:web:8b1a73dfdf717eb582e1c4"
    };

    // Настройки приложения
    const app = {
        name: 'СВОЙ МАСТЕР 86',
        shortName: 'СВОЙ86',
        description: 'Мастера рядом в ХМАО',
        supportEmail: 'support@svoymaster86.ru',
        adminUid: "dUUNkDJbXmN3efOr3JPKOyBrc8M2",
        version: '2.0.0',
        
        // Пагинация
        pagination: {
            ordersPerPage: 20,
            ordersInitial: 7,
            ordersLoadMore: 5,
            mastersPerPage: 10
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
            maxOrderPrice: 1000000
        },

        // Таймауты
        timeouts: {
            notification: 5000,
            sessionCheck: 30000,
            firebaseInit: 10000,
            authWait: 5000
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
        
        // Хелперы
        getApiUrl: (path) => {
            return isLocal ? `http://localhost:3000/api/${path}` : `/api/${path}`;
        },
        
        isProduction: () => !isLocal,
        isDevelopment: () => isLocal
    };

    // Заморозка объекта (нельзя изменить)
    window.__CONFIG_INITIALIZED__ = true;
    
    console.log(`✅ Конфиг загружен [${config.mode}]`);
    return Object.freeze(config);
})();

// Глобальный доступ
window.CONFIG = CONFIG;