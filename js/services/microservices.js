// ===== js/services/microservices.js =====
// МИКРОСЕРВИСНАЯ АРХИТЕКТУРА

const Microservices = (function() {
    // Конфигурация сервисов
    const SERVICES = {
        auth: {
            url: 'https://api.workhom.ru/auth',
            version: 'v1',
            timeout: 5000,
            health: '/health'
        },
        orders: {
            url: 'https://api.workhom.ru/orders',
            version: 'v1',
            timeout: 10000,
            health: '/health'
        },
        chat: {
            url: 'wss://chat.workhom.ru',
            version: 'v1',
            timeout: 5000,
            health: '/health'
        },
        payments: {
            url: 'https://api.workhom.ru/payments',
            version: 'v1',
            timeout: 15000,
            health: '/health'
        },
        notifications: {
            url: 'https://api.workhom.ru/notifications',
            version: 'v1',
            timeout: 5000,
            health: '/health'
        },
        analytics: {
            url: 'https://api.workhom.ru/analytics',
            version: 'v1',
            timeout: 30000,
            health: '/health'
        },
        cdn: {
            url: 'https://cdn.workhom.ru',
            version: 'v1',
            timeout: 30000,
            health: '/health'
        }
    };

    // Очередь запросов
    const requestQueue = [];
    let isProcessing = false;
    const MAX_CONCURRENT = 5;
    const RETRY_COUNT = 3;
    const RETRY_DELAY = 1000;

    /**
     * Вызов микросервиса
     */
    async function call(service, endpoint, method = 'GET', data = null, options = {}) {
        const serviceConfig = SERVICES[service];
        if (!serviceConfig) {
            throw new Error(`Сервис ${service} не найден`);
        }

        // Для WebSocket используем отдельную логику
        if (service === 'chat') {
            return callWebSocket(service, endpoint, data, options);
        }

        const baseUrl = serviceConfig.url;
        const version = serviceConfig.version;
        const url = endpoint.startsWith('http') 
            ? endpoint 
            : `${baseUrl}/${version}/${endpoint}`.replace(/\/+/g, '/');
        
        const token = await getToken();
        
        const fetchOptions = {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': token ? `Bearer ${token}` : '',
                'X-Request-ID': generateRequestId(),
                'X-Service-Version': serviceConfig.version,
                'X-Client-Version': '1.0.0'
            },
            ...options
        };

        if (data) {
            if (data instanceof FormData) {
                fetchOptions.body = data;
                delete fetchOptions.headers['Content-Type']; // Пусть браузер сам установит
            } else {
                fetchOptions.body = JSON.stringify(data);
            }
        }

        // Добавляем в очередь для rate limiting с retry
        return new Promise((resolve, reject) => {
            requestQueue.push({
                url,
                options: fetchOptions,
                resolve,
                reject,
                priority: options.priority || 0,
                retries: 0,
                service,
                endpoint
            });

            if (!isProcessing) {
                processQueue();
            }
        });
    }

    /**
     * Вызов WebSocket сервиса
     */
    function callWebSocket(service, endpoint, data, options) {
        return new Promise((resolve, reject) => {
            const wsUrl = `${SERVICES.chat.url}/${endpoint}`;
            const ws = new WebSocket(wsUrl);
            
            const timeout = setTimeout(() => {
                ws.close();
                reject(new Error('Таймаут WebSocket соединения'));
            }, options.timeout || SERVICES.chat.timeout);

            ws.onopen = () => {
                clearTimeout(timeout);
                ws.send(JSON.stringify({
                    type: 'request',
                    id: generateRequestId(),
                    data: data,
                    token: getToken()
                }));
            };

            ws.onmessage = (event) => {
                const response = JSON.parse(event.data);
                ws.close();
                resolve(response);
            };

            ws.onerror = (error) => {
                clearTimeout(timeout);
                reject(error);
            };
        });
    }

    /**
     * Обработка очереди с retry логикой
     */
    async function processQueue() {
        if (requestQueue.length === 0) {
            isProcessing = false;
            return;
        }

        isProcessing = true;

        // Сортируем по приоритету
        requestQueue.sort((a, b) => (b.priority || 0) - (a.priority || 0));

        const batch = requestQueue.splice(0, MAX_CONCURRENT);

        await Promise.all(batch.map(async (request) => {
            try {
                const response = await fetchWithRetry(request.url, request.options, request.retries);
                const data = await response.json();
                request.resolve(data);
            } catch (error) {
                // Пробуем еще раз, если не превышен лимит
                if (request.retries < RETRY_COUNT) {
                    request.retries++;
                    console.log(`🔄 Retry ${request.retries}/${RETRY_COUNT} for ${request.url}`);
                    setTimeout(() => {
                        requestQueue.unshift(request);
                    }, RETRY_DELAY * request.retries);
                } else {
                    console.error(`❌ Failed after ${RETRY_COUNT} retries:`, error);
                    request.reject(error);
                }
            }
        }));

        // Продолжаем обработку
        setTimeout(processQueue, 100);
    }

    /**
     * Fetch с retry логикой
     */
    async function fetchWithRetry(url, options, retryCount = 0) {
        try {
            const response = await fetchWithTimeout(url, options);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return response;
        } catch (error) {
            if (retryCount < RETRY_COUNT) {
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (retryCount + 1)));
                return fetchWithRetry(url, options, retryCount + 1);
            }
            throw error;
        }
    }

    /**
     * Fetch с таймаутом
     */
    async function fetchWithTimeout(url, options) {
        const controller = new AbortController();
        const timeout = options.timeout || 5000;

        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                throw new Error(`Таймаут запроса к ${url}`);
            }
            throw error;
        }
    }

    /**
     * Получение токена
     */
    async function getToken() {
        try {
            const user = Auth?.getUser ? Auth.getUser() : null;
            if (!user) return null;
            
            return await user.getIdToken();
        } catch (error) {
            console.error('Ошибка получения токена:', error);
            return null;
        }
    }

    /**
     * Генерация ID запроса
     */
    function generateRequestId() {
        return 'req_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Балансировка нагрузки
     */
    function getHealthyService(service) {
        // В реальном проекте здесь проверка здоровья
        return SERVICES[service];
    }

    /**
     * Проверка здоровья сервиса
     */
    async function checkHealth(service) {
        const config = SERVICES[service];
        if (!config) return false;

        try {
            const url = `${config.url}${config.health || '/health'}`;
            const response = await fetchWithTimeout(url, { timeout: 2000 });
            return response.ok;
        } catch {
            return false;
        }
    }

    /**
     * Сервис авторизации
     */
    const auth = {
        async login(email, password) {
            return call('auth', 'login', 'POST', { email, password });
        },
        async register(userData) {
            return call('auth', 'register', 'POST', userData);
        },
        async verify(token) {
            return call('auth', 'verify', 'POST', { token });
        },
        async refresh(refreshToken) {
            return call('auth', 'refresh', 'POST', { refreshToken });
        },
        async logout() {
            return call('auth', 'logout', 'POST');
        }
    };

    /**
     * Сервис заказов
     */
    const orders = {
        async create(orderData) {
            return call('orders', 'orders', 'POST', orderData, { priority: 5 });
        },
        async get(id) {
            return call('orders', `orders/${id}`);
        },
        async list(filters = {}) {
            const params = new URLSearchParams(filters).toString();
            return call('orders', `orders?${params}`);
        },
        async respond(orderId, response) {
            return call('orders', `orders/${orderId}/respond`, 'POST', response, { priority: 3 });
        },
        async selectMaster(orderId, masterId, price) {
            return call('orders', `orders/${orderId}/select`, 'POST', { masterId, price });
        },
        async complete(orderId) {
            return call('orders', `orders/${orderId}/complete`, 'POST');
        }
    };

    /**
     * Сервис чатов (WebSocket)
     */
    const chat = {
        ws: null,
        listeners: new Map(),
        
        connect(chatId) {
            if (this.ws) {
                this.ws.close();
            }

            const wsUrl = `${SERVICES.chat.url}/${chatId}?token=${getToken()}`;
            this.ws = new WebSocket(wsUrl);
            
            this.ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    this.handleMessage(message);
                } catch (e) {
                    console.error('Ошибка парсинга сообщения:', e);
                }
            };

            this.ws.onclose = () => {
                console.log('WebSocket чата закрыт');
                setTimeout(() => this.connect(chatId), 5000);
            };

            return this.ws;
        },

        send(message) {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify(message));
                return true;
            }
            return false;
        },

        handleMessage(message) {
            // Обработка сообщений
            window.dispatchEvent(new CustomEvent('chat-message', { 
                detail: message 
            }));
            
            // Вызываем слушателей
            if (this.listeners.has(message.type)) {
                this.listeners.get(message.type).forEach(cb => cb(message.data));
            }
        },

        on(type, callback) {
            if (!this.listeners.has(type)) {
                this.listeners.set(type, new Set());
            }
            this.listeners.get(type).add(callback);
        },

        off(type, callback) {
            if (this.listeners.has(type)) {
                this.listeners.get(type).delete(callback);
            }
        }
    };

    /**
     * Сервис платежей
     */
    const payments = {
        async createPayment(orderId, amount, method = 'card') {
            return call('payments', 'payments', 'POST', { 
                orderId, 
                amount, 
                method,
                returnUrl: window.location.origin + '/payment-success.html'
            }, { priority: 10, timeout: 30000 });
        },
        async checkStatus(paymentId) {
            return call('payments', `payments/${paymentId}/status`);
        },
        async refund(paymentId, amount = null) {
            return call('payments', `payments/${paymentId}/refund`, 'POST', { amount });
        },
        async getBalance() {
            return call('payments', 'balance');
        },
        async withdraw(amount, details) {
            return call('payments', 'withdraw', 'POST', { amount, details });
        }
    };

    /**
     * Сервис уведомлений
     */
    const notifications = {
        async send(userId, notification) {
            return call('notifications', 'send', 'POST', {
                userId,
                ...notification
            }, { priority: 2 });
        },
        async broadcast(type, data, roles = null) {
            return call('notifications', 'broadcast', 'POST', { 
                type, 
                data,
                roles 
            });
        },
        async markAsRead(notificationId) {
            return call('notifications', `notifications/${notificationId}/read`, 'POST');
        },
        async getUnreadCount() {
            return call('notifications', 'unread/count');
        }
    };

    /**
     * Сервис аналитики
     */
    const analytics = {
        async track(event) {
            return call('analytics', 'track', 'POST', event, {
                priority: -1, // Низкий приоритет
                timeout: 2000
            }).catch(() => {/* Игнорируем ошибки аналитики */});
        },
        async getReport(params) {
            const query = new URLSearchParams(params).toString();
            return call('analytics', `report?${query}`);
        },
        async getDashboard() {
            return call('analytics', 'dashboard');
        },
        async getRealtime() {
            return call('analytics', 'realtime');
        }
    };

    /**
     * Сервис CDN
     */
    const cdn = {
        async upload(file, folder = 'general') {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('folder', folder);
            
            return call('cdn', 'upload', 'POST', formData, {
                headers: {}, // Убираем Content-Type для FormData
                timeout: 60000, // 1 минута на загрузку
                priority: 3
            });
        },

        async uploadMultiple(files, folder = 'general') {
            const formData = new FormData();
            files.forEach((file, index) => {
                formData.append(`file_${index}`, file);
            });
            formData.append('folder', folder);
            
            return call('cdn', 'upload/multiple', 'POST', formData, {
                timeout: 120000, // 2 минуты
                priority: 2
            });
        },

        getUrl(path, size = 'original') {
            return `${SERVICES.cdn.url}/${size}/${path}`;
        },

        async delete(path) {
            return call('cdn', 'delete', 'POST', { path });
        }
    };

    /**
     * Статус всех сервисов
     */
    async function healthCheck() {
        const status = {};

        await Promise.all(Object.keys(SERVICES).map(async (name) => {
            try {
                const start = Date.now();
                const isHealthy = await checkHealth(name);
                status[name] = {
                    status: isHealthy ? 'healthy' : 'unhealthy',
                    latency: isHealthy ? Date.now() - start : null,
                    url: SERVICES[name].url
                };
            } catch (error) {
                status[name] = {
                    status: 'unhealthy',
                    error: error.message,
                    url: SERVICES[name].url
                };
            }
        }));

        return status;
    }

    // Публичное API
    return {
        call,
        auth,
        orders,
        chat,
        payments,
        notifications,
        analytics,
        cdn,
        healthCheck,
        SERVICES,
        checkHealth
    };
})();

window.Microservices = Microservices;