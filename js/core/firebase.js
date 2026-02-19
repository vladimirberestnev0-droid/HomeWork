// ===== js/core/firebase.js =====
// Firebase Configuration

// Проверяем, не инициализирован ли уже Firebase
if (!firebase.apps.length) {
    const firebaseConfig = {
        apiKey: "AIzaSyCQrxCTXNBS4sEyR_ElZ3dXRkkK9kEYTTQ",
        authDomain: "homework-6a562.firebaseapp.com",
        projectId: "homework-6a562",
        storageBucket: "homework-6a562.firebasestorage.app",
        messagingSenderId: "3651366285",
        appId: "1:3651366285:web:8b1a73dfdf717eb582e1c4"
    };
    
    firebase.initializeApp(firebaseConfig);
}

// Глобальные ссылки - проверяем, не объявлены ли уже
if (typeof window.db === 'undefined') {
    window.db = firebase.firestore();
    window.auth = firebase.auth();
    window.storage = firebase.storage();

    // Настройки Firestore
    window.db.settings({
        cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED,
        ignoreUndefinedProperties: true
    });

    // Включаем persistence для offline режима
    window.db.enablePersistence({ synchronizeTabs: true })
        .catch(err => {
            if (err.code === 'failed-precondition') {
                console.warn('⚠️ Множественные вкладки, persistence отключен');
            } else if (err.code === 'unimplemented') {
                console.warn('⚠️ Браузер не поддерживает persistence');
            }
        });
} else {
    console.log('⚠️ Firebase уже инициализирован');
}

console.log('✅ Firebase инициализирован');