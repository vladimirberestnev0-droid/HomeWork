// ===== js/services/redis-cache.js =====
// КЭШИРОВАНИЕ (эмуляция Redis)

const RedisCache = (function() {
    // In-memory cache (эмуляция Redis)
    const cache = new Map();
    const timers = new Map();

    // Конфигурация TTL
    const TTL = {
        USER: 300, // 5 минут
        ORDER: 600, // 10 минут
        CHAT: 60, // 1 минута
        MASTER: 300, // 5 минут
        STATS: 3600, // 1 час
        SESSION: 1800 // 30 минут
    };

    /**
     * Установка значения в кэш
     */
    function set(key, value, ttl = 300) {
        try {
            const item = {
                value: value,
                expiresAt: Date.now() + (ttl * 1000)
            };

            cache.set(key, item);

            // Устанавливаем таймер на удаление
            if (timers.has(key)) {
                clearTimeout(timers.get(key));
            }

            const timer = setTimeout(() => {
                cache.delete(key);
                timers.delete(key);
            }, ttl * 1000);

            timers.set(key, timer);

            return true;
        } catch (error) {
            console.error('Ошибка кэширования:', error);
            return false;
        }
    }

    /**
     * Получение значения из кэша
     */
    function get(key) {
        const item = cache.get(key);
        
        if (!item) {
            return null;
        }

        // Проверяем, не истек ли срок
        if (item.expiresAt < Date.now()) {
            cache.delete(key);
            if (timers.has(key)) {
                clearTimeout(timers.get(key));
                timers.delete(key);
            }
            return null;
        }

        return item.value;
    }

    /**
     * Удаление из кэша
     */
    function del(key) {
        cache.delete(key);
        if (timers.has(key)) {
            clearTimeout(timers.get(key));
            timers.delete(key);
        }
        return true;
    }

    /**
     * Удаление по паттерну
     */
    function delPattern(pattern) {
        const regex = new RegExp(pattern.replace('*', '.*'));
        const keysToDelete = [];
        
        for (const key of cache.keys()) {
            if (regex.test(key)) {
                keysToDelete.push(key);
            }
        }
        
        keysToDelete.forEach(key => del(key));
        return keysToDelete.length;
    }

    /**
     * Проверка существования
     */
    function exists(key) {
        const item = cache.get(key);
        return item && item.expiresAt >= Date.now();
    }

    /**
     * Очистка кэша
     */
    function flush() {
        cache.clear();
        timers.forEach(timer => clearTimeout(timer));
        timers.clear();
        return true;
    }

    /**
     * Получение статистики кэша
     */
    function stats() {
        const memory = window.performance?.memory?.usedJSHeapSize || 0;
        
        return {
            size: cache.size,
            keys: Array.from(cache.keys()).slice(0, 100), // Ограничиваем вывод
            memory: Math.round(memory / 1024 / 1024) + ' MB',
            timers: timers.size
        };
    }

    /**
     * Кэширование пользователя
     */
    async function cacheUser(userId, userData = null) {
        const key = `user:${userId}`;
        
        if (userData) {
            return set(key, userData, TTL.USER);
        }

        // Получаем из кэша или загружаем
        let cached = get(key);
        if (cached) {
            return cached;
        }

        try {
            const userDoc = await db.collection('users').doc(userId).get();
            if (userDoc.exists) {
                const data = userDoc.data();
                set(key, data, TTL.USER);
                return data;
            }
        } catch (error) {
            console.error('Ошибка загрузки пользователя:', error);
        }

        return null;
    }

    /**
     * Кэширование заказа
     */
    async function cacheOrder(orderId, orderData = null) {
        const key = `order:${orderId}`;
        
        if (orderData) {
            return set(key, orderData, TTL.ORDER);
        }

        let cached = get(key);
        if (cached) {
            return cached;
        }

        try {
            const orderDoc = await db.collection('orders').doc(orderId).get();
            if (orderDoc.exists) {
                const data = orderDoc.data();
                set(key, data, TTL.ORDER);
                return data;
            }
        } catch (error) {
            console.error('Ошибка загрузки заказа:', error);
        }

        return null;
    }

    /**
     * Кэширование списка заказов
     */
    async function cacheOrders(query, ttl = TTL.ORDER) {
        const key = `orders:${JSON.stringify(query)}`;
        
        let cached = get(key);
        if (cached) {
            return cached;
        }

        try {
            let dbQuery = db.collection('orders');
            
            if (query.status) {
                dbQuery = dbQuery.where('status', '==', query.status);
            }
            if (query.category) {
                dbQuery = dbQuery.where('category', '==', query.category);
            }
            
            dbQuery = dbQuery.orderBy('createdAt', 'desc').limit(query.limit || 20);

            const snapshot = await dbQuery.get();
            const orders = [];
            
            snapshot.forEach(doc => {
                orders.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            set(key, orders, ttl);
            return orders;
            
        } catch (error) {
            console.error('Ошибка загрузки заказов:', error);
            return [];
        }
    }

    /**
     * Кэширование чата
     */
    async function cacheChat(chatId, messages = null) {
        const key = `chat:${chatId}`;
        
        if (messages) {
            return set(key, messages, TTL.CHAT);
        }

        let cached = get(key);
        if (cached) {
            return cached;
        }

        try {
            const snapshot = await db.collection('chats').doc(chatId)
                .collection('messages')
                .orderBy('timestamp', 'desc')
                .limit(50)
                .get();

            const messages = [];
            snapshot.forEach(doc => {
                messages.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            set(key, messages.reverse(), TTL.CHAT); // Переворачиваем для хронологии
            return messages;
            
        } catch (error) {
            console.error('Ошибка загрузки чата:', error);
            return [];
        }
    }

    /**
     * Инвалидация кэша
     */
    function invalidate(patterns) {
        let deleted = 0;
        patterns.forEach(pattern => {
            deleted += delPattern(pattern);
        });
        return deleted;
    }

    /**
     * Получение счетчика (для rate limiting)
     */
    function incr(key, ttl = 60) {
        const current = get(key) || 0;
        const newValue = current + 1;
        set(key, newValue, ttl);
        return newValue;
    }

    /**
     * Получение TTL
     */
    function ttl(key) {
        const item = cache.get(key);
        if (!item) return -2; // Ключ не существует
        
        const remaining = item.expiresAt - Date.now();
        if (remaining <= 0) {
            del(key);
            return -2;
        }
        
        return Math.floor(remaining / 1000);
    }

    /**
     * Продление жизни ключа
     */
    function expire(key, seconds) {
        const item = cache.get(key);
        if (!item) return false;
        
        item.expiresAt = Date.now() + (seconds * 1000);
        
        // Обновляем таймер
        if (timers.has(key)) {
            clearTimeout(timers.get(key));
        }
        
        const timer = setTimeout(() => {
            cache.delete(key);
            timers.delete(key);
        }, seconds * 1000);
        
        timers.set(key, timer);
        
        return true;
    }

    // Публичное API
    return {
        set,
        get,
        del,
        delPattern,
        exists,
        flush,
        stats,
        ttl,
        expire,
        incr,
        invalidate,
        cacheUser,
        cacheOrder,
        cacheOrders,
        cacheChat,
        TTL
    };
})();

window.RedisCache = RedisCache;