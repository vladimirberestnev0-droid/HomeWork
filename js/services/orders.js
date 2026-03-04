const Orders = (function() {
    // Антиспам: храним время последнего отклика
    const spamPrevention = new Map();

    // ===== ВСПОМОГАТЕЛЬНЫЕ =====
    function checkFirebase() {
        if (!window.db) {
            console.error('❌ Firestore не инициализирован');
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

    // ===== СОЗДАНИЕ ЧАТА =====
    async function createChat(orderId, masterId, clientId, orderData) {
        try {
            const chatId = `chat_${orderId}_${masterId}`;
            const chatRef = db.collection('chats').doc(chatId);
            
            const chatDoc = await chatRef.get();
            if (chatDoc.exists) return { success: true, chatId };
            
            await chatRef.set({
                participants: [clientId, masterId],
                orderId: orderId,
                orderTitle: orderData.title || 'Заказ',
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
            if (!Auth.isAuthenticated()) throw new Error('Необходимо авторизоваться');
            if (!Auth.isClient()) throw new Error('Только клиенты могут создавать заказы');
            if (!orderData.title || orderData.title.length < 5) throw new Error('Название должно быть не менее 5 символов');
            if (!orderData.category) throw new Error('Выберите категорию');
            if (!Utils.validatePrice(orderData.price)) throw new Error('Цена должна быть от 500 до 1 000 000 ₽');
            if (!orderData.address) throw new Error('Укажите адрес');

            const modResult = await checkModeration(orderData.title, 'order_title');
            if (!modResult.isValid) throw new Error('Текст не прошел модерацию');

            // Загружаем фото
            const photoUrls = [];
            if (orderData.photos && orderData.photos.length > 0) {
                for (const file of orderData.photos) {
                    const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
                    const storageRef = storage.ref(`orders/${fileName}`);
                    await storageRef.put(file);
                    const url = await storageRef.getDownloadURL();
                    photoUrls.push(url);
                }
            }

            const order = {
                category: orderData.category,
                title: orderData.title,
                description: orderData.description || '',
                price: parseInt(orderData.price),
                address: orderData.address,
                photos: photoUrls,
                clientId: Auth.getUser().uid,
                clientName: Auth.getUserData()?.name || 'Клиент',
                clientPhone: Auth.getUserData()?.phone || '',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                status: ORDER_STATUS.OPEN,
                responses: [],
                city: extractCity(orderData.address)
            };

            const docRef = await db.collection('orders').add(order);
            Utils.showNotification('✅ Заказ создан!', 'success');
            return { success: true, orderId: docRef.id };
        } catch (error) {
            console.error('Ошибка создания заказа:', error);
            Utils.showNotification(`❌ ${error.message}`, 'error');
            return { success: false, error: error.message };
        }
    }

    // Извлечение города из адреса
    function extractCity(address) {
        const cityNames = CITIES.map(c => c.name.toLowerCase());
        for (const city of cityNames) {
            if (address.toLowerCase().includes(city)) return city;
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

            // Фильтр по городу на клиенте (проще, чем составной индекс)
            if (filters.city && filters.city !== 'all') {
                const cityName = CITIES.find(c => c.id === filters.city)?.name.toLowerCase();
                if (cityName) {
                    orders = orders.filter(o => 
                        o.city === cityName || o.address?.toLowerCase().includes(cityName)
                    );
                }
            }

            return orders;
        } catch (error) {
            console.error('Ошибка загрузки заказов:', error);
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
            console.error('Ошибка загрузки заказов клиента:', error);
            return [];
        }
    }

    async function getMasterResponses(masterId) {
        try {
            if (!checkFirebase()) return [];
            
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
            
            return responses;
        } catch (error) {
            console.error('Ошибка загрузки откликов:', error);
            return [];
        }
    }

    // ===== ОТКЛИК НА ЗАКАЗ =====
    async function respondToOrder(orderId, price, comment) {
        try {
            if (!checkFirebase()) return { success: false, error: 'Firestore недоступен' };
            if (!Auth.isAuthenticated()) throw new Error('Необходимо авторизоваться');
            if (!Auth.isMaster()) throw new Error('Только мастера могут откликаться');

            const user = Auth.getUser();
            
            // Антиспам
            const now = Date.now();
            if (spamPrevention.has(user.uid) && now - spamPrevention.get(user.uid) < 5000) {
                throw new Error('Слишком частые отклики. Подождите несколько секунд.');
            }
            spamPrevention.set(user.uid, now);
            setTimeout(() => spamPrevention.delete(user.uid), 5000);

            if (!Utils.validatePrice(price)) throw new Error('Цена должна быть от 500 до 1 000 000 ₽');

            if (comment) {
                const modResult = await checkModeration(comment, 'master_comment');
                if (!modResult.isValid) throw new Error('Комментарий не прошел модерацию');
            }

            const orderDoc = await db.collection('orders').doc(orderId).get();
            if (!orderDoc.exists) throw new Error('Заказ не найден');
            
            const orderData = orderDoc.data();
            if (orderData.status !== ORDER_STATUS.OPEN) throw new Error('Заказ уже неактивен');
            if (orderData.responses?.some(r => r.masterId === user.uid)) {
                throw new Error('Вы уже откликались на этот заказ');
            }

            const userData = Auth.getUserData();
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
            console.error('Ошибка отклика:', error);
            Utils.showNotification(`❌ ${error.message}`, 'error');
            return { success: false, error: error.message };
        }
    }

    // ===== ВЫБОР МАСТЕРА =====
    async function selectMaster(orderId, masterId, price) {
        try {
            if (!checkFirebase()) return { success: false, error: 'Firestore недоступен' };
            if (!Auth.isAuthenticated()) throw new Error('Необходимо авторизоваться');

            const user = Auth.getUser();
            const orderDoc = await db.collection('orders').doc(orderId).get();
            
            if (!orderDoc.exists) throw new Error('Заказ не найден');
            
            const orderData = orderDoc.data();
            if (orderData.clientId !== user.uid) throw new Error('Вы не можете выбрать мастера для этого заказа');
            if (orderData.status !== ORDER_STATUS.OPEN) throw new Error('Заказ уже неактивен');
            
            const hasResponse = orderData.responses?.some(r => r.masterId === masterId);
            if (!hasResponse) throw new Error('Этот мастер не откликался на заказ');

            // Обновляем заказ
            await db.collection('orders').doc(orderId).update({
                status: ORDER_STATUS.IN_PROGRESS,
                selectedMasterId: masterId,
                selectedPrice: price,
                selectedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // Создаём чат
            const chatResult = await createChat(orderId, masterId, user.uid, orderData);

            Utils.showNotification('✅ Мастер выбран! Чат создан.', 'success');
            return { success: true, chatId: chatResult.chatId };
        } catch (error) {
            console.error('Ошибка выбора мастера:', error);
            Utils.showNotification(`❌ ${error.message}`, 'error');
            return { success: false, error: error.message };
        }
    }

    // ===== ЗАВЕРШЕНИЕ ЗАКАЗА =====
    async function completeOrder(orderId, clientReview = null) {
        try {
            if (!checkFirebase()) return { success: false, error: 'Firestore недоступен' };
            
            const orderDoc = await db.collection('orders').doc(orderId).get();
            if (!orderDoc.exists) throw new Error('Заказ не найден');
            
            const orderData = orderDoc.data();
            const user = Auth.getUser();
            
            if (!user) throw new Error('Необходимо авторизоваться');
            if (orderData.selectedMasterId !== user.uid) throw new Error('Только мастер может завершить заказ');

            // Если мастер оставил отзыв о клиенте
            if (clientReview) {
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
            }

            // Обновляем статус заказа
            await db.collection('orders').doc(orderId).update({
                status: ORDER_STATUS.COMPLETED,
                completedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // Блокируем чат
            const chatId = `chat_${orderId}_${orderData.selectedMasterId}`;
            await db.collection('chats').doc(chatId).update({
                status: 'completed',
                lastMessage: '✅ Заказ выполнен. Чат закрыт.'
            });

            Utils.showNotification('✅ Заказ выполнен!', 'success');
            return { success: true };
        } catch (error) {
            console.error('Ошибка завершения заказа:', error);
            Utils.showNotification(`❌ ${error.message}`, 'error');
            return { success: false, error: error.message };
        }
    }

    // ===== ПОЛУЧЕНИЕ СТАТИСТИКИ =====
    async function getMasterStats(masterId) {
        try {
            const responses = await getMasterResponses(masterId);
            const total = responses.length;
            const accepted = responses.filter(r => r.status === ORDER_STATUS.IN_PROGRESS || r.status === ORDER_STATUS.COMPLETED).length;
            const completed = responses.filter(r => r.status === ORDER_STATUS.COMPLETED).length;
            
            return { total, accepted, completed, conversion: total > 0 ? Math.round((accepted / total) * 100) : 0 };
        } catch (error) {
            return { total: 0, accepted: 0, completed: 0, conversion: 0 };
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
        ORDER_STATUS
    };
})();

window.Orders = Orders;