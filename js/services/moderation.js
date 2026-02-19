// ===== js/services/moderation.js =====
// СИСТЕМА МОДЕРАЦИИ (УЛУЧШЕННАЯ ВЕРСИЯ)

const Moderation = (function() {
    // Стоп-слова
    const STOP_WORDS = [
        'спам', 'реклама', 'сайт', 'перейдите', 'ссылк',
        'чат', 'telegram', 'ватсап', 'whatsapp', 'телеграм',
        'секс', 'интим', 'знакомств', 'казино', 'лохотрон',
        'наркотик', 'оружие', 'взлом', 'халява', 'развод',
        'мошенник', 'обман', 'кидалово', 'лохотрон', 'пирамида',
        'кредит', 'займ', 'микрозайм', 'деньги быстро',
        'работа на дому', 'заработок', 'пассивный доход',
        'криптовалюта', 'биткоин', 'инвестиции', 'прибыль'
    ];

    // Паттерны
    const PATTERNS = {
        url: /(https?:\/\/[^\s]+)|(www\.[^\s]+)|(t\.me\/[^\s]+)|(@[a-zA-Z0-9_]+)|(vk\.com\/[^\s]+)|(instagram\.com\/[^\s]+)/gi,
        phone: /(\+7|8)[\s(]?(\d{3})[\s)]?[\s-]?(\d{3})[\s-]?(\d{2})[\s-]?(\d{2})/g,
        email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
        cyrillic: /[а-яА-ЯёЁ]/g,
        repeated: /(.)\1{4,}/,
        caps: /[А-ЯA-Z]{5,}/,
        profanity: /(бля|хуй|пизд|еба|нах|сук|пидор|гандон|шлюх|мудак|долбо|придур|дебил|идиот|козел|осел|сволоч|тварь)/gi
    };

    // Контексты
    const CONTEXT_RULES = {
        'order_title': {
            minLength: 5,
            maxLength: 100,
            allowCyrillic: true,
            allowLatin: true,
            allowNumbers: true,
            allowSpecialChars: true
        },
        'order_description': {
            minLength: 10,
            maxLength: 2000,
            allowCyrillic: true,
            allowLatin: true,
            allowNumbers: true,
            allowSpecialChars: true
        },
        'chat_message': {
            minLength: 1,
            maxLength: 1000,
            allowCyrillic: true,
            allowLatin: true,
            allowNumbers: true,
            allowSpecialChars: true
        },
        'master_comment': {
            minLength: 0,
            maxLength: 500,
            allowCyrillic: true,
            allowLatin: true,
            allowNumbers: true,
            allowSpecialChars: true
        },
        'review_text': {
            minLength: 0,
            maxLength: 1000,
            allowCyrillic: true,
            allowLatin: true,
            allowNumbers: true,
            allowSpecialChars: true
        }
    };

    // Проверка текста
    function check(text, context = 'general') {
        if (!text || text.trim() === '') {
            return { isValid: true, reason: null, score: 0, violations: [] };
        }

        const lowerText = text.toLowerCase();
        let violations = [];
        let score = 0;

        // Стоп-слова
        for (let word of STOP_WORDS) {
            if (lowerText.includes(word)) {
                violations.push({
                    type: 'stop_word',
                    message: `запрещенное слово: "${word}"`,
                    word: word
                });
                score += 0.3;
            }
        }

        // Ссылки
        const urlMatches = text.match(PATTERNS.url);
        if (urlMatches) {
            violations.push({
                type: 'url',
                message: 'обнаружены ссылки или контакты',
                matches: urlMatches
            });
            score += 0.5;
        }

        // Телефоны
        const phoneMatches = text.match(PATTERNS.phone);
        if (phoneMatches) {
            violations.push({
                type: 'phone',
                message: 'обнаружены телефонные номера',
                matches: phoneMatches
            });
            score += 0.5;
        }

        // Email
        const emailMatches = text.match(PATTERNS.email);
        if (emailMatches) {
            violations.push({
                type: 'email',
                message: 'обнаружены email адреса',
                matches: emailMatches
            });
            score += 0.4;
        }

        // Капслок
        const capsMatches = text.match(PATTERNS.caps);
        const capsCount = capsMatches ? capsMatches.length : 0;
        if (capsCount > 2) {
            violations.push({
                type: 'caps',
                message: 'слишком много заглавных букв',
                count: capsCount
            });
            score += 0.2;
        }

        // Повторы
        const repeatedMatches = text.match(PATTERNS.repeated);
        if (repeatedMatches) {
            violations.push({
                type: 'repeated',
                message: 'обнаружены повторяющиеся символы',
                matches: repeatedMatches
            });
            score += 0.2;
        }

        // Мат
        const profanityMatches = text.match(PATTERNS.profanity);
        if (profanityMatches) {
            violations.push({
                type: 'profanity',
                message: 'обнаружена нецензурная лексика',
                matches: profanityMatches
            });
            score += 0.8;
        }

        // Проверка длины
        if (context !== 'general' && CONTEXT_RULES[context]) {
            const rules = CONTEXT_RULES[context];
            
            if (text.length < rules.minLength) {
                violations.push({
                    type: 'too_short',
                    message: `слишком короткий текст (мин. ${rules.minLength} символов)`,
                    current: text.length,
                    required: rules.minLength
                });
                score += 0.1;
            }
            
            if (text.length > rules.maxLength) {
                violations.push({
                    type: 'too_long',
                    message: `слишком длинный текст (макс. ${rules.maxLength} символов)`,
                    current: text.length,
                    required: rules.maxLength
                });
                score += 0.1;
            }
        }

        // Повторяющиеся слова
        const words = text.split(/\s+/);
        const uniqueWords = new Set(words);
        if (words.length > 10 && uniqueWords.size < words.length * 0.3) {
            violations.push({
                type: 'repetitive',
                message: 'слишком много повторяющихся слов'
            });
            score += 0.3;
        }

        // Пунктуация
        const punctuationCount = (text.match(/[!?.,;:]{2,}/g) || []).length;
        if (punctuationCount > 3) {
            violations.push({
                type: 'excessive_punctuation',
                message: 'чрезмерное использование знаков препинания'
            });
            score += 0.2;
        }

        const isValid = score < 1.0;
        const reason = isValid ? null : generateReason(violations);

        return {
            isValid,
            reason,
            score: Math.min(score, 3.0),
            violations,
            needsReview: score >= 0.5 && score < 1.0
        };
    }

    // Генерация причины
    function generateReason(violations) {
        if (violations.length === 0) return null;
        
        const messages = {
            'stop_word': 'Использование запрещенных слов',
            'url': 'Размещение ссылок запрещено',
            'phone': 'Указание телефона в тексте запрещено',
            'email': 'Указание email в тексте запрещено',
            'caps': 'Слишком много заглавных букв',
            'repeated': 'Слишком много повторяющихся символов',
            'profanity': 'Обнаружена нецензурная лексика',
            'too_short': 'Текст слишком короткий',
            'too_long': 'Текст слишком длинный',
            'repetitive': 'Слишком много повторений',
            'excessive_punctuation': 'Чрезмерное использование знаков препинания'
        };

        return messages[violations[0].type] || 'Текст не прошел модерацию';
    }

    // Очистка текста
    function sanitize(text) {
        if (!text) return '';

        let cleaned = text
            .replace(/<[^>]*>/g, '')
            .replace(PATTERNS.url, '[ссылка удалена]')
            .replace(PATTERNS.phone, '[телефон удален]')
            .replace(PATTERNS.email, '[email удален]')
            .replace(/\s+/g, ' ')
            .trim();

        return cleaned;
    }

    // Модерация заказа
    async function moderateOrder(orderData) {
        const violations = [];
        
        const titleCheck = check(orderData.title, 'order_title');
        if (!titleCheck.isValid) {
            violations.push({
                field: 'title',
                reason: titleCheck.reason
            });
        }

        if (orderData.description) {
            const descCheck = check(orderData.description, 'order_description');
            if (!descCheck.isValid) {
                violations.push({
                    field: 'description',
                    reason: descCheck.reason
                });
            }
        }

        if (orderData.price < 500 || orderData.price > 1000000) {
            violations.push({
                field: 'price',
                reason: 'Цена вне допустимого диапазона'
            });
        }

        if (orderData.address && orderData.address.length < 5) {
            violations.push({
                field: 'address',
                reason: 'Слишком короткий адрес'
            });
        }

        return {
            isValid: violations.length === 0,
            violations,
            autoApprove: violations.length === 0 && orderData.price < 50000
        };
    }

    // Модерация сообщения
    async function moderateMessage(messageText, senderId) {
        const checkResult = check(messageText, 'chat_message');
        
        if (!checkResult.isValid) {
            await logViolation({
                userId: senderId,
                type: 'chat_spam',
                text: messageText,
                violations: checkResult.violations,
                timestamp: new Date().toISOString()
            });

            await checkBanThreshold(senderId);
        }

        return checkResult;
    }

    // Логирование нарушений
    async function logViolation(violation) {
        try {
            await db.collection('moderation_log').add({
                ...violation,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch (error) {
            console.error('Ошибка логирования нарушения:', error);
        }
    }

    // Проверка на бан
    async function checkBanThreshold(userId) {
        try {
            const oneDayAgo = new Date();
            oneDayAgo.setDate(oneDayAgo.getDate() - 1);

            const snapshot = await db.collection('moderation_log')
                .where('userId', '==', userId)
                .where('createdAt', '>=', oneDayAgo)
                .get();

            const violations = snapshot.size;
            
            if (violations >= 5) {
                await db.collection('users').doc(userId).update({
                    banned: true,
                    bannedAt: new Date().toISOString(),
                    banReason: 'Автоматический бан за спам'
                });
            }
        } catch (error) {
            console.error('Ошибка проверки порога бана:', error);
        }
    }

    // Публичное API
    return {
        check,
        sanitize,
        moderateOrder,
        moderateMessage
    };
})();

window.Moderation = Moderation;