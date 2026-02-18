// ===== Firebase Configuration =====
// Единый конфиг для всего проекта!
// Подключай этот файл на всех страницах

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

// Константы статусов (чтобы не было магических строк)
const ORDER_STATUS = {
    OPEN: 'open',
    IN_PROGRESS: 'in_progress',
    COMPLETED: 'completed'
};

const USER_ROLE = {
    CLIENT: 'client',
    MASTER: 'master',
    ADMIN: 'admin'
};

// Настройки пагинации
const PAGINATION = {
    ORDERS_PER_PAGE: 20,
    MASTERS_PER_PAGE: 10,
    MESSAGES_PER_PAGE: 50,
    RESPONSES_PER_PAGE: 20
};

// ID администратора (вынести в .env в идеале)
const ADMIN_UID = "dUUNkDJbXmN3efOr3JPKOyBrc8M2";