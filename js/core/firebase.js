// ===== js/core/firebase.js =====
// Firebase Configuration

const firebaseConfig = {
    apiKey: "AIzaSyCQrxCTXNBS4sEyR_ElZ3dXRkkK9kEYTTQ",
    authDomain: "homework-6a562.firebaseapp.com",
    projectId: "homework-6a562",
    storageBucket: "homework-6a562.firebasestorage.app",
    messagingSenderId: "3651366285",
    appId: "1:3651366285:web:8b1a73dfdf717eb582e1c4"
};

// Инициализация Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// Глобальные ссылки
const db = firebase.firestore();
const auth = firebase.auth();
const storage = firebase.storage();

// Настройки Firestore
db.settings({
    cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED,
    ignoreUndefinedProperties: true
});

// Включаем persistence для offline режима
db.enablePersistence({ synchronizeTabs: true })
    .catch(err => {
        if (err.code === 'failed-precondition') {
            console.warn('⚠️ Множественные вкладки, persistence отключен');
        } else if (err.code === 'unimplemented') {
            console.warn('⚠️ Браузер не поддерживает persistence');
        }
    });

// Экспортируем в глобальную область
window.db = db;
window.auth = auth;
window.storage = storage;

console.log('✅ Firebase инициализирован');