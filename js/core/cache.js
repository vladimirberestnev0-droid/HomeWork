// ============================================
// УЛУЧШЕННАЯ СИСТЕМА КЭШИРОВАНИЯ
// ============================================
const Cache = (function() {
    if (window.__CACHE_INITIALIZED__) return window.Cache;

    // Типы кэша с разными TTL
    const TTL = {
        SHORT: 30 * 1000,      // 30 секунд (непрочитанные)
        MEDIUM: 5 * 60 * 1000,  // 5 минут (заказы, чаты)
        LONG: 30 * 60 * 1000,   // 30 минут (мастера, пользователи)
        SESSION: 24 * 60 * 60 * 1000 // 24 часа (профили)
    };

    // In-memory кэш
    const memoryCache = new Map();
    
    // Статистика
    const stats = {
        hits: 0,
        misses: 0,
        sets: 0,
        deletes: 0
    };

    // Установка значения в кэш
    function set(key, data, ttl = TTL.MEDIUM) {
        if (!key) return false;
        
        const item = {
            data,
            timestamp: Date.now(),
            ttl
        };
        
        memoryCache.set(key, item);
        stats.sets++;
        
        // Автоматическое удаление по TTL
        setTimeout(() => {
            const cached = memoryCache.get(key);
            if (cached && Date.now() - cached.timestamp >= ttl) {
                memoryCache.delete(key);
                stats.deletes++;
            }
        }, ttl);
        
        return true;
    }

    // Получение значения из кэша
    function get(key) {
        if (!key) return null;
        
        const cached = memoryCache.get(key);
        if (!cached) {
            stats.misses++;
            return null;
        }
        
        if (Date.now() - cached.timestamp > cached.ttl) {
            memoryCache.delete(key);
            stats.deletes++;
            stats.misses++;
            return null;
        }
        
        stats.hits++;
        return cached.data;
    }

    // Удаление из кэша
    function remove(key) {
        if (memoryCache.delete(key)) {
            stats.deletes++;
            return true;
        }
        return false;
    }

    // Очистка кэша по шаблону
    function clear(pattern = null) {
        if (!pattern) {
            memoryCache.clear();
            stats.deletes += memoryCache.size;
            console.log('🧹 Весь кэш очищен');
            return;
        }
        
        const keysToDelete = [];
        for (const key of memoryCache.keys()) {
            if (key.includes(pattern)) {
                keysToDelete.push(key);
            }
        }
        
        keysToDelete.forEach(key => memoryCache.delete(key));
        stats.deletes += keysToDelete.length;
        console.log(`🧹 Очищено ${keysToDelete.length} записей по шаблону: ${pattern}`);
    }

    // Пакетная установка
    function setMany(items) {
        let count = 0;
        for (const [key, data] of Object.entries(items)) {
            if (set(key, data)) count++;
        }
        return count;
    }

    // Пакетное получение
    function getMany(keys) {
        const result = {};
        for (const key of keys) {
            result[key] = get(key);
        }
        return result;
    }

    // Получение статистики
    function getStats() {
        const hitRate = stats.hits + stats.misses > 0 
            ? Math.round((stats.hits / (stats.hits + stats.misses)) * 100) 
            : 0;
            
        return {
            ...stats,
            hitRate,
            size: memoryCache.size,
            keys: Array.from(memoryCache.keys())
        };
    }

    // Сброс статистики
    function resetStats() {
        stats.hits = 0;
        stats.misses = 0;
        stats.sets = 0;
        stats.deletes = 0;
    }

    // Декоратор для кэширования результатов функций
    function memoize(fn, ttl = TTL.MEDIUM) {
        return function(...args) {
            const key = `${fn.name}_${JSON.stringify(args)}`;
            const cached = get(key);
            if (cached !== null) return cached;
            
            const result = fn.apply(this, args);
            set(key, result, ttl);
            return result;
        };
    }

    const api = {
        set,
        get,
        remove,
        clear,
        setMany,
        getMany,
        getStats,
        resetStats,
        memoize,
        TTL
    };

    window.__CACHE_INITIALIZED__ = true;
    console.log('✅ Cache система загружена');
    
    return Object.freeze(api);
})();

window.Cache = Cache;