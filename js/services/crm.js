// ===== js/services/crm.js =====
// CRM для мастеров

const MasterCRM = (function() {
    /**
     * Получение клиентской базы
     */
    async function getClientBase(masterId) {
        try {
            const ordersSnapshot = await db.collection('orders')
                .where('selectedMasterId', '==', masterId)
                .get();

            const clients = new Map();

            for (const doc of ordersSnapshot.docs) {
                const order = doc.data();
                const clientId = order.clientId;
                
                if (!clientId) continue;
                
                if (!clients.has(clientId)) {
                    const clientDoc = await db.collection('users').doc(clientId).get();
                    const client = clientDoc.exists ? clientDoc.data() : { name: 'Клиент' };
                    
                    clients.set(clientId, {
                        id: clientId,
                        name: client.name || 'Клиент',
                        phone: client.phone || '',
                        email: client.email || '',
                        orders: [],
                        totalSpent: 0,
                        lastOrder: null
                    });
                }

                const clientData = clients.get(clientId);
                clientData.orders.push({
                    id: doc.id,
                    title: order.title || 'Заказ',
                    price: order.price || 0,
                    date: order.createdAt,
                    status: order.status
                });
                clientData.totalSpent += order.price || 0;
                
                if (!clientData.lastOrder || 
                    (order.createdAt && (!clientData.lastOrder || order.createdAt > clientData.lastOrder))) {
                    clientData.lastOrder = order.createdAt;
                }
            }

            return Array.from(clients.values());
            
        } catch (error) {
            console.error('Ошибка загрузки клиентов:', error);
            return [];
        }
    }

    /**
     * Создание сметы
     */
    async function createEstimate(orderId, items) {
        try {
            const orderDoc = await db.collection('orders').doc(orderId).get();
            if (!orderDoc.exists) {
                throw new Error('Заказ не найден');
            }
            
            const order = orderDoc.data();

            const total = items.reduce((sum, item) => sum + ((item.price || 0) * (item.quantity || 1)), 0);

            const estimate = {
                orderId: orderId,
                masterId: order.selectedMasterId,
                clientId: order.clientId,
                items: items,
                total: total,
                status: 'draft',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            const docRef = await db.collection('estimates').add(estimate);

            // Отправляем клиенту
            await db.collection('notifications').add({
                userId: order.clientId,
                type: 'estimate_ready',
                title: '📋 Готова смета',
                body: `Сумма: ${total} ₽`,
                data: { estimateId: docRef.id, orderId: orderId },
                read: false,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            return { success: true, id: docRef.id };
            
        } catch (error) {
            console.error('Ошибка создания сметы:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Генерация договора
     */
    async function generateContract(orderId) {
        try {
            const orderDoc = await db.collection('orders').doc(orderId).get();
            if (!orderDoc.exists) {
                throw new Error('Заказ не найден');
            }
            
            const order = orderDoc.data();

            const masterDoc = await db.collection('users').doc(order.selectedMasterId).get();
            const master = masterDoc.exists ? masterDoc.data() : { name: 'Мастер' };

            const clientDoc = await db.collection('users').doc(order.clientId).get();
            const client = clientDoc.exists ? clientDoc.data() : { name: 'Клиент' };

            const today = new Date().toLocaleDateString('ru-RU');

            const contract = `
ДОГОВОР ВОЗМЕЗДНОГО ОКАЗАНИЯ УСЛУГ №${orderId.slice(-6)}

г. Москва                                         ${today}

1. СТОРОНЫ ДОГОВОРА
Исполнитель: ${master.name || 'Мастер'} (ИП)
Заказчик: ${client.name || 'Клиент'}

2. ПРЕДМЕТ ДОГОВОРА
Исполнитель обязуется оказать услуги:
"${order.title || 'Заказ'}"
Описание: ${order.description || 'Без описания'}

3. СТОИМОСТЬ И ПОРЯДОК РАСЧЕТОВ
Стоимость работ: ${order.price || 0} ₽
Порядок оплаты: 
- Предоплата: 0 ₽
- Окончательный расчет: ${order.price || 0} ₽

4. СРОКИ ВЫПОЛНЕНИЯ
Начало работ: ${new Date().toLocaleDateString('ru-RU')}
Окончание работ: в течение 7 дней

5. ПОДПИСИ СТОРОН
__________________ (${master.name || 'Мастер'})
__________________ (${client.name || 'Клиент'})
            `;

            // Сохраняем в Firebase
            await db.collection('contracts').add({
                orderId: orderId,
                masterId: order.selectedMasterId,
                clientId: order.clientId,
                text: contract,
                signedByMaster: false,
                signedByClient: false,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            return contract;
            
        } catch (error) {
            console.error('Ошибка генерации договора:', error);
            return null;
        }
    }

    /**
     * Создание акта выполненных работ
     */
    async function createCompletionAct(orderId) {
        try {
            const orderDoc = await db.collection('orders').doc(orderId).get();
            if (!orderDoc.exists) {
                throw new Error('Заказ не найден');
            }
            
            const order = orderDoc.data();

            const master = await db.collection('users').doc(order.selectedMasterId).get();
            const client = await db.collection('users').doc(order.clientId).get();

            const today = new Date().toLocaleDateString('ru-RU');

            const act = `
АКТ ВЫПОЛНЕННЫХ РАБОТ №${orderId.slice(-6)}

Исполнитель: ${master.exists ? master.data().name : 'Мастер'}
Заказчик: ${client.exists ? client.data().name : 'Клиент'}

Мы, нижеподписавшиеся, составили настоящий акт о том, что:
Исполнитель выполнил, а Заказчик принял работы по договору №${orderId.slice(-6)}.

Работы выполнены в полном объеме, качество соответствует требованиям.

Сумма: ${order.price || 0} ₽

Претензий к Исполнителю не имею.

Подписи:
Исполнитель: __________________
Заказчик: __________________

Дата: ${today}
            `;

            // Сохраняем
            await db.collection('acts').add({
                orderId: orderId,
                text: act,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            return act;
            
        } catch (error) {
            console.error('Ошибка создания акта:', error);
            return null;
        }
    }

    // Публичное API
    return {
        getClientBase,
        createEstimate,
        generateContract,
        createCompletionAct
    };
})();

window.MasterCRM = MasterCRM;