const CONFIG = {
    firebase: {
        apiKey: process.env.FIREBASE_API_KEY || "AIzaSyCQrxCTXNBS4sEyR_ElZ3dXRkkK9kEYTTQ",
        authDomain: process.env.FIREBASE_AUTH_DOMAIN || "homework-6a562.firebaseapp.com",
        projectId: process.env.FIREBASE_PROJECT_ID || "homework-6a562",
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "homework-6a562.appspot.com",
        messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "3651366285",
        appId: process.env.FIREBASE_APP_ID || "1:3651366285:web:8b1a73dfdf717eb582e1c4"
    },

    app: {
        name: 'ВоркХом',
        supportEmail: 'support@workhom.ru',
        adminUid: process.env.ADMIN_UID || "dUUNkDJbXmN3efOr3JPKOyBrc8M2",
        
        pagination: {
            ordersPerPage: 20,
            ordersInitial: 7,
            ordersLoadMore: 5
        },

        limits: {
            maxPhotoSize: 10 * 1024 * 1024,
            maxPhotosPerOrder: 5,
            responseCooldown: 5000
        }
    },

    mode: process.env.NODE_ENV || (window.location.hostname === 'localhost' ? 'development' : 'production')
};

Object.freeze(CONFIG);
window.CONFIG = CONFIG;
console.log('✅ Config loaded, mode:', CONFIG.mode);