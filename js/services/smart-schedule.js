// ===== js/services/smart-schedule.js =====
// Умное расписание с синхронизацией

const SmartSchedule = (function() {
    // Конфигурация
    const CONFIG = {
        WORK_START: 9, // 9:00
        WORK_END: 21, // 21:00
        SLOT_DURATION: 60, // минут
        BREAK_DURATION: 15, // минут между слотами
        MAX_ADVANCE_DAYS: 30 // максимум запись на 30 дней
    };

    /**
     * Получить оптимальные слоты для мастера
     */
    async function getOptimalSlots(masterId, date = new Date()) {
        try {
            if (!masterId) return [];

            // Получаем существующие записи
            const bookings = await db.collection('bookings')
                .where('masterId', '==', masterId)
                .where('date', '>=', date)
                .where('date', '<', new Date(date.getTime() + 7 * 24 * 60 * 60 * 1000))
                .get();

            const busySlots = new Set();
            bookings.forEach(doc => {
                const booking = doc.data();
                if (booking.timeSlot) {
                    busySlots.add(booking.timeSlot);
                }
            });

            // Анализируем историю для рекомендаций
            const history = await analyzeMasterHistory(masterId);
            
            // Генерируем слоты
            const slots = [];
            for (let day = 0; day < 7; day++) {
                const currentDate = new Date(date);
                currentDate.setDate(date.getDate() + day);
                
                for (let hour = CONFIG.WORK_START; hour < CONFIG.WORK_END; hour++) {
                    for (let minute = 0; minute < 60; minute += CONFIG.SLOT_DURATION) {
                        // Форматируем дату и время
                        const year = currentDate.getFullYear();
                        const month = String(currentDate.getMonth() + 1).padStart(2, '0');
                        const day = String(currentDate.getDate()).padStart(2, '0');
                        const timeStr = `${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`;
                        
                        const timeSlot = `${year}-${month}-${day}T${timeStr}`;
                        
                        if (!busySlots.has(timeSlot)) {
                            // Рассчитываем score для слота
                            const score = calculateSlotScore(hour, history);
                            
                            slots.push({
                                time: timeSlot,
                                timeStr: timeStr,
                                dateStr: `${day}.${month}`,
                                available: true,
                                score: score,
                                recommended: score > 80
                            });
                        }
                    }
                }
            }

            // Сортируем по рейтингу
            slots.sort((a, b) => b.score - a.score);
            
            return slots;
            
        } catch (error) {
            console.error('Ошибка получения слотов:', error);
            return [];
        }
    }

    /**
     * Анализ истории мастера
     */
    async function analyzeMasterHistory(masterId) {
        try {
            const bookings = await db.collection('bookings')
                .where('masterId', '==', masterId)
                .where('status', '==', 'completed')
                .limit(100)
                .get();

            const hourStats = new Array(24).fill(0).map(() => ({ total: 0, success: 0 }));

            bookings.forEach(doc => {
                const booking = doc.data();
                if (!booking.date) return;
                
                const hour = new Date(booking.date).getHours();
                
                hourStats[hour].total++;
                if (booking.rating && booking.rating >= 4) {
                    hourStats[hour].success++;
                }
            });

            return hourStats.map((stat, hour) => ({
                hour,
                successRate: stat.total > 0 ? (stat.success / stat.total) * 100 : 50,
                bookingsCount: stat.total
            }));
            
        } catch (error) {
            console.error('Ошибка анализа истории:', error);
            return [];
        }
    }

    /**
     * Расчет скоринга слота
     */
    function calculateSlotScore(hour, history) {
        const hourData = history.find(h => h.hour === hour);
        if (!hourData) return 50;

        // Базовый score на основе истории
        let score = hourData.successRate;

        // Корректировка по времени суток
        if (hour >= 10 && hour <= 12) score += 10; // Утро
        else if (hour >= 14 && hour <= 17) score += 5; // День
        else if (hour >= 18 && hour <= 20) score -= 5; // Вечер

        return Math.min(100, Math.max(0, score));
    }

    /**
     * Создание бронирования
     */
    async function createBooking(orderId, masterId, clientId, timeSlot) {
        try {
            if (!orderId || !masterId || !clientId || !timeSlot) {
                throw new Error('Не все данные для бронирования');
            }

            // Проверяем доступность
            const existing = await db.collection('bookings')
                .where('masterId', '==', masterId)
                .where('timeSlot', '==', timeSlot)
                .get();

            if (!existing.empty) {
                throw new Error('Это время уже занято');
            }

            // Создаем бронь
            const booking = {
                orderId: orderId,
                masterId: masterId,
                clientId: clientId,
                timeSlot: timeSlot,
                date: new Date(timeSlot),
                status: 'confirmed',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            await db.collection('bookings').add(booking);

            // Планируем напоминания
            await scheduleReminders(orderId, masterId, clientId, timeSlot);

            // Отправляем уведомления
            await notifyAboutBooking(orderId, masterId, clientId, timeSlot);

            return { success: true };
            
        } catch (error) {
            console.error('Ошибка бронирования:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Планирование напоминаний
     */
    async function scheduleReminders(orderId, masterId, clientId, timeSlot) {
        try {
            const bookingTime = new Date(timeSlot);
            const now = new Date();
            
            const reminders = [
                { time: new Date(bookingTime.getTime() - 24 * 60 * 60 * 1000), type: 'day_before' }, // За день
                { time: new Date(bookingTime.getTime() - 3 * 60 * 60 * 1000), type: '3hours_before' }, // За 3 часа
                { time: new Date(bookingTime.getTime() - 1 * 60 * 60 * 1000), type: '1hour_before' } // За час
            ];

            for (const reminder of reminders) {
                if (reminder.time > now) {
                    await db.collection('reminders').add({
                        orderId: orderId,
                        masterId: masterId,
                        clientId: clientId,
                        timeSlot: timeSlot,
                        reminderTime: reminder.time,
                        type: reminder.type,
                        sent: false,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                }
            }
        } catch (error) {
            console.error('Ошибка планирования напоминаний:', error);
        }
    }

    /**
     * Уведомление о бронировании
     */
    async function notifyAboutBooking(orderId, masterId, clientId, timeSlot) {
        try {
            const bookingTime = new Date(timeSlot);
            const formattedTime = bookingTime.toLocaleString('ru-RU', {
                day: 'numeric',
                month: 'long',
                hour: '2-digit',
                minute: '2-digit'
            });

            // Клиенту
            await db.collection('notifications').add({
                userId: clientId,
                type: 'booking_confirmed',
                title: '📅 Запись подтверждена',
                body: `Мастер прибудет ${formattedTime}`,
                data: { orderId: orderId },
                read: false,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // Мастеру
            await db.collection('notifications').add({
                userId: masterId,
                type: 'booking_confirmed',
                title: '📅 Новая запись',
                body: `Выезд к клиенту ${formattedTime}`,
                data: { orderId: orderId },
                read: false,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
        } catch (error) {
            console.error('Ошибка уведомления о бронировании:', error);
        }
    }

    /**
     * Отправка напоминаний (CRON job)
     */
    async function processReminders() {
        try {
            const now = new Date();
            
            const reminders = await db.collection('reminders')
                .where('reminderTime', '<=', now)
                .where('sent', '==', false)
                .get();

            for (const doc of reminders.docs) {
                const reminder = doc.data();
                
                const bookingTime = new Date(reminder.timeSlot);
                const formattedTime = bookingTime.toLocaleString('ru-RU', {
                    hour: '2-digit',
                    minute: '2-digit'
                });
                
                let message = '';
                switch(reminder.type) {
                    case 'day_before':
                        message = '⏰ Напоминаем: завтра в ' + formattedTime + ' приедет мастер';
                        break;
                    case '3hours_before':
                        message = '⏰ Через 3 часа приедет мастер';
                        break;
                    case '1hour_before':
                        message = '⏰ Мастер прибудет через час';
                        break;
                }

                // Отправляем уведомления
                await db.collection('notifications').add({
                    userId: reminder.clientId,
                    type: 'booking_reminder',
                    title: '⏰ Напоминание',
                    body: message,
                    data: { orderId: reminder.orderId },
                    read: false,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });

                await db.collection('notifications').add({
                    userId: reminder.masterId,
                    type: 'booking_reminder',
                    title: '⏰ Напоминание о выезде',
                    body: message,
                    data: { orderId: reminder.orderId },
                    read: false,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });

                // Отмечаем как отправленное
                await doc.ref.update({ sent: true });
            }
        } catch (error) {
            console.error('Ошибка обработки напоминаний:', error);
        }
    }

    /**
     * Синхронизация с Google Calendar
     */
    async function syncWithGoogleCalendar(masterId, accessToken) {
        try {
            if (!accessToken) {
                throw new Error('Нет токена доступа');
            }

            const bookings = await db.collection('bookings')
                .where('masterId', '==', masterId)
                .where('status', '==', 'confirmed')
                .get();

            const results = [];

            for (const doc of bookings.docs) {
                const booking = doc.data();
                if (!booking.timeSlot) continue;
                
                const startTime = new Date(booking.timeSlot);
                const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);

                // Создаем событие в Google Calendar
                const event = {
                    summary: 'Заказ в ВоркХом',
                    description: `Заказ #${booking.orderId}`,
                    start: {
                        dateTime: startTime.toISOString(),
                        timeZone: 'Europe/Moscow'
                    },
                    end: {
                        dateTime: endTime.toISOString(),
                        timeZone: 'Europe/Moscow'
                    }
                };

                const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(event)
                });

                if (response.ok) {
                    const data = await response.json();
                    results.push({ success: true, eventId: data.id });
                } else {
                    results.push({ success: false, error: await response.text() });
                }
            }

            return { success: true, results };
            
        } catch (error) {
            console.error('Ошибка синхронизации с Google Calendar:', error);
            return { success: false, error: error.message };
        }
    }

    // Публичное API
    return {
        getOptimalSlots,
        createBooking,
        processReminders,
        syncWithGoogleCalendar
    };
})();

window.SmartSchedule = SmartSchedule;