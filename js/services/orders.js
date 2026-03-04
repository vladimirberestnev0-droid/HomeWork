// ============================================
// СЕРВИС ЗАКАЗОВ
// ============================================

const Orders = (function() {
    // Защита от повторных инициализаций
    if (window.__ORDERS_INITIALIZED__) {
        return window.Orders;
    }

    // ===== ПРИВАТНЫЕ ПЕРЕМЕННЫЕ =====
    const spamPrevention = new Map();
    const orderCache = new Map();
    const CACHE_TTL = 5 * 60 * 1000; // 5 минут
    let activeListeners = [];

    // ===== ПРОВЕРКИ =====
    function checkFirebase() {
        if (!window.db || !window.storage) {
            console.warn('⏳ Firebase не инициализирован');
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

    async function checkModeration(text, context) {
        if (window.Moderation) {
            return Moderation.check(text, context);
        }
        return { isValid: true };
    }

    // ===== РАБОТА С КЕШЕМ =====
    function setCache(key, data) {
        orderCache.set(key, {
            data,
            timestamp: Date.now()
        });
    }

    function getCache(key) {
        const cached = orderCache.get(key);
        if (!cached) return null;
        if (Date.now() - cached.timestamp > CACHE_TTL) {
            orderCache.delete(key);
            return null;
        }
        return cached.data;
    }

    function clearCache() {
        orderCache.clear();
    }

    // ===== СОЗДАНИЕ ЧАТА =====
    async function createChat(orderId, masterId, clientId, orderData) {
        try {
            if (!checkFirebase()) return { success: false, error: 'Firestore недоступен' };
            
            const chatId = `chat_${orderId}_${masterId}`;
            const chatRef = db.collection('chats').doc(chatId);
            
            // Проверяем существование
            const chatDoc = await chatRef.get();
            if (chatDoc.exists) {
                return { success: true, chatId };
            }
            
            // Создаём чат
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
            
            // Системное сообщение
            await chatRef.collection('messages').add({
                senderId: 'system',
                senderName: 'Система',
                text: '✅ Мастер выбран! Теперь вы можете общаться.',
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                type: 'system'
            });
            
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
            
            const user = Auth.getUser();
            const userData = Auth.getUserData();

            if (!Auth.isClient()) {
                return { success: false, error: 'Только клиенты могут создавать заказы' };
            }

            // Валидация
            if (!orderData.title || orderData.title.length < 5) {
                return { success: false, error: 'Название должно быть не менее 5 символов' };
            }
            if (orderData.title.length > 100) {
                return { success: false, error: 'Название слишком длинное (макс 100 символов)' };
            }

            if (!orderData.category || orderData.category === 'all') {
                return { success: false, error: 'Выберите категорию' };
            }

            if (!Utils.validatePrice(orderData.price)) {
                return { success: false, error: `Цена должна быть от ${CONFIG.app.limits.minOrderPrice} до ${CONFIG.app.limits.maxOrderPrice} ₽` };
            }

            if (!orderData.address) {
                return { success: false, error: 'Укажите адрес' };
            }
            if (orderData.address.length > 200) {
                return { success: false, error: 'Адрес слишком длинный' };
            }

            if (orderData.description && orderData.description.length > 1000) {
                return { success: false, error: 'Описание слишком длинное (макс 1000 символов)' };
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

            // Загружаем фото
            const photoUrls = [];
            if (orderData.photos && orderData.photos.length > 0) {
                if (orderData.photos.length > CONFIG.app.limits.maxPhotosPerOrder) {
                    return { success: false, error: `Максимум ${CONFIG.app.limits.maxPhotosPerOrder} фото` };
                }

                for (const file of orderData.photos) {
                    try {
                        if (file.size > CONFIG.app.limits.maxPhotoSize) {
                            Utils.showWarning(`Файл ${file.name} слишком большой, пропущен`);
                            continue;
                        }

                        const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
                        const storageRef = storage.ref(`orders/${fileName}`);
                        
                        // Прогресс загрузки
                        const task = storageRef.put(file);
                        
                        task.on('state_changed', (snapshot) => {
                            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                            console.log(`Загрузка ${file.name}: ${progress.toFixed(0)}%`);
                        });

                        await task;
                        const url = await storageRef.getDownloadURL();
                        photoUrls.push(url);
                    } catch (uploadError) {
                        console.error('Ошибка загрузки фото:', uploadError);
                        Utils.showWarning(`Не удалось загрузить ${file.name}`);
                    }
                }
            }

            // Извлекаем город
            const city = Utils.extractCity(orderData.address);

            // Создаём заказ
            const order = {
                category: orderData.category,
                title: orderData.title.trim(),
                description: orderData.description?.trim() || '',
                price: parseInt(orderData.price),
                address: orderData.address.trim(),
                city: city,
                photos: photoUrls,
                clientId: user.uid,
                clientName: userData?.name || 'Клиент',
                clientPhone: userData?.phone || '',
                clientRating: userData?.rating || 0,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                status: ORDER_STATUS.OPEN,
                responses: [],
                views: 0,
                urgent: orderData.urgent || false
            };

            const docRef = await db.collection('orders').add(order);
            
            // Очищаем кеш
            clearCache();
            
            Utils.showSuccess('✅ Заказ создан!');
            return { success: true, orderId: docRef.id };
            
        } catch (error) {
            console.error('❌ Ошибка создания заказа:', error);
            Utils.showError(error.message || 'Ошибка создания заказа');
            return { success: false, error: error.message };
        }
    }

    // ===== ПОЛУЧЕНИЕ ОТКРЫТЫХ ЗАКАЗОВ =====
    async function getOpenOrders(filters = {}, options = {}) {
        try {
            if (!checkFirebase()) return [];

            const cacheKey = `open_${JSON.stringify(filters)}_${options.limit || 20}`;
            const cached = getCache(cacheKey);
            if (cached && !options.force) return cached;

            let query = db.collection('orders')
                .where('status', '==', ORDER_STATUS.OPEN)
                .orderBy('createdAt', 'desc');

            if (filters.category && filters.category !== 'all') {
                query = query.where('category', '==', filters.category);
            }

            if (options.limit) {
                query = query.limit(options.limit);
            }

            const snapshot = await query.get();
            
            let orders = [];
            snapshot.forEach(doc => {
                orders.push({ id: doc.id, ...doc.data() });
            });

            // Фильтр по городу
            if (filters.city && filters.city !== 'all') {
                const cityName = CITIES.find(c => c.id === filters.city)?.name?.toLowerCase();
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

            // Сортировка
            if (filters.sort === 'price_asc') {
                orders.sort((a, b) => a.price - b.price);
            } else if (filters.sort === 'price_desc') {
                orders.sort((a, b) => b.price - a.price);
            }

            setCache(cacheKey, orders);
            return orders;
            
        } catch (error) {
            console.error('❌ Ошибка загрузки заказов:', error);
            return [];
        }
    }

    // ===== ПОЛУЧЕНИЕ ЗАКАЗОВ КЛИЕНТА =====
    async function getClientOrders(clientId, filter = 'all', options = {}) {
        try {
            if (!checkFirebase()) return [];
            
            let query = db.collection('orders')
                .where('clientId', '==', clientId)
                .orderBy('createdAt', 'desc');

            if (filter !== 'all' && ORDER_STATUS.isValid(filter)) {
                query = query.where('status', '==', filter);
            }

            if (options.limit) {
                query = query.limit(options.limit);
            }

            const snapshot = await query.get();
            
            let orders = [];
            snapshot.forEach(doc => {
                orders.push({ id: doc.id, ...doc.data() });
            });
            
            return orders;
            
        } catch (error) {
            console.error('❌ Ошибка загрузки заказов клиента:', error);
            return [];
        }
    }

    // ===== ПОЛУЧЕНИЕ ОТКЛИКОВ МАСТЕРА =====
    async function getMasterResponses(masterId, options = {}) {
        try {
            if (!checkFirebase()) return [];
            
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
                            order: { id: doc.id, ...order },
                            response: myResponse,
                            status: order.status,
                            createdAt: order.createdAt
                        });
                    }
                }
            }
            
            // Сортировка по дате создания отклика
            responses.sort((a, b) => {
                const dateA = a.response.createdAt?.toDate?.() || new Date(0);
                const dateB = b.response.createdAt?.toDate?.() || new Date(0);
                return dateB - dateA;
            });
            
            return responses;
            
        } catch (error) {
            console.error('❌ Ошибка загрузки откликов:', error);
            return [];
        }
    }

    // ===== ОТКЛИК НА ЗАКАЗ =====
    async function respondToOrder(orderId, price, comment) {
        try {
            if (!checkFirebase()) return { success: false, error: 'Firestore недоступен' };
            if (!checkAuth()) return { success: false, error: 'Необходимо авторизоваться' };

            const user = Auth.getUser();
            const userData = Auth.getUserData();

            if (!Auth.isMaster()) {
                return { success: false, error: 'Только мастера могут откликаться' };
            }

            // Антиспам
            const now = Date.now();
            const lastResponse = spamPrevention.get(user.uid) || 0;
            if (now - lastResponse < CONFIG.app.limits.responseCooldown) {
                const wait = Math.ceil((CONFIG.app.limits.responseCooldown - (now - lastResponse)) / 1000);
                return { success: false, error: `Подождите ${wait} сек. перед следующим откликом` };
            }
            spamPrevention.set(user.uid, now);
            setTimeout(() => spamPrevention.delete(user.uid), CONFIG.app.limits.responseCooldown);

            // Валидация
            if (!Utils.validatePrice(price)) {
                return { success: false, error: `Цена должна быть от ${CONFIG.app.limits.minOrderPrice} до ${CONFIG.app.limits.maxOrderPrice} ₽` };
            }

            if (comment && comment.length > 500) {
                return { success: false, error: 'Комментарий слишком длинный (макс 500 символов)' };
            }

            if (comment) {
                const modResult = await checkModeration(comment, 'master_comment');
                if (!modResult.isValid) {
                    return { success: false, error: modResult.reason || 'Комментарий не прошел модерацию' };
                }
            }

            // Получаем заказ
            const orderDoc = await db.collection('orders').doc(orderId).get();
            if (!orderDoc.exists) {
                return { success: false, error: 'Заказ не найден' };
            }
            
            const orderData = orderDoc.data();
            
            // Проверки
            if (orderData.status !== ORDER_STATUS.OPEN) {
                return { success: false, error: 'Заказ уже неактивен' };
            }
            
            if (orderData.clientId === user.uid) {
                return { success: false, error: 'Нельзя откликаться на свой заказ' };
            }
            
            if (orderData.responses?.some(r => r.masterId === user.uid)) {
                return { success: false, error: 'Вы уже откликались на этот заказ' };
            }

            // Создаём отклик
            const response = {
                masterId: user.uid,
                masterName: userData?.name || 'Мастер',
                masterPhone: userData?.phone || '',
                masterRating: userData?.rating || 0,
                masterReviews: userData?.reviews || 0,
                price: parseInt(price),
                comment: comment?.trim() || '',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            await db.collection('orders').doc(orderId).update({
                responses: firebase.firestore.FieldValue.arrayUnion(response)
            });

            // Очищаем кеш
            clearCache();

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

            const user = Auth.getUser();
            
            const orderDoc = await db.collection('orders').doc(orderId).get();
            if (!orderDoc.exists) {
                return { success: false, error: 'Заказ не найден' };
            }
            
            const orderData = orderDoc.data();
            
            // Проверки
            if (orderData.clientId !== user.uid) {
                return { success: false, error: 'Вы не можете выбрать мастера для этого заказа' };
            }
            
            if (orderData.status !== ORDER_STATUS.OPEN) {
                return { success: false, error: 'Заказ уже неактивен' };
            }
            
            const hasResponse = orderData.responses?.some(r => r.masterId === masterId);
            if (!hasResponse) {
                return { success: false, error: 'Этот мастер не откликался на заказ' };
            }

            // Обновляем заказ
            await db.collection('orders').doc(orderId).update({
                status: ORDER_STATUS.IN_PROGRESS,
                selectedMasterId: masterId,
                selectedPrice: price,
                selectedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // Создаём чат
            const chatResult = await createChat(orderId, masterId, user.uid, orderData);

            // Очищаем кеш
            clearCache();

            Utils.showSuccess('✅ Мастер выбран!');
            return { 
                success: true, 
                chatId: chatResult.chatId,
                orderId: orderId 
            };
            
        } catch (error) {
            console.error('❌ Ошибка выбора мастера:', error);
            Utils.showError(error.message || 'Ошибка выбора мастера');
            return { success: false, error: error.message };
        }
    }

    // ===== ЗАВЕРШЕНИЕ ЗАКАЗА =====
    async function completeOrder(orderId, clientReview = null) {
        try {
            if (!checkFirebase()) return { success: false, error: 'Firestore недоступен' };
            if (!checkAuth()) return { success: false, error: 'Необходимо авторизоваться' };
            
            const orderDoc = await db.collection('orders').doc(orderId).get();
            if (!orderDoc.exists) {
                return { success: false, error: 'Заказ не найден' };
            }
            
            const orderData = orderDoc.data();
            const user = Auth.getUser();
            
            // Проверяем, что завершает мастер
            if (orderData.selectedMasterId !== user.uid) {
                return { success: false, error: 'Только мастер может завершить заказ' };
            }

            // Если мастер оставил отзыв о клиенте
            if (clientReview && clientReview.rating) {
                await db.collection('orders').doc(orderId).update({
                    clientReviews: firebase.firestore.FieldValue.arrayUnion({
                        masterId: user.uid,
                        masterName: Auth.getUserData()?.name || 'Мастер',
                        rating: clientReview.rating,
                        text: clientReview.text?.trim() || '',
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    })
                });

                // Обновляем рейтинг клиента
                try {
                    const clientDoc = await db.collection('users').doc(orderData.clientId).get();
                    if (clientDoc.exists) {
                        const clientData = clientDoc.data();
                        const currentRating = clientData.rating || 0;
                        const currentReviews = clientData.reviews || 0;
                        const newRating = ((currentRating * currentReviews) + clientReview.rating) / (currentReviews + 1);
                        
                        await db.collection('users').doc(orderData.clientId).update({
                            rating: newRating,
                            reviews: currentReviews + 1
                        });
                    }
                } catch (clientError) {
                    console.error('Ошибка обновления рейтинга клиента:', clientError);
                }
            }

            // Обновляем статус заказа
            await db.collection('orders').doc(orderId).update({
                status: ORDER_STATUS.COMPLETED,
                completedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // Блокируем чат
            try {
                const chatId = `chat_${orderId}_${orderData.selectedMasterId}`;
                await db.collection('chats').doc(chatId).update({
                    status: 'completed',
                    lastMessage: '✅ Заказ выполнен. Чат закрыт.'
                });
            } catch (chatError) {
                console.error('Ошибка блокировки чата:', chatError);
            }

            // Очищаем кеш
            clearCache();

            Utils.showSuccess('✅ Заказ выполнен!');
            return { success: true };
            
        } catch (error) {
            console.error('❌ Ошибка завершения заказа:', error);
            Utils.showError(error.message || 'Ошибка завершения');
            return { success: false, error: error.message };
        }
    }

    // ===== ПОЛУЧЕНИЕ СТАТИСТИКИ МАСТЕРА =====
    async function getMasterStats(masterId) {
        try {
            const responses = await getMasterResponses(masterId);
            
            const total = responses.length;
            const accepted = responses.filter(r => 
                r.status === ORDER_STATUS.IN_PROGRESS || 
                r.status === ORDER_STATUS.COMPLETED
            ).length;
            const completed = responses.filter(r => 
                r.status === ORDER_STATUS.COMPLETED
            ).length;
            
            const totalEarnings = responses
                .filter(r => r.status === ORDER_STATUS.COMPLETED)
                .reduce((sum, r) => sum + (r.response.price || 0), 0);
            
            return { 
                total,
                accepted,
                completed,
                conversion: total > 0 ? Math.round((accepted / total) * 100) : 0,
                earnings: totalEarnings
            };
        } catch (error) {
            console.error('Ошибка получения статистики:', error);
            return { total: 0, accepted: 0, completed: 0, conversion: 0, earnings: 0 };
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
            
            const order = { id: doc.id, ...doc.data() };
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
                orders.push({ id: doc.id, ...doc.data() });
            });
            
            // Применяем фильтры на клиенте
            let filtered = orders;
            
            if (filters.city && filters.city !== 'all') {
                const cityName = CITIES.find(c => c.id === filters.city)?.name?.toLowerCase();
                if (cityName) {
                    filtered = filtered.filter(o => 
                        o.city === cityName || 
                        (o.address && o.address.toLowerCase().includes(cityName))
                    );
                }
            }

            callback(filtered);
        }, (error) => {
            console.error('Ошибка подписки на заказы:', error);
            callback([]);
        });

        activeListeners.push(unsubscribe);
        return unsubscribe;
    }

    // ===== ОЧИСТКА =====
    function cleanup() {
        activeListeners.forEach(unsubscribe => {
            if (typeof unsubscribe === 'function') {
                unsubscribe();
            }
        });
        activeListeners = [];
        clearCache();
    }

    // ===== ПУБЛИЧНОЕ API =====
    const api = {
        create,
        getOpenOrders,
        getClientOrders,
        getMasterResponses,
        respondToOrder,
        selectMaster,
        completeOrder,
        getMasterStats,
        getOrderById,
        incrementViews,
        subscribeToOrders,
        cleanup,
        ORDER_STATUS
    };

    window.__ORDERS_INITIALIZED__ = true;
    console.log('✅ Orders сервис загружен');
    
    return Object.freeze(api);
})();

// Глобальный доступ
window.Orders = Orders;