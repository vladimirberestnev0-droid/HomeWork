// ============================================
// ГЛОБАЛЬНЫЙ СТОР (ПАТТЕРН НАБЛЮДАТЕЛЬ) - ИСПРАВЛЕНО
// ============================================
const AppStore = (function() {
    if (window.__APP_STORE_INITIALIZED__) return window.AppStore;

    // Состояние приложения
    let state = {
        // Пользователь
        user: null,
        userData: null,
        isAuthenticated: false,
        isMaster: false,
        isClient: false,
        isAdmin: false,
        role: null,
        
        // Настройки
        city: localStorage.getItem('selectedCity') || 'nyagan',
        theme: localStorage.getItem('theme') || 'dark',
        
        // Фильтры (сохраняем в sessionStorage)
        filters: (() => {
            try {
                return JSON.parse(sessionStorage.getItem('app_filters')) || {
                    category: 'all',
                    sort: 'newest'
                };
            } catch {
                return { category: 'all', sort: 'newest' };
            }
        })(),
        
        // Уведомления
        unreadCount: 0,
        
        // UI состояние
        isLoading: false,
        isOnline: navigator.onLine,
        
        // Модальные окна
        activeModal: null,
        
        // Версия состояния для отслеживания изменений
        _version: 0
    };

    // Подписчики: Map<componentId, { paths: string[], callback: Function, lastVersion: number }>
    const subscribers = new Map();
    
    // Очередь уведомлений для батчинга
    let notifyQueue = [];
    let notifyScheduled = false;

    // Вспомогательная функция для получения вложенного значения по пути
    function getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => current?.[key], obj);
    }

    // Обновление состояния (ИСПРАВЛЕНО: гонка состояний)
    function setState(newState) {
        // Создаём глубокую копию старого состояния для сравнения
        const oldState = JSON.parse(JSON.stringify(state));
        
        // Создаём новое состояние
        const newStateObj = { 
            ...state, 
            ...newState,
            _version: state._version + 1 
        };
        
        // Атомарно обновляем ссылку
        state = newStateObj;
        
        // Сохраняем в localStorage/sessionStorage где нужно
        if (newState.city !== undefined) {
            localStorage.setItem('selectedCity', state.city);
        }
        if (newState.theme !== undefined) {
            localStorage.setItem('theme', state.theme);
        }
        if (newState.filters !== undefined) {
            sessionStorage.setItem('app_filters', JSON.stringify(state.filters));
        }
        
        // Планируем уведомления
        scheduleNotify(oldState);
    }

    // Планирование уведомлений с батчингом
    function scheduleNotify(oldState) {
        notifyQueue.push(oldState);
        
        if (!notifyScheduled) {
            notifyScheduled = true;
            // Используем microtask или setTimeout для батчинга
            Promise.resolve().then(() => {
                processNotifyQueue();
            }).catch(() => {
                setTimeout(processNotifyQueue, 0);
            });
        }
    }

    function processNotifyQueue() {
        if (notifyQueue.length === 0) {
            notifyScheduled = false;
            return;
        }
        
        // Берём самое старое состояние из очереди (первое)
        const oldestOldState = notifyQueue[0];
        // Очищаем очередь
        notifyQueue = [];
        notifyScheduled = false;
        
        // Уведомляем подписчиков
        notifySubscribers(oldestOldState);
    }

    // Уведомление подписчиков об изменениях
    function notifySubscribers(oldState) {
        subscribers.forEach((config, componentId) => {
            const [paths, callback, lastVersion = 0] = config;
            
            // Если компонент уже получил более новую версию - пропускаем
            if (lastVersion >= state._version) return;
            
            // Проверяем, изменилось ли что-то из интересующих путей
            const shouldUpdate = paths.some(path => {
                const oldVal = getNestedValue(oldState, path);
                const newVal = getNestedValue(state, path);
                return oldVal !== newVal;
            });
            
            if (shouldUpdate) {
                try {
                    callback(state);
                    // Обновляем версию для этого подписчика
                    config[2] = state._version;
                } catch (error) {
                    console.error(`❌ Ошибка в подписчике ${componentId}:`, error);
                }
            }
        });
    }

    // Подписка на изменения
    function subscribe(componentId, paths, callback) {
        if (!Array.isArray(paths)) paths = [paths];
        
        // Проверяем, не существует ли уже подписка с таким ID
        if (subscribers.has(componentId)) {
            console.warn(`⚠️ Компонент ${componentId} уже подписан, заменяем подписку`);
            subscribers.delete(componentId);
        }
        
        subscribers.set(componentId, [paths, callback, state._version]);
        
        // Сразу вызываем с текущим состоянием
        try {
            callback(state);
        } catch (error) {
            console.error(`❌ Ошибка в начальном вызове подписчика ${componentId}:`, error);
        }
        
        // Возвращаем функцию отписки
        return () => {
            subscribers.delete(componentId);
        };
    }

    // Отписка
    function unsubscribe(componentId) {
        subscribers.delete(componentId);
    }

    // Получение состояния (поверхностная копия для безопасности)
    function getState() {
        return { ...state };
    }

    // Получение определённого поля
    function get(path) {
        return getNestedValue(state, path);
    }

    // Сброс состояния (для тестирования/выхода)
    function reset() {
        const oldState = { ...state };
        
        state = {
            user: null,
            userData: null,
            isAuthenticated: false,
            isMaster: false,
            isClient: false,
            isAdmin: false,
            role: null,
            city: localStorage.getItem('selectedCity') || 'nyagan',
            theme: localStorage.getItem('theme') || 'dark',
            filters: { category: 'all', sort: 'newest' },
            unreadCount: 0,
            isLoading: false,
            isOnline: navigator.onLine,
            activeModal: null,
            _version: state._version + 1
        };
        
        // Уведомляем всех подписчиков
        notifySubscribers(oldState);
    }

    // Пакетное обновление нескольких полей
    function batch(updates) {
        const updatesObj = {};
        updates.forEach(([key, value]) => {
            updatesObj[key] = value;
        });
        setState(updatesObj);
    }

    const api = {
        getState,
        get,
        setState,
        subscribe,
        unsubscribe,
        reset,
        batch
    };

    window.__APP_STORE_INITIALIZED__ = true;
    console.log('✅ AppStore инициализирован (исправленная версия)');
    
    return Object.freeze(api);
})();

window.AppStore = AppStore;