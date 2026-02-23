// ===== js/core/config.js =====
// Централизованная конфигурация проекта

const CONFIG = {
    // API endpoints
    api: {
        base: window.location.hostname === 'localhost' 
            ? 'http://localhost:3000' 
            : 'https://api.workhom.ru',
        websocket: window.location.hostname === 'localhost'
            ? 'ws://localhost:8080'
            : 'wss://api.workhom.ru/ws',
        deepseek: 'https://us-central1-homework-6a562.cloudfunctions.net/deepseekProxy'
    },

    // Telegram
    telegram: {
        botUsername: '@WorkHomBot',
        botLink: 'https://t.me/WorkHomBot'
    },

    // CDN
    cdn: {
        url: window.location.hostname === 'localhost'
            ? 'http://localhost:3000/cdn'
            : 'https://cdn.workhom.ru',
        imageSizes: {
            thumbnail: { width: 100, height: 100 },
            small: { width: 300, height: 300 },
            medium: { width: 600, height: 600 },
            large: { width: 1200, height: 1200 }
        }
    },

    // Firebase (ПРОВЕРЕНО: правильный storageBucket)
    firebase: {
        apiKey: "AIzaSyCQrxCTXNBS4sEyR_ElZ3dXRkkK9kEYTTQ",
        authDomain: "homework-6a562.firebaseapp.com",
        projectId: "homework-6a562",
        storageBucket: "homework-6a562.appspot.com", // ИСПРАВЛЕНО!
        messagingSenderId: "3651366285",
        appId: "1:3651366285:web:8b1a73dfdf717eb582e1c4"
    },

    // Яндекс.Карты
    yandexMaps: {
        apiKey: "22f2217d-9d6c-44f6-b96b-94e396067a8e"
    },

    // Настройки приложения
    app: {
        name: 'ВоркХом',
        supportEmail: 'support@workhom.ru',
        supportPhone: '8 (800) 123-45-67',
        adminUid: "dUUNkDJbXmN3efOr3JPKOyBrc8M2",
        
        // Пагинация
        pagination: {
            ordersPerPage: 20,
            mastersPerPage: 10,
            messagesPerPage: 50,
            responsesPerPage: 20,
            ordersInitial: 7,
            ordersLoadMore: 5
        },

        // Таймауты
        timeouts: {
            deepseek: 15000,
            websocket: 5000,
            fetch: 10000,
            upload: 60000
        },

        // Антиспам
        antispam: {
            responseCooldown: 5000, // 5 секунд между откликами
            messageLimit: 30, // максимум сообщений в минуту
            spamThreshold: 5 // нарушений для бана
        },

        // Кэширование
        cache: {
            userTTL: 300000, // 5 минут
            orderTTL: 600000, // 10 минут
            chatTTL: 60000, // 1 минута
            statsTTL: 3600000 // 1 час
        },

        // Геолокация
        geolocation: {
            enableHighAccuracy: true,
            maximumAge: 30000,
            timeout: 27000
        }
    },

    // Фичи (можно включать/отключать)
    features: {
        gamification: true,
        videoChat: true,
        tracking: true,
        telegram: true,
        aiAssistant: true,
        offline: true,
        notifications: true
    },

    // Режим
    mode: window.location.hostname === 'localhost' ? 'development' : 'production'
};

// Заморозка объекта для защиты от изменений
Object.freeze(CONFIG);

window.CONFIG = CONFIG;
console.log('✅ Config loaded, mode:', CONFIG.mode);