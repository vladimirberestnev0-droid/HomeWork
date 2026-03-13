// ============================================
// СЕРВИС ЗАКАЗОВ - ИДЕАЛЬНАЯ АРХИТЕКТУРА
// ============================================

const Orders = (function() {
    if (window.__ORDERS_INITIALIZED__) return window.Orders;

    // ===== КОНСТАНТЫ СТАТУСОВ =====
    const ORDER_STATUS = {
        OPEN: 'open',
        IN_PROGRESS: 'in_progress',
        COMPLETED: 'completed',
        CANCELLED: 'cancelled',
        AWAITING_CONFIRMATION: 'awaiting_confirmation'
    };

    // Маппинг для нормализации статусов
    const STATUS_NORMALIZATION = {
        'open': ORDER_STATUS.OPEN,
        'opened': ORDER_STATUS.OPEN,
        'in_progress': ORDER_STATUS.IN_PROGRESS,
        'inprogress': ORDER_STATUS.IN_PROGRESS,
        'inProgress': ORDER_STATUS.IN_PROGRESS,
        'completed': ORDER_STATUS.COMPLETED,
        'done': ORDER_STATUS.COMPLETED,
        'cancelled': ORDER_STATUS.CANCELLED,
        'canceled': ORDER_STATUS.CANCELLED,
        'awaiting_confirmation': ORDER_STATUS.AWAITING_CONFIRMATION,
        'awaiting': ORDER_STATUS.AWAITING_CONFIRMATION,
        'pending_confirmation': ORDER_STATUS.AWAITING_CONFIRMATION
    };

    // ===== ПРИВАТНЫЕ ПЕРЕМЕННЫЕ =====
    const spamPrevention = new Map();
    let activeListeners = new Map();
    
    // Офлайн-очередь
    const OFFLINE_QUEUE_KEY = 'offline_orders_queue';
    let processingOffline = false;

    // ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =====
    function checkAuth() {
        return window.Auth && Auth.isAuthenticated();
    }

    function getUserSafe() {
        try { return Auth.getUser(); } 
        catch (e) { return null; }
    }

    function getUserDataSafe() {
        try { return Auth.getUserData(); } 
        catch (e) { return null; }
    }

    function normalizeStatus(status) {
        if (!status) return ORDER_STATUS.OPEN;
        return STATUS_NORMALIZATION[status.toLowerCase()] || status;
    }

    // ===== ОФЛАЙН-ОЧЕРЕДЬ =====
    function getOfflineQueue() {
        try {
            const queue = localStorage.getItem(OFFLINE_QUEUE_KEY);
            return queue ? JSON.parse(queue) : [];
        } catch (e) {
            console.error('❌ Ошибка чтения офлайн-очереди:', e);
            return [];
        }
    }

    function saveOfflineQueue(queue) {
        try {
            localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
        } catch (e) {
            console.error('❌ Ошибка сохранения офлайн-очереди:', e);
        }
    }

    function addToOfflineQueue(action) {
        const queue = getOfflineQueue();
        queue.push({
            ...action,
            id: `offline_${Date.now()}_${Math.random().toString(36)}`,
            createdAt: Date.now()
        });
        saveOfflineQueue(queue);
        
        if (navigator.onLine) {
            processOfflineQueue();
        }
        
        return queue.length;
    }

    async function processOfflineQueue() {
        if (processingOffline) return;
        if (!navigator.onLine) return;
        
        const queue = getOfflineQueue();
        if (queue.length === 0) return;
        
        processingOffline = true;
        const loaderId = Loader?.show('Отправка сохранённых действий...');
        
        const remaining = [];
        
        for (const action of queue) {
            try {
                let result;
                switch (action.type) {
                    case 'createOrder':
                        result = await create(action.data, true);
                        break;
                    case 'respondToOrder':
                        result = await respondToOrder(action.orderId, action.price, action.comment, true);
                        break;
                    case 'selectMaster':
                        result = await selectMaster(action.orderId, action.masterId, action.price, true);
                        break;
                    case 'initiateCompletion':
                        result = await initiateCompletion(action.orderId, action.review, true);
                        break;
                    case 'confirmCompletion':
                        result = await confirmCompletion(action.orderId, action.review, true);
                        break;
                    case 'cancelOrder':
                        result = await cancelOrder(action.orderId, action.reason, true);
                        break;
                }
                
                if (result && result.success) {
                    console.log(`✅ Офлайн-действие выполнено: ${action.type}`);
                } else {
                    remaining.push(action);
                }
            } catch (error) {
                console.error(`❌ Ошибка выполнения офлайн-действия:`, error);
                remaining.push(action);
            }
        }
        
        saveOfflineQueue(remaining);
        
        if (remaining.length === 0) {
            Utils.showSuccess('✅ Все сохранённые действия выполнены');
        }
        
        Loader?.hide(loaderId);
        processingOffline = false;
    }

    // ===== СОЗДАНИЕ ЧАТА ПРИ ОТКЛИКЕ =====
    async function createResponseChat(orderId, masterId, clientId, orderData, masterName, price, comment) {
        try {
            const chatId = `chat_${orderId}_${masterId}`;
            
            const existingChat = await DataService.getChat(chatId);
            if (existingChat) return { success: true, chatId };

            await DataService.createChat(chatId, {
                participants: [clientId, masterId],
                orderId: orderId,
                orderTitle: orderData.title || 'Заказ',
                orderPrice: orderData.price,
                status: 'pending',
                type: 'response',
                lastMessage: `🔔 Мастер ${masterName} откликнулся на ваш заказ`,
                lastMessageAt: new Date().toISOString(),
                unreadCount: { 
                    [clientId]: 1,
                    [masterId]: 0 
                }
            });

            let messageText = `🔔 Мастер ${masterName} откликнулся на ваш заказ`;
            if (price) messageText += `\n💰 Предложенная цена: ${Utils.formatMoney(price)}`;
            if (comment) messageText += `\n💬 Комментарий: ${comment}`;

            await DataService.sendMessage(chatId, {
                senderId: 'system',
                senderName: 'Система',
                text: messageText,
                type: 'system',
                read: false
            });

            console.log('✅ Чат создан при отклике:', chatId);
            
            if (window.Cache) {
                Cache.remove(`chats_${clientId}`);
                Cache.remove(`chats_${masterId}`);
            }

            return { success: true, chatId };
        } catch (error) {
            console.error('❌ Ошибка создания чата:', error);
            return { success: false, error: error.message };
        }
    }

    // ===== СОЗДАНИЕ ЗАКАЗА =====
    async function create(orderData, skipOffline = false) {
        const taskId = window.Loader?.show('Создание заказа...');

        try {
            if (!checkAuth()) return { success: false, error: 'Необходимо авторизоваться' };

            if (!skipOffline && !navigator.onLine) {
                addToOfflineQueue({ type: 'createOrder', data: orderData });
                Utils.showWarning('Заказ будет создан при подключении к интернету');
                return { success: true, queued: true };
            }

            const user = getUserSafe();
            const userData = getUserDataSafe();

            if (!user || !userData) {
                return { success: false, error: 'Ошибка получения данных пользователя' };
            }

            if (!Auth.isClient()) {
                return { success: false, error: 'Только клиенты могут создавать заказы' };
            }

            // Валидация
            if (!orderData.title || orderData.title.length < 5) {
                return { success: false, error: 'Название должно быть не менее 5 символов' };
            }
            if (!orderData.category || orderData.category === 'all') {
                return { success: false, error: 'Выберите категорию' };
            }
            if (!Utils.validatePrice(orderData.price)) {
                return { success: false, error: 'Цена должна быть от 500 до 1 000 000 ₽' };
            }
            if (!orderData.address) {
                return { success: false, error: 'Укажите адрес' };
            }

            // Модерация
            if (window.Moderation) {
                const modResult = Moderation.check(orderData.title, 'order_title');
                if (!modResult.isValid) {
                    return { success: false, error: modResult.reason || 'Название не прошло модерацию' };
                }
            }

            // Загрузка фото
            const photoUrls = [];
            if (orderData.photos && orderData.photos.length > 0) {
                if (orderData.photos.length > 5) {
                    return { success: false, error: 'Максимум 5 фото' };
                }

                const uploadResult = await UploadService.uploadMultiple(
                    orderData.photos, 'orders', {
                        maxFiles: 5,
                        maxSize: 10 * 1024 * 1024,
                        onFileProgress: (index, progress, fileName) => {
                            console.log(`📸 Загрузка ${fileName}: ${progress.toFixed(1)}%`);
                        }
                    }
                );

                photoUrls.push(...uploadResult.success.map(r => r.url));
                
                if (uploadResult.failed.length > 0) {
                    uploadResult.failed.forEach(f => {
                        Utils.showWarning(`Не удалось загрузить ${f.file}: ${f.error}`);
                    });
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
                status: ORDER_STATUS.OPEN,
                responses: [],
                views: 0,
                urgent: orderData.urgent || false
            };

            const result = await DataService.createOrder(order);
            
            // ===== ВСЁ ЧЕРЕЗ DATASERVICE =====
            await DataService.updateUser(user.uid, {
                ordersCount: (userData.ordersCount || 0) + 1,
                activeOrders: (userData.activeOrders || 0) + 1,
                lastOrderAt: new Date().toISOString()
            });
            
            // Уведомляем мастеров
            if (window.PushService) {
                PushService.notifyMastersAboutNewOrder({
                    id: result.id,
                    title: orderData.title,
                    category: orderData.category,
                    price: orderData.price
                }).catch(err => console.warn('⚠️ Ошибка уведомлений:', err));
            }
            
            if (window.Cache) {
                Cache.clear('open_orders');
                Cache.remove(`client_orders_${user.uid}`);
            }

            Utils.showSuccess('✅ Заказ создан!');
            return { success: true, orderId: result.id };
            
        } catch (error) {
            console.error('❌ Ошибка создания заказа:', error);
            Utils.showError(error.message || 'Ошибка создания заказа');
            return { success: false, error: error.message };
        } finally {
            if (taskId) window.Loader?.hide(taskId);
        }
    }

    // ===== ПОЛУЧЕНИЕ ОТКРЫТЫХ ЗАКАЗОВ =====
    async function getOpenOrders(filters = {}, options = {}, retryCount = 0) {
        const MAX_RETRIES = 3;
        const RETRY_DELAY = 1000;

        try {
            console.log('📦 Загрузка открытых заказов...');

            const dbFilters = { status: ORDER_STATUS.OPEN };
            if (filters.category && filters.category !== 'all') {
                dbFilters.category = filters.category;
            }

            const result = await DataService.getOrders(
                dbFilters,
                {
                    limit: options.limit || 20,
                    lastDoc: options.lastDoc
                }
            );

            let orders = result.items.map(order => ({
                ...order,
                status: normalizeStatus(order.status),
                createdAt: order.createdAt?.toDate?.() || new Date(order.createdAt)
            }));

            // Фильтруем только OPEN заказы
            orders = orders.filter(o => o.status === ORDER_STATUS.OPEN);

            // Фильтрация по цене
            if (filters.minPrice) orders = orders.filter(o => o.price >= filters.minPrice);
            if (filters.maxPrice) orders = orders.filter(o => o.price <= filters.maxPrice);

            // Сортировка
            if (filters.sort === 'price_asc') orders.sort((a, b) => a.price - b.price);
            else if (filters.sort === 'price_desc') orders.sort((a, b) => b.price - a.price);
            else orders.sort((a, b) => b.createdAt - a.createdAt);

            console.log(`📦 Загружено ${orders.length} доступных заказов`);

            return {
                orders,
                lastDoc: result.lastDoc,
                hasMore: result.size === (options.limit || 20)
            };

        } catch (error) {
            if (error.message?.includes('Target ID already exists') && retryCount < MAX_RETRIES) {
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (retryCount + 1)));
                return getOpenOrders(filters, options, retryCount + 1);
            }
            console.error('❌ Ошибка загрузки заказов:', error);
            throw error;
        }
    }

    // ===== ПОЛУЧЕНИЕ ЗАКАЗОВ КЛИЕНТА =====
    async function getClientOrders(clientId, filter = 'all', options = {}) {
        try {
            const cacheKey = `client_orders_${clientId}_${filter}`;
            
            if (!options.force && window.Cache) {
                const cached = Cache.get(cacheKey);
                if (cached) return cached;
            }

            const status = filter !== 'all' ? normalizeStatus(filter) : null;
            
            const result = await DataService.getOrders(
                { clientId, status },
                {
                    limit: options.limit || 50,
                    orderBy: { field: 'createdAt', direction: 'desc' }
                }
            );

            const orders = result.items.map(order => ({
                ...order,
                status: normalizeStatus(order.status),
                createdAt: order.createdAt?.toDate?.() || new Date()
            }));

            if (window.Cache) {
                Cache.set(cacheKey, orders, Cache.TTL.MEDIUM);
            }

            return orders;
        } catch (error) {
            console.error('❌ Ошибка загрузки заказов клиента:', error);
            return [];
        }
    }

    // ===== ПОЛУЧЕНИЕ ОТКЛИКОВ МАСТЕРА =====
    async function getMasterResponses(masterId, options = {}) {
        try {
            const cacheKey = `master_responses_${masterId}`;
            
            if (!options.force && window.Cache) {
                const cached = Cache.get(cacheKey);
                if (cached) return cached;
            }

            const result = await DataService.getOrders(
                {},
                {
                    limit: options.limit || 100,
                    orderBy: { field: 'createdAt', direction: 'desc' }
                }
            );

            const responses = [];
            
            for (const order of result.items) {
                if (order.responses && Array.isArray(order.responses)) {
                    const myResponse = order.responses.find(r => r.masterId === masterId);
                    if (myResponse) {
                        // Пропускаем заказы, где выбран другой мастер
                        if (order.status === ORDER_STATUS.IN_PROGRESS && 
                            order.selectedMasterId && 
                            order.selectedMasterId !== masterId) {
                            console.log(`⏭️ Заказ ${order.id} взят другим мастером, пропускаем`);
                            continue;
                        }
                        
                        responses.push({
                            orderId: order.id,
                            order: { 
                                ...order,
                                status: normalizeStatus(order.status),
                                createdAt: order.createdAt?.toDate?.() || new Date()
                            },
                            response: {
                                ...myResponse,
                                createdAt: myResponse.createdAt?.toDate?.() || new Date()
                            },
                            status: normalizeStatus(order.status),
                            createdAt: order.createdAt?.toDate?.() || new Date()
                        });
                    }
                }
            }

            responses.sort((a, b) => b.createdAt - a.createdAt);

            if (window.Cache) {
                Cache.set(cacheKey, responses, Cache.TTL.MEDIUM);
            }

            return responses;
        } catch (error) {
            console.error('❌ Ошибка загрузки откликов:', error);
            return [];
        }
    }

    // ===== ОТКЛИК НА ЗАКАЗ =====
    async function respondToOrder(orderId, price, comment, skipOffline = false) {
        const taskId = window.Loader?.show('Отправка отклика...');

        try {
            if (!checkAuth()) return { success: false, error: 'Необходимо авторизоваться' };

            if (!skipOffline && !navigator.onLine) {
                addToOfflineQueue({ type: 'respondToOrder', orderId, price, comment });
                Utils.showWarning('Отклик будет отправлен при подключении к интернету');
                return { success: true, queued: true };
            }

            const user = getUserSafe();
            const userData = getUserDataSafe();

            if (!user || !userData) {
                return { success: false, error: 'Ошибка получения данных пользователя' };
            }

            if (!Auth.isMaster()) {
                return { success: false, error: 'Только мастера могут откликаться' };
            }

            // Антиспам
            const now = Date.now();
            const lastResponse = spamPrevention.get(user.uid) || 0;
            if (now - lastResponse < 5000) {
                return { success: false, error: 'Подождите 5 секунд перед следующим откликом' };
            }
            spamPrevention.set(user.uid, now);
            setTimeout(() => spamPrevention.delete(user.uid), 5000);

            if (!Utils.validatePrice(price)) {
                return { success: false, error: 'Цена должна быть от 500 до 1 000 000 ₽' };
            }

            if (comment && window.Moderation) {
                const modResult = Moderation.check(comment, 'master_comment');
                if (!modResult.isValid) {
                    return { success: false, error: modResult.reason || 'Комментарий не прошёл модерацию' };
                }
            }

            const order = await DataService.getOrder(orderId);
            if (!order) throw new Error('Заказ не найден');
            
            if (normalizeStatus(order.status) !== ORDER_STATUS.OPEN) {
                throw new Error('Заказ уже неактивен');
            }

            if (order.clientId === user.uid) {
                throw new Error('Нельзя откликаться на свой заказ');
            }

            if (order.responses?.some(r => r.masterId === user.uid)) {
                throw new Error('Вы уже откликались на этот заказ');
            }

            const response = {
                masterId: user.uid,
                masterName: userData.name || 'Мастер',
                masterPhone: userData.phone || '',
                masterRating: userData.rating || 0,
                masterReviews: userData.reviews || 0,
                price: parseInt(price),
                comment: comment?.trim() || '',
                createdAt: new Date().toISOString()
            };

            // Добавляем отклик
            await DataService.updateOrder(orderId, {
                responses: [...(order.responses || []), response]
            });

            // Создаём чат
            await createResponseChat(
                orderId, user.uid, order.clientId, order,
                userData.name || 'Мастер', price, comment
            );

            // ===== ЧЕРЕЗ DATASERVICE =====
            await DataService.createNotification({
                userId: order.clientId,
                type: 'new_response',
                title: '🔔 Новый отклик',
                body: `Мастер ${userData.name || 'Мастер'} откликнулся на ваш заказ`,
                data: { 
                    orderId: orderId,
                    masterId: user.uid,
                    price: price,
                    chatId: `chat_${orderId}_${user.uid}`
                }
            });

            if (window.Cache) {
                Cache.clear('open_orders');
                Cache.remove(`master_responses_${user.uid}`);
                Cache.remove(`order_${orderId}`);
            }

            Utils.showSuccess('✅ Отклик отправлен!');
            return { success: true };
        } catch (error) {
            console.error('❌ Ошибка отклика:', error);
            Utils.showError(error.message || 'Ошибка отклика');
            return { success: false, error: error.message };
        } finally {
            if (taskId) window.Loader?.hide(taskId);
        }
    }

    // ===== ВЫБОР МАСТЕРА =====
    async function selectMaster(orderId, masterId, price, skipOffline = false) {
        const taskId = window.Loader?.show('Выбор мастера...');

        try {
            if (!checkAuth()) return { success: false, error: 'Необходимо авторизоваться' };

            if (!skipOffline && !navigator.onLine) {
                addToOfflineQueue({ type: 'selectMaster', orderId, masterId, price });
                Utils.showWarning('Выбор мастера будет сохранён');
                return { success: true, queued: true };
            }

            const user = getUserSafe();
            if (!user) return { success: false, error: 'Ошибка получения данных пользователя' };

            const order = await DataService.getOrder(orderId);
            if (!order) throw new Error('Заказ не найден');

            if (order.clientId !== user.uid) {
                throw new Error('Вы не можете выбрать мастера для этого заказа');
            }

            if (normalizeStatus(order.status) !== ORDER_STATUS.OPEN) {
                throw new Error('Заказ уже неактивен');
            }

            const hasResponse = order.responses?.some(r => r.masterId === masterId);
            if (!hasResponse) throw new Error('Этот мастер не откликался на заказ');

            // 1. Обновляем статус заказа
            await DataService.updateOrder(orderId, {
                status: ORDER_STATUS.IN_PROGRESS,
                selectedMasterId: masterId,
                selectedPrice: price,
                selectedAt: new Date().toISOString()
            });

            // 2. Уведомление выбранному мастеру
            await DataService.createNotification({
                userId: masterId,
                type: 'master_selected',
                title: '✅ Вас выбрали!',
                body: `Клиент выбрал вас для заказа "${order.title || 'Заказ'}"`,
                data: { orderId, clientId: user.uid, price }
            });

            // 3. Обрабатываем все чаты
            const allChatsResult = await DataService.getCollection('chats', [
                { type: 'where', field: 'orderId', operator: '==', value: orderId }
            ]);

            const selectedChatId = `chat_${orderId}_${masterId}`;

            for (const chat of allChatsResult.items) {
                if (chat.id === selectedChatId) {
                    // Выбранный мастер
                    await DataService.updateChat(chat.id, {
                        status: 'active',
                        lastMessage: '✅ Мастер выбран! Чат активен',
                        lastMessageAt: new Date().toISOString()
                    });
                    
                    await DataService.sendMessage(chat.id, {
                        senderId: 'system',
                        senderName: 'Система',
                        text: '✅ Мастер выбран! Теперь вы можете общаться.',
                        type: 'system',
                        read: false
                    });
                } else {
                    // Остальные мастера
                    await DataService.updateChat(chat.id, {
                        status: 'rejected',
                        lastMessage: '❌ Выбран другой мастер',
                        lastMessageAt: new Date().toISOString()
                    });
                    
                    await DataService.sendMessage(chat.id, {
                        senderId: 'system',
                        senderName: 'Система',
                        text: '❌ Выбран другой мастер. Спасибо за интерес к заказу!',
                        type: 'system',
                        read: false
                    });

                    // 4. Уведомление отклонённым мастерам
                    const otherMasterId = chat.participants.find(id => id !== user.uid);
                    if (otherMasterId && otherMasterId !== masterId) {
                        await DataService.createNotification({
                            userId: otherMasterId,
                            type: 'order_taken',
                            title: '❌ Заказ уже неактуален',
                            body: `Заказ "${order.title || 'Заказ'}" уже взят другим мастером`,
                            data: { orderId }
                        });
                    }
                }
            }

            // 5. Инвалидируем кэш
            if (window.Cache) {
                Cache.clear('open_orders');
                Cache.remove(`client_orders_${user.uid}`);
                Cache.remove(`order_${orderId}`);
                
                if (order.responses) {
                    order.responses.forEach(response => {
                        Cache.remove(`master_responses_${response.masterId}`);
                        Cache.remove(`chats_${response.masterId}`);
                    });
                }
            }

            Utils.showSuccess('✅ Мастер выбран!');
            return { success: true, chatId: selectedChatId, orderId };
            
        } catch (error) {
            console.error('❌ Ошибка выбора мастера:', error);
            Utils.showError(error.message || 'Ошибка выбора мастера');
            return { success: false, error: error.message };
        } finally {
            if (taskId) window.Loader?.hide(taskId);
        }
    }

    // ===== ИНИЦИАЛИЗАЦИЯ ЗАВЕРШЕНИЯ (МАСТЕР) - ИСПРАВЛЕНО =====
async function initiateCompletion(orderId, clientReview = null, skipOffline = false) {
    const taskId = window.Loader?.show('Завершение заказа...');

    try {
        if (!checkAuth()) return { success: false, error: 'Необходимо авторизоваться' };

        if (!skipOffline && !navigator.onLine) {
            addToOfflineQueue({ type: 'initiateCompletion', orderId, review: clientReview });
            Utils.showWarning('Запрос на завершение будет отправлен при подключении');
            return { success: true, queued: true };
        }

        const user = getUserSafe();
        if (!user) return { success: false, error: 'Ошибка получения данных пользователя' };

        const order = await DataService.getOrder(orderId);
        if (!order) throw new Error('Заказ не найден');

        if (order.selectedMasterId !== user.uid) {
            throw new Error('Только назначенный мастер может завершить заказ');
        }

        if (normalizeStatus(order.status) !== ORDER_STATUS.IN_PROGRESS) {
            throw new Error('Заказ не в работе');
        }

        const updateData = {
            status: ORDER_STATUS.AWAITING_CONFIRMATION,
            masterCompletedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (clientReview && clientReview.rating) {
            updateData.masterReview = {
                rating: clientReview.rating,
                text: clientReview.text?.trim() || '',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };
        }

        // ===== 1. ОБНОВЛЯЕМ ЗАКАЗ =====
        await DataService.updateOrder(orderId, updateData);

        // ===== 2. ПРОВЕРЯЕМ И ОБНОВЛЯЕМ ЧАТ (ЕСЛИ ЕСТЬ) =====
        try {
            const chatId = `chat_${orderId}_${order.selectedMasterId}`;
            const chat = await DataService.getChat(chatId);
            
            if (chat) {
                // Чат существует - обновляем
                await DataService.updateChat(chatId, {
                    lastMessage: '🔔 Ожидает подтверждения',
                    lastMessageAt: firebase.firestore.FieldValue.serverTimestamp(),
                    [`unreadCount.${order.clientId}`]: firebase.firestore.FieldValue.increment(1)
                });

                await DataService.sendMessage(chatId, {
                    senderId: 'system',
                    senderName: 'Система',
                    text: '🔔 Мастер отметил заказ как выполненный. Пожалуйста, подтвердите завершение.',
                    type: 'system',
                    read: false
                });
            } else {
                console.log('ℹ️ Чат не найден, пропускаем обновление чата');
            }
        } catch (chatError) {
            // Игнорируем ошибки чата - главное, что заказ обновился!
            console.log('ℹ️ Ошибка обновления чата (не критично):', chatError.message);
        }

        // ===== 3. УВЕДОМЛЕНИЕ КЛИЕНТУ (обязательно!) =====
        await DataService.createNotification({
            userId: order.clientId,
            type: 'awaiting_confirmation',
            title: '🔔 Ожидает подтверждения',
            body: `Мастер завершил работу. Подтвердите выполнение заказа.`,
            data: { orderId, chatId: `chat_${orderId}_${order.selectedMasterId}` }
        });

        if (window.Cache) {
            Cache.remove(`master_responses_${user.uid}`);
            Cache.remove(`order_${orderId}`);
        }

        Utils.showSuccess('✅ Запрос на завершение отправлен');
        return { success: true, requiresConfirmation: true };
        
    } catch (error) {
        console.error('❌ Ошибка:', error);
        Utils.showError(error.message || 'Ошибка');
        return { success: false, error: error.message };
    } finally {
        if (taskId) window.Loader?.hide(taskId);
    }
}

    // ===== ПОДТВЕРЖДЕНИЕ ЗАВЕРШЕНИЯ (КЛИЕНТ) =====
    async function confirmCompletion(orderId, clientReview = null, skipOffline = false) {
        const taskId = window.Loader?.show('Подтверждение завершения...');

        try {
            if (!checkAuth()) return { success: false, error: 'Необходимо авторизоваться' };

            if (!skipOffline && !navigator.onLine) {
                addToOfflineQueue({ type: 'confirmCompletion', orderId, review: clientReview });
                Utils.showWarning('Подтверждение будет отправлено при подключении');
                return { success: true, queued: true };
            }

            const user = getUserSafe();
            if (!user) return { success: false, error: 'Ошибка получения данных пользователя' };

            const order = await DataService.getOrder(orderId);
            if (!order) throw new Error('Заказ не найден');

            if (order.clientId !== user.uid) {
                throw new Error('Только клиент может подтвердить завершение');
            }

            if (normalizeStatus(order.status) !== ORDER_STATUS.AWAITING_CONFIRMATION) {
                throw new Error('Заказ не ожидает подтверждения');
            }

            const updateData = {
                status: ORDER_STATUS.COMPLETED,
                completedAt: new Date().toISOString()
            };

            if (clientReview && clientReview.rating) {
                updateData.clientReview = {
                    rating: clientReview.rating,
                    text: clientReview.text?.trim() || '',
                    createdAt: new Date().toISOString()
                };

                // Обновляем рейтинг мастера
                const master = await DataService.getUser(order.selectedMasterId).catch(() => null);
                if (master) {
                    const currentRating = master.rating || 0;
                    const currentReviews = master.reviews || 0;
                    const newRating = ((currentRating * currentReviews) + clientReview.rating) / (currentReviews + 1);

                    await DataService.updateUser(order.selectedMasterId, {
                        rating: newRating,
                        reviews: currentReviews + 1
                    });
                }
            }

            await DataService.updateOrder(orderId, updateData);

            // Уменьшаем activeOrders клиента
            const client = await DataService.getUser(order.clientId);
            if (client) {
                await DataService.updateUser(order.clientId, {
                    activeOrders: Math.max(0, (client.activeOrders || 0) - 1)
                });
            }

            // Обновляем чат
            const chatId = `chat_${orderId}_${order.selectedMasterId}`;
            const chat = await DataService.getChat(chatId);
            if (chat) {
                await DataService.updateChat(chatId, {
                    status: 'completed',
                    lastMessage: '✅ Заказ выполнен. Чат закрыт.',
                    lastMessageAt: new Date().toISOString()
                });
            }

            // Уведомление мастеру
            await DataService.createNotification({
                userId: order.selectedMasterId,
                type: 'order_completed',
                title: '✅ Заказ выполнен!',
                body: `Клиент подтвердил выполнение заказа. Спасибо за работу!`,
                data: { orderId, chatId }
            });

            if (window.Cache) {
                Cache.remove(`client_orders_${user.uid}`);
                Cache.remove(`master_responses_${order.selectedMasterId}`);
                Cache.remove(`order_${orderId}`);
            }

            Utils.showSuccess('✅ Заказ выполнен!');
            return { success: true };
        } catch (error) {
            console.error('❌ Ошибка:', error);
            Utils.showError(error.message || 'Ошибка');
            return { success: false, error: error.message };
        } finally {
            if (taskId) window.Loader?.hide(taskId);
        }
    }

    // ===== ОТМЕНА ЗАКАЗА =====
    async function cancelOrder(orderId, reason = '', skipOffline = false) {
        const taskId = window.Loader?.show('Отмена заказа...');

        try {
            if (!checkAuth()) return { success: false, error: 'Необходимо авторизоваться' };

            if (!skipOffline && !navigator.onLine) {
                addToOfflineQueue({ type: 'cancelOrder', orderId, reason });
                Utils.showWarning('Отмена будет выполнена при подключении');
                return { success: true, queued: true };
            }

            const user = getUserSafe();
            if (!user) return { success: false, error: 'Ошибка получения данных пользователя' };

            const order = await getOrderById(orderId);
            if (!order) throw new Error('Заказ не найден');

            if (order.clientId !== user.uid) {
                throw new Error('Вы не можете отменить этот заказ');
            }

            if (order.status !== ORDER_STATUS.OPEN) {
                throw new Error('Можно отменить только открытые заказы');
            }

            await DataService.updateOrder(orderId, {
                status: ORDER_STATUS.CANCELLED,
                cancelledAt: new Date().toISOString(),
                cancelReason: reason?.trim() || '',
                cancelledBy: 'client'
            });

            // Уменьшаем activeOrders клиента
            const client = await DataService.getUser(order.clientId);
            if (client) {
                await DataService.updateUser(order.clientId, {
                    activeOrders: Math.max(0, (client.activeOrders || 0) - 1)
                });
            }

            // Уведомляем мастеров
            if (order.responses && order.responses.length > 0) {
                for (const response of order.responses) {
                    const chatId = `chat_${orderId}_${response.masterId}`;
                    const chat = await DataService.getChat(chatId);
                    if (!chat) continue;

                    await DataService.sendMessage(chatId, {
                        senderId: 'system',
                        senderName: 'Система',
                        text: `❌ Заказ отменён клиентом. ${reason ? `Причина: ${reason}` : ''}`,
                        type: 'system',
                        read: false
                    });

                    await DataService.updateChat(chatId, {
                        status: 'cancelled',
                        lastMessage: '❌ Заказ отменён',
                        lastMessageAt: new Date().toISOString(),
                        [`unreadCount.${response.masterId}`]: (chat.unreadCount?.[response.masterId] || 0) + 1
                    });

                    await DataService.createNotification({
                        userId: response.masterId,
                        type: 'order_cancelled',
                        title: '❌ Заказ отменён',
                        body: `Клиент отменил заказ "${order.title || 'Заказ'}"`,
                        data: { orderId, chatId }
                    });
                }
            }

            if (window.Cache) {
                Cache.clear('open_orders');
                Cache.remove(`order_${orderId}`);
                Cache.remove(`client_orders_${user.uid}`);
            }

            Utils.showSuccess('✅ Заказ отменён');
            return { success: true };

        } catch (error) {
            console.error('❌ Ошибка отмены заказа:', error);
            Utils.showError(error.message || 'Ошибка отмены заказа');
            return { success: false, error: error.message };
        } finally {
            if (taskId) window.Loader?.hide(taskId);
        }
    }

    // ===== СТАТИСТИКА МАСТЕРА =====
    async function getMasterStats(masterId) {
        try {
            const cacheKey = `master_stats_${masterId}`;
            
            if (window.Cache) {
                const cached = Cache.get(cacheKey);
                if (cached) return cached;
            }

            const responses = await getMasterResponses(masterId, { force: true });

            const total = responses.length;
            const accepted = responses.filter(r => 
                r.status === ORDER_STATUS.IN_PROGRESS || 
                r.status === ORDER_STATUS.COMPLETED ||
                r.status === ORDER_STATUS.AWAITING_CONFIRMATION
            ).length;
            const completed = responses.filter(r => r.status === ORDER_STATUS.COMPLETED).length;
            const awaiting = responses.filter(r => r.status === ORDER_STATUS.AWAITING_CONFIRMATION).length;

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

            if (window.Cache) {
                Cache.set(cacheKey, stats, Cache.TTL.MEDIUM);
            }

            return stats;
        } catch (error) {
            console.error('❌ Ошибка статистики:', error);
            return { total: 0, accepted: 0, completed: 0, awaiting: 0, conversion: 0, earnings: 0 };
        }
    }

    // ===== ПОЛУЧЕНИЕ ЗАКАЗА ПО ID =====
    async function getOrderById(orderId, force = false) {
        try {
            const cacheKey = `order_${orderId}`;
            
            if (!force && window.Cache) {
                const cached = Cache.get(cacheKey);
                if (cached) return cached;
            }

            const order = await DataService.getOrder(orderId);
            
            if (order) {
                order.status = normalizeStatus(order.status);
            }
            
            if (order && window.Cache) {
                Cache.set(cacheKey, order, Cache.TTL.MEDIUM);
            }

            return order;
        } catch (error) {
            console.error('❌ Ошибка получения заказа:', error);
            return null;
        }
    }

    // ===== ПОДПИСКА НА ЗАКАЗЫ =====
    function subscribeToOrders(callback, filters = {}) {
        const constraints = [
            { type: 'where', field: 'status', operator: '==', value: ORDER_STATUS.OPEN },
            { type: 'orderBy', field: 'createdAt', direction: 'desc' },
            { type: 'limit', value: 50 }
        ];

        if (filters.category && filters.category !== 'all') {
            constraints.push({
                type: 'where',
                field: 'category',
                operator: '==',
                value: filters.category
            });
        }

        const unsubscribe = DataService.subscribeToCollection(
            'orders',
            constraints,
            (items) => {
                let filtered = items
                    .map(item => ({ ...item, status: normalizeStatus(item.status) }))
                    .filter(item => item.status === ORDER_STATUS.OPEN);

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
                
                if (window.Cache) {
                    Cache.clear('open_orders');
                }
            },
            (error) => {
                console.error('❌ Ошибка подписки:', error);
                callback([]);
            }
        );

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
            catch (error) { console.error(`❌ Ошибка отписки ${id}:`, error); }
        });
        activeListeners.clear();
        spamPrevention.clear();
    }

    // ===== ИНИЦИАЛИЗАЦИЯ =====
    function init() {
        window.addEventListener('online', () => {
            processOfflineQueue();
        });
        
        if (navigator.onLine) {
            setTimeout(processOfflineQueue, 2000);
        }
    }

    setTimeout(init, 1000);

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
        cancelOrder,
        getMasterStats,
        getOrderById,
        subscribeToOrders,
        cleanup,
        ORDER_STATUS,
        normalizeStatus,
        processOfflineQueue
    };

    window.__ORDERS_INITIALIZED__ = true;
    console.log('✅ Orders сервис загружен (эталонная версия)');
    
    return Object.freeze(api);
})();

window.Orders = Orders;