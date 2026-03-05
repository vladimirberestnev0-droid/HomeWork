// ============================================
// АБСТРАКТНЫЙ СЛОЙ ДАННЫХ (С ОЧЕРЕДЬЮ ВЫЗОВОВ)
// ============================================
const DataService = (function() {
    if (window.__DATA_SERVICE_INITIALIZED__) return window.DataService;

    let db = null;
    let storage = null;
    let isInitialized = false;
    const callQueue = []; // Очередь вызовов, ожидающих инициализации

    // Универсальная обертка для всех методов
    function createMethod(fn) {
        return function(...args) {
            if (isInitialized) {
                // Если уже инициализированы - выполняем сразу
                return fn.apply(this, args);
            } else {
                // Если нет - возвращаем промис, который выполнится после инициализации
                return new Promise((resolve, reject) => {
                    callQueue.push({
                        fn: () => fn.apply(this, args).then(resolve).catch(reject)
                    });
                    
                    // Запускаем проверку инициализации
                    ensureInit();
                });
            }
        };
    }

    // Автоматическая инициализация
    async function ensureInit() {
        if (isInitialized) return;
        if (window._dataServiceInitializing) return;
        
        window._dataServiceInitializing = true;
        
        console.log('📦 DataService: ожидание Firebase...');
        
        // Ждем Firebase
        const maxAttempts = 20;
        for (let i = 0; i < maxAttempts; i++) {
            if (window.db && window.storage) {
                db = window.db;
                storage = window.storage;
                isInitialized = true;
                
                console.log('✅ DataService готов (автоинициализация)');
                
                // Выполняем все накопившиеся вызовы
                while (callQueue.length > 0) {
                    const queued = callQueue.shift();
                    try {
                        await queued.fn();
                    } catch (error) {
                        console.error('❌ Ошибка в отложенном вызове:', error);
                    }
                }
                
                window._dataServiceInitializing = false;
                return;
            }
            await new Promise(r => setTimeout(r, 100));
        }
        
        window._dataServiceInitializing = false;
        console.error('❌ DataService: Firebase не загрузился');
    }

    // ===== ОБЩИЕ МЕТОДЫ =====
    const getCollection = createMethod(async function(collection, constraints = [], options = {}) {
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
    });

    const getDocument = createMethod(async function(collection, id) {
        const doc = await db.collection(collection).doc(id).get();
        return doc.exists ? { id: doc.id, ...doc.data() } : null;
    });

    const createDocument = createMethod(async function(collection, data) {
        const docRef = await db.collection(collection).add({
            ...data,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        return { id: docRef.id, ...data };
    });

    const updateDocument = createMethod(async function(collection, id, data) {
        await db.collection(collection).doc(id).update({
            ...data,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        return { id, ...data };
    });

    const deleteDocument = createMethod(async function(collection, id) {
        await db.collection(collection).doc(id).delete();
        return true;
    });

    const runTransaction = createMethod(async function(callback) {
        return await db.runTransaction(callback);
    });

    const batch = createMethod(function() {
        return db.batch();
    });

    // ===== СПЕЦИАЛИЗИРОВАННЫЕ МЕТОДЫ =====
    const getUser = createMethod(async function(userId) {
        return getDocument('users', userId);
    });

    const createUser = createMethod(async function(userId, userData) {
        await db.collection('users').doc(userId).set({
            ...userData,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            banned: false,
            rating: 0,
            reviews: 0
        });
        return { id: userId, ...userData };
    });

    const updateUser = createMethod(async function(userId, data) {
        return updateDocument('users', userId, data);
    });

    const getMasters = createMethod(async function(filters = {}, options = {}) {
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
    });

    const getOrders = createMethod(async function(filters = {}, options = {}) {
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
    });

    const getOrder = createMethod(async function(orderId) {
        return getDocument('orders', orderId);
    });

    const createOrder = createMethod(async function(orderData) {
        return createDocument('orders', orderData);
    });

    const updateOrder = createMethod(async function(orderId, data) {
        return updateDocument('orders', orderId, data);
    });

    const getChat = createMethod(async function(chatId) {
        return getDocument('chats', chatId);
    });

    const getUserChats = createMethod(async function(userId, options = {}) {
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
    });

    const createChat = createMethod(async function(chatId, chatData) {
        await db.collection('chats').doc(chatId).set({
            ...chatData,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            lastMessageAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        return { id: chatId, ...chatData };
    });

    const updateChat = createMethod(async function(chatId, data) {
        return updateDocument('chats', chatId, data);
    });

    const getMessages = createMethod(async function(chatId, options = {}) {
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
    });

    const sendMessage = createMethod(async function(chatId, messageData) {
        const messagesRef = db.collection('chats').doc(chatId).collection('messages');
        const docRef = await messagesRef.add({
            ...messageData,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        return { id: docRef.id, ...messageData };
    });

    const uploadFile = createMethod(async function(file, path, onProgress = null) {
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
    });

    const deleteFile = createMethod(async function(path) {
        await storage.ref(path).delete();
        return true;
    });

    const subscribeToCollection = createMethod(function(collection, constraints, callback, errorCallback) {
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
    });

    const subscribeToDocument = createMethod(function(collection, id, callback, errorCallback) {
        return db.collection(collection).doc(id).onSnapshot(
            (doc) => {
                callback(doc.exists ? { id: doc.id, ...doc.data() } : null);
            },
            errorCallback || console.error
        );
    });

    const subscribeToMessages = createMethod(function(chatId, callback, errorCallback) {
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
    });

    // Запускаем проверку инициализации сразу
    ensureInit();

    const api = {
        getCollection,
        getDocument,
        createDocument,
        updateDocument,
        deleteDocument,
        runTransaction,
        batch,
        getUser,
        createUser,
        updateUser,
        getMasters,
        getOrders,
        getOrder,
        createOrder,
        updateOrder,
        getChat,
        getUserChats,
        createChat,
        updateChat,
        getMessages,
        sendMessage,
        uploadFile,
        deleteFile,
        subscribeToCollection,
        subscribeToDocument,
        subscribeToMessages,
        isReady: () => isInitialized
    };

    window.__DATA_SERVICE_INITIALIZED__ = true;
    console.log('✅ DataService загружен (с очередью вызовов)');
    
    return Object.freeze(api);
})();

window.DataService = DataService;