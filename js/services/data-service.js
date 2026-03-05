// ============================================
// АБСТРАКТНЫЙ СЛОЙ ДАННЫХ (ЭЛЕГАНТНОЕ РЕШЕНИЕ)
// ============================================
const DataService = (function() {
    if (window.__DATA_SERVICE_INITIALIZED__) return window.DataService;

    let db = null;
    let storage = null;
    let initPromise = null;
    let isInitialized = false;

    // Автоматическая инициализация при первом использовании
    async function ensureInit() {
        if (isInitialized) return true;
        
        if (initPromise) return initPromise;
        
        initPromise = new Promise(async (resolve, reject) => {
            console.log('📦 DataService: автоматическая инициализация...');
            
            // Ждем Firebase
            const maxAttempts = 10;
            for (let i = 0; i < maxAttempts; i++) {
                if (window.db && window.storage) {
                    db = window.db;
                    storage = window.storage;
                    isInitialized = true;
                    console.log('✅ DataService готов (автоинициализация)');
                    resolve(true);
                    return;
                }
                await new Promise(r => setTimeout(r, 100));
            }
            
            reject(new Error('Firebase не загрузился'));
        });
        
        return initPromise;
    }

    // ===== ОБЩИЕ МЕТОДЫ =====
    async function getCollection(collection, constraints = [], options = {}) {
        await ensureInit();
        
        let query = db.collection(collection);
        
        constraints.forEach(constraint => {
            if (constraint.type === 'where') {
                query = query.where(constraint.field, constraint.operator, constraint.value);
            }
        });
        
        if (options.orderBy) {
            query = query.orderBy(options.orderBy.field, options.orderBy.direction || 'asc');
        }
        
        if (options.limit) {
            query = query.limit(options.limit);
        }
        
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

    async function getDocument(collection, id) {
        await ensureInit();
        const doc = await db.collection(collection).doc(id).get();
        return doc.exists ? { id: doc.id, ...doc.data() } : null;
    }

    async function createDocument(collection, data) {
        await ensureInit();
        
        const docRef = await db.collection(collection).add({
            ...data,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        return { id: docRef.id, ...data };
    }

    async function updateDocument(collection, id, data) {
        await ensureInit();
        
        await db.collection(collection).doc(id).update({
            ...data,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        return { id, ...data };
    }

    async function deleteDocument(collection, id) {
        await ensureInit();
        await db.collection(collection).doc(id).delete();
        return true;
    }

    async function runTransaction(callback) {
        await ensureInit();
        return await db.runTransaction(callback);
    }

    function batch() {
        if (!isInitialized) {
            throw new Error('DataService не инициализирован');
        }
        return db.batch();
    }

    // ===== СПЕЦИАЛИЗИРОВАННЫЕ МЕТОДЫ ДЛЯ ПОЛЬЗОВАТЕЛЕЙ =====
    async function getUser(userId) {
        return getDocument('users', userId);
    }

    async function createUser(userId, userData) {
        await ensureInit();
        
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
        await ensureInit();
        
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
        await ensureInit();
        
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
        await ensureInit();
        
        const messagesRef = db.collection('chats').doc(chatId).collection('messages');
        const docRef = await messagesRef.add({
            ...messageData,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        return { id: docRef.id, ...messageData };
    }

    // ===== РАБОТА С ФАЙЛАМИ =====
    async function uploadFile(file, path, onProgress = null) {
        await ensureInit();
        
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
        await ensureInit();
        await storage.ref(path).delete();
        return true;
    }

    // ===== ПОДПИСКИ (REALTIME) =====
    function subscribeToCollection(collection, constraints, callback, errorCallback) {
        if (!isInitialized) {
            throw new Error('DataService не инициализирован');
        }
        
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
        if (!isInitialized) {
            throw new Error('DataService не инициализирован');
        }
        
        return db.collection(collection).doc(id).onSnapshot(
            (doc) => {
                callback(doc.exists ? { id: doc.id, ...doc.data() } : null);
            },
            errorCallback || console.error
        );
    }

    function subscribeToMessages(chatId, callback, errorCallback) {
        if (!isInitialized) {
            throw new Error('DataService не инициализирован');
        }
        
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
        subscribeToMessages,
        
        // Вспомогательные
        init: () => ensureInit(),
        isReady: () => isInitialized
    };

    window.__DATA_SERVICE_INITIALIZED__ = true;
    console.log('✅ DataService загружен (элегантная версия)');
    
    return Object.freeze(api);
})();

window.DataService = DataService;