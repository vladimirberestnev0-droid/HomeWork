// ===== js/services/ai-assistant.js =====
// ИИ-помощник на базе OpenAI/GigaChat

const AIAssistant = (function() {
    // Конфигурация
    const CONFIG = {
        // OpenAI (можно заменить на GigaChat)
        API_KEY: 'ваш_openai_api_key',
        API_URL: 'https://api.openai.com/v1/chat/completions',
        MODEL: 'gpt-3.5-turbo',
        GOOGLE_VISION_KEY: 'ваш_vision_api_key',
        
        // Режим
        TEST_MODE: true
    };

    /**
     * Подбор мастера под заказ
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
                .where('role', '==', USER_ROLE.MASTER)
                .where('banned', '==', false)
                .get();

            const masters = [];
            mastersSnapshot.forEach(doc => {
                masters.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            if (CONFIG.TEST_MODE) {
                // Тестовая логика: просто сортируем по рейтингу
                return masters
                    .filter(m => {
                        const categories = (m.categories || '').toLowerCase();
                        return categories.includes((orderData.category || '').toLowerCase());
                    })
                    .sort((a, b) => (b.rating || 0) - (a.rating || 0))
                    .slice(0, 5);
            }

            // Реальная OpenAI логика
            const prompt = `
                Дан заказ: ${orderData.title}
                Описание: ${orderData.description}
                Категория: ${orderData.category}
                Бюджет: ${orderData.price} ₽
                
                Список мастеров: ${JSON.stringify(masters.map(m => ({
                    name: m.name,
                    rating: m.rating,
                    reviews: m.reviews,
                    categories: m.categories,
                    completedJobs: m.completedJobs
                })))}
                
                Выбери 5 самых подходящих мастеров и объясни почему.
                Ответ в формате JSON с полями: masterIds, reasons
            `;

            const response = await fetch(CONFIG.API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${CONFIG.API_KEY}`
                },
                body: JSON.stringify({
                    model: CONFIG.MODEL,
                    messages: [
                        { role: 'system', content: 'Ты эксперт по подбору мастеров' },
                        { role: 'user', content: prompt }
                    ],
                    temperature: 0.7
                })
            });

            const data = await response.json();
            const result = JSON.parse(data.choices[0].message.content);
            
            // Сохраняем рекомендации
            await db.collection('ai_recommendations').add({
                orderId: orderData.id,
                recommendations: result.masterIds,
                reasons: result.reasons,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            return masters.filter(m => result.masterIds.includes(m.id));
            
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
                .where('status', '==', ORDER_STATUS.COMPLETED)
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

            // ИИ анализ описания
            let boost = 1.0;
            const keywords = {
                'срочно': 1.3,
                'сложный': 1.4,
                'дорогой': 1.2,
                'ночью': 1.5,
                'выходной': 1.2,
                'гарантия': 1.1
            };

            const desc = (description || '').toLowerCase();
            Object.entries(keywords).forEach(([word, mult]) => {
                if (desc.includes(word)) boost *= mult;
            });

            const recommended = Math.round(median * boost);

            return {
                min,
                max,
                avg,
                median,
                recommended,
                confidence: prices.length > 50 ? 'high' : 'medium'
            };
            
        } catch (error) {
            console.error('Ошибка расчёта цены:', error);
            return null;
        }
    }

    /**
     * Проверка фото на качество
     */
    async function analyzePhoto(imageUrl) {
        try {
            if (CONFIG.TEST_MODE) {
                return {
                    quality: 'good',
                    issues: [],
                    suggestions: []
                };
            }

            if (!CONFIG.GOOGLE_VISION_KEY) {
                throw new Error('GOOGLE_VISION_KEY не настроен');
            }

            // Здесь интеграция с Google Vision API
            const response = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${CONFIG.GOOGLE_VISION_KEY}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    requests: [{
                        image: { source: { imageUri: imageUrl } },
                        features: [
                            { type: 'LABEL_DETECTION', maxResults: 10 },
                            { type: 'SAFE_SEARCH_DETECTION' },
                            { type: 'IMAGE_PROPERTIES' }
                        ]
                    }]
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            const result = data.responses[0];

            return {
                quality: result.safeSearch?.adult === 'VERY_UNLIKELY' ? 'good' : 'bad',
                labels: result.labelAnnotations?.map(l => l.description) || [],
                safeSearch: result.safeSearch,
                colors: result.imagePropertiesAnnotation?.dominantColors?.colors || [],
                issues: result.safeSearch?.adult !== 'VERY_UNLIKELY' ? ['Неприемлемый контент'] : []
            };
            
        } catch (error) {
            console.error('Ошибка анализа фото:', error);
            return {
                quality: 'unknown',
                issues: ['Ошибка анализа'],
                error: error.message
            };
        }
    }

    /**
     * Авто-ответ в чатах
     */
    async function generateAutoReply(chatId, lastMessage) {
        try {
            const chatDoc = await db.collection('chats').doc(chatId).get();
            if (!chatDoc.exists) return null;
            
            const chat = chatDoc.data();
            
            const user = Auth.getUser();
            if (!user) return null;
            
            const isMaster = user.uid === chat.masterId;

            // Шаблоны ответов
            const templates = {
                'цена': isMaster ? 
                    '💰 Точную цену скажу после осмотра. Обычно от 2000₽' :
                    '💵 Какой у вас бюджет на работу?',
                'когда': isMaster ?
                    '📅 Могу подъехать завтра в 10:00 или после обеда' :
                    '🕐 Когда вам удобно приехать?',
                'фото': isMaster ?
                    '📸 Скиньте фото проблемы, я оценю' :
                    '📷 Вот фото, что уже сделано',
                'спасибо': '🙏 Обращайтесь! Всегда рад помочь',
                'пока': '👋 До связи! Если что - пишите'
            };

            // Определяем тему
            let topic = 'общее';
            const msg = (lastMessage || '').toLowerCase();
            
            if (msg.includes('цен') || msg.includes('сто') || msg.includes('₽')) topic = 'цена';
            else if (msg.includes('когда') || msg.includes('время') || msg.includes('час')) topic = 'когда';
            else if (msg.includes('фото') || msg.includes('сним') || msg.includes('покажи')) topic = 'фото';
            else if (msg.includes('спасиб') || msg.includes('благодар')) topic = 'спасибо';
            else if (msg.includes('пока') || msg.includes('до свид')) topic = 'пока';

            return templates[topic] || null;
            
        } catch (error) {
            console.error('Ошибка генерации ответа:', error);
            return null;
        }
    }

    // Публичное API
    return {
        findBestMaster,
        suggestPrice,
        analyzePhoto,
        generateAutoReply
    };
})();

window.AIAssistant = AIAssistant;