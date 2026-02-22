// ===== js/services/client-gamification.js =====
// ГЕЙМИФИКАЦИЯ ДЛЯ КЛИЕНТОВ (достижения, уровни, XP) - ИСПРАВЛЕННАЯ ВЕРСИЯ

const ClientGamification = (function() {
    // ===== КОНСТАНТЫ =====
    
    // Уровни клиентов
    const CLIENT_LEVELS = [
        { level: 1, name: '🌱 Новичок', minXP: 0, maxXP: 100, color: '#95a5a6', icon: 'fa-seedling' },
        { level: 2, name: '🔍 Любознательный', minXP: 100, maxXP: 300, color: '#3498db', icon: 'fa-eye' },
        { level: 3, name: '📋 Заказчик', minXP: 300, maxXP: 600, color: '#9b59b6', icon: 'fa-clipboard-list' },
        { level: 4, name: '⭐ Постоянный', minXP: 600, maxXP: 1000, color: '#f1c40f', icon: 'fa-star' },
        { level: 5, name: '💎 VIP', minXP: 1000, maxXP: 1500, color: '#e67e22', icon: 'fa-gem' },
        { level: 6, name: '👑 Партнёр', minXP: 1500, maxXP: 2500, color: '#e74c3c', icon: 'fa-crown' },
        { level: 7, name: '🏆 Эксперт', minXP: 2500, maxXP: 4000, color: '#2c3e50', icon: 'fa-trophy' },
        { level: 8, name: '🔥 Легенда', minXP: 4000, maxXP: 10000, color: '#8e44ad', icon: 'fa-fire' }
    ];

    // Достижения для клиентов (20 штук)
    const CLIENT_ACHIEVEMENTS = {
        // ===== ПО ЗАКАЗАМ =====
        first_order: {
            id: 'first_order',
            title: '🚀 Первый шаг',
            description: 'Создать первый заказ',
            xp: 50,
            icon: 'fa-rocket',
            color: '#4CAF50',
            group: 'orders',
            condition: (stats) => (stats.totalOrders || 0) >= 1
        },
        regular_client: {
            id: 'regular_client',
            title: '📦 Постоянный клиент',
            description: 'Создать 5 заказов',
            xp: 150,
            icon: 'fa-boxes',
            color: '#2196F3',
            group: 'orders',
            condition: (stats) => (stats.totalOrders || 0) >= 5
        },
        pro_client: {
            id: 'pro_client',
            title: '⚡ Профи-клиент',
            description: 'Создать 15 заказов',
            xp: 300,
            icon: 'fa-bolt',
            color: '#9C27B0',
            group: 'orders',
            condition: (stats) => (stats.totalOrders || 0) >= 15
        },
        master_client: {
            id: 'master_client',
            title: '👑 Мастер заказов',
            description: 'Создать 30 заказов',
            xp: 500,
            icon: 'fa-crown',
            color: '#FF9800',
            group: 'orders',
            condition: (stats) => (stats.totalOrders || 0) >= 30
        },
        legend_client: {
            id: 'legend_client',
            title: '🔥 Легендарный клиент',
            description: 'Создать 50 заказов',
            xp: 1000,
            icon: 'fa-fire',
            color: '#f44336',
            group: 'orders',
            condition: (stats) => (stats.totalOrders || 0) >= 50
        },

        // ===== ПО БЮДЖЕТУ =====
        first_thousand: {
            id: 'first_thousand',
            title: '💰 Первая тысяча',
            description: 'Потратить 1 000 ₽ на услуги',
            xp: 30,
            icon: 'fa-coins',
            color: '#FFD700',
            group: 'budget',
            condition: (stats) => (stats.totalSpent || 0) >= 1000
        },
        big_spender: {
            id: 'big_spender',
            title: '💸 Щедрый клиент',
            description: 'Потратить 50 000 ₽',
            xp: 200,
            icon: 'fa-sack-dollar',
            color: '#4CAF50',
            group: 'budget',
            condition: (stats) => (stats.totalSpent || 0) >= 50000
        },
        wealthy: {
            id: 'wealthy',
            title: '💎 Состоятельный',
            description: 'Потратить 200 000 ₽',
            xp: 500,
            icon: 'fa-gem',
            color: '#9C27B0',
            group: 'budget',
            condition: (stats) => (stats.totalSpent || 0) >= 200000
        },
        millionaire: {
            id: 'millionaire',
            title: '🏦 Миллионер',
            description: 'Потратить 1 000 000 ₽',
            xp: 1000,
            icon: 'fa-building-columns',
            color: '#FF9800',
            group: 'budget',
            condition: (stats) => (stats.totalSpent || 0) >= 1000000
        },

        // ===== ПО ОТЗЫВАМ =====
        first_review: {
            id: 'first_review',
            title: '✍️ Первый отзыв',
            description: 'Оставить первый отзыв мастеру',
            xp: 25,
            icon: 'fa-pen',
            color: '#00BCD4',
            group: 'reviews',
            condition: (stats) => (stats.totalReviews || 0) >= 1
        },
        helpful: {
            id: 'helpful',
            title: '🤝 Помощник',
            description: 'Оставить 5 отзывов',
            xp: 75,
            icon: 'fa-handshake',
            color: '#8BC34A',
            group: 'reviews',
            condition: (stats) => (stats.totalReviews || 0) >= 5
        },
        reviewer: {
            id: 'reviewer',
            title: '📝 Опытный критик',
            description: 'Оставить 15 отзывов',
            xp: 200,
            icon: 'fa-pen-to-square',
            color: '#FF5722',
            group: 'reviews',
            condition: (stats) => (stats.totalReviews || 0) >= 15
        },
        expert_reviewer: {
            id: 'expert_reviewer',
            title: '🎯 Эксперт по отзывам',
            description: 'Оставить 30 отзывов',
            xp: 400,
            icon: 'fa-bullseye',
            color: '#E91E63',
            group: 'reviews',
            condition: (stats) => (stats.totalReviews || 0) >= 30
        },

        // ===== ПО КАТЕГОРИЯМ =====
        handyman: {
            id: 'handyman',
            title: '🔧 Мастер на все руки',
            description: 'Заказать услуги в 3 разных категориях',
            xp: 80,
            icon: 'fa-toolbox',
            color: '#795548',
            group: 'categories',
            condition: (stats) => (stats.categoriesUsed || 0) >= 3
        },
        universal: {
            id: 'universal',
            title: '🌐 Универсал',
            description: 'Заказать услуги в 5 разных категориях',
            xp: 200,
            icon: 'fa-globe',
            color: '#3F51B5',
            group: 'categories',
            condition: (stats) => (stats.categoriesUsed || 0) >= 5
        },
        all_rounder: {
            id: 'all_rounder',
            title: '🎯 Всезнайка',
            description: 'Заказать услуги в 8 разных категориях',
            xp: 400,
            icon: 'fa-star',
            color: '#673AB7',
            group: 'categories',
            condition: (stats) => (stats.categoriesUsed || 0) >= 8
        },

        // ===== СПЕЦИАЛЬНЫЕ =====
        photo_uploader: {
            id: 'photo_uploader',
            title: '📸 Фотограф',
            description: 'Загрузить фото к заказу',
            xp: 30,
            icon: 'fa-camera',
            color: '#607D8B',
            group: 'special',
            condition: (stats) => (stats.photosUploaded || 0) >= 1
        },
        early_bird: {
            id: 'early_bird',
            title: '🐦 Ранняя пташка',
            description: 'Создать заказ до 9:00 утра',
            xp: 40,
            icon: 'fa-sun',
            color: '#FFC107',
            group: 'special',
            condition: (stats) => (stats.earlyOrders || 0) >= 1
        },
        night_owl: {
            id: 'night_owl',
            title: '🦉 Ночная сова',
            description: 'Создать заказ после 23:00',
            xp: 40,
            icon: 'fa-moon',
            color: '#3F51B5',
            group: 'special',
            condition: (stats) => (stats.nightOrders || 0) >= 1
        },
        fast_decision: {
            id: 'fast_decision',
            title: '⚡ Быстрое решение',
            description: 'Выбрать мастера за 1 час после создания заказа',
            xp: 60,
            icon: 'fa-clock',
            color: '#4CAF50',
            group: 'special',
            condition: (stats) => (stats.fastDecisions || 0) >= 1
        },
        loyal: {
            id: 'loyal',
            title: '🤝 Верный клиент',
            description: 'Выбрать одного мастера 3 раза',
            xp: 100,
            icon: 'fa-handshake',
            color: '#9C27B0',
            group: 'special',
            condition: (stats) => (stats.favoriteMasterCount || 0) >= 3
        },
        social: {
            id: 'social',
            title: '💬 Общительный',
            description: 'Написать 50 сообщений в чатах',
            xp: 150,
            icon: 'fa-comments',
            color: '#00BCD4',
            group: 'special',
            condition: (stats) => (stats.messagesCount || 0) >= 50
        },
        year_on_platform: {
            id: 'year_on_platform',
            title: '🎂 Год с нами!',
            description: 'Быть клиентом более года',
            xp: 200,
            icon: 'fa-cake-candles',
            color: '#E91E63',
            group: 'special',
            condition: (stats) => (stats.daysOnPlatform || 0) >= 365
        }
    };

    // XP за действия
    const XP_REWARDS = {
        CREATE_ORDER: 20,
        COMPLETE_ORDER: 50,
        LEAVE_REVIEW: 10,
        UPLOAD_PHOTO: 5,
        INVITE_FRIEND: 100,
        DAILY_VISIT: 5,
        FIRST_ORDER_OF_DAY: 15,
        CHOOSE_MASTER: 10,
        FAST_DECISION: 30,
        WEEKLY_STREAK: 50,
        MONTHLY_STREAK: 200
    };

    // ===== ОСНОВНАЯ ЛОГИКА =====

    /**
     * Получить уровень клиента по XP
     */
    function getLevelFromXP(xp) {
        xp = xp || 0;
        for (let i = CLIENT_LEVELS.length - 1; i >= 0; i--) {
            if (xp >= CLIENT_LEVELS[i].minXP) {
                return CLIENT_LEVELS[i];
            }
        }
        return CLIENT_LEVELS[0];
    }

    /**
     * Получить прогресс до следующего уровня
     */
    function getLevelProgress(xp) {
        xp = xp || 0;
        const currentLevel = getLevelFromXP(xp);
        const nextLevel = CLIENT_LEVELS.find(l => l.level === currentLevel.level + 1);
        
        if (!nextLevel) {
            return { 
                current: currentLevel,
                progress: 100,
                xpNeeded: 0,
                xpInCurrent: xp - currentLevel.minXP,
                next: null,
                xpToNext: 0
            };
        }

        const xpInCurrent = xp - currentLevel.minXP;
        const xpNeededForNext = nextLevel.minXP - currentLevel.minXP;
        const progress = Math.min(100, (xpInCurrent / xpNeededForNext) * 100);

        return {
            current: currentLevel,
            next: nextLevel,
            progress: Math.min(100, progress),
            xpNeeded: nextLevel.minXP - xp,
            xpInCurrent: xpInCurrent,
            xpNeededForNext: xpNeededForNext,
            xpToNext: nextLevel.minXP - xp
        };
    }

    /**
     * Собрать статистику клиента
     */
    async function getClientStats(userId) {
        // Проверка Firestore
        if (!GamificationBase.checkFirestore()) return {};
        
        try {
            // Получаем информацию о пользователе
            const userDoc = await db.collection('users').doc(userId).get();
            if (!userDoc.exists) return {};
            
            const user = userDoc.data();

            // Загружаем заказы клиента
            const ordersSnapshot = await db.collection('orders')
                .where('clientId', '==', userId)
                .get();

            let totalOrders = 0;
            let completedOrders = 0;
            let totalSpent = 0;
            let categoriesSet = new Set();
            let photosUploaded = 0;
            let fastDecisions = 0;
            let earlyOrders = 0;
            let nightOrders = 0;
            let masterFrequency = {};

            for (const doc of ordersSnapshot.docs) {
                const order = doc.data();
                totalOrders++;
                
                if (order.status === GamificationBase.ORDER_STATUS.COMPLETED) {
                    completedOrders++;
                    totalSpent += order.price || 0;
                }

                // Категории
                if (order.category) {
                    categoriesSet.add(order.category);
                }

                // Фото
                if (order.photos && Array.isArray(order.photos)) {
                    photosUploaded += order.photos.length;
                }

                // Быстрые решения
                if (order.createdAt && order.selectedMasterId) {
                    const createdTime = GamificationBase.safeGetDate(order.createdAt);
                    const selectedTime = order.selectedAt ? GamificationBase.safeGetDate(order.selectedAt) : createdTime;
                    const diffHours = (selectedTime - createdTime) / (1000 * 60 * 60);
                    
                    if (diffHours <= 1) {
                        fastDecisions++;
                    }
                }

                // Время создания заказа
                if (order.createdAt) {
                    const createdTime = GamificationBase.safeGetDate(order.createdAt);
                    const hours = createdTime.getHours();
                    
                    if (hours < 9) earlyOrders++;
                    if (hours >= 23 || hours < 5) nightOrders++;
                }

                // Статистика по мастерам
                if (order.selectedMasterId) {
                    masterFrequency[order.selectedMasterId] = (masterFrequency[order.selectedMasterId] || 0) + 1;
                }
            }

            // Подсчет отзывов клиента
            const reviewsSnapshot = await db.collection('reviews')
                .where('clientId', '==', userId)
                .get();
            const totalReviews = reviewsSnapshot.size;

            // Сообщения в чатах
            const messagesSnapshot = await db.collectionGroup('messages')
                .where('senderId', '==', userId)
                .get();
            const messagesCount = messagesSnapshot.size;

            // Избранные мастера
            const favoritesCount = user.favorites?.length || 0;

            // Любимый мастер (исправлено)
            const frequencies = Object.values(masterFrequency);
            const favoriteMasterCount = frequencies.length > 0 ? Math.max(...frequencies) : 0;

            // Дней на платформе
            const daysOnPlatform = user.createdAt ? 
                Math.floor((Date.now() - GamificationBase.safeGetDate(user.createdAt).getTime()) / (1000 * 60 * 60 * 24)) : 0;

            return {
                totalOrders,
                completedOrders,
                totalSpent,
                categoriesUsed: categoriesSet.size,
                totalReviews,
                photosUploaded,
                fastDecisions,
                earlyOrders,
                nightOrders,
                messagesCount,
                favoritesCount,
                favoriteMasterCount,
                daysOnPlatform,
                userData: user
            };
            
        } catch (error) {
            console.error('❌ Ошибка получения статистики клиента:', error);
            return {};
        }
    }

    /**
     * Проверить и выдать достижения
     */
    async function checkAchievements(userId, skipXP = false) {
        // Проверка Firestore
        if (!GamificationBase.checkFirestore()) return [];
        
        try {
            const userDoc = await db.collection('users').doc(userId).get();
            if (!userDoc.exists) return [];
            
            const user = userDoc.data();
            const earnedAchievements = user.achievements || [];
            const stats = await getClientStats(userId);
            
            const newAchievements = [];

            for (const [key, ach] of Object.entries(CLIENT_ACHIEVEMENTS)) {
                if (earnedAchievements.includes(key)) continue;

                try {
                    if (ach.condition(stats)) {
                        newAchievements.push(key);
                        
                        // Начисляем XP только если не skipXP
                        const xpReward = ach.xp || 0;
                        if (!skipXP && xpReward > 0) {
                            await addXP(userId, xpReward, `achievement_${key}`, true);
                        }
                        
                        // Создаем уведомление
                        await db.collection('notifications').add({
                            userId: userId,
                            type: 'achievement',
                            title: '🏆 Новое достижение!',
                            body: ach.title,
                            data: { 
                                achievement: key,
                                xp: xpReward,
                                icon: ach.icon,
                                color: ach.color
                            },
                            read: false,
                            createdAt: firebase.firestore.FieldValue.serverTimestamp()
                        });

                        // Показываем уведомление в UI
                        GamificationBase.showAchievementNotification(ach, xpReward);

                        console.log(`🏆 Клиент получил достижение: ${ach.title} (+${xpReward} XP)`);
                    }
                } catch (e) {
                    console.error(`Ошибка проверки достижения ${key}:`, e);
                }
            }

            if (newAchievements.length > 0) {
                await db.collection('users').doc(userId).update({
                    achievements: firebase.firestore.FieldValue.arrayUnion(...newAchievements)
                });
            }

            return newAchievements;
            
        } catch (error) {
            console.error('❌ Ошибка проверки достижений:', error);
            return [];
        }
    }

    /**
     * Добавить XP клиенту
     */
    async function addXP(userId, amount, reason, skipAchievements = false) {
        // Проверка Firestore
        if (!GamificationBase.checkFirestore()) {
            return { success: false, error: 'Firestore не инициализирован' };
        }
        
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

                // Логируем
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

            // Проверяем ачивки только если не skipAchievements
            if (!skipAchievements) {
                await checkAchievements(userId, true);
            }

            // Обновляем UI
            updateUI(userId);

            return { success: true, ...result };
            
        } catch (error) {
            console.error('❌ Ошибка добавления XP:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Уведомление о повышении уровня
     */
    async function notifyLevelUp(userId, oldLevel, newLevel) {
        // Проверка Firestore
        if (!GamificationBase.checkFirestore()) return;
        
        // Создаем уведомление
        await db.collection('notifications').add({
            userId: userId,
            type: 'level_up',
            title: '🎉 Уровень повышен!',
            body: `${oldLevel.name} → ${newLevel.name}`,
            data: { 
                oldLevel: oldLevel.level,
                newLevel: newLevel.level,
                xpBonus: 50
            },
            read: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Показываем уведомление
        GamificationBase.showLevelUpNotification(oldLevel, newLevel);

        // Дарим бонусные XP (с флагом чтобы не зациклиться)
        await addXP(userId, 50, 'Бонус за повышение уровня', true);
    }

    /**
     * Получить все достижения с статусом
     */
    async function getUserAchievementsWithStatus(userId) {
        // Проверка Firestore
        if (!GamificationBase.checkFirestore()) return [];
        
        try {
            const userDoc = await db.collection('users').doc(userId).get();
            const earned = userDoc.exists ? (userDoc.data().achievements || []) : [];
            
            return Object.entries(CLIENT_ACHIEVEMENTS).map(([id, ach]) => ({
                id,
                ...ach,
                earned: earned.includes(id)
            }));
            
        } catch (error) {
            console.error('❌ Ошибка получения достижений:', error);
            return [];
        }
    }

    /**
     * Получить статистику по группам достижений
     */
    async function getAchievementsStats(userId) {
        const achievements = await getUserAchievementsWithStatus(userId);
        
        const stats = {
            total: achievements.length,
            earned: achievements.filter(a => a.earned).length,
            byGroup: {}
        };

        achievements.forEach(ach => {
            if (!stats.byGroup[ach.group]) {
                stats.byGroup[ach.group] = { total: 0, earned: 0 };
            }
            stats.byGroup[ach.group].total++;
            if (ach.earned) {
                stats.byGroup[ach.group].earned++;
            }
        });

        stats.percent = stats.total > 0 ? Math.round((stats.earned / stats.total) * 100) : 0;

        return stats;
    }

    /**
     * Обновить UI
     */
    async function updateUI(userId) {
        try {
            const userData = Auth?.getUserData?.();
            if (!userData) return;

            const xp = userData.xp || 0;
            const progress = getLevelProgress(xp);
            const achievements = await getUserAchievementsWithStatus(userId);
            const earnedCount = achievements.filter(a => a.earned).length;
            const stats = await getAchievementsStats(userId);

            // Обновляем заголовок
            const headerLevel = document.getElementById('headerLevel');
            const headerXP = document.getElementById('headerXP');
            const headerXPBadge = document.getElementById('headerXPBadge');
            
            if (headerLevel) headerLevel.textContent = progress.current.level;
            if (headerXP) headerXP.textContent = xp;
            if (headerXPBadge) headerXPBadge.style.display = 'flex';

            // Обновляем уровень в бейдже
            const levelBadge = document.getElementById('levelBadge');
            if (levelBadge) levelBadge.textContent = progress.current.level;

            // Обновляем прогресс-бар
            const xpProgressBar = document.getElementById('xpProgressBar');
            const xpProgressText = document.getElementById('xpProgressText');
            const currentLevelName = document.getElementById('currentLevelName');
            const xpToNextLevel = document.getElementById('xpToNextLevel');

            if (xpProgressBar) xpProgressBar.style.width = `${progress.progress}%`;
            if (xpProgressText) {
                if (progress.next) {
                    xpProgressText.textContent = `${xp}/${progress.next.minXP} XP`;
                } else {
                    xpProgressText.textContent = `${xp} XP (макс)`;
                }
            }
            if (currentLevelName) currentLevelName.textContent = progress.current.name;
            if (xpToNextLevel) {
                if (progress.next) {
                    xpToNextLevel.textContent = `${progress.xpToNext} XP`;
                } else {
                    xpToNextLevel.textContent = 'Макс. уровень';
                }
            }

            // Обновляем счетчик достижений
            const achievementsCount = document.getElementById('achievementsCount');
            if (achievementsCount) {
                achievementsCount.textContent = `${earnedCount}/${stats.total}`;
            }

            // Обновляем мини-иконки достижений
            const achievementsIcons = document.getElementById('achievementsIcons');
            if (achievementsIcons) {
                const earned = achievements.filter(a => a.earned).slice(0, 5);
                const html = earned.map(ach => `
                    <div class="achievement-icon-mini earned" title="${ach.title}\n${ach.description}">
                        <i class="fas ${ach.icon}"></i>
                    </div>
                `).join('');
                
                if (earned.length === 0) {
                    achievementsIcons.innerHTML = '<div class="text-secondary small">Нет достижений</div>';
                } else {
                    achievementsIcons.innerHTML = html;
                }
            }

            // Обновляем статистику в табе достижений
            const achievementsEarned = document.getElementById('achievementsEarned');
            const achievementsTotal = document.getElementById('achievementsTotal');
            const achievementsProgress = document.getElementById('achievementsProgress');
            
            if (achievementsEarned) achievementsEarned.textContent = stats.earned;
            if (achievementsTotal) achievementsTotal.textContent = stats.total;
            if (achievementsProgress) achievementsProgress.textContent = stats.percent + '%';

            // Обновляем сетки достижений по группам
            const groups = {
                orders: document.getElementById('achievementsOrdersGrid'),
                budget: document.getElementById('achievementsBudgetGrid'),
                reviews: document.getElementById('achievementsReviewsGrid'),
                categories: document.getElementById('achievementsCategoriesGrid'),
                special: document.getElementById('achievementsSpecialGrid')
            };

            Object.entries(groups).forEach(([group, element]) => {
                if (element) {
                    const groupAchievements = achievements.filter(a => a.group === group);
                    element.innerHTML = renderAchievementsGrid(groupAchievements);
                }
            });

        } catch (error) {
            console.error('❌ Ошибка обновления UI:', error);
        }
    }

    /**
     * Рендер сетки достижений
     */
    function renderAchievementsGrid(achievements) {
        if (!achievements || achievements.length === 0) {
            return '<div class="text-secondary p-3">Нет достижений в этой категории</div>';
        }

        return achievements.map(ach => `
            <div class="achievement-card ${ach.earned ? 'earned' : ''}">
                <div class="achievement-icon">
                    <i class="fas ${ach.icon}" style="color: ${ach.earned ? 'gold' : ach.color}"></i>
                </div>
                <div class="achievement-name">${ach.title}</div>
                <div class="achievement-description">${ach.description}</div>
                <div class="achievement-xp">+${ach.xp} XP</div>
            </div>
        `).join('');
    }

    /**
     * Инициализация
     */
    async function init(userId) {
        if (!userId) return;
        
        // Первичная проверка достижений
        await checkAchievements(userId);
        
        // Обновляем UI
        await updateUI(userId);
        
        // Подписываемся на изменения пользователя
        if (GamificationBase.checkFirestore()) {
            db.collection('users').doc(userId).onSnapshot(() => {
                updateUI(userId);
            });
        }
        
        console.log('✅ ClientGamification инициализирован для пользователя:', userId);
    }

    // Публичное API
    return {
        CLIENT_LEVELS,
        CLIENT_ACHIEVEMENTS,
        XP_REWARDS,
        getLevelFromXP,
        getLevelProgress,
        getClientStats,
        checkAchievements,
        addXP,
        getUserAchievementsWithStatus,
        getAchievementsStats,
        updateUI,
        init
    };
})();

// Глобальный доступ
window.ClientGamification = ClientGamification;
console.log('✅ ClientGamification загружен');