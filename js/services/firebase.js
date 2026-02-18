// ===== js/services/firebase.js =====

const firebaseConfig = {
    apiKey: "AIzaSyCQrxCTXNBS4sEyR_ElZ3dXRkkK9kEYTTQ",
    authDomain: "homework-6a562.firebaseapp.com",
    projectId: "homework-6a562",
    storageBucket: "homework-6a562.firebasestorage.app",
    messagingSenderId: "3651366285",
    appId: "1:3651366285:web:8b1a73dfdf717eb582e1c4"
};

// Инициализация Firebase
firebase.initializeApp(firebaseConfig);

// Глобальные ссылки (доступны везде)
const db = firebase.firestore();
const auth = firebase.auth();
const storage = firebase.storage();

// Экспортируем в глобальную область
window.db = db;
window.auth = auth;
window.storage = storage;

console.log('✅ Firebase инициализирован:', { db: !!db, auth: !!auth, storage: !!storage });