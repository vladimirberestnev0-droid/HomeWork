// ============================================
// АБСТРАКТНЫЙ СЛОЙ ДАННЫХ (ПРОСЛОЙКА МЕЖДУ FIREBASE И СЕРВИСАМИ)
// ============================================
const DataService = (function() {
    if (window.__DATA_SERVICE_INITIALIZED__) return window.DataService;

    let db = null;
    let storage = null;
    let isInitialized = false;

    function init(firebaseDB, firebaseStorage) {
        db = firebaseDB;
        storage = firebaseStorage;
        isInitialized = true;
        console.log('✅ DataService инициализирован');
    }

    function checkInit() {
        if (!isInitialized) throw new Error('DataService не инициализирован');
        return true;
    }

    // ===== ОБЩИЕ МЕТОДЫ =====

    // Получение коллекции с фильтрацией
    async function getCollection(collection, constraints = [], options = {}) {
        checkInit();
        
        let query = db.collection(collection);
        
        // Применяем where constraints
        constraints.forEach(constraint => {
            if (constraint.type === 'where') {
                query = query.where(constraint.field, constraint.operator, constraint.value);
            }
        });
        
        // Сортировка
        if (options.orderBy) {
            query = query.orderBy(options.orderBy.field, options.orderBy.direction || 'asc');
        }
        
        // Лимит
        if (options.limit) {
            query = query.limit(options.limit);
        }
        
        // Пагинация
        if (options.startAfter) {
            query = query.startAfter(options.startAfter);
        }
        if (options.startAt) {
            query = query.startAt(options.startAt);
        }
        if (options.endAt) {
            query = query.endAt(options.endAt);
        }
        if (options.endBefore) {
            query = query.endBefore(options.endBefore);
        }
        
        const snapshot = await query.get();
        
        return {
            items: snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                _exists: true
            })),
            lastDoc: snapshot.docs[snapshot.docs.length - 1] || null,
            size: snapshot.size
        };
    }

    // Получение документа по ID
    async function getDocument(collection, id) {
        checkInit();
        
        const doc = await db.collection(collection).doc(id).get();
        return doc.exists ? { id: doc.id, ...doc.data() } : null;
    }

    // Создание документа
    async function createDocument(collection, data) {
        checkInit();
        
        const docRef = await db.collection(collection).add({
            ...data,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        return { id: docRef.id, ...data };
    }

    // Обновление документа
    async function updateDocument(collection, id, data) {
        checkInit();
        
        await db.collection(collection).doc(id).update({
            ...data,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        return { id, ...data };
    }

    // Удаление документа
    async function deleteDocument(collection, id) {
        checkInit();
        await db.collection(collection).doc(id).delete();
        return true;
    }

    // Транзакция
    async function runTransaction(callback) {
        checkInit();
        return await db.runTransaction(callback);
    }

    // Пакетная запись
    function batch() {
        checkInit();
        return db.batch();
    }

    // ===== СПЕЦИАЛИЗИРОВАННЫЕ МЕТОДЫ ДЛЯ ПОЛЬЗОВАТЕЛЕЙ =====

    async function getUser(userId) {
        return getDocument('users', userId);
    }

    async function createUser(userId, userData) {
        await db.collection('users').doc(userId).set({
            ...userData,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            banned: false,
            rating: 0,
            reviews: 0
        });
        return { id: userId, ...userData };
    }

    async function updateUser(userId, data) {
        return updateDocument('users', userId, data);
    }

    async function getMasters(filters = {}, options = {}) {
        const constraints = [
            { type: 'where', field: 'role', operator: '==', value: 'master' },
            { type: 'where', field: 'banned', operator: '==', value: false }
        ];
        
        if (filters.category) {
            constraints.push({
                type: 'where',
                field: 'categories',
                operator: 'array-contains',
                value: filters.category
            });
        }
        
        return getCollection('users', constraints, {
            orderBy: { field: 'rating', direction: 'desc' },
            limit: options.limit || 10,
            startAfter: options.lastDoc
        });
    }

    // ===== СПЕЦИАЛИЗИРОВАННЫЕ МЕТОДЫ ДЛЯ ЗАКАЗОВ =====

    async function getOrders(filters = {}, options = {}) {
        const constraints = [];
        
        if (filters.status) {
            constraints.push({
                type: 'where',
                field: 'status',
                operator: '==',
                value: filters.status
            });
        }
        
        if (filters.category && filters.category !== 'all') {
            constraints.push({
                type: 'where',
                field: 'category',
                operator: '==',
                value: filters.category
            });
        }
        
        if (filters.clientId) {
            constraints.push({
                type: 'where',
                field: 'clientId',
                operator: '==',
                value: filters.clientId
            });
        }
        
        return getCollection('orders', constraints, {
            orderBy: { field: 'createdAt', direction: 'desc' },
            limit: options.limit || 20,
            startAfter: options.lastDoc
        });
    }

    async function getOrder(orderId) {
        return getDocument('orders', orderId);
    }

    async function createOrder(orderData) {
        return createDocument('orders', orderData);
    }

    async function updateOrder(orderId, data) {
        return updateDocument('orders', orderId, data);
    }

    // ===== СПЕЦИАЛИЗИРОВАННЫЕ МЕТОДЫ ДЛЯ ЧАТОВ =====

    async function getChat(chatId) {
        return getDocument('chats', chatId);
    }

    async function getUserChats(userId, options = {}) {
        const constraints = [{
            type: 'where',
            field: 'participants',
            operator: 'array-contains',
            value: userId
        }];
        
        return getCollection('chats', constraints, {
            orderBy: { field: 'lastMessageAt', direction: 'desc' },
            limit: options.limit || 50,
            startAfter: options.lastDoc
        });
    }

    async function createChat(chatId, chatData) {
        await db.collection('chats').doc(chatId).set({
            ...chatData,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            lastMessageAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        return { id: chatId, ...chatData };
    }

    async function updateChat(chatId, data) {
        return updateDocument('chats', chatId, data);
    }

    async function getMessages(chatId, options = {}) {
        const messagesRef = db.collection('chats').doc(chatId).collection('messages');
        let query = messagesRef.orderBy('timestamp', options.order || 'asc');
        
        if (options.limit) {
            query = query.limit(options.limit);
        }
        
        if (options.startAfter) {
            query = query.startAfter(options.startAfter);
        }
        
        const snapshot = await query.get();
        
        return {
            items: snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                timestamp: doc.data().timestamp?.toDate?.() || new Date()
            })),
            lastDoc: snapshot.docs[snapshot.docs.length - 1] || null
        };
    }

    async function sendMessage(chatId, messageData) {
        const messagesRef = db.collection('chats').doc(chatId).collection('messages');
        const docRef = await messagesRef.add({
            ...messageData,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        return { id: docRef.id, ...messageData };
    }

    // ===== РАБОТА С ФАЙЛАМИ =====

    async function uploadFile(file, path, onProgress = null) {
        checkInit();
        
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
        const storageRef = storage.ref(`${path}/${fileName}`);
        const uploadTask = storageRef.put(file);
        
        return new Promise((resolve, reject) => {
            uploadTask.on(
                'state_changed',
                (snapshot) => {
                    if (onProgress) {
                        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                        onProgress(progress);
                    }
                },
                (error) => reject(error),
                async () => {
                    const url = await uploadTask.snapshot.ref.getDownloadURL();
                    resolve({
                        url,
                        name: file.name,
                        size: file.size,
                        type: file.type,
                        path: `${path}/${fileName}`
                    });
                }
            );
        });
    }

    async function deleteFile(path) {
        checkInit();
        await storage.ref(path).delete();
        return true;
    }

    // ===== ПОДПИСКИ (REALTIME) =====

    function subscribeToCollection(collection, constraints, callback, errorCallback) {
        checkInit();
        
        let query = db.collection(collection);
        
        constraints.forEach(constraint => {
            if (constraint.type === 'where') {
                query = query.where(constraint.field, constraint.operator, constraint.value);
            }
            if (constraint.type === 'orderBy') {
                query = query.orderBy(constraint.field, constraint.direction || 'asc');
            }
            if (constraint.type === 'limit') {
                query = query.limit(constraint.value);
            }
        });
        
        return query.onSnapshot(
            (snapshot) => {
                const items = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    _exists: true
                }));
                callback(items, snapshot);
            },
            errorCallback || console.error
        );
    }

    function subscribeToDocument(collection, id, callback, errorCallback) {
        checkInit();
        
        return db.collection(collection).doc(id).onSnapshot(
            (doc) => {
                callback(doc.exists ? { id: doc.id, ...doc.data() } : null);
            },
            errorCallback || console.error
        );
    }

    function subscribeToMessages(chatId, callback, errorCallback) {
        checkInit();
        
        return db.collection('chats').doc(chatId)
            .collection('messages')
            .orderBy('timestamp', 'asc')
            .onSnapshot(
                (snapshot) => {
                    const messages = snapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data(),
                        timestamp: doc.data().timestamp?.toDate?.() || new Date()
                    }));
                    callback(messages);
                },
                errorCallback || console.error
            );
    }

    const api = {
        init,
        
        // Общие методы
        getCollection,
        getDocument,
        createDocument,
        updateDocument,
        deleteDocument,
        runTransaction,
        batch,
        
        // Пользователи
        getUser,
        createUser,
        updateUser,
        getMasters,
        
        // Заказы
        getOrders,
        getOrder,
        createOrder,
        updateOrder,
        
        // Чаты
        getChat,
        getUserChats,
        createChat,
        updateChat,
        getMessages,
        sendMessage,
        
        // Файлы
        uploadFile,
        deleteFile,
        
        // Подписки
        subscribeToCollection,
        subscribeToDocument,
        subscribeToMessages
    };

    window.__DATA_SERVICE_INITIALIZED__ = true;
    console.log('✅ DataService готов');
    
    return Object.freeze(api);
})();

window.DataService = DataService;