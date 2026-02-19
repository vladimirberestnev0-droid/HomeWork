// ===== js/services/badges.js =====
// СИСТЕМА БЕЙДЖЕЙ (УЛУЧШЕННАЯ ВЕРСИЯ)

const Badges = (function() {
    // Конфигурация бейджей
    const BADGES = {
        'newbie': {
            name: '🌱 Новичок',
            description: 'Только начинает свой путь',
            color: '#3498db',
            icon: 'fa-seedling',
            condition: (stats) => stats.completedJobs === 0 && stats.totalResponses < 5
        },
        'pro': {
            name: '👑 Профи',
            description: 'Выполнил более 10 заказов',
            color: '#9C88FF',
            icon: 'fa-crown',
            condition: (stats) => stats.completedJobs >= 10
        },
        'veteran': {
            name: '🎯 Ветеран',
            description: 'Более 50 выполненных заказов',
            color: '#e74c3c',
            icon: 'fa-medal',
            condition: (stats) => stats.completedJobs >= 50
        },
        'fast': {
            name: '⚡ Быстрый отклик',
            description: 'Отвечает на заказы в течение часа',
            color: '#4CD964',
            icon: 'fa-bolt',
            condition: (stats) => stats.fastResponses >= 10
        },
        'reliable': {
            name: '✅ Надежный',
            description: 'Рейтинг 4.8+ на основе 20+ отзывов',
            color: '#00A86B',
            icon: 'fa-check-circle',
            condition: (stats) => stats.rating >= 4.8 && stats.reviews >= 20
        },
        'expert': {
            name: '🔧 Эксперт',
            description: 'Работает в 3+ категориях',
            color: '#E67A4B',
            icon: 'fa-tools',
            condition: (stats) => stats.categoriesCount >= 3
        },
        'popular': {
            name: '🌟 Популярный',
            description: 'В избранном у 10+ клиентов',
            color: '#FFB020',
            icon: 'fa-star',
            condition: (stats) => stats.favoritesCount >= 10
        },
        'communicative': {
            name: '💬 Коммуникабельный',
            description: 'Отвечает на 90% сообщений за 10 минут',
            color: '#1abc9c',
            icon: 'fa-comments',
            condition: (stats) => stats.chatResponseRate >= 90
        },
        'photo_pro': {
            name: '📸 Фото-профи',
            description: 'Добавил 10+ фото в портфолио',
            color: '#e84393',
            icon: 'fa-camera',
            condition: (stats) => stats.portfolioCount >= 10
        },
        'verified': {
            name: '✅ Верифицирован',
            description: 'Подтвержденная личность',
            color: '#27ae60',
            icon: 'fa-id-card',
            condition: (stats) => stats.verified === true
        }
    };

    // Расчет статистики мастера
    async function calculateMasterStats(masterId) {
        try {
            const masterDoc = await db.collection('users').doc(masterId).get();
            if (!masterDoc.exists) return null;
            
            const master = masterDoc.data();
            
            const ordersSnapshot = await db.collection('orders').get();
            
            let completedJobs = 0;
            let fastResponses = 0;
            let totalResponses = 0;
            let categories = new Set();
            let totalRating = 0;
            let reviewCount = 0;

            for (const doc of ordersSnapshot.docs) {
                const order = doc.data();
                
                if (order.responses && Array.isArray(order.responses)) {
                    const myResponses = order.responses.filter(r => r.masterId === masterId);
                    
                    if (myResponses.length > 0) {
                        totalResponses += myResponses.length;
                        
                        myResponses.forEach(response => {
                            if (response.createdAt && order.createdAt) {
                                const responseTime = response.createdAt.seconds - order.createdAt.seconds;
                                if (responseTime < 3600) fastResponses++;
                            }
                        });
                    }
                }
                
                if (order.status === ORDER_STATUS.COMPLETED && 
                    order.selectedMasterId === masterId) {
                    completedJobs++;
                }
                
                if (order.category) {
                    categories.add(order.category);
                }
                
                if (order.reviews && Array.isArray(order.reviews)) {
                    order.reviews.forEach(review => {
                        if (review.masterId === masterId) {
                            totalRating += review.rating || 0;
                            reviewCount++;
                        }
                    });
                }
            }

            const portfolioSnapshot = await db.collection('portfolio')
                .where('masterId', '==', masterId)
                .get();
            const portfolioCount = portfolioSnapshot.size;

            const favoritesCount = master.favorites?.length || 0;

            const chatStats = await calculateChatStats(masterId);

            return {
                completedJobs,
                fastResponses,
                totalResponses,
                categoriesCount: categories.size,
                rating: master.rating || 0,
                reviews: master.reviews || 0,
                portfolioCount,
                favoritesCount,
                verified: master.verified || false,
                chatResponseRate: chatStats.responseRate,
                avgResponseTime: chatStats.avgResponseTime
            };
            
        } catch (error) {
            console.error('❌ Ошибка расчета статистики:', error);
            return null;
        }
    }

    // Расчет статистики чатов
    async function calculateChatStats(masterId) {
        try {
            const chatsSnapshot = await db.collection('chats')
                .where('masterId', '==', masterId)
                .get();

            let fastResponses = 0;
            let totalResponses = 0;

            for (const chatDoc of chatsSnapshot.docs) {
                const messagesSnapshot = await db.collection('chats').doc(chatDoc.id)
                    .collection('messages')
                    .orderBy('timestamp', 'asc')
                    .get();

                let lastClientMessage = null;
                
                messagesSnapshot.forEach(msg => {
                    const message = msg.data();
                    
                    if (message.senderId !== masterId) {
                        lastClientMessage = message.timestamp;
                    } else if (lastClientMessage && message.timestamp) {
                        const responseTime = message.timestamp.seconds - lastClientMessage.seconds;
                        if (responseTime < 600) fastResponses++;
                        totalResponses++;
                        lastClientMessage = null;
                    }
                });
            }

            return {
                responseRate: totalResponses > 0 ? (fastResponses / totalResponses) * 100 : 0,
                fastResponses,
                totalResponses
            };
            
        } catch (error) {
            console.error('❌ Ошибка расчета статистики чатов:', error);
            return { responseRate: 0, fastResponses: 0, totalResponses: 0 };
        }
    }

    // Получение бейджей из статистики
    function getBadgesFromStats(stats) {
        const earnedBadges = [];

        for (const [badgeId, badgeConfig] of Object.entries(BADGES)) {
            try {
                if (badgeConfig.condition(stats)) {
                    earnedBadges.push({
                        id: badgeId,
                        ...badgeConfig
                    });
                }
            } catch (error) {
                console.error(`❌ Ошибка проверки бейджа ${badgeId}:`, error);
            }
        }

        return earnedBadges;
    }

    // Обновление бейджей
    async function updateMasterBadges(masterId) {
        try {
            const stats = await calculateMasterStats(masterId);
            if (!stats) return [];

            const badges = getBadgesFromStats(stats);
            const badgeIds = badges.map(b => b.id);

            await db.collection('users').doc(masterId).update({
                badges: badgeIds,
                badgesUpdated: firebase.firestore.FieldValue.serverTimestamp(),
                stats: {
                    completedJobs: stats.completedJobs || 0,
                    fastResponses: stats.fastResponses || 0,
                    totalResponses: stats.totalResponses || 0,
                    categoriesCount: stats.categoriesCount || 0,
                    rating: stats.rating || 0,
                    reviews: stats.reviews || 0,
                    portfolioCount: stats.portfolioCount || 0,
                    favoritesCount: stats.favoritesCount || 0,
                    verified: stats.verified || false,
                    chatResponseRate: stats.chatResponseRate || 0,
                    avgResponseTime: stats.avgResponseTime || 0
                }
            });

            console.log(`✅ Бейджи обновлены для мастера ${masterId}:`, badgeIds);
            return badges;
            
        } catch (error) {
            console.error('❌ Ошибка обновления бейджей:', error);
            return [];
        }
    }

    // Отрисовка бейджей
    function renderBadges(badges, container) {
        if (!container) return;
        
        if (!badges || badges.length === 0) {
            container.innerHTML = '<span class="text-secondary">Нет бейджей</span>';
            return;
        }

        container.innerHTML = badges.map(badge => `
            <span class="badge" style="background: ${badge.color}; color: white; padding: 6px 12px; border-radius: 30px; font-size: 12px; margin-right: 5px; margin-bottom: 5px; display: inline-flex; align-items: center; gap: 5px;" 
                  title="${badge.description}">
                <i class="fas ${badge.icon}"></i>
                ${badge.name}
            </span>
        `).join('');
    }

    // Получение бейджей из базы
    async function getMasterBadges(masterId) {
        try {
            const masterDoc = await db.collection('users').doc(masterId).get();
            if (!masterDoc.exists) return [];
            
            const master = masterDoc.data();
            const badgeIds = master.badges || [];
            
            return badgeIds.map(id => ({
                id,
                ...BADGES[id]
            })).filter(b => b.name);
            
        } catch (error) {
            console.error('❌ Ошибка получения бейджей:', error);
            return [];
        }
    }

    // Публичное API
    return {
        BADGES,
        calculateMasterStats,
        updateMasterBadges,
        getMasterBadges,
        renderBadges
    };
})();

window.Badges = Badges;