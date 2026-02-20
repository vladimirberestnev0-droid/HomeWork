// ===== js/services/ai-assistant.js =====
// ИИ-помощник (клиентская часть, только заглушки)

const AIAssistant = (function() {
    // Конфигурация (без ключей!)
    const CONFIG = {
        API_URL: 'https://us-central1-homework-6a562.cloudfunctions.net/aiProxy',
        TEST_MODE: true
    };

    /**
     * Подбор мастера под заказ (тестовая версия)
     */
    async function findBestMaster(orderData) {
        try {
            if (!orderData || !orderData.id) {
                console.warn('Нет данных заказа');
                return [];
            }

            console.log('🤖 ИИ подбирает мастера для:', orderData.title);

            // Получаем всех мастеров
            const mastersSnapshot = await db.collection('users')
                .where('role', '==', 'master')
                .where('banned', '==', false)
                .get();

            const masters = [];
            mastersSnapshot.forEach(doc => {
                masters.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            // Простая сортировка по рейтингу и категориям
            return masters
                .filter(m => {
                    const categories = (m.categories || '').toLowerCase();
                    return categories.includes((orderData.category || '').toLowerCase());
                })
                .sort((a, b) => (b.rating || 0) - (a.rating || 0))
                .slice(0, 5);
            
        } catch (error) {
            console.error('Ошибка ИИ подбора:', error);
            return [];
        }
    }

    /**
     * Предложение цены на основе статистики
     */
    async function suggestPrice(category, description) {
        try {
            // Собираем статистику по похожим заказам
            const snapshot = await db.collection('orders')
                .where('category', '==', category)
                .where('status', '==', 'completed')
                .limit(100)
                .get();

            const prices = [];
            snapshot.forEach(doc => {
                prices.push(doc.data().price);
            });

            if (prices.length === 0) {
                return {
                    min: 1000,
                    max: 5000,
                    avg: 2500,
                    recommended: 3000
                };
            }

            // Статистика
            prices.sort((a, b) => a - b);
            const min = prices[0];
            const max = prices[prices.length - 1];
            const avg = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
            
            // Медиана
            const mid = Math.floor(prices.length / 2);
            const median = prices.length % 2 ? prices[mid] : (prices[mid - 1] + prices[mid]) / 2;

            return {
                min,
                max,
                avg,
                median,
                recommended: Math.round(median),
                confidence: prices.length > 50 ? 'high' : 'medium'
            };
            
        } catch (error) {
            console.error('Ошибка расчёта цены:', error);
            return null;
        }
    }

    // Публичное API
    return {
        findBestMaster,
        suggestPrice
    };
})();

window.AIAssistant = AIAssistant;