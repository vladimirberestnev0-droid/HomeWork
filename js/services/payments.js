// ===== js/services/payments.js =====
// Платёжная система (тестовая версия для клиента)

const Payments = (function() {
    // Константы
    const ORDER_STATUS = window.ORDER_STATUS || {
        COMPLETED: 'completed'
    };

    // Конфигурация (ключи загружаются из мета-тегов или переменных)
    const CONFIG = {
        // Ключи получаем из мета-тегов на странице
        YUKASSA_SHOP_ID: document.querySelector('meta[name="yookassa-shop-id"]')?.content || 'test_shop',
        CLOUDPAYMENTS_PUBLIC_ID: document.querySelector('meta[name="cloudpayments-public-id"]')?.content || 'test_public',
        
        // Режим (всегда тестовый на клиенте)
        TEST_MODE: true
    };

    /**
     * Создание платежа (всегда тестовый режим на клиенте)
     */
    async function createPayment(orderId, amount, description, method = 'yookassa') {
        try {
            if (!Auth.isAuthenticated()) {
                throw new Error('Необходимо авторизоваться');
            }

            const user = Auth.getUser();
            
            console.log('🧪 Тестовый платёж:', { orderId, amount, method });
            
            // Сохраняем в БД
            const paymentRef = await db.collection('payments').add({
                orderId: orderId,
                userId: user.uid,
                amount: amount,
                status: 'pending',
                method: method + '_test',
                description: description,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // Имитация успешной оплаты через 3 секунды
            setTimeout(() => {
                confirmPayment(paymentRef.id, {
                    id: 'test_' + Date.now(),
                    status: 'succeeded'
                });
            }, 3000);

            return {
                success: true,
                paymentId: paymentRef.id,
                confirmationUrl: '#test-payment',
                testMode: true
            };
            
        } catch (error) {
            console.error('Ошибка платежа:', error);
            if (window.Helpers && Helpers.showNotification) {
                Helpers.showNotification(`❌ ${error.message}`, 'error');
            }
            return { success: false, error: error.message };
        }
    }

    /**
     * Подтверждение платежа
     */
    async function confirmPayment(paymentId, paymentData) {
        try {
            const paymentRef = db.collection('payments').doc(paymentId);
            const payment = await paymentRef.get();
            
            if (!payment.exists) {
                throw new Error('Платёж не найден');
            }

            const data = payment.data();
            
            // Обновляем статус платежа
            await paymentRef.update({
                status: 'succeeded',
                confirmedAt: firebase.firestore.FieldValue.serverTimestamp(),
                paymentData: paymentData
            });

            // Создаём безопасную сделку
            await createSafeDeal(data.orderId, data.userId, data.amount);

            // Отправляем уведомление
            await db.collection('notifications').add({
                userId: data.userId,
                type: 'payment_success',
                title: '✅ Оплата прошла успешно',
                body: `Сумма: ${data.amount} ₽`,
                data: { orderId: data.orderId },
                read: false,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            if (window.Helpers && Helpers.showNotification) {
                Helpers.showNotification('✅ Оплата прошла успешно!', 'success');
            }
            
        } catch (error) {
            console.error('Ошибка подтверждения:', error);
        }
    }

    /**
     * Создание безопасной сделки
     */
    async function createSafeDeal(orderId, clientId, amount) {
        try {
            const orderDoc = await db.collection('orders').doc(orderId).get();
            if (!orderDoc.exists) {
                throw new Error('Заказ не найден');
            }
            
            const order = orderDoc.data();
            
            if (!order.selectedMasterId) {
                throw new Error('Мастер не выбран');
            }

            await db.collection('deals').add({
                orderId: orderId,
                clientId: clientId,
                masterId: order.selectedMasterId,
                amount: amount,
                status: 'hold',
                heldAt: firebase.firestore.FieldValue.serverTimestamp(),
                releasedAt: null
            });

            console.log('🔒 Безопасная сделка создана');
            
        } catch (error) {
            console.error('Ошибка создания сделки:', error);
        }
    }

    /**
     * Завершение сделки (выплата мастеру)
     */
    async function releasePayment(orderId) {
        try {
            const dealSnapshot = await db.collection('deals')
                .where('orderId', '==', orderId)
                .where('status', '==', 'hold')
                .limit(1)
                .get();

            if (dealSnapshot.empty) {
                throw new Error('Сделка не найдена');
            }

            const deal = dealSnapshot.docs[0];
            
            await deal.ref.update({
                status: 'released',
                releasedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // Уведомление мастеру
            await db.collection('notifications').add({
                userId: deal.data().masterId,
                type: 'payment_released',
                title: '💰 Деньги зачислены',
                body: `Сумма: ${deal.data().amount} ₽`,
                data: { orderId: orderId },
                read: false,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            if (window.Helpers && Helpers.showNotification) {
                Helpers.showNotification('✅ Деньги переведены мастеру', 'success');
            }
            
        } catch (error) {
            console.error('Ошибка выплаты:', error);
        }
    }

    /**
     * Проверка статуса платежа
     */
    async function checkPaymentStatus(orderId) {
        try {
            const snapshot = await db.collection('payments')
                .where('orderId', '==', orderId)
                .orderBy('createdAt', 'desc')
                .limit(1)
                .get();

            if (snapshot.empty) {
                return { status: 'none' };
            }

            const payment = snapshot.docs[0].data();
            return { status: payment.status, data: payment };
            
        } catch (error) {
            console.error('Ошибка проверки статуса:', error);
            return { status: 'error' };
        }
    }

    // Публичное API
    return {
        createPayment,
        confirmPayment,
        releasePayment,
        checkPaymentStatus
    };
})();

window.Payments = Payments;