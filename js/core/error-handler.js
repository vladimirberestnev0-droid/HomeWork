// ===== js/core/error-handler.js =====
// Глобальный обработчик ошибок - ПРОФЕССИОНАЛЬНАЯ ВЕРСИЯ

(function() {
    // Конфигурация
    const CONFIG = {
        LOG_TO_SERVER: true,        // отправлять ошибки на сервер
        SHOW_NOTIFICATIONS: true,    // показывать уведомления
        MAX_RECURSION: 5,            // защита от циклических ошибок
        IGNORED_ERRORS: [            // ошибки которые не показываем
            'NetworkError',
            'AbortError',
            'ChunkLoadError',
            'ResizeObserver loop limit exceeded'
        ],
        ERROR_MESSAGES: {             // дружелюбные сообщения
            'auth/user-not-found': 'Пользователь не найден',
            'auth/wrong-password': 'Неверный пароль',
            'auth/email-already-in-use': 'Email уже используется',
            'auth/weak-password': 'Пароль слишком простой',
            'auth/too-many-requests': 'Слишком много попыток. Попробуйте позже',
            'permission-denied': 'Нет доступа',
            'unavailable': 'Сервис временно недоступен',
            'deadline-exceeded': 'Превышено время ожидания',
            'not-found': 'Данные не найдены',
            'already-exists': 'Запись уже существует',
            'resource-exhausted': 'Превышен лимит запросов',
            'failed-precondition': 'Невозможно выполнить операцию',
            'aborted': 'Операция отменена',
            'out-of-range': 'Значение вне диапазона',
            'unimplemented': 'Функция не реализована',
            'internal': 'Внутренняя ошибка сервера',
            'cancelled': 'Операция отменена'
        }
    };

    // Счетчик рекурсий
    let recursionCount = 0;
    let lastErrorTime = 0;
    let errorQueue = [];

    // ===== ОСНОВНЫЕ ОБРАБОТЧИКИ =====

    /**
     * Перехват синхронных ошибок
     */
    window.addEventListener('error', function(event) {
        handleError({
            type: 'SYNTAX_ERROR',
            message: event.message,
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno,
            error: event.error,
            stack: event.error?.stack,
            timestamp: new Date().toISOString(),
            url: window.location.href,
            userAgent: navigator.userAgent
        });
        
        // Предотвращаем стандартное поведение
        event.preventDefault();
        return false;
    });

    /**
     * Перехват Promise rejections
     */
    window.addEventListener('unhandledrejection', function(event) {
        let errorData = {
            type: 'PROMISE_REJECTION',
            timestamp: new Date().toISOString(),
            url: window.location.href,
            userAgent: navigator.userAgent
        };

        if (event.reason instanceof Error) {
            errorData.message = event.reason.message;
            errorData.stack = event.reason.stack;
            errorData.name = event.reason.name;
        } else if (typeof event.reason === 'string') {
            errorData.message = event.reason;
        } else if (event.reason && event.reason.code) {
            // Firebase ошибка
            errorData.message = event.reason.message || event.reason.code;
            errorData.code = event.reason.code;
            errorData.details = event.reason.details;
        } else {
            errorData.message = 'Неизвестная ошибка Promise';
            errorData.data = event.reason;
        }

        handleError(errorData);
        
        // Не показываем в консоли если ошибка в игнор-листе
        if (!shouldIgnoreError(errorData)) {
            console.warn('⚠️ Перехвачен unhandledrejection:', errorData);
        }
    });

    /**
     * Перехват ошибок в fetch запросах
     */
    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
        try {
            const response = await originalFetch(...args);
            
            // Проверяем HTTP ошибки
            if (!response.ok) {
                const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
                error.status = response.status;
                error.url = response.url;
                error.type = 'HTTP_ERROR';
                
                // Обрабатываем специфичные статусы
                if (response.status === 429) {
                    showUserNotification('⚠️ Слишком много запросов. Подождите немного.', 'warning');
                } else if (response.status >= 500) {
                    showUserNotification('🔧 Сервер временно недоступен. Пробуем снова...', 'warning');
                }
                
                handleError(error);
            }
            
            return response;
        } catch (error) {
            // Ошибки сети
            if (error.name === 'TypeError' && error.message.includes('NetworkError')) {
                error.type = 'NETWORK_ERROR';
                error.message = 'Проверьте подключение к интернету';
                showUserNotification('🌐 Нет соединения с интернетом', 'warning');
            }
            
            handleError(error);
            throw error;
        }
    };

    /**
     * Перехват ошибок в WebSocket
     */
    const originalWebSocket = window.WebSocket;
    window.WebSocket = function(...args) {
        try {
            const ws = new originalWebSocket(...args);
            
            ws.addEventListener('error', function(event) {
                handleError({
                    type: 'WEBSOCKET_ERROR',
                    message: 'Ошибка WebSocket соединения',
                    url: args[0],
                    timestamp: new Date().toISOString()
                });
            });
            
            return ws;
        } catch (error) {
            handleError({
                type: 'WEBSOCKET_INIT_ERROR',
                message: error.message,
                url: args[0],
                timestamp: new Date().toISOString()
            });
            throw error;
        }
    };

    /**
     * Перехват ошибок в localStorage/sessionStorage
     */
    const storages = ['localStorage', 'sessionStorage'];
    storages.forEach(storageName => {
        const storage = window[storageName];
        if (!storage) return;

        const originalGetItem = storage.getItem;
        storage.getItem = function(...args) {
            try {
                return originalGetItem.apply(this, args);
            } catch (error) {
                handleError({
                    type: 'STORAGE_ERROR',
                    operation: 'getItem',
                    storage: storageName,
                    key: args[0],
                    message: error.message,
                    timestamp: new Date().toISOString()
                });
                return null;
            }
        };

        const originalSetItem = storage.setItem;
        storage.setItem = function(...args) {
            try {
                return originalSetItem.apply(this, args);
            } catch (error) {
                handleError({
                    type: 'STORAGE_ERROR',
                    operation: 'setItem',
                    storage: storageName,
                    key: args[0],
                    message: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        };
    });

    // ===== ОСНОВНАЯ ЛОГИКА ОБРАБОТКИ =====

    /**
     * Главный обработчик ошибок
     */
    function handleError(error) {
        // Защита от циклических ошибок
        if (recursionCount > CONFIG.MAX_RECURSION) {
            console.error('⚠️ Обнаружена циклическая ошибка, остановка обработки');
            return;
        }
        recursionCount++;

        // Дедупликация одинаковых ошибок (не чаще раза в секунду)
        const now = Date.now();
        const errorKey = generateErrorKey(error);
        
        if (errorQueue.includes(errorKey) && now - lastErrorTime < 1000) {
            recursionCount--;
            return;
        }

        errorQueue.push(errorKey);
        if (errorQueue.length > 10) errorQueue.shift();
        lastErrorTime = now;

        // Проверяем, нужно ли игнорировать
        if (shouldIgnoreError(error)) {
            recursionCount--;
            return;
        }

        // Логируем в консоль
        logToConsole(error);

        // Показываем пользователю
        if (CONFIG.SHOW_NOTIFICATIONS && !shouldIgnoreError(error)) {
            showUserNotification(getUserFriendlyMessage(error), getErrorLevel(error));
        }

        // Отправляем на сервер
        if (CONFIG.LOG_TO_SERVER && !isLocalhost()) {
            sendErrorToServer(error);
        }

        // Специфичная обработка для разных типов ошибок
        handleSpecificError(error);

        recursionCount--;
    }

    /**
     * Генерация ключа для дедупликации
     */
    function generateErrorKey(error) {
        if (typeof error === 'string') return error;
        if (error instanceof Error) return `${error.name}:${error.message}`;
        if (error.code) return `${error.type || 'FIREBASE'}:${error.code}`;
        return JSON.stringify(error);
    }

    /**
     * Проверка нужно ли игнорировать ошибку
     */
    function shouldIgnoreError(error) {
        const message = error.message || error.toString();
        
        // Игнорируем по списку
        for (const ignore of CONFIG.IGNORED_ERRORS) {
            if (message.includes(ignore)) return true;
        }

        // Игнорируем ошибки связанные с рекламой/расширениями
        if (message.includes('chrome-extension://') ||
            message.includes('moz-extension://') ||
            message.includes('web_accessible_resources')) {
            return true;
        }

        return false;
    }

    /**
     * Логирование в консоль с цветом
     */
    function logToConsole(error) {
        const styles = {
            'SYNTAX_ERROR': 'color: #ff6b6b; font-weight: bold',
            'PROMISE_REJECTION': 'color: #feca57; font-weight: bold',
            'NETWORK_ERROR': 'color: #48dbfb; font-weight: bold',
            'FIREBASE_ERROR': 'color: #ff9ff3; font-weight: bold',
            'default': 'color: #54a0ff; font-weight: bold'
        };

        const style = styles[error.type] || styles.default;
        const timestamp = new Date().toLocaleTimeString();

        console.group(`%c❌ ${error.type || 'ERROR'} [${timestamp}]`, style);
        console.error('Детали:', error);
        
        if (error.stack) {
            console.log('Стек:', error.stack);
        }
        
        if (error.code) {
            console.log('Код:', error.code);
        }
        
        if (error.url) {
            console.log('URL:', error.url);
        }
        
        console.groupEnd();
    }

    /**
     * Дружелюбное сообщение для пользователя
     */
    function getUserFriendlyMessage(error) {
        // Firebase ошибки
        if (error.code && CONFIG.ERROR_MESSAGES[error.code]) {
            return CONFIG.ERROR_MESSAGES[error.code];
        }

        // HTTP ошибки
        if (error.status) {
            const httpMessages = {
                400: 'Неверный запрос',
                401: 'Требуется авторизация',
                403: 'Доступ запрещён',
                404: 'Ресурс не найден',
                408: 'Время ожидания истекло',
                429: 'Слишком много запросов',
                500: 'Ошибка сервера',
                502: 'Сервер временно недоступен',
                503: 'Сервис недоступен',
                504: 'Сервер не отвечает'
            };
            return httpMessages[error.status] || `Ошибка HTTP ${error.status}`;
        }

        // Сетевые ошибки
        if (error.type === 'NETWORK_ERROR') {
            return '🌐 Проблемы с интернетом. Проверьте соединение.';
        }

        if (error.type === 'WEBSOCKET_ERROR') {
            return '🔄 Ошибка соединения. Переподключаемся...';
        }

        if (error.type === 'STORAGE_ERROR') {
            return '💾 Ошибка сохранения данных';
        }

        // По умолчанию
        return '❌ Что-то пошло не так. Мы уже работаем над этим.';
    }

    /**
     * Уровень ошибки для уведомления
     */
    function getErrorLevel(error) {
        if (error.status >= 500) return 'error';
        if (error.status === 429) return 'warning';
        if (error.type === 'NETWORK_ERROR') return 'warning';
        if (error.code === 'permission-denied') return 'warning';
        if (error.code?.includes('auth')) return 'warning';
        
        return 'error';
    }

    /**
     * Специфичная обработка ошибок
     */
    function handleSpecificError(error) {
        // Firebase Auth ошибки
        if (error.code?.startsWith('auth/')) {
            handleAuthError(error);
        }

        // Ошибки загрузки чанков (code splitting)
        if (error.name === 'ChunkLoadError') {
            handleChunkLoadError();
        }

        // Ошибки квоты Firestore
        if (error.code === 'resource-exhausted') {
            handleQuotaError();
        }

        // Ошибки соединения
        if (error.type === 'NETWORK_ERROR' || error.name === 'NetworkError') {
            handleNetworkError();
        }
    }

    /**
     * Обработка ошибок авторизации
     */
    function handleAuthError(error) {
        if (error.code === 'auth/user-not-found' || 
            error.code === 'auth/wrong-password') {
            // Очищаем поля ввода
            document.querySelectorAll('input[type="password"]').forEach(input => {
                input.value = '';
            });
        }
        
        if (error.code === 'auth/too-many-requests') {
            // Блокируем кнопку на 30 секунд
            const buttons = document.querySelectorAll('.btn-login, .btn-register');
            buttons.forEach(btn => {
                btn.disabled = true;
                setTimeout(() => btn.disabled = false, 30000);
            });
        }
    }

    /**
     * Обработка ошибок загрузки чанков
     */
    function handleChunkLoadError() {
        const CHUNK_KEY = 'chunk_reload_count';
        const MAX_CHUNK_RELOADS = 2;
        
        let count = parseInt(sessionStorage.getItem(CHUNK_KEY) || '0');
        count++;
        
        if (count <= MAX_CHUNK_RELOADS) {
            sessionStorage.setItem(CHUNK_KEY, count);
            showUserNotification('🔄 Обновляем приложение... (попытка ' + count + '/' + MAX_CHUNK_RELOADS + ')', 'info');
            setTimeout(() => window.location.reload(), 2000);
        } else {
            sessionStorage.removeItem(CHUNK_KEY);
            showUserNotification(
                '❌ Не удалось загрузить часть приложения. Пожалуйста, очистите кэш браузера или свяжитесь с поддержкой.',
                'error'
            );
        }
    }

    /**
     * Обработка ошибок квоты
     */
    function handleQuotaError() {
        showUserNotification('⏳ Достигнут лимит запросов. Подождите минуту.', 'warning');
        
        // Увеличиваем интервалы между запросами
        if (window.Orders && Orders.setRequestInterval) {
            Orders.setRequestInterval(2000);
        }
    }

    /**
     * Обработка сетевых ошибок
     */
    function handleNetworkError() {
        // Показываем индикатор офлайн режима
        const offlineIndicator = document.createElement('div');
        offlineIndicator.className = 'offline-indicator';
        offlineIndicator.innerHTML = '🌐 Офлайн режим';
        offlineIndicator.style.cssText = `
            position: fixed;
            top: 10px;
            left: 50%;
            transform: translateX(-50%);
            background: #ff6b6b;
            color: white;
            padding: 8px 20px;
            border-radius: 40px;
            z-index: 10000;
            font-size: 14px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        `;
        
        if (!document.querySelector('.offline-indicator')) {
            document.body.appendChild(offlineIndicator);
            
            // Убираем при восстановлении
            window.addEventListener('online', function removeIndicator() {
                offlineIndicator.remove();
                window.removeEventListener('online', removeIndicator);
            });
        }
    }

    /**
     * Отправка ошибки на сервер
     */
    async function sendErrorToServer(error) {
        try {
            // Собираем контекст
            const errorData = {
                ...error,
                timestamp: new Date().toISOString(),
                url: window.location.href,
                userAgent: navigator.userAgent,
                screenSize: `${window.innerWidth}x${window.innerHeight}`,
                language: navigator.language,
                online: navigator.onLine,
                cookies: navigator.cookieEnabled,
                doNotTrack: navigator.doNotTrack,
                memory: window.performance?.memory?.usedJSHeapSize,
                loadTime: window.performance?.timing?.loadEventEnd - window.performance?.timing?.navigationStart,
                userId: window.Auth?.getUser?.()?.uid,
                userRole: window.Auth?.getUserData?.()?.role
            };

            // Отправляем POST запрос (если есть эндпоинт)
            if (window.ERROR_LOGGING_ENDPOINT) {
                const response = await fetch(window.ERROR_LOGGING_ENDPOINT, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(errorData),
                    // Не ждем ответа и игнорируем ошибки
                    keepalive: true
                });
            }

            // Сохраняем в localStorage для анализа
            saveErrorLocally(errorData);

        } catch (e) {
            // Игнорируем ошибки при отправке ошибок
        }
    }

    /**
     * Сохранение ошибки локально
     */
    function saveErrorLocally(errorData) {
        try {
            const errors = JSON.parse(localStorage.getItem('error_log') || '[]');
            errors.push({
                ...errorData,
                id: Date.now() + Math.random().toString(36).substr(2, 9)
            });
            
            // Храним только последние 50 ошибок
            if (errors.length > 50) errors.shift();
            
            localStorage.setItem('error_log', JSON.stringify(errors));
        } catch (e) {
            // localStorage переполнен - чистим
            localStorage.removeItem('error_log');
        }
    }

    /**
     * Показать уведомление пользователю
     */
    function showUserNotification(message, type = 'error') {
        if (!window.Helpers?.showNotification) {
            // Создаем свое уведомление если Helpers нет
            const notification = document.createElement('div');
            notification.className = `error-notification ${type}`;
            notification.innerHTML = `
                <i class="fas ${getIconForType(type)}"></i>
                <span>${message}</span>
                <button onclick="this.parentElement.remove()">✕</button>
            `;
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: ${type === 'error' ? '#ff6b6b' : type === 'warning' ? '#feca57' : '#48dbfb'};
                color: white;
                padding: 15px 25px;
                border-radius: 12px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.2);
                z-index: 10000;
                display: flex;
                align-items: center;
                gap: 12px;
                animation: slideIn 0.3s ease;
                max-width: 400px;
            `;
            
            document.body.appendChild(notification);
            
            setTimeout(() => {
                notification.style.animation = 'slideOut 0.3s ease';
                setTimeout(() => notification.remove(), 300);
            }, 5000);
        } else {
            Helpers.showNotification(message, type);
        }
    }

    /**
     * Иконка для типа ошибки
     */
    function getIconForType(type) {
        const icons = {
            'error': 'fa-exclamation-circle',
            'warning': 'fa-exclamation-triangle',
            'info': 'fa-info-circle',
            'success': 'fa-check-circle'
        };
        return icons[type] || icons.error;
    }

    /**
     * Проверка localhost
     */
    function isLocalhost() {
        return window.location.hostname === 'localhost' || 
               window.location.hostname === '127.0.0.1' ||
               window.location.hostname.includes('github.io');
    }

    // ===== МОНИТОРИНГ ПРОИЗВОДИТЕЛЬНОСТИ =====

    /**
     * Мониторинг загрузки страницы
     */
    if (window.performance) {
        window.addEventListener('load', () => {
            const timing = performance.timing;
            const loadTime = timing.loadEventEnd - timing.navigationStart;
            const domTime = timing.domComplete - timing.domLoading;
            const renderTime = timing.domComplete - timing.domInteractive;

            if (loadTime > 3000) {
                console.warn(`⚠️ Медленная загрузка: ${loadTime}ms`);
                handleError({
                    type: 'PERFORMANCE_WARNING',
                    message: 'Медленная загрузка страницы',
                    loadTime,
                    domTime,
                    renderTime,
                    url: window.location.href
                });
            }
        });
    }

    /**
     * Мониторинг онлайн статуса
     */
    window.addEventListener('online', () => {
        showUserNotification('🟢 Соединение восстановлено', 'success');
        
        // Убираем индикатор офлайн
        document.querySelector('.offline-indicator')?.remove();
        
        // Перезагружаем данные
        if (window.loadAllOrders) window.loadAllOrders();
        if (window.loadChats) window.loadChats();
    });

    window.addEventListener('offline', () => {
        showUserNotification('🔴 Нет соединения', 'warning');
        handleNetworkError();
    });

    /**
     * Мониторинг памяти
     */
    if (window.performance?.memory) {
        setInterval(() => {
            const memory = window.performance.memory;
            if (memory.usedJSHeapSize > memory.jsHeapSizeLimit * 0.9) {
                console.warn('⚠️ Высокое использование памяти');
                handleError({
                    type: 'MEMORY_WARNING',
                    message: 'Высокое использование памяти',
                    used: memory.usedJSHeapSize,
                    total: memory.jsHeapSizeLimit,
                    limit: memory.jsHeapSizeLimit
                });
            }
        }, 30000);
    }

    /**
     * Экспорт ошибок для разработчика
     */
    window.exportErrorLog = function() {
        const errors = JSON.parse(localStorage.getItem('error_log') || '[]');
        const blob = new Blob([JSON.stringify(errors, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `error-log-${new Date().toISOString()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    /**
     * Очистка лога ошибок
     */
    window.clearErrorLog = function() {
        localStorage.removeItem('error_log');
        showUserNotification('✅ Лог ошибок очищен', 'success');
    };

    console.log('✅ Error Handler PRO загружен');
})();

// ===== ПОЛЕЗНЫЕ УТИЛИТЫ ДЛЯ ОТЛАДКИ =====

/**
 * Обертка для async функций с автоматической обработкой ошибок
 */
window.safeAsync = function(asyncFn) {
    return function(...args) {
        return asyncFn(...args).catch(error => {
            console.error('❌ Ошибка в async функции:', error);
            
            // Показываем уведомление если это пользовательская ошибка
            if (error.message && !error.message.includes('NetworkError')) {
                showUserNotification(error.message, error.code?.startsWith('auth/') ? 'warning' : 'error');
            }
            
            throw error;
        });
    };
};

/**
 * Декоратор для отлова ошибок в методах классов
 */
window.catchErrors = function(target, propertyKey, descriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = function(...args) {
        try {
            const result = originalMethod.apply(this, args);
            
            // Если это Promise
            if (result && result.catch) {
                return result.catch(error => {
                    console.error(`❌ Ошибка в методе ${propertyKey}:`, error);
                    throw error;
                });
            }
            
            return result;
        } catch (error) {
            console.error(`❌ Ошибка в методе ${propertyKey}:`, error);
            throw error;
        }
    };
    
    return descriptor;
};