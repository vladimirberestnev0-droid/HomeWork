const Orders = (function() {
    // Антиспам: храним время последнего отклика
    const spamPrevention = new Map();

    // ===== ПРОВЕРКИ =====
    function checkFirebase() {
        if (typeof window.db === 'undefined' || !window.db) {
            console.warn('⏳ Firestore не инициализирован');
            return false;
        }
        if (typeof window.storage === 'undefined' || !window.storage) {
            console.warn('⏳ Storage не инициализирован');
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
        if (window.Moderation && Moderation.check) {
            return Moderation.check(text, context);
        }
        return { isValid: true };
    }

    // ===== СОЗДАНИЕ ЧАТА =====
    async function createChat(orderId, masterId, clientId, orderData) {
        try {
            if (!checkFirebase()) return { success: false, error: 'Firestore недоступен' };
            
            const chatId = `chat_${orderId}_${masterId}`;
            const chatRef = db.collection('chats').doc(chatId);
            
            // Проверяем, существует ли уже чат
            const chatDoc = await chatRef.get();
            if (chatDoc.exists) {
                console.log('📝 Чат уже существует:', chatId);
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
            
            // Добавляем системное сообщение
            await chatRef.collection('messages').add({
                senderId: 'system',
                senderName: 'Система',
                text: '✅ Мастер выбран! Теперь вы можете общаться.',
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                type: 'system'
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
            
            const user = Auth.getUser();
            const userData = Auth.getUserData();

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
            const modResult = await checkModeration(orderData.title, 'order_title');
            if (!modResult.isValid) {
                return { success: false, error: 'Текст не прошел модерацию' };
            }

            // Загружаем фото
            const photoUrls = [];
            if (orderData.photos && orderData.photos.length > 0) {
                for (const file of orderData.photos) {
                    try {
                        const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
                        const storageRef = storage.ref(`orders/${fileName}`);
                        await storageRef.put(file);
                        const url = await storageRef.getDownloadURL();
                        photoUrls.push(url);
                    } catch (uploadError) {
                        console.error('Ошибка загрузки фото:', uploadError);
                    }
                }
            }

            // Извлекаем город из адреса
            const city = extractCity(orderData.address);

            const order = {
                category: orderData.category,
                title: orderData.title,
                description: orderData.description || '',
                price: parseInt(orderData.price),
                address: orderData.address,
                city: city,
                photos: photoUrls,
                clientId: user.uid,
                clientName: userData?.name || 'Клиент',
                clientPhone: userData?.phone || '',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                status: ORDER_STATUS.OPEN,
                responses: []
            };

            const docRef = await db.collection('orders').add(order);
            
            Utils.showNotification('✅ Заказ создан!', 'success');
            return { success: true, orderId: docRef.id };
            
        } catch (error) {
            console.error('❌ Ошибка создания заказа:', error);
            Utils.showNotification(`❌ ${error.message}`, 'error');
            return { success: false, error: error.message };
        }
    }

    // Извлечение города из адреса
    function extractCity(address) {
        if (!address || !window.CITIES) return 'другой';
        
        const addressLower = address.toLowerCase();
        for (const city of window.CITIES) {
            if (city.id !== 'all' && addressLower.includes(city.name.toLowerCase())) {
                return city.name.toLowerCase();
            }
        }
        return 'другой';
    }

    // ===== ПОЛУЧЕНИЕ ЗАКАЗОВ =====
    async function getOpenOrders(filters = {}) {
        try {
            if (!checkFirebase()) return [];
            
            let query = db.collection('orders')
                .where('status', '==', ORDER_STATUS.OPEN)
                .orderBy('createdAt', 'desc');

            if (filters.category && filters.category !== 'all') {
                query = query.where('category', '==', filters.category);
            }

            const snapshot = await query.get();
            
            let orders = [];
            snapshot.forEach(doc => {
                orders.push({ id: doc.id, ...doc.data() });
            });

            // Фильтр по городу (на клиенте, чтобы избежать составных индексов)
            if (filters.city && filters.city !== 'all' && window.CITIES) {
                const cityName = window.CITIES.find(c => c.id === filters.city)?.name?.toLowerCase();
                if (cityName) {
                    orders = orders.filter(o => 
                        o.city === cityName || 
                        (o.address && o.address.toLowerCase().includes(cityName))
                    );
                }
            }

            return orders;
        } catch (error) {
            console.error('❌ Ошибка загрузки заказов:', error);
            return [];
        }
    }

    async function getClientOrders(clientId, filter = 'all') {
        try {
            if (!checkFirebase()) return [];
            
            let query = db.collection('orders')
                .where('clientId', '==', clientId)
                .orderBy('createdAt', 'desc');

            if (filter !== 'all') {
                query = query.where('status', '==', filter);
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

    async function getMasterResponses(masterId) {
        try {
            if (!checkFirebase()) return [];
            
            // Получаем все заказы (лимит 100 для производительности)
            const snapshot = await db.collection('orders')
                .orderBy('createdAt', 'desc')
                .limit(100)
                .get();
            
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
            if (now - lastResponse < 5000) {
                return { success: false, error: 'Слишком частые отклики. Подождите несколько секунд.' };
            }
            spamPrevention.set(user.uid, now);
            setTimeout(() => spamPrevention.delete(user.uid), 5000);

            // Валидация
            if (!Utils.validatePrice(price)) {
                return { success: false, error: 'Цена должна быть от 500 до 1 000 000 ₽' };
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
                comment: comment || '',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            await db.collection('orders').doc(orderId).update({
                responses: firebase.firestore.FieldValue.arrayUnion(response)
            });

            Utils.showNotification('✅ Отклик отправлен!', 'success');
            return { success: true };
            
        } catch (error) {
            console.error('❌ Ошибка отклика:', error);
            Utils.showNotification(`❌ ${error.message}`, 'error');
            return { success: false, error: error.message };
        }
    }

    // ===== ВЫБОР МАСТЕРА =====
    async function selectMaster(orderId, masterId, price) {
        try {
            if (!checkFirebase()) return { success: false, error: 'Firestore недоступен' };
            if (!checkAuth()) return { success: false, error: 'Необходимо авторизоваться' };

            const user = Auth.getUser();
            
            // Получаем заказ
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

            Utils.showNotification('✅ Мастер выбран!', 'success');
            return { 
                success: true, 
                chatId: chatResult.chatId,
                orderId: orderId 
            };
            
        } catch (error) {
            console.error('❌ Ошибка выбора мастера:', error);
            Utils.showNotification(`❌ ${error.message}`, 'error');
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
                    customerReviews: firebase.firestore.FieldValue.arrayUnion({
                        masterId: user.uid,
                        masterName: Auth.getUserData()?.name || 'Мастер',
                        rating: clientReview.rating,
                        text: clientReview.text || '',
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

            Utils.showNotification('✅ Заказ выполнен!', 'success');
            return { success: true };
            
        } catch (error) {
            console.error('❌ Ошибка завершения заказа:', error);
            Utils.showNotification(`❌ ${error.message}`, 'error');
            return { success: false, error: error.message };
        }
    }

    // ===== ПОЛУЧЕНИЕ СТАТИСТИКИ МАСТЕРА =====
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
            if (!checkFirebase()) return null;
            
            const doc = await db.collection('orders').doc(orderId).get();
            if (!doc.exists) return null;
            return { id: doc.id, ...doc.data() };
        } catch (error) {
            console.error('Ошибка получения заказа:', error);
            return null;
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
        getMasterStats,
        getOrderById,
        ORDER_STATUS
    };
})();

window.Orders = Orders;