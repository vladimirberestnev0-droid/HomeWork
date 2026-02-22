// ===== js/services/orders.js =====
// РАБОТА С ЗАКАЗАМИ (УЛУЧШЕННАЯ ВЕРСИЯ) + ЧАТ ПРИ ВЫБОРЕ МАСТЕРА

const Orders = (function() {
    // Кэш заказов
    const cache = new Map();
    let listeners = [];

    // Константы статусов
    const ORDER_STATUS = {
        OPEN: 'open',
        IN_PROGRESS: 'in_progress',
        COMPLETED: 'completed',
        CANCELLED: 'cancelled'
    };

    // Антиспам: храним время последнего отклика для каждого мастера
    const spamPrevention = new Map();

    // Безопасный Helpers
    const safeHelpers = {
        showNotification: (msg, type) => {
            if (window.Helpers && Helpers.showNotification) {
                Helpers.showNotification(msg, type);
            } else {
                console.log(`🔔 ${type}: ${msg}`);
                if (type === 'error') alert(`❌ ${msg}`);
                else if (type === 'success') alert(`✅ ${msg}`);
                else alert(msg);
            }
        },
        validatePrice: (price) => {
            if (window.Helpers && Helpers.validatePrice) {
                return Helpers.validatePrice(price);
            }
            return price && !isNaN(price) && price >= 500 && price <= 1000000;
        },
        checkSpam: (masterId) => {
            const now = Date.now();
            const lastResponse = spamPrevention.get(masterId) || 0;
            
            // Не чаще 1 отклика в 5 секунд
            if (now - lastResponse < 5000) {
                return false;
            }
            
            spamPrevention.set(masterId, now);
            
            // Очищаем старые записи через 10 секунд
            setTimeout(() => {
                if (spamPrevention.get(masterId) === now) {
                    spamPrevention.delete(masterId);
                }
            }, 10000);
            
            return true;
        }
    };

    // Проверка модерации (с fallback)
    async function checkModeration(text, context) {
        if (window.Moderation && Moderation.check) {
            return Moderation.check(text, context);
        }
        return { isValid: true, violations: [] };
    }

    // Проверка Firebase
    function checkFirebase() {
        if (typeof firebase === 'undefined') {
            console.error('❌ Firebase не загружен');
            return false;
        }
        if (typeof db === 'undefined' || !db) {
            console.error('❌ Firestore не инициализирован');
            return false;
        }
        return true;
    }

    // ===== СОЗДАНИЕ ЧАТА ПРИ ВЫБОРЕ МАСТЕРА =====
    async function createChatAfterSelection(orderId, masterId, clientId, orderData) {
        try {
            if (!checkFirebase()) return { success: false, error: 'Firestore недоступен' };
            
            const chatId = `chat_${orderId}_${masterId}`;
            const chatRef = db.collection('chats').doc(chatId);
            
            // Проверяем, не создан ли уже чат
            const chatDoc = await chatRef.get();
            if (chatDoc.exists) {
                console.log('📝 Чат уже существует:', chatId);
                return { success: true, chatId };
            }
            
            // Создаем чат
            await chatRef.set({
                participants: [clientId, masterId],
                orderId: orderId,
                orderTitle: orderData.title || 'Заказ',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastMessageAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastMessage: '✅ Мастер выбран! Чат открыт.',
                status: 'active',
                createdBy: clientId,
                unreadCount: {
                    [clientId]: 0,
                    [masterId]: 1
                },
                settings: {
                    canClientWrite: true,
                    canMasterWrite: true
                }
            });
            
            // Создаем системное сообщение
            await chatRef.collection('messages').add({
                senderId: 'system',
                senderName: 'Система',
                text: '✅ Мастер выбран! Теперь вы можете общаться.',
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                type: 'system',
                systemType: 'master_selected'
            });
            
            console.log('✅ Чат создан после выбора мастера:', chatId);
            return { success: true, chatId };
            
        } catch (error) {
            console.error('❌ Ошибка создания чата:', error);
            return { success: false, error: error.message };
        }
    }

    // ===== СОЗДАНИЕ ЗАКАЗА =====
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

            if (!safeHelpers.validatePrice(orderData.price)) {
                throw new Error('Цена должна быть от 500 до 1 000 000 ₽');
            }

            if (!orderData.address) {
                throw new Error('Укажите адрес');
            }

            // Проверка модерации
            const modResult = await checkModeration(orderData.title, 'order_title');
            if (!modResult.isValid) {
                throw new Error('Текст не прошел модерацию');
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
            
            safeHelpers.showNotification('✅ Заказ создан!', 'success');
            
            return { success: true, orderId: docRef.id };
            
        } catch (error) {
            console.error('Ошибка создания заказа:', error);
            safeHelpers.showNotification(`❌ ${error.message}`, 'error');
            return { success: false, error: error.message };
        }
    }

    // ===== УВЕДОМЛЕНИЕ МАСТЕРОВ =====
    async function notifyMasters(orderId, order) {
        try {
            const mastersSnapshot = await db.collection('users')
                .where('role', '==', 'master')
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

    // ===== ПОЛУЧЕНИЕ ОТКРЫТЫХ ЗАКАЗОВ =====
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
                .limit(20);

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
            safeHelpers.showNotification('❌ Ошибка загрузки заказов', 'error');
            return [];
        }
    }

    // ===== ПОЛУЧЕНИЕ ЗАКАЗОВ КЛИЕНТА =====
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

    // ===== ПОЛУЧЕНИЕ ОТКЛИКОВ МАСТЕРА =====
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

    // ===== ОТКЛИК НА ЗАКАЗ (с антиспамом) - ИСПРАВЛЕНО!!! =====
    async function respondToOrder(orderId, price, comment) {
        try {
            if (!Auth.isAuthenticated()) {
                throw new Error('Необходимо авторизоваться');
            }

            if (!Auth.isMaster()) {
                throw new Error('Только мастера могут откликаться');
            }

            const user = Auth.getUser();
            
            // Антиспам проверка
            if (!safeHelpers.checkSpam(user.uid)) {
                throw new Error('Слишком частые отклики. Подождите несколько секунд.');
            }

            if (!safeHelpers.validatePrice(price)) {
                throw new Error('Цена должна быть от 500 до 1 000 000 ₽');
            }

            // Проверка модерации
            if (comment) {
                const modResult = await checkModeration(comment, 'master_comment');
                if (!modResult.isValid) {
                    throw new Error(modResult.reason || 'Комментарий не прошел модерацию');
                }
            }

            const userData = Auth.getUserData();

            const orderDoc = await db.collection('orders').doc(orderId).get();
            if (!orderDoc.exists) {
                throw new Error('Заказ не найден');
            }
            const orderData = orderDoc.data();
            const clientId = orderData.clientId;

            // Проверяем, что заказ еще открыт
            if (orderData.status !== ORDER_STATUS.OPEN) {
                throw new Error('Заказ уже неактивен');
            }

            // Проверяем, не откликался ли уже мастер
            if (orderData.responses?.some(r => r.masterId === user.uid)) {
                throw new Error('Вы уже откликались на этот заказ');
            }

            // ✅ ИСПРАВЛЕНО: создаем объект без serverTimestamp() внутри
            const response = {
                masterId: user.uid,
                masterName: userData?.name || 'Мастер',
                masterPhone: userData?.phone || '',
                masterRating: userData?.rating || 0,
                masterReviews: userData?.reviews || 0,
                price: parseInt(price),
                comment: comment || '',
                createdAt: new Date().toISOString() // Используем ISO строку вместо serverTimestamp()
            };

            await db.collection('orders').doc(orderId).update({
                responses: firebase.firestore.FieldValue.arrayUnion(response)
            });

            // Обновляем статистику мастера
            await db.collection('users').doc(user.uid).update({
                totalResponses: firebase.firestore.FieldValue.increment(1)
            });

            // Очищаем кэш
            clearCache();

            safeHelpers.showNotification('✅ Отклик отправлен!', 'success');
            
            return { success: true };
            
        } catch (error) {
            console.error('Ошибка отклика:', error);
            safeHelpers.showNotification(`❌ ${error.message}`, 'error');
            return { success: false, error: error.message };
        }
    }

    // ===== ВЫБОР МАСТЕРА (с созданием чата!) =====
    async function selectMaster(orderId, masterId, price) {
        try {
            if (!Auth.isAuthenticated()) {
                throw new Error('Необходимо авторизоваться');
            }

            const user = Auth.getUser();

            const orderDoc = await db.collection('orders').doc(orderId).get();
            
            if (!orderDoc.exists) {
                throw new Error('Заказ не найден');
            }

            const orderData = orderDoc.data();
            
            // Проверяем, что клиент - владелец заказа
            if (orderData.clientId !== user.uid) {
                throw new Error('Вы не можете выбрать мастера для этого заказа');
            }

            // Проверяем, что заказ еще открыт
            if (orderData.status !== ORDER_STATUS.OPEN) {
                throw new Error('Заказ уже неактивен');
            }

            // Проверяем, что мастер откликался на этот заказ
            const hasResponse = orderData.responses?.some(r => r.masterId === masterId);
            if (!hasResponse) {
                throw new Error('Этот мастер не откликался на заказ');
            }

            // Обновляем заказ в транзакции для безопасности
            await db.runTransaction(async (transaction) => {
                const freshOrderDoc = await transaction.get(db.collection('orders').doc(orderId));
                if (!freshOrderDoc.exists) throw new Error('Заказ не найден');
                
                const freshOrder = freshOrderDoc.data();
                if (freshOrder.status !== ORDER_STATUS.OPEN) {
                    throw new Error('Заказ уже неактивен');
                }

                transaction.update(db.collection('orders').doc(orderId), {
                    status: ORDER_STATUS.IN_PROGRESS,
                    selectedMasterId: masterId,
                    selectedPrice: price,
                    selectedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            });

            // ✅ СОЗДАЕМ ЧАТ после успешного выбора мастера
            const chatResult = await createChatAfterSelection(
                orderId, 
                masterId, 
                user.uid, 
                orderData
            );

            if (!chatResult.success) {
                console.warn('⚠️ Чат не создан, но заказ обновлен:', chatResult.error);
            }

            // Уведомление мастеру
            await db.collection('notifications').add({
                userId: masterId,
                orderId: orderId,
                type: 'master_selected',
                title: '🎉 Вас выбрали!',
                body: `Клиент выбрал вас для заказа "${orderData.title}"`,
                data: {
                    chatId: chatResult.chatId,
                    orderId: orderId
                },
                read: false,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // Начисляем XP клиенту
            if (window.ClientGamification) {
                await ClientGamification.addXP(user.uid, 10, 'Выбор мастера');
            }

            clearCache();

            safeHelpers.showNotification('✅ Мастер выбран! Чат создан.', 'success');
            
            return { 
                success: true, 
                chatId: chatResult.chatId,
                orderId: orderId 
            };
            
        } catch (error) {
            console.error('Ошибка выбора мастера:', error);
            safeHelpers.showNotification(`❌ ${error.message}`, 'error');
            return { success: false, error: error.message };
        }
    }

    // ===== ЗАВЕРШЕНИЕ ЗАКАЗА (с блокировкой чата) =====
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

            // Проверяем, что заказ еще не завершен
            if (orderData.status === ORDER_STATUS.COMPLETED) {
                throw new Error('Заказ уже завершен');
            }

            // Обновляем заказ
            await db.collection('orders').doc(orderId).update({
                status: ORDER_STATUS.COMPLETED,
                completedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // ✅ БЛОКИРУЕМ ЧАТ (только для чтения)
            if (orderData.selectedMasterId) {
                const chatId = `chat_${orderId}_${orderData.selectedMasterId}`;
                const chatRef = db.collection('chats').doc(chatId);
                
                const chatDoc = await chatRef.get();
                if (chatDoc.exists) {
                    await chatRef.update({
                        status: 'completed',
                        'settings.canClientWrite': false,
                        'settings.canMasterWrite': false,
                        completedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    
                    // Добавляем системное сообщение
                    await chatRef.collection('messages').add({
                        senderId: 'system',
                        senderName: 'Система',
                        text: '✅ Заказ выполнен. Чат закрыт для новых сообщений.',
                        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                        type: 'system',
                        systemType: 'order_completed'
                    });
                    
                    console.log('🔒 Чат заблокирован после завершения заказа');
                }
            }

            // Обновляем статистику мастера
            if (isMaster) {
                await db.collection('users').doc(user.uid).update({
                    completedJobs: firebase.firestore.FieldValue.increment(1)
                });
                
                // Начисляем XP мастеру
                if (window.Gamification) {
                    await Gamification.addXP(user.uid, 50, 'Заказ выполнен');
                }
            }

            // Начисляем XP клиенту
            if (isClient && window.ClientGamification) {
                await ClientGamification.addXP(user.uid, 20, 'Заказ завершен');
            }

            clearCache();

            console.log('✅ Заказ завершен:', orderId);
            safeHelpers.showNotification('✅ Заказ завершен!', 'success');
            
            return { success: true };
            
        } catch (error) {
            console.error('❌ Ошибка завершения заказа:', error);
            safeHelpers.showNotification(`❌ ${error.message}`, 'error');
            return { success: false, error: error.message };
        }
    }

    // ===== ОТМЕНА ЗАКАЗА =====
    async function cancelOrder(orderId) {
        try {
            const orderDoc = await db.collection('orders').doc(orderId).get();
            
            if (!orderDoc.exists) {
                throw new Error('Заказ не найден');
            }

            const orderData = orderDoc.data();
            const user = Auth.getUser();
            
            if (!user) {
                throw new Error('Необходимо авторизоваться');
            }
            
            if (orderData.clientId !== user.uid) {
                throw new Error('Только клиент может отменить заказ');
            }

            await db.collection('orders').doc(orderId).update({
                status: ORDER_STATUS.CANCELLED,
                cancelledAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            clearCache();

            safeHelpers.showNotification('✅ Заказ отменен', 'info');
            return { success: true };
            
        } catch (error) {
            console.error('Ошибка отмены заказа:', error);
            safeHelpers.showNotification(`❌ ${error.message}`, 'error');
            return { success: false, error: error.message };
        }
    }

    // ===== ПОИСК ЗАКАЗОВ =====
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

    // ===== ДОБАВЛЕНИЕ ПРОСМОТРА =====
    async function addView(orderId) {
        try {
            await db.collection('orders').doc(orderId).update({
                views: firebase.firestore.FieldValue.increment(1)
            });

            if (Auth.isAuthenticated()) {
                const user = Auth.getUser();
                const viewedOrder = {
                    orderId: orderId,
                    viewedAt: firebase.firestore.FieldValue.serverTimestamp()
                };
                
                await db.collection('users').doc(user.uid).update({
                    viewedOrders: firebase.firestore.FieldValue.arrayUnion(viewedOrder)
                });
            }
            
        } catch (error) {
            console.error('Ошибка добавления просмотра:', error);
        }
    }

    // ===== СТАТИСТИКА МАСТЕРА =====
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

    // ===== ПОЛУЧЕНИЕ ЗАКАЗА ПО ID =====
    async function getOrderById(orderId) {
        try {
            const doc = await db.collection('orders').doc(orderId).get();
            if (!doc.exists) return null;
            return { id: doc.id, ...doc.data() };
        } catch (error) {
            console.error('Ошибка получения заказа:', error);
            return null;
        }
    }

    // ===== ОЧИСТКА КЭША =====
    function clearCache() {
        cache.clear();
        console.log('🧹 Кэш заказов очищен');
    }

    // ===== ПОДПИСКА НА ИЗМЕНЕНИЯ =====
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
        cancelOrder,
        searchOrders,
        addView,
        getMasterStats,
        getOrderById,
        onOrderChange,
        clearCache,
        ORDER_STATUS
    };
})();

window.Orders = Orders;