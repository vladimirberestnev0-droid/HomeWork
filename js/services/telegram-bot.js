// ===== /server/telegram-bot.js =====
// НЕ В ПАПКЕ JS! ЭТО СЕРВЕРНЫЙ ФАЙЛ!
// Запускать через: node server/telegram-bot.js

require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const admin = require('firebase-admin');

// ========== КОНФИГУРАЦИЯ ==========
const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
    console.error('❌ TELEGRAM_BOT_TOKEN не найден в .env');
    process.exit(1);
}

// Инициализация Firebase Admin
try {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
        })
    });
    console.log('✅ Firebase Admin инициализирован');
} catch (error) {
    console.error('❌ Ошибка Firebase:', error);
    process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });
const db = admin.firestore();

console.log('🤖 Telegram бот запущен!');

// ... остальной код бота ...
console.log('📱 Имя бота:', process.env.TELEGRAM_BOT_USERNAME || '@WorkHomBot');

// ========== ОБРАБОТКА ОШИБОК ==========
bot.on('polling_error', (error) => {
    console.log('⚠️ Ошибка polling:', error.message);
});

bot.on('error', (error) => {
    console.log('⚠️ Ошибка бота:', error.message);
});

// ========== КОМАНДЫ ==========

// /start
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const firstName = msg.from.first_name || 'мастер';
    
    bot.sendMessage(chatId, 
        `👋 Привет, ${firstName}!\n\n` +
        `🔨 *ВоркХом Бот*\n` +
        `Помогает мастерам находить заказы\n\n` +
        `*Доступные команды:*\n` +
        `• /start - приветствие\n` +
        `• /orders - новые заказы (последние 5)\n` +
        `• /myorders - мои отклики\n` +
        `• /profile - мой профиль\n` +
        `• /stats - моя статистика\n` +
        `• /connect *EMAIL* - привязать аккаунт\n` +
        `• /help - помощь`, 
        { parse_mode: 'Markdown' }
    );
});

// /help
bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    
    bot.sendMessage(chatId,
        `🔍 *Как пользоваться ботом:*\n\n` +
        `1️⃣ *Привяжи аккаунт*\n` +
        `   /connect твой@email.ru\n\n` +
        `2️⃣ *После привязки будешь получать*\n` +
        `   • Уведомления о новых заказах\n` +
        `   • Уведомления о сообщениях\n` +
        `   • Напоминания о просмотренных заказах\n\n` +
        `3️⃣ *Команды для работы:*\n` +
        `   /orders - свежие заказы\n` +
        `   /myorders - твои отклики\n` +
        `   /profile - твои данные\n` +
        `   /stats - статистика откликов`,
        { parse_mode: 'Markdown' }
    );
});

// /connect email@mail.ru
bot.onText(/\/connect (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const email = match[1].trim().toLowerCase();
    
    try {
        const usersRef = db.collection('users');
        const snapshot = await usersRef.where('email', '==', email).get();
        
        if (snapshot.empty) {
            await bot.sendMessage(chatId, '❌ Пользователь с таким email не найден');
            return;
        }
        
        const userDoc = snapshot.docs[0];
        const userData = userDoc.data();
        
        if (userData.role !== 'master') {
            await bot.sendMessage(chatId, '❌ Этот бот только для мастеров');
            return;
        }
        
        await userDoc.ref.update({
            telegramChatId: chatId,
            telegramName: msg.from.first_name,
            telegramConnectedAt: new Date().toISOString()
        });
        
        await bot.sendMessage(chatId, 
            `✅ *Аккаунт привязан!*\n\n` +
            `👤 Имя: ${userData.name || 'Не указано'}\n` +
            `⭐ Рейтинг: ${userData.rating || 0} (${userData.reviews || 0} отзывов)\n` +
            `🔧 Категории: ${userData.categories || 'Не указаны'}\n\n` +
            `Теперь ты будешь получать уведомления о новых заказах!`,
            { parse_mode: 'Markdown' }
        );
        
        // Отправляем приветственное уведомление
        await sendTelegramNotification(
            chatId,
            '🎯 Персональные заказы',
            `Мы будем присылать тебе заказы по твоим категориям: ${userData.categories || 'все'}`,
            process.env.SITE_URL || 'https://воркхом.рф'
        );
        
    } catch (error) {
        console.error('Ошибка привязки:', error);
        await bot.sendMessage(chatId, '❌ Ошибка сервера. Попробуй позже.');
    }
});

// /orders
bot.onText(/\/orders/, async (msg) => {
    const chatId = msg.chat.id;
    
    try {
        // Получаем мастера по chatId
        const userSnapshot = await db.collection('users')
            .where('telegramChatId', '==', chatId)
            .where('role', '==', 'master')
            .get();
        
        if (userSnapshot.empty) {
            await bot.sendMessage(chatId, '❌ Сначала привяжи аккаунт: /connect email@mail.ru');
            return;
        }
        
        const userDoc = userSnapshot.docs[0];
        const userData = userDoc.data();
        
        // Получаем последние 10 открытых заказов
        const ordersRef = db.collection('orders')
            .where('status', '==', 'open')
            .orderBy('createdAt', 'desc')
            .limit(10);
            
        const snapshot = await ordersRef.get();
        
        if (snapshot.empty) {
            await bot.sendMessage(chatId, '😴 Новых заказов пока нет');
            return;
        }
        
        let message = '📋 *Свежие заказы:*\n\n';
        let orderCount = 0;
        
        snapshot.forEach(doc => {
            if (orderCount >= 5) return; // Показываем только 5
            
            const order = doc.data();
            
            // Проверяем, есть ли уже отклик от этого мастера
            const hasResponse = order.responses?.some(r => r.masterId === userDoc.id);
            if (hasResponse) return; // Пропускаем заказы, где уже откликнулись
            
            const date = order.createdAt ? 
                order.createdAt.toDate().toLocaleDateString('ru-RU', { 
                    day: 'numeric', 
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit'
                }) : 'сегодня';
            
            message += `🔨 *${order.title || 'Заказ'}*\n`;
            message += `💰 ${order.price} ₽\n`;
            message += `📍 ${order.address || 'Адрес не указан'}\n`;
            message += `📅 ${date}\n`;
            message += `👉 ${process.env.SITE_URL || 'https://воркхом.рф'}/?order=${doc.id}\n\n`;
            
            orderCount++;
        });
        
        if (orderCount === 0) {
            message = '🎯 Ты уже откликнулся на все свежие заказы!';
        }
        
        await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
        
    } catch (error) {
        console.error('Ошибка загрузки заказов:', error);
        await bot.sendMessage(chatId, '❌ Ошибка загрузки. Попробуй позже.');
    }
});

// /myorders
bot.onText(/\/myorders/, async (msg) => {
    const chatId = msg.chat.id;
    
    try {
        const userSnapshot = await db.collection('users')
            .where('telegramChatId', '==', chatId)
            .where('role', '==', 'master')
            .get();
        
        if (userSnapshot.empty) {
            await bot.sendMessage(chatId, '❌ Сначала привяжи аккаунт: /connect email@mail.ru');
            return;
        }
        
        const user = userSnapshot.docs[0];
        const masterId = user.id;
        
        const ordersSnapshot = await db.collection('orders')
            .orderBy('createdAt', 'desc')
            .get();
            
        const myResponses = [];
        
        ordersSnapshot.forEach(doc => {
            const order = doc.data();
            if (order.responses && Array.isArray(order.responses)) {
                const myResponse = order.responses.find(r => r.masterId === masterId);
                if (myResponse) {
                    myResponses.push({
                        id: doc.id,
                        ...order,
                        myResponse
                    });
                }
            }
        });
        
        if (myResponses.length === 0) {
            await bot.sendMessage(chatId, '📭 Ты ещё не откликался на заказы');
            return;
        }
        
        let message = '📬 *Мои отклики:*\n\n';
        myResponses.slice(0, 5).forEach(item => {
            const statusEmoji = item.status === 'open' ? '⏳' : 
                               item.status === 'in_progress' ? '🔨' : '✅';
            
            message += `🔨 *${item.title || 'Заказ'}*\n`;
            message += `💰 Твоя цена: ${item.myResponse.price} ₽\n`;
            message += `${statusEmoji} Статус: ${getStatusText(item.status)}\n`;
            message += `👉 ${process.env.SITE_URL || 'https://воркхом.рф'}/masters.html?order=${item.id}\n\n`;
        });
        
        await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
        
    } catch (error) {
        console.error('Ошибка загрузки откликов:', error);
        await bot.sendMessage(chatId, '❌ Ошибка загрузки');
    }
});

// /profile
bot.onText(/\/profile/, async (msg) => {
    const chatId = msg.chat.id;
    
    try {
        const userSnapshot = await db.collection('users')
            .where('telegramChatId', '==', chatId)
            .where('role', '==', 'master')
            .get();
        
        if (userSnapshot.empty) {
            await bot.sendMessage(chatId, '❌ Сначала привяжи аккаунт: /connect email@mail.ru');
            return;
        }
        
        const user = userSnapshot.docs[0].data();
        const date = user.createdAt ? 
            user.createdAt.toDate().toLocaleDateString('ru-RU', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            }) : 'неизвестно';
        
        // Форматируем бейджи
        const badges = user.badges || [];
        const badgesText = badges.length > 0 
            ? badges.map(b => `  • ${getBadgeEmoji(b)} ${getBadgeName(b)}`).join('\n')
            : '  • Пока нет';
        
        const message = 
            `👤 *Профиль мастера*\n\n` +
            `📋 Имя: ${user.name || 'Не указано'}\n` +
            `📧 Email: ${user.email || 'Не указан'}\n` +
            `📞 Телефон: ${user.phone || 'Не указан'}\n` +
            `🔧 Категории: ${user.categories || 'Не указаны'}\n\n` +
            `⭐ Рейтинг: ${user.rating ? user.rating.toFixed(1) : 0} (${user.reviews || 0} отзывов)\n` +
            `🏅 Бейджи:\n${badgesText}\n\n` +
            `✅ Верификация: ${user.verified ? 'Пройдена ✅' : 'Не пройдена ❌'}\n` +
            `📅 На платформе с: ${date}`;
        
        await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
        
    } catch (error) {
        console.error('Ошибка загрузки профиля:', error);
        await bot.sendMessage(chatId, '❌ Ошибка загрузки');
    }
});

// /stats
bot.onText(/\/stats/, async (msg) => {
    const chatId = msg.chat.id;
    
    try {
        const userSnapshot = await db.collection('users')
            .where('telegramChatId', '==', chatId)
            .where('role', '==', 'master')
            .get();
        
        if (userSnapshot.empty) {
            await bot.sendMessage(chatId, '❌ Сначала привяжи аккаунт: /connect email@mail.ru');
            return;
        }
        
        const user = userSnapshot.docs[0];
        const masterId = user.id;
        
        const ordersSnapshot = await db.collection('orders').get();
        
        let totalResponses = 0;
        let acceptedJobs = 0;
        let completedJobs = 0;
        
        ordersSnapshot.forEach(doc => {
            const order = doc.data();
            if (order.responses && Array.isArray(order.responses)) {
                const myResponses = order.responses.filter(r => r.masterId === masterId);
                totalResponses += myResponses.length;
                
                if (order.selectedMasterId === masterId) {
                    acceptedJobs++;
                    if (order.status === 'completed') {
                        completedJobs++;
                    }
                }
            }
        });
        
        const conversion = totalResponses > 0 ? Math.round((acceptedJobs / totalResponses) * 100) : 0;
        
        const message = 
            `📊 *Твоя статистика*\n\n` +
            `📨 Всего откликов: ${totalResponses}\n` +
            `✅ Принято в работу: ${acceptedJobs}\n` +
            `🎉 Выполнено заказов: ${completedJobs}\n` +
            `📈 Конверсия: ${conversion}%\n\n` +
            `💡 *Совет:* Каждый 5-й отклик обычно становится заказом!\n` +
            `🔥 Чем больше откликов - тем выше рейтинг!`;
        
        await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
        
    } catch (error) {
        console.error('Ошибка загрузки статистики:', error);
        await bot.sendMessage(chatId, '❌ Ошибка загрузки');
    }
});

// ========== СИСТЕМА НАПОМИНАНИЙ ==========
setInterval(async () => {
    try {
        console.log('⏰ Проверка просмотренных заказов...');
        
        const mastersSnapshot = await db.collection('users')
            .where('role', '==', 'master')
            .where('telegramChatId', '!=', null)
            .get();
        
        for (const masterDoc of mastersSnapshot.docs) {
            const master = masterDoc.data();
            const masterId = masterDoc.id;
            const viewedOrders = master.viewedOrders || [];
            
            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
            
            for (const view of viewedOrders) {
                if (view.viewedAt > oneHourAgo && !view.notified) {
                    const orderDoc = await db.collection('orders').doc(view.orderId).get();
                    if (!orderDoc.exists) continue;
                    
                    const order = orderDoc.data();
                    
                    // Проверяем, есть ли уже отклик
                    const hasResponse = order.responses?.some(r => r.masterId === masterId);
                    
                    if (!hasResponse) {
                        await sendTelegramNotification(
                            master.telegramChatId,
                            '👀 Не забудь откликнуться!',
                            `Ты смотрел заказ: ${order.title || 'Заказ'}\n💰 ${order.price} ₽\n🏃‍♂️ Не упусти заказ!`,
                            `${process.env.SITE_URL || 'https://воркхом.рф'}/?order=${view.orderId}`
                        );
                        
                        // Отмечаем, что уведомление отправлено
                        view.notified = true;
                    }
                }
            }
            
            // Обновляем просмотры
            if (viewedOrders.length > 0) {
                await db.collection('users').doc(masterId).update({
                    viewedOrders: viewedOrders.filter(v => 
                        new Date(v.viewedAt) > new Date(Date.now() - 24 * 60 * 60 * 1000)
                    )
                });
            }
        }
    } catch (error) {
        console.error('Ошибка в напоминаниях:', error);
    }
}, 30 * 60 * 1000); // Каждые 30 минут

// ========== ОТПРАВКА УВЕДОМЛЕНИЙ ==========
async function sendTelegramNotification(chatId, title, body, url) {
    try {
        const message = `🔔 *${title}*\n\n${body}\n\n[🔗 Открыть в ВоркХом](${url})`;
        await bot.sendMessage(chatId, message, { 
            parse_mode: 'Markdown',
            disable_web_page_preview: true
        });
        console.log(`✅ Уведомление отправлено в чат ${chatId}`);
    } catch (error) {
        console.log(`❌ Ошибка отправки в Telegram (чат ${chatId}):`, error.message);
    }
}

// Слушаем новые заказы
db.collection('orders').onSnapshot((snapshot) => {
    snapshot.docChanges().forEach(async (change) => {
        if (change.type === 'added') {
            const order = change.doc.data();
            
            const mastersRef = db.collection('users')
                .where('role', '==', 'master')
                .where('telegramChatId', '!=', null);
                
            const masters = await mastersRef.get();
            
            masters.forEach(master => {
                const masterData = master.data();
                const chatId = masterData.telegramChatId;
                
                // Проверяем категории
                if (masterData.categories) {
                    const categories = masterData.categories.split(',').map(c => c.trim());
                    if (categories.includes(order.category)) {
                        sendTelegramNotification(
                            chatId,
                            '🎯 Новый заказ по твоей специальности!',
                            `📋 ${order.title || 'Заказ'}\n💰 ${order.price} ₽\n📍 ${order.address || 'Адрес не указан'}`,
                            `${process.env.SITE_URL || 'https://воркхом.рф'}/?order=${change.doc.id}`
                        );
                    }
                } else {
                    sendTelegramNotification(
                        chatId,
                        '🔔 Новый заказ!',
                        `📋 ${order.title || 'Заказ'}\n💰 ${order.price} ₽\n📍 ${order.address || 'Адрес не указан'}`,
                        `${process.env.SITE_URL || 'https://воркхом.рф'}/?order=${change.doc.id}`
                    );
                }
            });
        }
    });
});

// Слушаем новые сообщения в чатах
db.collection('chats').onSnapshot((snapshot) => {
    snapshot.docChanges().forEach(async (change) => {
        if (change.type === 'modified' || change.type === 'added') {
            const chat = change.doc.data();
            const lastMessage = chat.lastMessage;
            const lastSender = chat.lastSenderId;
            const chatId = change.doc.id;
            
            if (!lastMessage || !lastSender) return;
            
            // Получаем информацию о чате
            const [clientDoc, masterDoc] = await Promise.all([
                db.collection('users').doc(chat.clientId).get(),
                db.collection('users').doc(chat.masterId).get()
            ]);
            
            const client = clientDoc.data();
            const master = masterDoc.data();
            
            // Отправляем уведомление получателю
            const recipient = lastSender === chat.clientId ? master : client;
            
            if (recipient?.telegramChatId) {
                const sender = lastSender === chat.clientId ? client : master;
                
                sendTelegramNotification(
                    recipient.telegramChatId,
                    '💬 Новое сообщение',
                    `От: ${sender.name || 'Пользователь'}\n📝 ${lastMessage}`,
                    `${process.env.SITE_URL || 'https://воркхом.рф'}/chat.html?orderId=${chat.orderId}&masterId=${chat.masterId}`
                );
            }
        }
    });
});

// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========
function getStatusText(status) {
    const statuses = {
        'open': '⏳ Ожидает',
        'in_progress': '🔨 В работе',
        'completed': '✅ Выполнен'
    };
    return statuses[status] || status;
}

function getBadgeEmoji(badgeId) {
    const emojis = {
        'pro': '👑',
        'fast': '⚡',
        'reliable': '✅',
        'expert': '🔧',
        'popular': '🌟',
        'newbie': '🌱',
        'veteran': '🎯',
        'communicative': '💬'
    };
    return emojis[badgeId] || '🏅';
}

function getBadgeName(badgeId) {
    const names = {
        'pro': 'Профи',
        'fast': 'Быстрый отклик',
        'reliable': 'Надежный',
        'expert': 'Эксперт',
        'popular': 'Популярный',
        'newbie': 'Новичок',
        'veteran': 'Ветеран',
        'communicative': 'Коммуникабельный'
    };
    return names[badgeId] || badgeId;
}

console.log('✅ Бот успешно запущен и готов к работе!');
console.log('🌐 URL сайта:', process.env.SITE_URL || 'https://воркхом.рф');