// ===== js/services/payments.js =====
// Платёжная система (ЮKassa + CloudPayments)

const Payments = (function() {
    // Константы
    const ORDER_STATUS = window.ORDER_STATUS || {
        COMPLETED: 'completed'
    };

    // Конфигурация
    const CONFIG = {
        // ЮKassa (тестовые)
        YUKASSA_SHOP_ID: 'ваш_shop_id',
        YUKASSA_SECRET_KEY: 'ваш_secret_key',
        
        // CloudPayments (тестовые)
        CLOUDPAYMENTS_PUBLIC_ID: 'ваш_public_id',
        CLOUDPAYMENTS_API_KEY: 'ваш_api_key',
        
        // Режим
        TEST_MODE: true
    };

    /**
     * Создание платежа (ЮKassa)
     */
    async function createPaymentYooKassa(orderId, amount, description) {
        try {
            if (!Auth.isAuthenticated()) {
                throw new Error('Необходимо авторизоваться');
            }

            const user = Auth.getUser();
            
            // В тестовом режиме имитируем оплату
            if (CONFIG.TEST_MODE) {
                console.log('🧪 Тестовый платёж:', { orderId, amount });
                
                // Сохраняем в БД
                const paymentRef = await db.collection('payments').add({
                    orderId: orderId,
                    userId: user.uid,
                    amount: amount,
                    status: 'pending',
                    method: 'yookassa_test',
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
            }

            // Реальная интеграция с ЮKassa
            const response = await fetch('https://api.yookassa.ru/v3/payments', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Basic ' + btoa(CONFIG.YUKASSA_SHOP_ID + ':' + CONFIG.YUKASSA_SECRET_KEY),
                    'Idempotence-Key': Date.now().toString()
                },
                body: JSON.stringify({
                    amount: {
                        value: amount.toFixed(2),
                        currency: 'RUB'
                    },
                    capture: true,
                    confirmation: {
                        type: 'redirect',
                        return_url: window.location.origin + '/payment-success.html'
                    },
                    description: description || `Оплата заказа #${orderId}`,
                    metadata: {
                        orderId: orderId,
                        userId: user.uid
                    }
                })
            });

            const payment = await response.json();
            
            if (payment.id) {
                // Сохраняем в БД
                await db.collection('payments').add({
                    orderId: orderId,
                    userId: user.uid,
                    amount: amount,
                    paymentId: payment.id,
                    status: 'pending',
                    method: 'yookassa',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });

                return {
                    success: true,
                    paymentId: payment.id,
                    confirmationUrl: payment.confirmation.confirmation_url
                };
            } else {
                throw new Error(payment.description || 'Ошибка создания платежа');
            }
            
        } catch (error) {
            console.error('Ошибка платежа:', error);
            Helpers.showNotification(`❌ ${error.message}`, 'error');
            return { success: false, error: error.message };
        }
    }

    /**
     * Создание платежа (CloudPayments)
     */
    async function createPaymentCloudPayments(orderId, amount, description) {
        try {
            if (!Auth.isAuthenticated()) {
                throw new Error('Необходимо авторизоваться');
            }

            const user = Auth.getUser();

            if (CONFIG.TEST_MODE) {
                return createPaymentYooKassa(orderId, amount, description);
            }

            // Создаём криптограмму карты (через виджет)
            const cryptogram = await getCardCryptogram();
            
            const response = await fetch('https://api.cloudpayments.ru/payments/cards/charge', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Basic ' + btoa(CONFIG.CLOUDPAYMENTS_PUBLIC_ID + ':' + CONFIG.CLOUDPAYMENTS_API_KEY)
                },
                body: JSON.stringify({
                    Amount: amount,
                    Currency: 'RUB',
                    IpAddress: '127.0.0.1',
                    Name: user.email,
                    CardCryptogramPacket: cryptogram,
                    Description: description || `Оплата заказа #${orderId}`,
                    InvoiceId: orderId,
                    AccountId: user.uid
                })
            });

            const result = await response.json();
            
            if (result.Success) {
                await db.collection('payments').add({
                    orderId: orderId,
                    userId: user.uid,
                    amount: amount,
                    transactionId: result.Model.TransactionId,
                    status: 'succeeded',
                    method: 'cloudpayments',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });

                return { success: true, transactionId: result.Model.TransactionId };
            } else {
                throw new Error(result.Message || 'Ошибка оплаты');
            }
            
        } catch (error) {
            console.error('Ошибка платежа:', error);
            Helpers.showNotification(`❌ ${error.message}`, 'error');
            return { success: false, error: error.message };
        }
    }

    /**
     * Получение криптограммы карты (тестовая заглушка)
     */
    function getCardCryptogram() {
        return new Promise((resolve) => {
            console.warn('getCardCryptogram: тестовый режим');
            resolve('test_cryptogram');
        });
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

            Helpers.showNotification('✅ Оплата прошла успешно!', 'success');
            
        } catch (error) {
            console.error('Ошибка подтверждения:', error);
        }
    }

    /**
     * Создание безопасной сделки (холдирование)
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

            Helpers.showNotification('✅ Деньги переведены мастеру', 'success');
            
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
        createPaymentYooKassa,
        createPaymentCloudPayments,
        confirmPayment,
        releasePayment,
        checkPaymentStatus
    };
})();

window.Payments = Payments;