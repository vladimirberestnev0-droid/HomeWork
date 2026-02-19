// ===== js/services/gamification.js =====
// СИСТЕМА ГЕЙМИФИКАЦИИ (УРОВНИ, XP, АЧИВКИ, ТОПЫ)

const Gamification = (function() {
    // Константы
    const ORDER_STATUS = window.ORDER_STATUS || {
        COMPLETED: 'completed'
    };

    // Конфигурация уровней
    const LEVELS = [
        { level: 1, name: '🌱 Новичок', minXP: 0, maxXP: 100, color: '#95a5a6' },
        { level: 2, name: '🔨 Подмастерье', minXP: 100, maxXP: 300, color: '#3498db' },
        { level: 3, name: '⚡ Мастер', minXP: 300, maxXP: 600, color: '#9b59b6' },
        { level: 4, name: '👑 Профи', minXP: 600, maxXP: 1000, color: '#f1c40f' },
        { level: 5, name: '🏆 Эксперт', minXP: 1000, maxXP: 1500, color: '#e67e22' },
        { level: 6, name: '💎 Гуру', minXP: 1500, maxXP: 2500, color: '#e74c3c' },
        { level: 7, name: '🌟 Легенда', minXP: 2500, maxXP: 4000, color: '#2c3e50' },
        { level: 8, name: '🔥 Бог ремонта', minXP: 4000, maxXP: 10000, color: '#8e44ad' }
    ];

    // Ачивки (30 штук)
    const ACHIEVEMENTS = {
        // По заказам
        first_order: {
            id: 'first_order',
            name: '🚀 Первый заказ',
            description: 'Выполнить первый заказ',
            xp: 50,
            icon: 'fa-rocket',
            condition: (stats) => (stats.completedOrders || 0) >= 1
        },
        ten_orders: {
            id: 'ten_orders',
            name: '🔥 10 заказов',
            description: 'Выполнить 10 заказов',
            xp: 200,
            icon: 'fa-fire',
            condition: (stats) => (stats.completedOrders || 0) >= 10
        },
        fifty_orders: {
            id: 'fifty_orders',
            name: '⚡ 50 заказов',
            description: 'Выполнить 50 заказов',
            xp: 500,
            icon: 'fa-bolt',
            condition: (stats) => (stats.completedOrders || 0) >= 50
        },
        hundred_orders: {
            id: 'hundred_orders',
            name: '👑 100 заказов',
            description: 'Выполнить 100 заказов',
            xp: 1000,
            icon: 'fa-crown',
            condition: (stats) => (stats.completedOrders || 0) >= 100
        },
        
        // По рейтингу
        five_star: {
            id: 'five_star',
            name: '⭐ 5 звёзд',
            description: 'Получить 10 отзывов с оценкой 5',
            xp: 300,
            icon: 'fa-star',
            condition: (stats) => (stats.fiveStarReviews || 0) >= 10
        },
        perfect_100: {
            id: 'perfect_100',
            name: '💯 Идеально',
            description: '100% положительных отзывов',
            xp: 400,
            icon: 'fa-percent',
            condition: (stats) => (stats.positiveRate || 0) === 100
        },
        
        // По скорости
        fast_response: {
            id: 'fast_response',
            name: '⚡ Быстрый отклик',
            description: 'Откликнуться на заказ за 5 минут',
            xp: 100,
            icon: 'fa-clock',
            condition: (stats) => (stats.fastResponses || 0) >= 1
        },
        speed_demon: {
            id: 'speed_demon',
            name: '🏃 Скоростной',
            description: '10 быстрых откликов',
            xp: 300,
            icon: 'fa-gauge-high',
            condition: (stats) => (stats.fastResponses || 0) >= 10
        },
        
        // По портфолио
        photo_add: {
            id: 'photo_add',
            name: '📸 Фотограф',
            description: 'Добавить 10 фото в портфолио',
            xp: 150,
            icon: 'fa-camera',
            condition: (stats) => (stats.portfolioCount || 0) >= 10
        },
        portfolio_pro: {
            id: 'portfolio_pro',
            name: '🎨 Мастер портфолио',
            description: '50 фото в портфолио',
            xp: 400,
            icon: 'fa-images',
            condition: (stats) => (stats.portfolioCount || 0) >= 50
        },
        
        // По избранному
        popular: {
            id: 'popular',
            name: '🌟 Популярный',
            description: 'Добавлен в избранное 10 раз',
            xp: 200,
            icon: 'fa-heart',
            condition: (stats) => (stats.favoritesCount || 0) >= 10
        },
        celebrity: {
            id: 'celebrity',
            name: '🎭 Знаменитость',
            description: '50 в избранном',
            xp: 500,
            icon: 'fa-star',
            condition: (stats) => (stats.favoritesCount || 0) >= 50
        },
        
        // Специальные
        early_bird: {
            id: 'early_bird',
            name: '🐦 Ранняя пташка',
            description: 'Выполнить заказ до 9 утра',
            xp: 100,
            icon: 'fa-sun',
            condition: (stats) => (stats.earlyOrders || 0) >= 1
        },
        night_owl: {
            id: 'night_owl',
            name: '🦉 Ночная сова',
            description: 'Работа после 22:00',
            xp: 100,
            icon: 'fa-moon',
            condition: (stats) => (stats.nightOrders || 0) >= 1
        },
        weekend_warrior: {
            id: 'weekend_warrior',
            name: '📅 Воин выходного дня',
            description: '10 заказов в выходные',
            xp: 300,
            icon: 'fa-calendar-week',
            condition: (stats) => (stats.weekendOrders || 0) >= 10
        },
        
        // По категориям
        plumber: {
            id: 'plumber',
            name: '🔧 Сантехник',
            description: '10 заказов по сантехнике',
            xp: 200,
            icon: 'fa-wrench',
            condition: (stats) => (stats.categoryStats?.plumber || 0) >= 10
        },
        electrician: {
            id: 'electrician',
            name: '⚡ Электрик',
            description: '10 заказов по электрике',
            xp: 200,
            icon: 'fa-bolt',
            condition: (stats) => (stats.categoryStats?.electrician || 0) >= 10
        },
        builder: {
            id: 'builder',
            name: '🏗️ Строитель',
            description: '10 заказов по ремонту',
            xp: 200,
            icon: 'fa-hammer',
            condition: (stats) => (stats.categoryStats?.builder || 0) >= 10
        },
        
        // Юбилейные
        anniversary_1: {
            id: 'anniversary_1',
            name: '🎂 1 год',
            description: 'Год на платформе',
            xp: 500,
            icon: 'fa-cake-candles',
            condition: (stats) => (stats.daysOnPlatform || 0) >= 365
        },
        anniversary_3: {
            id: 'anniversary_3',
            name: '🎉 3 года',
            description: 'Три года с нами',
            xp: 1500,
            icon: 'fa-gift',
            condition: (stats) => (stats.daysOnPlatform || 0) >= 1095
        },
        
        // Социальные
        helper: {
            id: 'helper',
            name: '🤝 Помощник',
            description: 'Помочь 5 новичкам',
            xp: 200,
            icon: 'fa-handshake',
            condition: (stats) => (stats.helpCount || 0) >= 5
        },
        communicator: {
            id: 'communicator',
            name: '💬 Коммуникатор',
            description: '1000 сообщений в чатах',
            xp: 300,
            icon: 'fa-comments',
            condition: (stats) => (stats.messagesCount || 0) >= 1000
        },
        
        // Секретные
        secret_achievement: {
            id: 'secret_achievement',
            name: '🔍 Секретная ачивка',
            description: '???',
            xp: 1000,
            icon: 'fa-mask',
            secret: true,
            condition: (stats) => stats.secretFlag === true
        }
    };

    /**
     * Получить уровень по XP
     */
    function getLevelFromXP(xp) {
        xp = xp || 0;
        for (let i = LEVELS.length - 1; i >= 0; i--) {
            if (xp >= LEVELS[i].minXP) {
                return LEVELS[i];
            }
        }
        return LEVELS[0];
    }

    /**
     * Получить прогресс до следующего уровня
     */
    function getLevelProgress(xp) {
        xp = xp || 0;
        const currentLevel = getLevelFromXP(xp);
        const nextLevel = LEVELS.find(l => l.level === currentLevel.level + 1);
        
        if (!nextLevel) {
            return { 
                current: currentLevel,
                progress: 100,
                xpNeeded: 0,
                next: null
            };
        }

        const xpInCurrent = xp - currentLevel.minXP;
        const xpNeededForNext = nextLevel.minXP - currentLevel.minXP;
        const progress = (xpInCurrent / xpNeededForNext) * 100;

        return {
            current: currentLevel,
            next: nextLevel,
            progress: Math.min(100, progress),
            xpNeeded: nextLevel.minXP - xp
        };
    }

    /**
     * Добавление XP пользователю
     */
    async function addXP(userId, amount, reason) {
        try {
            const userRef = db.collection('users').doc(userId);
            
            const result = await db.runTransaction(async (transaction) => {
                const userDoc = await transaction.get(userRef);
                if (!userDoc.exists) {
                    throw new Error('Пользователь не найден');
                }
                
                const user = userDoc.data();
                
                const currentXP = user.xp || 0;
                const newXP = currentXP + amount;
                
                const oldLevel = getLevelFromXP(currentXP);
                const newLevel = getLevelFromXP(newXP);
                
                // Обновляем XP
                transaction.update(userRef, {
                    xp: newXP,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });

                // Логируем получение XP
                await db.collection('xp_log').add({
                    userId: userId,
                    amount: amount,
                    reason: reason,
                    oldXP: currentXP,
                    newXP: newXP,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });

                // Если уровень повысился
                if (newLevel.level > oldLevel.level) {
                    await notifyLevelUp(userId, oldLevel, newLevel);
                }

                return { oldLevel, newLevel, newXP };
            });

            // Проверяем ачивки
            await checkAchievements(userId);

            return { success: true, ...result };
            
        } catch (error) {
            console.error('Ошибка добавления XP:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Уведомление о повышении уровня
     */
    async function notifyLevelUp(userId, oldLevel, newLevel) {
        await db.collection('notifications').add({
            userId: userId,
            type: 'level_up',
            title: `🎉 Уровень повышен!`,
            body: `${oldLevel.name} → ${newLevel.name}`,
            data: { 
                oldLevel: oldLevel.level,
                newLevel: newLevel.level,
                xpBonus: 100
            },
            read: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Дарим XP за повышение
        await addXP(userId, 100, 'Бонус за повышение уровня');
    }

    /**
     * Проверка и выдача ачивок
     */
    async function checkAchievements(userId) {
        try {
            const userDoc = await db.collection('users').doc(userId).get();
            if (!userDoc.exists) return [];
            
            const user = userDoc.data();
            
            const earned = user.achievements || [];
            const newAchievements = [];

            // Собираем статистику пользователя
            const stats = await getUserStats(userId);

            // Проверяем каждую ачивку
            for (const [key, ach] of Object.entries(ACHIEVEMENTS)) {
                if (earned.includes(key)) continue;

                try {
                    if (ach.condition(stats)) {
                        newAchievements.push(key);
                        
                        // Добавляем XP за ачивку
                        await addXP(userId, ach.xp, `achievement_${key}`);
                        
                        // Создаем уведомление
                        await db.collection('notifications').add({
                            userId: userId,
                            type: 'achievement',
                            title: `🏅 Новая ачивка!`,
                            body: ach.name,
                            data: { 
                                achievement: key,
                                xp: ach.xp
                            },
                            read: false,
                            createdAt: firebase.firestore.FieldValue.serverTimestamp()
                        });
                    }
                } catch (e) {
                    console.error(`Ошибка проверки ачивки ${key}:`, e);
                }
            }

            if (newAchievements.length > 0) {
                await db.collection('users').doc(userId).update({
                    achievements: firebase.firestore.FieldValue.arrayUnion(...newAchievements)
                });
            }

            return newAchievements;
            
        } catch (error) {
            console.error('Ошибка проверки ачивок:', error);
            return [];
        }
    }

    /**
     * Получение статистики пользователя
     */
    async function getUserStats(userId) {
        try {
            const userDoc = await db.collection('users').doc(userId).get();
            if (!userDoc.exists) return {};
            
            const user = userDoc.data();

            // Заказы
            const ordersSnapshot = await db.collection('orders')
                .where('selectedMasterId', '==', userId)
                .get();

            let completedOrders = 0;
            let fiveStarReviews = 0;
            let totalRating = 0;
            let categoryStats = {};

            for (const doc of ordersSnapshot.docs) {
                const order = doc.data();
                
                if (order.status === ORDER_STATUS.COMPLETED) {
                    completedOrders++;
                }

                if (order.reviews) {
                    order.reviews.forEach(review => {
                        if (review.masterId === userId) {
                            totalRating += review.rating || 0;
                            if (review.rating === 5) fiveStarReviews++;
                        }
                    });
                }

                // Статистика по категориям
                const cat = order.category;
                if (cat) {
                    if (cat.includes('Сантехника')) categoryStats.plumber = (categoryStats.plumber || 0) + 1;
                    if (cat.includes('Электрика')) categoryStats.electrician = (categoryStats.electrician || 0) + 1;
                    if (cat.includes('Отделочные')) categoryStats.builder = (categoryStats.builder || 0) + 1;
                }
            }

            // Портфолио
            const portfolioSnapshot = await db.collection('portfolio')
                .where('masterId', '==', userId)
                .get();
            const portfolioCount = portfolioSnapshot.size;

            // Сообщения
            const messagesSnapshot = await db.collectionGroup('messages')
                .where('senderId', '==', userId)
                .get();
            const messagesCount = messagesSnapshot.size;

            // Дней на платформе
            const daysOnPlatform = user.createdAt ? 
                Math.floor((Date.now() - user.createdAt.toDate().getTime()) / (1000 * 60 * 60 * 24)) : 0;

            return {
                completedOrders,
                fiveStarReviews,
                positiveRate: user.reviews > 0 ? (user.rating / 5 * 100) : 0,
                fastResponses: user.fastResponses || 0,
                portfolioCount,
                favoritesCount: user.favorites?.length || 0,
                messagesCount,
                daysOnPlatform,
                categoryStats,
                earlyOrders: user.earlyOrders || 0,
                nightOrders: user.nightOrders || 0,
                weekendOrders: user.weekendOrders || 0,
                helpCount: user.helpCount || 0,
                secretFlag: user.secretFlag || false
            };
            
        } catch (error) {
            console.error('Ошибка получения статистики:', error);
            return {};
        }
    }

    /**
     * Получение топа мастеров
     */
    async function getLeaderboard(period = 'all', limit = 10) {
        try {
            let query = db.collection('users')
                .where('role', '==', USER_ROLE.MASTER)
                .orderBy('xp', 'desc')
                .limit(limit);

            const snapshot = await query.get();
            
            const leaders = [];
            let position = 1;

            for (const doc of snapshot.docs) {
                const master = doc.data();
                const level = getLevelFromXP(master.xp || 0);
                
                leaders.push({
                    id: doc.id,
                    name: master.name || 'Мастер',
                    xp: master.xp || 0,
                    level: level.level,
                    levelName: level.name,
                    position: position++,
                    rating: master.rating || 0,
                    reviews: master.reviews || 0,
                    achievements: master.achievements?.length || 0
                });
            }

            return leaders;
            
        } catch (error) {
            console.error('Ошибка получения топа:', error);
            return [];
        }
    }

    /**
     * Получение топа за неделю
     */
    async function getWeeklyLeaderboard(limit = 10) {
        try {
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);

            const xpLogSnapshot = await db.collection('xp_log')
                .where('createdAt', '>=', weekAgo)
                .get();

            const xpMap = new Map();

            xpLogSnapshot.forEach(doc => {
                const log = doc.data();
                const userId = log.userId;
                const current = xpMap.get(userId) || 0;
                xpMap.set(userId, current + (log.amount || 0));
            });

            const leaders = [];
            for (const [userId, xp] of xpMap) {
                const userDoc = await db.collection('users').doc(userId).get();
                if (userDoc.exists) {
                    const user = userDoc.data();
                    leaders.push({
                        id: userId,
                        name: user.name || 'Мастер',
                        xp: xp,
                        level: getLevelFromXP(user.xp || 0).level
                    });
                }
            }

            return leaders.sort((a, b) => b.xp - a.xp).slice(0, limit);
            
        } catch (error) {
            console.error('Ошибка получения недельного топа:', error);
            return [];
        }
    }

    /**
     * Получение ачивок пользователя
     */
    async function getUserAchievements(userId) {
        try {
            const userDoc = await db.collection('users').doc(userId).get();
            if (!userDoc.exists) return [];
            
            const user = userDoc.data();
            
            const earnedIds = user.achievements || [];
            
            const achievements = Object.entries(ACHIEVEMENTS).map(([id, ach]) => ({
                id,
                ...ach,
                earned: earnedIds.includes(id)
            }));

            // Сортируем: сначала полученные
            return achievements.sort((a, b) => {
                if (a.earned && !b.earned) return -1;
                if (!a.earned && b.earned) return 1;
                return 0;
            });
            
        } catch (error) {
            console.error('Ошибка получения ачивок:', error);
            return [];
        }
    }

    /**
     * Рендер прогресса в UI
     */
    function renderProgress(userId) {
        const user = Auth.getUser();
        if (!user) return;

        const userData = Auth.getUserData();
        if (!userData) return;

        const xp = userData.xp || 0;
        const progress = getLevelProgress(xp);

        // Обновляем в шапке
        const headerLevel = document.getElementById('headerLevelValue');
        const headerXP = document.getElementById('headerXPValue');
        
        if (headerLevel) headerLevel.textContent = progress.current.level;
        if (headerXP) headerXP.textContent = xp;

        // Обновляем карточку прогресса
        const levelBadge = document.getElementById('userLevelBadge');
        const levelName = document.getElementById('userLevelName');
        const xpProgress = document.getElementById('userXPProgress');
        const xpText = document.getElementById('userXPText');

        if (levelBadge) levelBadge.textContent = progress.current.level;
        if (levelName) levelName.textContent = progress.current.name;
        if (xpProgress) xpProgress.style.width = `${progress.progress}%`;
        
        if (xpText) {
            if (progress.next) {
                xpText.textContent = `${xp} / ${progress.next.minXP} XP (ещё ${progress.xpNeeded} до ${progress.next.name})`;
            } else {
                xpText.textContent = `${xp} XP (максимальный уровень)`;
            }
        }

        // Показываем блок прогресса
        const progressBlock = document.getElementById('userProgress');
        if (progressBlock) progressBlock.classList.remove('d-none');
    }

    // Публичное API
    return {
        LEVELS,
        ACHIEVEMENTS,
        getLevelFromXP,
        getLevelProgress,
        addXP,
        checkAchievements,
        getLeaderboard,
        getWeeklyLeaderboard,
        getUserAchievements,
        renderProgress
    };
})();

window.Gamification = Gamification;