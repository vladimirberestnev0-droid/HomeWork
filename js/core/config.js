// Упрощённая конфигурация без process.env
const CONFIG = {
    firebase: {
        apiKey: "AIzaSyCQrxCTXNBS4sEyR_ElZ3dXRkkK9kEYTTQ",
        authDomain: "homework-6a562.firebaseapp.com",
        projectId: "homework-6a562",
        storageBucket: "homework-6a562.appspot.com",
        messagingSenderId: "3651366285",
        appId: "1:3651366285:web:8b1a73dfdf717eb582e1c4"
    },

    app: {
        name: 'ВоркХом',
        supportEmail: 'support@workhom.ru',
        adminUid: "dUUNkDJbXmN3efOr3JPKOyBrc8M2",
        
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

    mode: window.location.hostname === 'localhost' ? 'development' : 'production'
};

// Делаем глобальной
window.CONFIG = CONFIG;
console.log('✅ Config loaded');