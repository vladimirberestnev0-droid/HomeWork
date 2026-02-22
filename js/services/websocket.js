// ===== js/services/websocket.js =====
// WEBSOCKET РЕАЛЬНОГО ВРЕМЕНИ — ИСПРАВЛЕННАЯ ВЕРСИЯ

const WebSocketService = (function() {
    let ws = null;
    let reconnectAttempts = 0;
    const maxReconnect = 10;
    let reconnectDelay = 1000;
    let listeners = new Map();
    let heartbeatInterval = null;
    let reconnectTimer = null;

    /**
     * Проверка наличия Auth
     */
    function checkAuth() {
        if (!window.Auth || typeof window.Auth.getUser !== 'function') {
            console.warn('⚠️ Auth не доступен');
            return false;
        }
        return true;
    }

    /**
     * Получение URL WebSocket
     */
    function getWebSocketUrl() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        if (window.location.hostname.includes('github.io')) {
            return 'wss://echo.websocket.org';
        }
        const host = window.location.hostname === 'localhost' 
            ? 'localhost:8080'
            : 'api.workhom.ru';
        return `${protocol}//${host}/ws`;
    }

    /**
     * Подключение к WebSocket
     */
    function connect() {
        return new Promise((resolve, reject) => {
            try {
                const wsUrl = getWebSocketUrl();
                console.log('🔌 Подключение к WebSocket:', wsUrl);
                
                ws = new WebSocket(wsUrl);
                
                ws.onopen = () => {
                    console.log('✅ WebSocket подключен');
                    reconnectAttempts = 0;
                    reconnectDelay = 1000;
                    
                    // Отправляем приветствие
                    const userId = checkAuth() ? window.Auth.getUser()?.uid : null;
                    send({
                        type: 'auth',
                        userId: userId,
                        sessionId: getSessionId(),
                        timestamp: Date.now()
                    });
                    
                    // Запускаем heartbeat
                    startHeartbeat();
                    
                    resolve();
                };

                ws.onmessage = (event) => {
                    try {
                        // Пробуем распарсить как JSON
                        const data = JSON.parse(event.data);
                        handleMessage(data);
                    } catch (e) {
                        // Если не JSON — просто логируем как текст (без ошибки)
                        if (event.data === 'ping' || event.data.includes('ping')) {
                            // Отвечаем на ping текстовым pong
                            if (ws && ws.readyState === WebSocket.OPEN) {
                                ws.send('pong');
                            }
                        } else {
                            // Для отладки — можно закомментировать
                            console.log('📩 WebSocket (текст):', event.data.substring(0, 50));
                        }
                    }
                };

                ws.onerror = (error) => {
                    // Не выводим ошибку в консоль, если это echo.websocket.org
                    if (!wsUrl.includes('echo.websocket.org')) {
                        console.error('❌ WebSocket ошибка:', error);
                    }
                    reject(error);
                };

                ws.onclose = (event) => {
                    if (!wsUrl.includes('echo.websocket.org')) {
                        console.log(`🔌 WebSocket отключен: ${event.code} ${event.reason}`);
                    }
                    stopHeartbeat();
                    
                    if (event.code !== 1000) {
                        reconnect();
                    }
                };

            } catch (error) {
                console.error('Ошибка подключения WebSocket:', error);
                reject(error);
            }
        });
    }

    /**
     * Переподключение с экспоненциальной задержкой
     */
    function reconnect() {
        if (reconnectAttempts >= maxReconnect) {
            console.log('❌ Достигнут лимит переподключений');
            return;
        }

        reconnectAttempts++;
        const delay = reconnectDelay * Math.pow(2, reconnectAttempts - 1);
        
        console.log(`🔄 Переподключение через ${delay}ms... попытка ${reconnectAttempts}`);
        
        if (reconnectTimer) {
            clearTimeout(reconnectTimer);
        }
        
        reconnectTimer = setTimeout(() => {
            connect().catch(() => {});
        }, delay);
    }

    /**
     * Получение сессии
     */
    function getSessionId() {
        let sessionId = sessionStorage.getItem('ws_session');
        if (!sessionId) {
            sessionId = 'ws_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            sessionStorage.setItem('ws_session', sessionId);
        }
        return sessionId;
    }

    /**
     * Запуск heartbeat
     */
    function startHeartbeat() {
        stopHeartbeat();
        heartbeatInterval = setInterval(() => {
            if (isConnected()) {
                send({ type: 'ping', timestamp: Date.now() });
            }
        }, 30000);
    }

    /**
     * Остановка heartbeat
     */
    function stopHeartbeat() {
        if (heartbeatInterval) {
            clearInterval(heartbeatInterval);
            heartbeatInterval = null;
        }
    }

    /**
     * Обработка входящих сообщений
     */
    function handleMessage(message) {
        // Не логируем ping/pong чтобы не засорять консоль
        if (message.type !== 'pong' && message.type !== 'ping') {
            console.log('📩 WebSocket сообщение:', message.type);
        }

        switch(message.type) {
            case 'pong':
                break;
            case 'notification':
                showNotification(message.data);
                break;
            case 'typing':
                emit('typing', message.data);
                break;
            case 'status':
                emit('status', message.data);
                break;
            case 'message':
                emit('message', message.data);
                break;
            default:
                emit(message.type, message.data);
        }

        emit('*', message);
    }

    /**
     * Отправка сообщения
     */
    function send(message) {
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            return false;
        }

        try {
            ws.send(JSON.stringify(message));
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Подписка на события
     */
    function on(eventType, callback) {
        if (!listeners.has(eventType)) {
            listeners.set(eventType, new Set());
        }
        listeners.get(eventType).add(callback);
        return () => off(eventType, callback);
    }

    /**
     * Отписка
     */
    function off(eventType, callback) {
        if (listeners.has(eventType)) {
            listeners.get(eventType).delete(callback);
        }
    }

    /**
     * Вызов событий
     */
    function emit(eventType, data) {
        if (listeners.has(eventType)) {
            listeners.get(eventType).forEach(callback => {
                try {
                    callback(data);
                } catch (e) {
                    console.error(`Ошибка в слушателе ${eventType}:`, e);
                }
            });
        }
    }

    /**
     * Показать уведомление
     */
    function showNotification(data) {
        if (!data) return;
        
        if (Notification.permission === 'granted') {
            new Notification(data.title || 'ВоркХом', {
                body: data.body,
                icon: '/HomeWork/icons/icon-192x192.png',
                badge: '/HomeWork/icons/badge.png',
                data: data
            });
        } else if (Notification.permission !== 'denied') {
            Notification.requestPermission();
        }
    }

    /**
     * Отключение
     */
    function disconnect() {
        stopHeartbeat();
        
        if (reconnectTimer) {
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
        }
        
        if (ws) {
            ws.close(1000, 'Штатное отключение');
            ws = null;
        }
    }

    /**
     * Проверка статуса
     */
    function isConnected() {
        return ws && ws.readyState === WebSocket.OPEN;
    }

    /**
     * Отправка статуса печати в чате
     */
    function sendTyping(chatId, isTyping) {
        const userId = checkAuth() ? window.Auth.getUser()?.uid : null;
        send({
            type: 'typing',
            data: {
                chatId,
                userId: userId,
                isTyping,
                timestamp: Date.now()
            }
        });
    }

    /**
     * Отправка онлайн статуса
     */
    function sendOnlineStatus(isOnline) {
        const userId = checkAuth() ? window.Auth.getUser()?.uid : null;
        send({
            type: 'status',
            data: {
                userId: userId,
                online: isOnline,
                timestamp: Date.now()
            }
        });
    }

    /**
     * Получение онлайн пользователей
     */
    function getOnlineUsers() {
        return new Promise((resolve) => {
            const requestId = 'online_' + Date.now();
            
            const handler = (data) => {
                off('online_users_' + requestId, handler);
                resolve(data);
            };
            
            on('online_users_' + requestId, handler);
            
            send({
                type: 'get_online_users',
                requestId
            });

            setTimeout(() => {
                off('online_users_' + requestId, handler);
                resolve([]);
            }, 5000);
        });
    }

    /**
     * Запрос разрешения на уведомления
     */
    function requestNotificationPermission() {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }

    // Автоподключение при авторизации
    if (checkAuth() && typeof window.Auth.onAuthChange === 'function') {
        window.Auth.onAuthChange((state) => {
            if (state.isAuthenticated) {
                connect();
                requestNotificationPermission();
                
                setTimeout(() => {
                    if (isConnected()) {
                        sendOnlineStatus(true);
                    }
                }, 1000);
            } else {
                disconnect();
            }
        });
    }

    // Публичное API
    return {
        connect,
        disconnect,
        send,
        on,
        off,
        isConnected,
        sendTyping,
        sendOnlineStatus,
        getOnlineUsers
    };
})();

window.WebSocketService = WebSocketService;