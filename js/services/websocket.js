// ===== js/services/websocket.js =====
// WEBSOCKET С ПЕРЕПОДКЛЮЧЕНИЕМ

const WebSocketService = (function() {
    let ws = null;
    let reconnectAttempts = 0;
    let reconnectTimer = null;
    let heartbeatInterval = null;
    let listeners = new Map();
    let intentionalClose = false;

    const CONFIG = window.CONFIG?.api || {
        websocket: 'wss://api.workhom.ru/ws',
        timeouts: { websocket: 5000 }
    };

    const MAX_RECONNECT = 10;
    const BASE_DELAY = 1000;

    /**
     * Получение URL
     */
    function getUrl() {
        if (window.location.hostname.includes('github.io')) {
            return 'wss://echo.websocket.org';
        }
        return CONFIG.websocket;
    }

    /**
     * Подключение
     */
    function connect() {
        return new Promise((resolve, reject) => {
            try {
                const url = getUrl();
                console.log('🔌 Подключение к WebSocket:', url);

                ws = new WebSocket(url);

                ws.onopen = () => {
                    console.log('✅ WebSocket подключен');
                    reconnectAttempts = 0;
                    intentionalClose = false;

                    // Отправка auth
                    const userId = Auth?.getUser?.()?.uid;
                    ws.send(JSON.stringify({
                        type: 'auth',
                        userId: userId,
                        sessionId: Utils.getSessionId(),
                        timestamp: Date.now()
                    }));

                    startHeartbeat();
                    resolve();
                };

                ws.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        handleMessage(data);
                    } catch {
                        // Текстовые сообщения (ping/pong)
                        if (event.data === 'ping') {
                            ws.send('pong');
                        }
                    }
                };

                ws.onerror = (error) => {
                    if (!url.includes('echo.websocket.org')) {
                        console.error('❌ WebSocket ошибка:', error);
                        
                        // Передаем в error-handler
                        if (window.handleError) {
                            window.handleError({
                                type: 'WEBSOCKET_ERROR',
                                message: error.message || 'WebSocket error',
                                timestamp: new Date().toISOString()
                            });
                        }
                    }
                    reject(error);
                };

                ws.onclose = (event) => {
                    if (!url.includes('echo.websocket.org')) {
                        console.log(`🔌 WebSocket отключен: ${event.code}`);
                    }

                    stopHeartbeat();

                    if (!intentionalClose && event.code !== 1000) {
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
     * Переподключение
     */
    function reconnect() {
        if (reconnectAttempts >= MAX_RECONNECT) {
            console.log('❌ Достигнут лимит переподключений');
            return;
        }

        reconnectAttempts++;
        const delay = BASE_DELAY * Math.pow(2, reconnectAttempts - 1);

        console.log(`🔄 Переподключение через ${delay}ms... (${reconnectAttempts}/${MAX_RECONNECT})`);

        if (reconnectTimer) clearTimeout(reconnectTimer);

        reconnectTimer = setTimeout(() => {
            connect().catch(() => {});
        }, delay);
    }

    /**
     * Отключение
     */
    function disconnect() {
        intentionalClose = true;
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
     * Проверка соединения
     */
    function isConnected() {
        return ws && ws.readyState === WebSocket.OPEN;
    }

    /**
     * Отправка сообщения
     */
    function send(message) {
        if (!isConnected()) return false;

        try {
            ws.send(JSON.stringify(message));
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Обработка сообщений
     */
    function handleMessage(message) {
        if (message.type !== 'pong') {
            console.log('📩 WebSocket:', message.type);
        }

        emit(message.type, message.data);
        emit('*', message);
    }

    /**
     * Подписка на события
     */
    function on(event, callback) {
        if (!listeners.has(event)) {
            listeners.set(event, new Set());
        }
        listeners.get(event).add(callback);
        return () => off(event, callback);
    }

    /**
     * Отписка
     */
    function off(event, callback) {
        if (listeners.has(event)) {
            listeners.get(event).delete(callback);
        }
    }

    /**
     * Вызов событий
     */
    function emit(event, data) {
        if (listeners.has(event)) {
            listeners.get(event).forEach(cb => {
                try {
                    cb(data);
                } catch (e) {
                    console.error(`Ошибка в слушателе ${event}:`, e);
                }
            });
        }
    }

    /**
     * Отправка статуса печати
     */
    function sendTyping(chatId, isTyping) {
        send({
            type: 'typing',
            data: {
                chatId,
                userId: Auth?.getUser?.()?.uid,
                isTyping,
                timestamp: Date.now()
            }
        });
    }

    /**
     * Отправка онлайн статуса
     */
    function sendOnlineStatus(isOnline) {
        send({
            type: 'status',
            data: {
                userId: Auth?.getUser?.()?.uid,
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
            const requestId = Utils.generateId('online_');

            const handler = (data) => {
                off('online_users', handler);
                resolve(data);
            };

            on('online_users', handler);

            send({
                type: 'get_online_users',
                requestId
            });

            setTimeout(() => {
                off('online_users', handler);
                resolve([]);
            }, 5000);
        });
    }

    // Автоподключение
    if (window.Auth?.onAuthChange) {
        Auth.onAuthChange((state) => {
            if (state.isAuthenticated) {
                connect();

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