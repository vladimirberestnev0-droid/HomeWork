// Service Worker для PWA и уведомлений
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: "AIzaSyCQrxCTXNBS4sEyR_ElZ3dXRkkK9kEYTTQ",
    authDomain: "homework-6a562.firebaseapp.com",
    projectId: "homework-6a562",
    storageBucket: "homework-6a562.appspot.com",
    messagingSenderId: "3651366285",
    appId: "1:3651366285:web:8b1a73dfdf717eb582e1c4"
});

const messaging = firebase.messaging();

// Фоновые уведомления
messaging.onBackgroundMessage((payload) => {
    const notificationTitle = payload.notification?.title || 'ВоркХом';
    const notificationOptions = {
        body: payload.notification?.body || 'Новое уведомление',
        icon: '/HomeWork/icons/icon-192x192.png',
        badge: '/HomeWork/icons/icon-72x72.png',
        data: payload.data,
        vibrate: [200, 100, 200]
    };

    return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Клик по уведомлению
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    
    const urlToOpen = event.notification.data?.url || '/HomeWork/';
    event.waitUntil(
        clients.openWindow(urlToOpen)
    );
});