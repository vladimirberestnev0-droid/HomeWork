// ===== js/services/orders.js =====
// РАБОТА С ЗАКАЗАМИ (УЛУЧШЕННАЯ ВЕРСИЯ)

const Orders = (function() {
    // Кэш заказов
    const cache = new Map();
    let listeners = [];

    // Создание заказа
    async function create(orderData) {
        try {
            // Валидация
            if (!Auth.isAuthenticated()) {
                throw new Error('Необходимо авторизоваться');
            }

            if (!Auth.isClient()) {
                throw new Error('Только клиенты могут создавать заказы');
            }

            if (!orderData.title || orderData.title.length < 5) {
                throw new Error('Название должно быть не менее 5 символов');
            }

            if (!orderData.category) {
                throw new Error('Выберите категорию');
            }

            if (!Helpers.validatePrice(orderData.price)) {
                throw new Error('Цена должна быть от 500 до 1 000 000 ₽');
            }

            if (!orderData.address) {
                throw new Error('Укажите адрес');
            }

            // Проверка модерации
            const modResult = await Moderation.moderateOrder(orderData);
            if (!modResult.isValid) {
                throw new Error(modResult.violations[0]?.reason || 'Текст не прошел модерацию');
            }

            // Подготовка данных
            const order = {
                category: orderData.category,
                title: orderData.title,
                description: orderData.description || '',
                price: parseInt(orderData.price),
                address: orderData.address,
                latitude: orderData.latitude || 55.7558,
                longitude: orderData.longitude || 37.6173,
                photos: orderData.photos || [],
                clientName: orderData.clientName,
                clientPhone: orderData.clientPhone,
                clientId: Auth.getUser().uid,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                status: ORDER_STATUS.OPEN,
                responses: [],
                views: 0
            };

            // Сохраняем
            const docRef = await db.collection('orders').add(order);
            
            // Отправляем уведомления мастерам
            await notifyMasters(docRef.id, order);
            
            // Очищаем кэш
            clearCache();
            
            Helpers.showNotification('✅ Заказ создан!', 'success');
            
            return { success: true, orderId: docRef.id };
            
        } catch (error) {
            console.error('Ошибка создания заказа:', error);
            Helpers.showNotification(`❌ ${error.message}`, 'error');
            return { success: false, error: error.message };
        }
    }

    // Уведомление мастеров
    async function notifyMasters(orderId, order) {
        try {
            const mastersSnapshot = await db.collection('users')
                .where('role', '==', USER_ROLE.MASTER)
                .where('banned', '==', false)
                .get();

            const batch = db.batch();
            let count = 0;
            
            mastersSnapshot.forEach(doc => {
                const master = doc.data();
                const masterCategories = (master.categories || '').split(',').map(c => c.trim());
                
                if (masterCategories.length === 0 || masterCategories.includes(order.category)) {
                    const notifRef = db.collection('notifications').doc();
                    batch.set(notifRef, {
                        masterId: doc.id,
                        orderId: orderId,
                        type: 'new_order',
                        title: 'Новый заказ',
                        body: `${order.category}: ${order.title}`,
                        read: false,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    count++;
                }
            });

            if (count > 0) {
                await batch.commit();
                console.log(`📨 Отправлено ${count} уведомлений мастерам`);
            }
            
        } catch (error) {
            console.error('Ошибка отправки уведомлений:', error);
        }
    }

    // Получение открытых заказов (с кэшированием)
    async function getOpenOrders(filters = {}) {
        try {
            const cacheKey = `open_orders_${filters.category || 'all'}`;
            
            // Проверяем кэш
            if (cache.has(cacheKey)) {
                const cached = cache.get(cacheKey);
                if (Date.now() - cached.timestamp < 300000) { // 5 минут
                    console.log('📦 Загружено из кэша:', cacheKey);
                    return cached.data;
                }
            }

            let query = db.collection('orders')
                .where('status', '==', ORDER_STATUS.OPEN)
                .orderBy('createdAt', 'desc')
                .limit(PAGINATION.ORDERS_PER_PAGE);

            if (filters.category && filters.category !== 'all') {
                query = query.where('category', '==', filters.category);
            }

            if (filters.minPrice) {
                query = query.where('price', '>=', parseInt(filters.minPrice));
            }
            if (filters.maxPrice) {
                query = query.where('price', '<=', parseInt(filters.maxPrice));
            }

            const snapshot = await query.get();
            
            const orders = [];
            snapshot.forEach(doc => {
                orders.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            // Сохраняем в кэш
            cache.set(cacheKey, {
                data: orders,
                timestamp: Date.now()
            });

            console.log(`📦 Загружено ${orders.length} открытых заказов`);
            return orders;
            
        } catch (error) {
            console.error('Ошибка загрузки заказов:', error);
            Helpers.showNotification('❌ Ошибка загрузки заказов', 'error');
            return [];
        }
    }

    // Получение заказов клиента
    async function getClientOrders(clientId, filter = 'all') {
        try {
            let query = db.collection('orders')
                .where('clientId', '==', clientId)
                .orderBy('createdAt', 'desc');

            if (filter !== 'all') {
                query = query.where('status', '==', filter);
            }

            const snapshot = await query.get();
            
            const orders = [];
            snapshot.forEach(doc => {
                orders.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            return orders;
            
        } catch (error) {
            console.error('Ошибка загрузки заказов клиента:', error);
            return [];
        }
    }

    // Получение откликов мастера
    async function getMasterResponses(masterId) {
        try {
            console.log('🔍 Загружаем отклики для мастера:', masterId);
            
            const snapshot = await db.collection('orders').get();

            const responses = [];
            
            snapshot.forEach(doc => {
                const order = doc.data();
                
                if (order.responses && Array.isArray(order.responses)) {
                    const myResponse = order.responses.find(r => r.masterId === masterId);
                    if (myResponse) {
                        responses.push({
                            orderId: doc.id,
                            order: order,
                            response: myResponse,
                            status: order.status
                        });
                    }
                }
            });

            console.log(`📊 Загружено ${responses.length} откликов`);
            return responses;
            
        } catch (error) {
            console.error('❌ Ошибка загрузки откликов:', error);
            return [];
        }
    }

    // ✅ ИСПРАВЛЕННЫЙ ОТКЛИК НА ЗАКАЗ
    async function respondToOrder(orderId, price, comment) {
        try {
            if (!Auth.isAuthenticated()) {
                throw new Error('Необходимо авторизоваться');
            }

            if (!Auth.isMaster()) {
                throw new Error('Только мастера могут откликаться');
            }

            if (!Helpers.validatePrice(price)) {
                throw new Error('Цена должна быть от 500 до 1 000 000 ₽');
            }

            // Проверка модерации
            if (comment) {
                const modResult = Moderation.check(comment, 'master_comment');
                if (!modResult.isValid) {
                    throw new Error(modResult.reason || 'Комментарий не прошел модерацию');
                }
            }

            const user = Auth.getUser();
            const userData = Auth.getUserData();

            const orderDoc = await db.collection('orders').doc(orderId).get();
            if (!orderDoc.exists) {
                throw new Error('Заказ не найден');
            }
            const orderData = orderDoc.data();
            const clientId = orderData.clientId;

            // ✅ ИСПРАВЛЕНО: используем обычную дату вместо serverTimestamp()
            const response = {
                masterId: user.uid,
                masterName: userData?.name || 'Мастер',
                masterPhone: userData?.phone || '',
                masterRating: userData?.rating || 0,
                masterReviews: userData?.reviews || 0,
                price: parseInt(price),
                comment: comment || '',
                createdAt: new Date().toISOString() // ✅ Обычная дата, строка
            };

            await db.collection('orders').doc(orderId).update({
                responses: firebase.firestore.FieldValue.arrayUnion(response)
            });

            // Создаем чат
            try {
                await Chats.create(orderId, user.uid, clientId);
            } catch (chatError) {
                console.error('❌ Ошибка создания чата:', chatError);
            }

            // Обновляем статистику
            await db.collection('users').doc(user.uid).update({
                totalResponses: firebase.firestore.FieldValue.increment(1)
            });

            // Очищаем кэш
            clearCache();

            Helpers.showNotification('✅ Отклик отправлен!', 'success');
            
            return { success: true };
            
        } catch (error) {
            console.error('Ошибка отклика:', error);
            Helpers.showNotification(`❌ ${error.message}`, 'error');
            return { success: false, error: error.message };
        }
    }

    // Выбор мастера
    async function selectMaster(orderId, masterId, price) {
        try {
            const orderDoc = await db.collection('orders').doc(orderId).get();
            
            if (!orderDoc.exists) {
                throw new Error('Заказ не найден');
            }

            const orderData = orderDoc.data();
            
            if (orderData.clientId !== Auth.getUser()?.uid) {
                throw new Error('Вы не можете выбрать мастера для этого заказа');
            }

            await db.collection('orders').doc(orderId).update({
                status: ORDER_STATUS.IN_PROGRESS,
                selectedMasterId: masterId,
                selectedPrice: price,
                selectedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // Уведомление мастеру
            await db.collection('notifications').add({
                masterId: masterId,
                orderId: orderId,
                type: 'master_selected',
                title: 'Вас выбрали!',
                body: 'Клиент выбрал вас для выполнения заказа',
                read: false,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            clearCache();

            Helpers.showNotification('✅ Мастер выбран!', 'success');
            
            return { success: true };
            
        } catch (error) {
            console.error('Ошибка выбора мастера:', error);
            Helpers.showNotification(`❌ ${error.message}`, 'error');
            return { success: false, error: error.message };
        }
    }

    // Завершение заказа
    async function completeOrder(orderId) {
        try {
            console.log('🔄 Начинаем завершение заказа:', orderId);
            
            const orderDoc = await db.collection('orders').doc(orderId).get();
            
            if (!orderDoc.exists) {
                throw new Error('Заказ не найден');
            }

            const orderData = orderDoc.data();
            const user = Auth.getUser();
            
            if (!user) {
                throw new Error('Необходимо авторизоваться');
            }
            
            const isClient = orderData.clientId === user.uid;
            const isMaster = orderData.selectedMasterId === user.uid;

            if (!isClient && !isMaster) {
                throw new Error('У вас нет прав для завершения этого заказа');
            }

            await db.collection('orders').doc(orderId).update({
                status: ORDER_STATUS.COMPLETED,
                completedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            if (isMaster) {
                await db.collection('users').doc(user.uid).update({
                    completedJobs: firebase.firestore.FieldValue.increment(1)
                });
            }

            clearCache();

            console.log('✅ Заказ завершен:', orderId);
            Helpers.showNotification('✅ Заказ завершен!', 'success');
            
            return { success: true };
            
        } catch (error) {
            console.error('❌ Ошибка завершения заказа:', error);
            Helpers.showNotification(`❌ ${error.message}`, 'error');
            return { success: false, error: error.message };
        }
    }

    // Поиск заказов
    async function searchOrders(query) {
        try {
            if (!query || query.length < 3) {
                return [];
            }

            const snapshot = await db.collection('orders')
                .where('status', '==', ORDER_STATUS.OPEN)
                .orderBy('createdAt', 'desc')
                .limit(20)
                .get();

            const results = [];
            const lowerQuery = query.toLowerCase();

            snapshot.forEach(doc => {
                const order = doc.data();
                
                if (order.title?.toLowerCase().includes(lowerQuery) ||
                    order.description?.toLowerCase().includes(lowerQuery) ||
                    order.category?.toLowerCase().includes(lowerQuery)) {
                    results.push({
                        id: doc.id,
                        ...order
                    });
                }
            });

            return results;
            
        } catch (error) {
            console.error('Ошибка поиска:', error);
            return [];
        }
    }

    // Добавление просмотра
    async function addView(orderId) {
        try {
            await db.collection('orders').doc(orderId).update({
                views: firebase.firestore.FieldValue.increment(1)
            });

            if (Auth.isAuthenticated()) {
                const user = Auth.getUser();
                const viewedOrder = {
                    orderId: orderId,
                    viewedAt: new Date().toISOString() // ✅ Исправлено на обычную дату
                };
                
                await db.collection('users').doc(user.uid).update({
                    viewedOrders: firebase.firestore.FieldValue.arrayUnion(viewedOrder)
                });
            }
            
        } catch (error) {
            console.error('Ошибка добавления просмотра:', error);
        }
    }

    // Статистика мастера
    async function getMasterStats(masterId) {
        try {
            const responses = await getMasterResponses(masterId);
            
            const total = responses.length;
            const accepted = responses.filter(r => r.status === ORDER_STATUS.IN_PROGRESS || r.status === ORDER_STATUS.COMPLETED).length;
            const completed = responses.filter(r => r.status === ORDER_STATUS.COMPLETED).length;
            
            return {
                total,
                accepted,
                completed,
                conversion: total > 0 ? Math.round((accepted / total) * 100) : 0
            };
            
        } catch (error) {
            console.error('Ошибка получения статистики:', error);
            return { total: 0, accepted: 0, completed: 0, conversion: 0 };
        }
    }

    // Очистка кэша
    function clearCache() {
        cache.clear();
        console.log('🧹 Кэш заказов очищен');
    }

    // Подписка на изменения
    function onOrderChange(callback) {
        if (typeof callback === 'function') {
            listeners.push(callback);
        }
    }

    // Публичное API
    return {
        create,
        getOpenOrders,
        getClientOrders,
        getMasterResponses,
        respondToOrder,
        selectMaster,
        completeOrder,
        searchOrders,
        addView,
        getMasterStats,
        onOrderChange,
        clearCache
    };
})();

window.Orders = Orders;