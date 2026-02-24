// ===== js/services/analytics.js =====
// РАСШИРЕННАЯ АНАЛИТИКА И МЕТРИКИ

const Analytics = (function() {
    // Конфигурация
    const CONFIG = {
        RETENTION_DAYS: 30,
        CACHE_TTL: 3600000, // 1 час
        METRICS: [
            'users', 'orders', 'revenue', 'conversion',
            'retention', 'ltv', 'churn', 'arpu'
        ]
    };

    /**
     * Отслеживание события
     */
    async function trackEvent(category, action, label = null, value = null, metadata = {}) {
        try {
            const event = {
                category: category,
                action: action,
                label: label,
                value: value,
                metadata: metadata,
                userId: Auth.getUser()?.uid,
                userAgent: navigator.userAgent,
                url: window.location.href,
                referrer: document.referrer,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                sessionId: getSessionId()
            };

            await db.collection('analytics_events').add(event);

            // Яндекс.Метрика
            if (window.ym) {
                ym(93662075, 'reachGoal', action);
            }

            // Google Analytics
            if (window.gtag) {
                gtag('event', action, {
                    'event_category': category,
                    'event_label': label,
                    'value': value,
                    ...metadata
                });
            }

            // Отправляем в WebSocket для realtime
            if (window.ws) {
                ws.send(JSON.stringify({
                    type: 'analytics',
                    data: { category, action, label, value }
                }));
            }
            
        } catch (error) {
            console.error('Ошибка трекинга:', error);
        }
    }

    /**
     * Получение сессии
     */
    function getSessionId() {
        let sessionId = sessionStorage.getItem('sessionId');
        if (!sessionId) {
            sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            sessionStorage.setItem('sessionId', sessionId);
        }
        return sessionId;
    }

    /**
     * Получение общей статистики
     */
    async function getDashboardStats() {
        try {
            const now = new Date();
            const today = new Date(now.setHours(0, 0, 0, 0));
            const weekAgo = new Date(today);
            weekAgo.setDate(weekAgo.getDate() - 7);
            const monthAgo = new Date(today);
            monthAgo.setMonth(monthAgo.getMonth() - 1);

            // Параллельные запросы
            const [
                totalUsersSnap,
                newUsersSnap,
                activeToday,
                totalOrdersSnap,
                ordersTodaySnap,
                completedTodaySnap,
                revenueToday,
                revenueMonth,
                avgOrderValue,
                conversionRate
            ] = await Promise.all([
                // Всего пользователей
                db.collection('users').get(),
                
                // Новые сегодня
                db.collection('users')
                    .where('createdAt', '>=', today)
                    .get(),
                
                // Активные сегодня
                db.collection('analytics_events')
                    .where('timestamp', '>=', today)
                    .get()
                    .then(snap => {
                        const unique = new Set();
                        snap.forEach(doc => {
                            const userId = doc.data().userId;
                            if (userId) unique.add(userId);
                        });
                        return unique.size;
                    }),
                
                // Всего заказов
                db.collection('orders').get(),
                
                // Заказов сегодня
                db.collection('orders')
                    .where('createdAt', '>=', today)
                    .get(),
                
                // Выполнено сегодня
                db.collection('orders')
                    .where('status', '==', ORDER_STATUS.COMPLETED)
                    .where('completedAt', '>=', today)
                    .get(),
                
                // Выручка сегодня
                calculateRevenue(today),
                
                // Выручка за месяц
                calculateRevenue(monthAgo),
                
                // Средний чек
                calculateAvgOrderValue(),
                
                // Конверсия
                calculateConversionRate(weekAgo)
            ]);

            const totalUsers = totalUsersSnap.size;
            const newUsersToday = newUsersSnap.size;
            const totalOrders = totalOrdersSnap.size;
            const ordersToday = ordersTodaySnap.size;
            const completedToday = completedTodaySnap.size;

            return {
                users: {
                    total: totalUsers,
                    newToday: newUsersToday,
                    activeToday: activeToday
                },
                orders: {
                    total: totalOrders,
                    today: ordersToday,
                    completedToday: completedToday
                },
                revenue: {
                    today: revenueToday,
                    month: revenueMonth
                },
                metrics: {
                    avgOrderValue: avgOrderValue,
                    conversionRate: conversionRate
                }
            };
            
        } catch (error) {
            console.error('Ошибка получения статистики:', error);
            return null;
        }
    }

    /**
     * Расчет выручки
     */
    async function calculateRevenue(startDate) {
        const snapshot = await db.collection('orders')
            .where('status', '==', ORDER_STATUS.COMPLETED)
            .where('completedAt', '>=', startDate)
            .get();

        let total = 0;
        snapshot.forEach(doc => {
            total += doc.data().price || 0;
        });

        return total;
    }

    /**
     * Расчет среднего чека
     */
    async function calculateAvgOrderValue() {
        const snapshot = await db.collection('orders')
            .where('status', '==', ORDER_STATUS.COMPLETED)
            .limit(1000)
            .get();

        if (snapshot.empty) return 0;

        let total = 0;
        snapshot.forEach(doc => total += doc.data().price || 0);
        
        return snapshot.size > 0 ? Math.round(total / snapshot.size) : 0;
    }

    /**
     * Расчет конверсии
     */
    async function calculateConversionRate(startDate) {
        const viewsSnapshot = await db.collection('analytics_events')
            .where('category', '==', 'order')
            .where('action', '==', 'view')
            .where('timestamp', '>=', startDate)
            .get();

        const ordersSnapshot = await db.collection('orders')
            .where('createdAt', '>=', startDate)
            .get();

        const views = viewsSnapshot.size;
        const orders = ordersSnapshot.size;

        if (views === 0) return 0;
        return (orders / views * 100).toFixed(1);
    }

    /**
     * Получение данных для графика
     */
    async function getChartData(metric, period = 'week') {
        try {
            const now = new Date();
            let startDate, interval, format;

            switch(period) {
                case 'day':
                    startDate = new Date(now.setHours(0, 0, 0, 0));
                    interval = 'hour';
                    format = 'HH:00';
                    break;
                case 'week':
                    startDate = new Date(now);
                    startDate.setDate(startDate.getDate() - 7);
                    interval = 'day';
                    format = 'DD.MM';
                    break;
                case 'month':
                    startDate = new Date(now);
                    startDate.setMonth(startDate.getMonth() - 1);
                    interval = 'day';
                    format = 'DD.MM';
                    break;
                case 'year':
                    startDate = new Date(now);
                    startDate.setFullYear(startDate.getFullYear() - 1);
                    interval = 'month';
                    format = 'MMMM';
                    break;
                default:
                    startDate = new Date(now.setDate(now.getDate() - 7));
                    interval = 'day';
                    format = 'DD.MM';
            }

            let data = [];

            switch(metric) {
                case 'users':
                    data = await getUsersTimeline(startDate, interval);
                    break;
                case 'orders':
                    data = await getOrdersTimeline(startDate, interval);
                    break;
                case 'revenue':
                    data = await getRevenueTimeline(startDate, interval);
                    break;
                case 'conversion':
                    data = await getConversionTimeline(startDate, interval);
                    break;
            }

            return {
                labels: data.map(d => d.label),
                values: data.map(d => d.value),
                period,
                metric
            };
            
        } catch (error) {
            console.error('Ошибка получения данных графика:', error);
            return null;
        }
    }

    /**
     * Динамика пользователей
     */
    async function getUsersTimeline(startDate, interval) {
        const snapshot = await db.collection('users')
            .where('createdAt', '>=', startDate)
            .orderBy('createdAt')
            .get();

        const timeline = new Map();

        snapshot.forEach(doc => {
            const data = doc.data();
            if (!data.createdAt) return;
            
            const date = data.createdAt.toDate();
            let key;

            if (interval === 'hour') {
                key = date.getHours() + ':00';
            } else if (interval === 'day') {
                key = date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
            } else {
                key = date.toLocaleDateString('ru-RU', { month: 'long' });
            }

            timeline.set(key, (timeline.get(key) || 0) + 1);
        });

        return Array.from(timeline, ([label, value]) => ({ label, value }));
    }

    /**
     * Динамика заказов
     */
    async function getOrdersTimeline(startDate, interval) {
        const snapshot = await db.collection('orders')
            .where('createdAt', '>=', startDate)
            .orderBy('createdAt')
            .get();

        const timeline = new Map();

        snapshot.forEach(doc => {
            const data = doc.data();
            if (!data.createdAt) return;
            
            const date = data.createdAt.toDate();
            let key;

            if (interval === 'hour') {
                key = date.getHours() + ':00';
            } else if (interval === 'day') {
                key = date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
            } else {
                key = date.toLocaleDateString('ru-RU', { month: 'long' });
            }

            timeline.set(key, (timeline.get(key) || 0) + 1);
        });

        return Array.from(timeline, ([label, value]) => ({ label, value }));
    }

    /**
     * Динамика просмотров
     */
    async function getViewsTimeline(startDate, interval) {
        const snapshot = await db.collection('analytics_events')
            .where('category', '==', 'order')
            .where('action', '==', 'view')
            .where('timestamp', '>=', startDate)
            .orderBy('timestamp')
            .get();

        const timeline = new Map();

        snapshot.forEach(doc => {
            const data = doc.data();
            if (!data.timestamp) return;
            
            const date = data.timestamp.toDate();
            let key;

            if (interval === 'hour') {
                key = date.getHours() + ':00';
            } else if (interval === 'day') {
                key = date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
            } else {
                key = date.toLocaleDateString('ru-RU', { month: 'long' });
            }

            timeline.set(key, (timeline.get(key) || 0) + 1);
        });

        return Array.from(timeline, ([label, value]) => ({ label, value }));
    }

    /**
     * Динамика выручки
     */
    async function getRevenueTimeline(startDate, interval) {
        const snapshot = await db.collection('orders')
            .where('status', '==', ORDER_STATUS.COMPLETED)
            .where('completedAt', '>=', startDate)
            .orderBy('completedAt')
            .get();

        const timeline = new Map();

        snapshot.forEach(doc => {
            const data = doc.data();
            if (!data.completedAt) return;
            
            const date = data.completedAt.toDate();
            const price = data.price || 0;
            let key;

            if (interval === 'hour') {
                key = date.getHours() + ':00';
            } else if (interval === 'day') {
                key = date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
            } else {
                key = date.toLocaleDateString('ru-RU', { month: 'long' });
            }

            timeline.set(key, (timeline.get(key) || 0) + price);
        });

        return Array.from(timeline, ([label, value]) => ({ label, value }));
    }

    /**
     * Динамика конверсии
     */
    async function getConversionTimeline(startDate, interval) {
        const views = await getViewsTimeline(startDate, interval);
        const orders = await getOrdersTimeline(startDate, interval);

        return views.map((v, i) => {
            const orderValue = orders[i]?.value || 0;
            const viewValue = v.value || 1; // Избегаем деления на 0
            return {
                label: v.label,
                value: orderValue ? (orderValue / viewValue * 100).toFixed(1) : 0
            };
        });
    }

    /**
     * Воронка конверсии
     */
    async function getConversionFunnel() {
        const monthAgo = new Date();
        monthAgo.setMonth(monthAgo.getMonth() - 1);

        const funnel = {
            views: 0,
            responses: 0,
            selections: 0,
            payments: 0,
            completions: 0
        };

        const snapshot = await db.collection('orders')
            .where('createdAt', '>=', monthAgo)
            .get();

        snapshot.forEach(doc => {
            const order = doc.data();
            
            funnel.views += order.views || 0;
            funnel.responses += order.responses?.length || 0;
            
            if (order.selectedMasterId) {
                funnel.selections++;
            }
            
            if (order.paymentStatus === 'paid') {
                funnel.payments++;
            }
            
            if (order.status === ORDER_STATUS.COMPLETED) {
                funnel.completions++;
            }
        });

        return {
            stages: [
                { name: 'Просмотры', count: funnel.views },
                { name: 'Отклики', count: funnel.responses },
                { name: 'Выбор мастера', count: funnel.selections },
                { name: 'Оплата', count: funnel.payments },
                { name: 'Выполнение', count: funnel.completions }
            ],
            conversion: {
                viewsToResponses: funnel.views > 0 ? (funnel.responses / funnel.views * 100).toFixed(1) : 0,
                responsesToSelections: funnel.responses > 0 ? (funnel.selections / funnel.responses * 100).toFixed(1) : 0,
                selectionsToPayments: funnel.selections > 0 ? (funnel.payments / funnel.selections * 100).toFixed(1) : 0,
                paymentsToCompletions: funnel.payments > 0 ? (funnel.completions / funnel.payments * 100).toFixed(1) : 0
            }
        };
    }

    /**
     * Активность по часам
     */
    async function getHourlyActivity() {
        const hours = new Array(24).fill(0);
        
        const snapshot = await db.collection('analytics_events')
            .orderBy('timestamp', 'desc')
            .limit(10000)
            .get();

        snapshot.forEach(doc => {
            const event = doc.data();
            if (event.timestamp) {
                const hour = new Date(event.timestamp.seconds * 1000).getHours();
                hours[hour]++;
            }
        });

        return hours;
    }

    /**
     * Топ категорий
     */
    async function getTopCategories(limit = 5) {
        const snapshot = await db.collection('orders')
            .where('status', '==', ORDER_STATUS.COMPLETED)
            .limit(1000)
            .get();

        const categories = {};

        snapshot.forEach(doc => {
            const cat = doc.data().category;
            categories[cat] = (categories[cat] || 0) + 1;
        });

        return Object.entries(categories)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, limit);
    }

    /**
     * География заказов
     */
    async function getOrderGeography() {
        const snapshot = await db.collection('orders')
            .where('status', '==', ORDER_STATUS.COMPLETED)
            .limit(5000)
            .get();

        const cities = {};

        snapshot.forEach(doc => {
            const address = doc.data().address || '';
            // Парсим город
            const match = address.match(/(?:г\.|город)\s*([А-Яа-я\-]+)/);
            const city = match ? match[1] : 'Другой';
            
            cities[city] = (cities[city] || 0) + 1;
        });

        return Object.entries(cities)
            .map(([city, count]) => ({ city, count }))
            .sort((a, b) => b.count - a.count);
    }

    /**
     * Удержание пользователей (Retention)
     */
    async function getRetention() {
        const cohorts = {};
        const now = new Date();

        // Получаем пользователей по неделям регистрации
        for (let i = 0; i < 8; i++) {
            const weekStart = new Date(now);
            weekStart.setDate(weekStart.getDate() - (i * 7));
            weekStart.setHours(0, 0, 0, 0);
            
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekEnd.getDate() + 7);

            const usersSnapshot = await db.collection('users')
                .where('createdAt', '>=', weekStart)
                .where('createdAt', '<', weekEnd)
                .get();

            if (usersSnapshot.empty) continue;

            const cohort = [];
            
            // Для каждого пользователя считаем активность по неделям
            for (const userDoc of usersSnapshot.docs) {
                const userId = userDoc.id;
                
                const activitySnapshot = await db.collection('analytics_events')
                    .where('userId', '==', userId)
                    .where('timestamp', '>=', weekStart)
                    .orderBy('timestamp')
                    .get();

                const weeks = new Array(8).fill(0);
                
                activitySnapshot.forEach(doc => {
                    const eventData = doc.data();
                    if (!eventData.timestamp) return;
                    
                    const eventDate = eventData.timestamp.toDate();
                    const weekDiff = Math.floor((eventDate - weekStart) / (7 * 24 * 60 * 60 * 1000));
                    if (weekDiff >= 0 && weekDiff < 8) {
                        weeks[weekDiff] = 1;
                    }
                });

                cohort.push(weeks);
            }

            // Усредняем
            const retention = [];
            for (let week = 0; week < 8; week++) {
                const active = cohort.filter(u => u[week] === 1).length;
                retention.push(cohort.length > 0 ? (active / cohort.length * 100).toFixed(1) : 0);
            }

            cohorts[`Неделя ${i + 1}`] = retention;
        }

        return cohorts;
    }

    /**
     * Экспорт отчета
     */
    async function exportReport(format = 'csv') {
        const stats = await getDashboardStats();
        const funnel = await getConversionFunnel();
        const topCategories = await getTopCategories();

        if (format === 'csv') {
            let csv = 'Метрика,Значение\n';
            csv += `Всего пользователей,${stats.users.total}\n`;
            csv += `Новых сегодня,${stats.users.newToday}\n`;
            csv += `Активных сегодня,${stats.users.activeToday}\n`;
            csv += `Всего заказов,${stats.orders.total}\n`;
            csv += `Заказов сегодня,${stats.orders.today}\n`;
            csv += `Выручка сегодня,${stats.revenue.today}\n`;
            csv += `Средний чек,${stats.metrics.avgOrderValue}\n`;
            csv += `Конверсия,${stats.metrics.conversionRate}%\n`;

            return csv;
        }

        return {
            stats,
            funnel,
            topCategories,
            generatedAt: new Date().toISOString()
        };
    }

    // Публичное API
    return {
        trackEvent,
        getDashboardStats,
        getChartData,
        getConversionFunnel,
        getHourlyActivity,
        getTopCategories,
        getOrderGeography,
        getRetention,
        exportReport
    };
})();

window.Analytics = Analytics;