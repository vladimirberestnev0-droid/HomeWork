// ============================================
// СЕРВИС ЗАКАЗОВ (ИСПРАВЛЕНО - пагинация, отклики, завершение)
// ============================================

const Orders = (function() {
    if (window.__ORDERS_INITIALIZED__) return window.Orders;

    // ===== ПРИВАТНЫЕ ПЕРЕМЕННЫЕ =====
    const spamPrevention = new Map();
    const orderCache = new Map();
    let activeListeners = new Map();
    
    // Константы
    const ORDER_STATUS = window.ORDER_STATUS || {
        OPEN: 'open',
        IN_PROGRESS: 'in_progress',
        COMPLETED: 'completed',
        CANCELLED: 'cancelled',
        AWAITING_CONFIRMATION: 'awaiting_confirmation' // Новый статус
    };

    // ===== ПРОВЕРКИ =====
    function checkFirebase() {
        if (!window.db) {
            console.warn('⏳ Firestore не инициализирован');
            return false;
        }
        return true;
    }

    function checkAuth() {
        if (!window.Auth || !Auth.isAuthenticated()) {
            console.warn('⏳ Пользователь не авторизован');
            return false;
        }
        return true;
    }

    function getUserSafe() {
        try { return Auth.getUser(); } 
        catch (e) { return null; }
    }

    function getUserDataSafe() {
        try { return Auth.getUserData(); } 
        catch (e) { return null; }
    }

    async function checkModeration(text, context) {
        if (window.Moderation) return Moderation.check(text, context);
        return { isValid: true };
    }

    // ===== РАБОТА С КЭШЕМ =====
    function getCacheTTL() {
        return CONFIG?.app?.timeouts?.cacheTTL?.orders || 5 * 60 * 1000;
    }

    function setCache(key, data) {
        if (!key) return;
        orderCache.set(key, { 
            data, 
            timestamp: Date.now() 
        });
        
        // Автоматическая очистка через TTL
        setTimeout(() => {
            const cached = orderCache.get(key);
            if (cached && Date.now() - cached.timestamp > getCacheTTL()) {
                orderCache.delete(key);
            }
        }, getCacheTTL());
    }

    function getCache(key) {
        if (!key) return null;
        const cached = orderCache.get(key);
        if (!cached) return null;
        if (Date.now() - cached.timestamp > getCacheTTL()) {
            orderCache.delete(key);
            return null;
        }
        return cached.data;
    }

    function clearCache(pattern = null) {
        if (!pattern) {
            orderCache.clear();
            console.log('🧹 Весь кэш заказов очищен');
            return;
        }
        
        const keysToDelete = [];
        for (const key of orderCache.keys()) {
            if (key.includes(pattern)) {
                keysToDelete.push(key);
            }
        }
        keysToDelete.forEach(key => orderCache.delete(key));
    }

    // ===== СОЗДАНИЕ ЧАТА =====
    async function createChat(orderId, masterId, clientId, orderData) {
        try {
            if (!checkFirebase()) return { success: false, error: 'Firestore недоступен' };
            
            const chatId = `chat_${orderId}_${masterId}`;
            const chatRef = db.collection('chats').doc(chatId);
            
            const chatDoc = await chatRef.get();
            if (chatDoc.exists) return { success: true, chatId };
            
            await chatRef.set({
                participants: [clientId, masterId],
                orderId: orderId,
                orderTitle: orderData.title || 'Заказ',
                selectedPrice: orderData.selectedPrice || orderData.price,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastMessageAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastMessage: '✅ Мастер выбран! Чат открыт.',
                status: 'active',
                unreadCount: { 
                    [clientId]: 0, 
                    [masterId]: 1 
                }
            });
            
            await chatRef.collection('messages').add({
                senderId: 'system',
                senderName: 'Система',
                text: '✅ Мастер выбран! Теперь вы можете общаться.',
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                type: 'system',
                read: true
            });
            
            console.log('✅ Чат создан:', chatId);
            return { success: true, chatId };
            
        } catch (error) {
            console.error('❌ Ошибка создания чата:', error);
            return { success: false, error: error.message };
        }
    }

    // ===== СОЗДАНИЕ ЗАКАЗА =====
    async function create(orderData) {
        try {
            if (!checkFirebase()) return { success: false, error: 'Firestore недоступен' };
            if (!checkAuth()) return { success: false, error: 'Необходимо авторизоваться' };
            
            const user = getUserSafe();
            const userData = getUserDataSafe();
            
            if (!user || !userData) {
                return { success: false, error: 'Ошибка получения данных пользователя' };
            }

            if (!Auth.isClient()) {
                return { success: false, error: 'Только клиенты могут создавать заказы' };
            }

            // Валидация с использованием CONFIG
            const limits = CONFIG?.app?.limits || {
                maxTitleLength: 100,
                maxDescriptionLength: 1000,
                maxAddressLength: 200,
                minOrderPrice: 500,
                maxOrderPrice: 1000000,
                maxPhotosPerOrder: 5,
                maxPhotoSize: 10 * 1024 * 1024
            };

            if (!orderData.title || orderData.title.length < 5) {
                return { success: false, error: 'Название должно быть не менее 5 символов' };
            }
            if (orderData.title.length > limits.maxTitleLength) {
                return { success: false, error: `Название слишком длинное (макс ${limits.maxTitleLength} символов)` };
            }

            if (!orderData.category || orderData.category === 'all') {
                return { success: false, error: 'Выберите категорию' };
            }

            if (!Utils.validatePrice(orderData.price)) {
                return { success: false, error: `Цена должна быть от ${limits.minOrderPrice} до ${limits.maxOrderPrice} ₽` };
            }

            if (!orderData.address) {
                return { success: false, error: 'Укажите адрес' };
            }
            if (orderData.address.length > limits.maxAddressLength) {
                return { success: false, error: 'Адрес слишком длинный' };
            }

            if (orderData.description && orderData.description.length > limits.maxDescriptionLength) {
                return { success: false, error: `Описание слишком длинное (макс ${limits.maxDescriptionLength} символов)` };
            }

            // Модерация
            const titleMod = await checkModeration(orderData.title, 'order_title');
            if (!titleMod.isValid) {
                return { success: false, error: titleMod.reason || 'Название не прошло модерацию' };
            }

            if (orderData.description) {
                const descMod = await checkModeration(orderData.description, 'order_description');
                if (!descMod.isValid) {
                    return { success: false, error: descMod.reason || 'Описание не прошло модерацию' };
                }
            }

            // Загрузка фото
            const photoUrls = [];
            if (orderData.photos && orderData.photos.length > 0) {
                if (orderData.photos.length > limits.maxPhotosPerOrder) {
                    return { success: false, error: `Максимум ${limits.maxPhotosPerOrder} фото` };
                }

                for (const file of orderData.photos) {
                    try {
                        if (file.size > limits.maxPhotoSize) {
                            Utils.showWarning(`Файл ${file.name} слишком большой, пропущен`);
                            continue;
                        }

                        const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
                        const storageRef = storage.ref(`orders/${fileName}`);
                        
                        await storageRef.put(file);
                        const url = await storageRef.getDownloadURL();
                        photoUrls.push(url);
                    } catch (uploadError) {
                        console.error('Ошибка загрузки фото:', uploadError);
                        Utils.showWarning(`Не удалось загрузить ${file.name}`);
                    }
                }
            }

            const city = Utils.extractCity(orderData.address);

            const order = {
                category: orderData.category,
                title: orderData.title.trim(),
                description: orderData.description?.trim() || '',
                price: parseInt(orderData.price),
                address: orderData.address.trim(),
                city: city,
                photos: photoUrls,
                clientId: user.uid,
                clientName: userData.name || 'Клиент',
                clientPhone: userData.phone || '',
                clientRating: userData.rating || 0,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                status: ORDER_STATUS.OPEN,
                responses: [],
                views: 0,
                urgent: orderData.urgent || false
            };

            const docRef = await db.collection('orders').add(order);
            
            clearCache();
            
            Utils.showSuccess('✅ Заказ создан!');
            return { success: true, orderId: docRef.id };
            
        } catch (error) {
            console.error('❌ Ошибка создания заказа:', error);
            Utils.showError(error.message || 'Ошибка создания заказа');
            return { success: false, error: error.message };
        }
    }

    // ===== ПОЛУЧЕНИЕ ОТКРЫТЫХ ЗАКАЗОВ (ИСПРАВЛЕННАЯ ПАГИНАЦИЯ) =====
    async function getOpenOrders(filters = {}, options = {}) {
        try {
            if (!checkFirebase()) return { orders: [], lastDoc: null, hasMore: false };

            const limit = options.limit || CONFIG?.app?.pagination?.ordersPerPage || 20;
            const cacheKey = `open_orders_${JSON.stringify(filters)}_${limit}_${options.lastDoc?.id || ''}`;
            
            // Не используем кэш для пагинации, если есть lastDoc
            if (!options.lastDoc && !options.force) {
                const cached = getCache(cacheKey);
                if (cached) return cached;
            }

            let query = db.collection('orders')
                .where('status', '==', ORDER_STATUS.OPEN)
                .orderBy('createdAt', 'desc');

            if (filters.category && filters.category !== 'all') {
                query = query.where('category', '==', filters.category);
            }

            query = query.limit(limit);

            // ИСПРАВЛЕНО: правильная обработка lastDoc
            if (options.lastDoc) {
                if (options.lastDoc.id && options.lastDoc.exists === undefined) {
                    // Это просто объект с id, получаем DocumentSnapshot
                    const lastDocSnapshot = await db.collection('orders').doc(options.lastDoc.id).get();
                    if (lastDocSnapshot.exists) {
                        query = query.startAfter(lastDocSnapshot);
                    }
                } else if (options.lastDoc.id && typeof options.lastDoc.data === 'function') {
                    // Это DocumentSnapshot
                    query = query.startAfter(options.lastDoc);
                }
            }

            const snapshot = await query.get();
            
            let orders = [];
            let lastDoc = null;
            
            snapshot.forEach((doc, index) => {
                const data = doc.data();
                orders.push({ 
                    id: doc.id, 
                    ...data,
                    createdAt: data.createdAt?.toDate?.() || new Date()
                });
                
                if (index === snapshot.docs.length - 1) {
                    lastDoc = {
                        id: doc.id,
                        exists: true,
                        data: () => doc.data()
                    };
                }
            });

            // Фильтр по городу (на клиенте)
            if (filters.city && filters.city !== 'all') {
                const cityName = window.CITIES?.find(c => c.id === filters.city)?.name?.toLowerCase();
                if (cityName) {
                    orders = orders.filter(o => 
                        o.city === cityName || 
                        (o.address && o.address.toLowerCase().includes(cityName))
                    );
                }
            }

            // Фильтр по цене
            if (filters.minPrice) {
                orders = orders.filter(o => o.price >= filters.minPrice);
            }
            if (filters.maxPrice) {
                orders = orders.filter(o => o.price <= filters.maxPrice);
            }

            // Сортировка на клиенте
            if (filters.sort === 'price_asc') {
                orders.sort((a, b) => a.price - b.price);
            } else if (filters.sort === 'price_desc') {
                orders.sort((a, b) => b.price - a.price);
            }

            const result = {
                orders,
                lastDoc: lastDoc,
                hasMore: snapshot.docs.length === limit
            };
            
            // Кэшируем только если нет lastDoc (первая страница)
            if (!options.lastDoc) {
                setCache(cacheKey, result);
            }
            
            return result;
            
        } catch (error) {
            console.error('❌ Ошибка загрузки заказов:', error);
            return { orders: [], lastDoc: null, hasMore: false };
        }
    }

    // ===== ПОЛУЧЕНИЕ ЗАКАЗОВ КЛИЕНТА =====
    async function getClientOrders(clientId, filter = 'all', options = {}) {
        try {
            if (!checkFirebase()) return [];
            
            const cacheKey = `client_orders_${clientId}_${filter}_${options.limit || 50}`;
            const cached = getCache(cacheKey);
            if (cached && !options.force) return cached;
            
            let query = db.collection('orders')
                .where('clientId', '==', clientId)
                .orderBy('createdAt', 'desc');

            if (filter !== 'all' && ORDER_STATUS[filter.toUpperCase()]) {
                query = query.where('status', '==', filter);
            }

            if (options.limit) query = query.limit(options.limit);

            const snapshot = await query.get();
            
            let orders = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                orders.push({ 
                    id: doc.id, 
                    ...data,
                    createdAt: data.createdAt?.toDate?.() || new Date()
                });
            });
            
            setCache(cacheKey, orders);
            return orders;
            
        } catch (error) {
            console.error('❌ Ошибка загрузки заказов клиента:', error);
            return [];
        }
    }

    // ===== ПОЛУЧЕНИЕ ОТКЛИКОВ МАСТЕРА (ОПТИМИЗИРОВАНО) =====
    async function getMasterResponses(masterId, options = {}) {
        try {
            if (!checkFirebase()) return [];
            
            const cacheKey = `master_responses_${masterId}_${options.limit || 50}`;
            const cached = getCache(cacheKey);
            if (cached && !options.force) return cached;
            
            // Получаем все заказы, где есть отклики этого мастера
            // В идеале нужно создать отдельную коллекцию responses, но пока так
            const snapshot = await db.collection('orders')
                .orderBy('createdAt', 'desc')
                .limit(options.limit || 100)
                .get();
            
            const responses = [];
            
            for (const doc of snapshot.docs) {
                const order = doc.data();
                if (order.responses && Array.isArray(order.responses)) {
                    const myResponse = order.responses.find(r => r.masterId === masterId);
                    if (myResponse) {
                        responses.push({
                            orderId: doc.id,
                            order: { 
                                id: doc.id, 
                                ...order,
                                createdAt: order.createdAt?.toDate?.() || new Date()
                            },
                            response: {
                                ...myResponse,
                                createdAt: myResponse.createdAt?.toDate?.() || new Date()
                            },
                            status: order.status,
                            createdAt: order.createdAt?.toDate?.() || new Date()
                        });
                    }
                }
            }
            
            // Сортируем по дате создания
            responses.sort((a, b) => b.createdAt - a.createdAt);
            
            setCache(cacheKey, responses);
            return responses;
            
        } catch (error) {
            console.error('❌ Ошибка загрузки откликов:', error);
            return [];
        }
    }

    // ===== ОТКЛИК НА ЗАКАЗ (ИСПРАВЛЕНО) =====
async function respondToOrder(orderId, price, comment) {
    try {
        if (!checkFirebase()) return { success: false, error: 'Firestore недоступен' };
        if (!checkAuth()) return { success: false, error: 'Необходимо авторизоваться' };

        const user = getUserSafe();
        const userData = getUserDataSafe();

        if (!user || !userData) {
            return { success: false, error: 'Ошибка получения данных пользователя' };
        }

        if (!Auth.isMaster()) {
            return { success: false, error: 'Только мастера могут откликаться' };
        }

        // Антиспам
        const limits = CONFIG?.app?.limits || { responseCooldown: 5000 };
        const now = Date.now();
        const lastResponse = spamPrevention.get(user.uid) || 0;
        
        if (now - lastResponse < limits.responseCooldown) {
            const wait = Math.ceil((limits.responseCooldown - (now - lastResponse)) / 1000);
            return { success: false, error: `Подождите ${wait} сек. перед следующим откликом` };
        }
        
        spamPrevention.set(user.uid, now);
        setTimeout(() => spamPrevention.delete(user.uid), limits.responseCooldown);

        // Валидация
        const minPrice = CONFIG?.app?.limits?.minOrderPrice || 500;
        const maxPrice = CONFIG?.app?.limits?.maxOrderPrice || 1000000;
        const maxCommentLength = CONFIG?.app?.limits?.maxCommentLength || 500;

        if (!Utils.validatePrice(price)) {
            return { success: false, error: `Цена должна быть от ${minPrice} до ${maxPrice} ₽` };
        }

        if (comment && comment.length > maxCommentLength) {
            return { success: false, error: `Комментарий слишком длинный (макс ${maxCommentLength} символов)` };
        }

        if (comment) {
            const modResult = await checkModeration(comment, 'master_comment');
            if (!modResult.isValid) {
                return { success: false, error: modResult.reason || 'Комментарий не прошел модерацию' };
            }
        }

        const orderRef = db.collection('orders').doc(orderId);
        
        const result = await db.runTransaction(async (transaction) => {
            const orderDoc = await transaction.get(orderRef);
            
            if (!orderDoc.exists) {
                throw new Error('Заказ не найден');
            }
            
            const orderData = orderDoc.data();
            
            if (orderData.status !== ORDER_STATUS.OPEN) {
                throw new Error('Заказ уже неактивен');
            }
            
            if (orderData.clientId === user.uid) {
                throw new Error('Нельзя откликаться на свой заказ');
            }
            
            if (orderData.responses?.some(r => r.masterId === user.uid)) {
                throw new Error('Вы уже откликались на этот заказ');
            }

            // ИСПРАВЛЕНО: создаем объект без serverTimestamp()
            const response = {
                masterId: user.uid,
                masterName: userData.name || 'Мастер',
                masterPhone: userData.phone || '',
                masterRating: userData.rating || 0,
                masterReviews: userData.reviews || 0,
                price: parseInt(price),
                comment: comment?.trim() || '',
                createdAt: new Date().toISOString() // Используем ISO строку вместо serverTimestamp()
            };

            transaction.update(orderRef, {
                responses: firebase.firestore.FieldValue.arrayUnion(response)
            });

            return response;
        });

        clearCache();
        clearCache(`master_responses_${user.uid}`);

        Utils.showSuccess('✅ Отклик отправлен!');
        return { success: true };
        
    } catch (error) {
        console.error('❌ Ошибка отклика:', error);
        Utils.showError(error.message || 'Ошибка отклика');
        return { success: false, error: error.message };
    }
}

    // ===== ВЫБОР МАСТЕРА =====
    async function selectMaster(orderId, masterId, price) {
        try {
            if (!checkFirebase()) return { success: false, error: 'Firestore недоступен' };
            if (!checkAuth()) return { success: false, error: 'Необходимо авторизоваться' };

            const user = getUserSafe();
            if (!user) return { success: false, error: 'Ошибка получения данных пользователя' };
            
            const orderRef = db.collection('orders').doc(orderId);
            
            const result = await db.runTransaction(async (transaction) => {
                const orderDoc = await transaction.get(orderRef);
                if (!orderDoc.exists) throw new Error('Заказ не найден');
                
                const orderData = orderDoc.data();
                
                if (orderData.clientId !== user.uid) {
                    throw new Error('Вы не можете выбрать мастера для этого заказа');
                }
                if (orderData.status !== ORDER_STATUS.OPEN) {
                    throw new Error('Заказ уже неактивен');
                }
                
                const hasResponse = orderData.responses?.some(r => r.masterId === masterId);
                if (!hasResponse) throw new Error('Этот мастер не откликался на заказ');

                transaction.update(orderRef, {
                    status: ORDER_STATUS.IN_PROGRESS,
                    selectedMasterId: masterId,
                    selectedPrice: price,
                    selectedAt: firebase.firestore.FieldValue.serverTimestamp()
                });

                return orderData;
            });

            const chatResult = await createChat(orderId, masterId, user.uid, result);

            clearCache();

            Utils.showSuccess('✅ Мастер выбран!');
            return { success: true, chatId: chatResult.chatId, orderId };
            
        } catch (error) {
            console.error('❌ Ошибка выбора мастера:', error);
            Utils.showError(error.message || 'Ошибка выбора мастера');
            return { success: false, error: error.message };
        }
    }

    // ===== ИНИЦИАЛИЗАЦИЯ ЗАВЕРШЕНИЯ ЗАКАЗА (МАСТЕР) =====
    async function initiateCompletion(orderId, clientReview = null) {
        try {
            if (!checkFirebase()) return { success: false, error: 'Firestore недоступен' };
            if (!checkAuth()) return { success: false, error: 'Необходимо авторизоваться' };
            
            const user = getUserSafe();
            if (!user) return { success: false, error: 'Ошибка получения данных пользователя' };
            
            const orderRef = db.collection('orders').doc(orderId);
            
            const orderDoc = await orderRef.get();
            if (!orderDoc.exists) throw new Error('Заказ не найден');
            
            const orderData = orderDoc.data();
            
            // Проверяем, что мастер действительно назначен на этот заказ
            if (orderData.selectedMasterId !== user.uid) {
                throw new Error('Только назначенный мастер может завершить заказ');
            }
            
            // Проверяем статус
            if (orderData.status !== ORDER_STATUS.IN_PROGRESS) {
                throw new Error('Заказ не в работе');
            }

            // Если мастер оставляет отзыв о клиенте
            if (clientReview && clientReview.rating) {
                await orderRef.update({
                    status: ORDER_STATUS.AWAITING_CONFIRMATION,
                    masterCompletedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    masterReview: {
                        rating: clientReview.rating,
                        text: clientReview.text?.trim() || '',
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    }
                });
            } else {
                await orderRef.update({
                    status: ORDER_STATUS.AWAITING_CONFIRMATION,
                    masterCompletedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            }

            // Отправляем уведомление клиенту через чат
            try {
                const chatId = `chat_${orderId}_${orderData.selectedMasterId}`;
                const chatRef = db.collection('chats').doc(chatId);
                
                await chatRef.collection('messages').add({
                    senderId: 'system',
                    senderName: 'Система',
                    text: '🔔 Мастер отметил заказ как выполненный. Пожалуйста, подтвердите завершение.',
                    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                    type: 'system',
                    read: false
                });
                
                await chatRef.update({
                    lastMessage: '🔔 Ожидает подтверждения завершения',
                    lastMessageAt: firebase.firestore.FieldValue.serverTimestamp(),
                    [`unreadCount.${orderData.clientId}`]: firebase.firestore.FieldValue.increment(1)
                });
            } catch (chatError) {
                console.error('Ошибка уведомления в чате:', chatError);
            }

            clearCache();
            
            Utils.showSuccess('✅ Запрос на завершение отправлен клиенту');
            return { success: true, requiresConfirmation: true };
            
        } catch (error) {
            console.error('❌ Ошибка инициирования завершения:', error);
            Utils.showError(error.message || 'Ошибка');
            return { success: false, error: error.message };
        }
    }

    // ===== ПОДТВЕРЖДЕНИЕ ЗАВЕРШЕНИЯ ЗАКАЗА (КЛИЕНТ) =====
    async function confirmCompletion(orderId, clientReview = null) {
        try {
            if (!checkFirebase()) return { success: false, error: 'Firestore недоступен' };
            if (!checkAuth()) return { success: false, error: 'Необходимо авторизоваться' };
            
            const user = getUserSafe();
            if (!user) return { success: false, error: 'Ошибка получения данных пользователя' };
            
            const orderRef = db.collection('orders').doc(orderId);
            
            const result = await db.runTransaction(async (transaction) => {
                const orderDoc = await transaction.get(orderRef);
                if (!orderDoc.exists) throw new Error('Заказ не найден');
                
                const orderData = orderDoc.data();
                
                // Проверяем, что клиент владелец заказа
                if (orderData.clientId !== user.uid) {
                    throw new Error('Только клиент может подтвердить завершение');
                }
                
                // Проверяем статус
                if (orderData.status !== ORDER_STATUS.AWAITING_CONFIRMATION) {
                    throw new Error('Заказ не ожидает подтверждения');
                }

                const updates = {
                    status: ORDER_STATUS.COMPLETED,
                    completedAt: firebase.firestore.FieldValue.serverTimestamp()
                };

                // Если клиент оставляет отзыв о мастере
                if (clientReview && clientReview.rating) {
                    updates.clientReview = {
                        rating: clientReview.rating,
                        text: clientReview.text?.trim() || '',
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    };
                    
                    // Обновляем рейтинг мастера
                    const masterRef = db.collection('users').doc(orderData.selectedMasterId);
                    const masterDoc = await transaction.get(masterRef);
                    
                    if (masterDoc.exists) {
                        const masterData = masterDoc.data();
                        const currentRating = masterData.rating || 0;
                        const currentReviews = masterData.reviews || 0;
                        const newRating = ((currentRating * currentReviews) + clientReview.rating) / (currentReviews + 1);
                        
                        transaction.update(masterRef, {
                            rating: newRating,
                            reviews: currentReviews + 1
                        });
                    }
                }

                transaction.update(orderRef, updates);
                
                return orderData;
            });

            // Блокируем чат
            try {
                const orderData = result;
                if (orderData && orderData.selectedMasterId) {
                    const chatId = `chat_${orderId}_${orderData.selectedMasterId}`;
                    await db.collection('chats').doc(chatId).update({
                        status: 'completed',
                        lastMessage: '✅ Заказ выполнен. Чат закрыт.'
                    });
                }
            } catch (chatError) {
                console.error('Ошибка блокировки чата:', chatError);
            }

            clearCache();

            Utils.showSuccess('✅ Заказ выполнен! Спасибо за отзыв!');
            return { success: true };
            
        } catch (error) {
            console.error('❌ Ошибка подтверждения завершения:', error);
            Utils.showError(error.message || 'Ошибка');
            return { success: false, error: error.message };
        }
    }

    // ===== ПОЛУЧЕНИЕ СТАТИСТИКИ МАСТЕРА =====
    async function getMasterStats(masterId) {
        try {
            const cacheKey = `master_stats_${masterId}`;
            const cached = getCache(cacheKey);
            if (cached) return cached;
            
            const responses = await getMasterResponses(masterId);
            
            const total = responses.length;
            const accepted = responses.filter(r => 
                r.status === ORDER_STATUS.IN_PROGRESS || 
                r.status === ORDER_STATUS.COMPLETED ||
                r.status === ORDER_STATUS.AWAITING_CONFIRMATION
            ).length;
            const completed = responses.filter(r => 
                r.status === ORDER_STATUS.COMPLETED
            ).length;
            const awaiting = responses.filter(r => 
                r.status === ORDER_STATUS.AWAITING_CONFIRMATION
            ).length;
            
            const totalEarnings = responses
                .filter(r => r.status === ORDER_STATUS.COMPLETED)
                .reduce((sum, r) => sum + (r.response.price || 0), 0);
            
            const stats = { 
                total,
                accepted,
                completed,
                awaiting,
                conversion: total > 0 ? Math.round((accepted / total) * 100) : 0,
                earnings: totalEarnings
            };
            
            setCache(cacheKey, stats);
            return stats;
            
        } catch (error) {
            console.error('Ошибка получения статистики:', error);
            return { total: 0, accepted: 0, completed: 0, awaiting: 0, conversion: 0, earnings: 0 };
        }
    }

    // ===== ПОЛУЧЕНИЕ ЗАКАЗА ПО ID =====
    async function getOrderById(orderId, force = false) {
        try {
            if (!checkFirebase()) return null;
            
            const cacheKey = `order_${orderId}`;
            if (!force) {
                const cached = getCache(cacheKey);
                if (cached) return cached;
            }
            
            const doc = await db.collection('orders').doc(orderId).get();
            if (!doc.exists) return null;
            
            const data = doc.data();
            const order = { 
                id: doc.id, 
                ...data,
                createdAt: data.createdAt?.toDate?.() || new Date()
            };
            
            setCache(cacheKey, order);
            return order;
            
        } catch (error) {
            console.error('Ошибка получения заказа:', error);
            return null;
        }
    }

    // ===== УВЕЛИЧЕНИЕ ПРОСМОТРОВ =====
    async function incrementViews(orderId) {
        try {
            await db.collection('orders').doc(orderId).update({
                views: firebase.firestore.FieldValue.increment(1)
            });
        } catch (error) {
            console.error('Ошибка увеличения просмотров:', error);
        }
    }

    // ===== ПОДПИСКА НА ЗАКАЗЫ =====
    function subscribeToOrders(callback, filters = {}) {
        if (!checkFirebase()) return null;

        let query = db.collection('orders')
            .where('status', '==', ORDER_STATUS.OPEN)
            .orderBy('createdAt', 'desc')
            .limit(50);

        if (filters.category && filters.category !== 'all') {
            query = query.where('category', '==', filters.category);
        }

        const unsubscribe = query.onSnapshot((snapshot) => {
            const orders = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                orders.push({ 
                    id: doc.id, 
                    ...data,
                    createdAt: data.createdAt?.toDate?.() || new Date()
                });
            });
            
            let filtered = orders;
            
            if (filters.city && filters.city !== 'all') {
                const cityName = window.CITIES?.find(c => c.id === filters.city)?.name?.toLowerCase();
                if (cityName) {
                    filtered = filtered.filter(o => 
                        o.city === cityName || 
                        (o.address && o.address.toLowerCase().includes(cityName))
                    );
                }
            }

            callback(filtered);
            
            clearCache('open_orders');
        }, (error) => {
            console.error('Ошибка подписки на заказы:', error);
            callback([]);
        });

        const subId = `orders_${Date.now()}`;
        activeListeners.set(subId, unsubscribe);
        
        return () => {
            unsubscribe();
            activeListeners.delete(subId);
        };
    }

    // ===== ОЧИСТКА =====
    function cleanup() {
        activeListeners.forEach((unsubscribe, id) => {
            try { unsubscribe(); } 
            catch (error) { console.error(`Ошибка отписки ${id}:`, error); }
        });
        activeListeners.clear();
        clearCache();
        spamPrevention.clear();
        console.log('🧹 Orders service cleaned up');
    }

    // ===== ПУБЛИЧНОЕ API =====
    const api = {
        create,
        getOpenOrders,
        getClientOrders,
        getMasterResponses,
        respondToOrder,
        selectMaster,
        initiateCompletion,
        confirmCompletion,
        getMasterStats,
        getOrderById,
        incrementViews,
        subscribeToOrders,
        cleanup,
        ORDER_STATUS
    };

    window.__ORDERS_INITIALIZED__ = true;
    console.log('✅ Orders сервис загружен (с двухэтапным завершением)');
    
    return Object.freeze(api);
})();

window.Orders = Orders;