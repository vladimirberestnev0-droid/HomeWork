// ===== ORDERS.JS — РАБОТА С ЗАКАЗАМИ =====

const Orders = (function() {
    // Приватные переменные
    let ordersCache = new Map();
    let listeners = [];

    /**
     * Создание нового заказа
     */
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

            // Сохраняем в Firestore
            const docRef = await db.collection('orders').add(order);
            
            // Отправляем уведомления мастерам
            await notifyMastersAboutNewOrder(docRef.id, order);
            
            Helpers.showNotification('✅ Заказ создан! Мастера увидят его в течение 5 минут', 'success');
            
            return { success: true, orderId: docRef.id };
            
        } catch (error) {
            console.error('Ошибка создания заказа:', error);
            Helpers.showNotification(`❌ ${error.message}`, 'error');
            return { success: false, error: error.message };
        }
    }

    /**
     * Уведомление мастеров о новом заказе
     */
    async function notifyMastersAboutNewOrder(orderId, order) {
        try {
            // Ищем мастеров с подходящими категориями
            const mastersSnapshot = await db.collection('users')
                .where('role', '==', USER_ROLE.MASTER)
                .where('banned', '==', false)
                .get();

            const notifications = [];
            
            mastersSnapshot.forEach(doc => {
                const master = doc.data();
                const masterCategories = (master.categories || '').split(',').map(c => c.trim());
                
                // Если категория совпадает или у мастера нет категорий
                if (masterCategories.length === 0 || masterCategories.includes(order.category)) {
                    notifications.push({
                        masterId: doc.id,
                        orderId: orderId,
                        type: 'new_order',
                        read: false,
                        createdAt: new Date().toISOString()
                    });
                }
            });

            // Сохраняем уведомления в Firestore
            if (notifications.length > 0) {
                const batch = db.batch();
                notifications.forEach(notif => {
                    const ref = db.collection('notifications').doc();
                    batch.set(ref, notif);
                });
                await batch.commit();
            }
            
        } catch (error) {
            console.error('Ошибка отправки уведомлений:', error);
        }
    }

    /**
     * Получение открытых заказов
     */
    async function getOpenOrders(filters = {}) {
        try {
            let query = db.collection('orders')
                .where('status', '==', ORDER_STATUS.OPEN)
                .orderBy('createdAt', 'desc')
                .limit(PAGINATION.ORDERS_PER_PAGE);

            // Фильтр по категории
            if (filters.category) {
                query = query.where('category', '==', filters.category);
            }

            // Фильтр по цене
            if (filters.minPrice) {
                query = query.where('price', '>=', parseInt(filters.minPrice));
            }
            if (filters.maxPrice) {
                query = query.where('price', '<=', parseInt(filters.maxPrice));
            }

            const snapshot = await query.get();
            
            const orders = [];
            snapshot.forEach(doc => {
                const order = doc.data();
                // Дополнительная проверка статуса (на всякий случай)
                if (order.status === ORDER_STATUS.OPEN) {
                    orders.push({
                        id: doc.id,
                        ...order
                    });
                }
            });

            console.log(`📦 Загружено ${orders.length} открытых заказов`);
            return orders;
            
        } catch (error) {
            console.error('Ошибка загрузки заказов:', error);
            Helpers.showNotification('❌ Ошибка загрузки заказов', 'error');
            return [];
        }
    }

    /**
     * Получение заказов клиента
     */
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

    /**
     * Получение откликов мастера
     */
    async function getMasterResponses(masterId) {
        try {
            console.log('🔍 Загружаем отклики для мастера:', masterId);
            
            // Получаем все заказы
            const snapshot = await db.collection('orders').get();
            console.log('📦 Всего заказов в базе:', snapshot.size);

            const responses = [];
            
            snapshot.forEach(doc => {
                const order = doc.data();
                console.log('📋 Проверяем заказ:', doc.id, 'статус:', order.status);
                
                // Проверяем, есть ли отклик этого мастера
                if (order.responses && Array.isArray(order.responses)) {
                    const myResponse = order.responses.find(r => r.masterId === masterId);
                    if (myResponse) {
                        console.log('✅ Найден отклик для заказа:', doc.id);
                        responses.push({
                            orderId: doc.id,
                            order: order,
                            response: myResponse,
                            status: order.status
                        });
                    }
                }
            });

            console.log(`📊 Загружено ${responses.length} откликов для мастера`);
            return responses;
            
        } catch (error) {
            console.error('❌ Ошибка загрузки откликов:', error);
            return [];
        }
    }

    /**
     * Отклик на заказ (С ЧАТОМ СРАЗУ ПОСЛЕ ОТКЛИКА)
     */
    async function respondToOrder(orderId, price, comment) {
        try {
            // Валидация
            if (!Auth.isAuthenticated()) {
                throw new Error('Необходимо авторизоваться');
            }

            if (!Auth.isMaster()) {
                throw new Error('Только мастера могут откликаться');
            }

            if (!Helpers.validatePrice(price)) {
                throw new Error('Цена должна быть от 500 до 1 000 000 ₽');
            }

            const user = Auth.getUser();
            const userData = Auth.getUserData();

            // Получаем информацию о заказе, чтобы узнать clientId
            const orderDoc = await db.collection('orders').doc(orderId).get();
            if (!orderDoc.exists) {
                throw new Error('Заказ не найден');
            }
            const orderData = orderDoc.data();
            const clientId = orderData.clientId;

            const response = {
                masterId: user.uid,
                masterName: userData?.name || 'Мастер',
                masterPhone: userData?.phone || '',
                masterRating: userData?.rating || 0,
                masterReviews: userData?.reviews || 0,
                price: parseInt(price),
                comment: comment || '',
                createdAt: new Date().toISOString()
            };

            // Добавляем отклик
            await db.collection('orders').doc(orderId).update({
                responses: firebase.firestore.FieldValue.arrayUnion(response)
            });

            // 🔥 СОЗДАЁМ ЧАТ СРАЗУ ПОСЛЕ ОТКЛИКА
            try {
                await Chats.create(orderId, user.uid, clientId);
                console.log('✅ Чат создан после отклика');
            } catch (chatError) {
                console.error('❌ Ошибка создания чата:', chatError);
                // Не блокируем отклик, если чат не создался
            }

            // Увеличиваем счетчик откликов у мастера
            await db.collection('users').doc(user.uid).update({
                totalResponses: firebase.firestore.FieldValue.increment(1)
            });

            Helpers.showNotification('✅ Отклик отправлен! Чат с клиентом доступен', 'success');
            
            return { success: true };
            
        } catch (error) {
            console.error('Ошибка отклика:', error);
            Helpers.showNotification(`❌ ${error.message}`, 'error');
            return { success: false, error: error.message };
        }
    }

    /**
     * Выбор мастера клиентом
     */
    async function selectMaster(orderId, masterId, price) {
        try {
            const order = await db.collection('orders').doc(orderId).get();
            
            if (!order.exists) {
                throw new Error('Заказ не найден');
            }

            const orderData = order.data();
            
            if (orderData.clientId !== Auth.getUser()?.uid) {
                throw new Error('Вы не можете выбрать мастера для этого заказа');
            }

            await db.collection('orders').doc(orderId).update({
                status: ORDER_STATUS.IN_PROGRESS,
                selectedMasterId: masterId,
                selectedPrice: price,
                selectedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // Чат уже должен быть создан при отклике, но на всякий случай создаём
            try {
                await Chats.create(orderId, masterId, orderData.clientId);
            } catch (chatError) {
                console.log('Чат уже существует или ошибка:', chatError);
            }

            Helpers.showNotification('✅ Мастер выбран!', 'success');
            
            return { success: true };
            
        } catch (error) {
            console.error('Ошибка выбора мастера:', error);
            Helpers.showNotification(`❌ ${error.message}`, 'error');
            return { success: false, error: error.message };
        }
    }

    /**
     * Завершение заказа
     */
    async function completeOrder(orderId) {
        try {
            const order = await db.collection('orders').doc(orderId).get();
            
            if (!order.exists) {
                throw new Error('Заказ не найден');
            }

            const orderData = order.data();
            
            // Проверяем права (клиент или выбранный мастер)
            const user = Auth.getUser();
            const isClient = orderData.clientId === user?.uid;
            const isMaster = orderData.selectedMasterId === user?.uid;

            if (!isClient && !isMaster) {
                throw new Error('У вас нет прав для завершения этого заказа');
            }

            await db.collection('orders').doc(orderId).update({
                status: ORDER_STATUS.COMPLETED,
                completedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // Если завершает мастер, увеличиваем счетчик выполненных заказов
            if (isMaster) {
                await db.collection('users').doc(user.uid).update({
                    completedJobs: firebase.firestore.FieldValue.increment(1)
                });
            }

            Helpers.showNotification('✅ Заказ завершен!', 'success');
            
            return { success: true };
            
        } catch (error) {
            console.error('Ошибка завершения заказа:', error);
            Helpers.showNotification(`❌ ${error.message}`, 'error');
            return { success: false, error: error.message };
        }
    }

    /**
     * Поиск заказов
     */
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

    /**
     * Добавление просмотра заказа
     */
    async function addView(orderId) {
        try {
            await db.collection('orders').doc(orderId).update({
                views: firebase.firestore.FieldValue.increment(1)
            });

            // Добавляем в историю просмотров пользователя
            if (Auth.isAuthenticated()) {
                await Auth.addViewedOrder(orderId);
            }
            
        } catch (error) {
            console.error('Ошибка добавления просмотра:', error);
        }
    }

    /**
     * Получение статистики мастера
     */
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

    // Подписка на изменения заказов
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
        onOrderChange
    };
})();

// Экспортируем
window.Orders = Orders;