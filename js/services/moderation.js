// ============================================
// СЕРВИС МОДЕРАЦИИ
// ============================================

const Moderation = (function() {
    // Защита от повторных инициализаций
    if (window.__MODERATION_INITIALIZED__) {
        return window.Moderation;
    }

    // ===== СТОП-СЛОВА =====
    const STOP_WORDS = [
        'спам', 'реклама', 'сайт', 'ссылк', 'чат', 'telegram', 'ватсап',
        'whatsapp', 'телеграм', 'секс', 'интим', 'казино', 'наркотик',
        'оружие', 'взлом', 'мошенник', 'обман', 'развод', 'лохотрон',
        'пишите на почту', 'звоните на ватсап', 'перейдите по ссылке',
        'заходите на сайт', 'подпишись', 'лайкни', 'репост'
    ];

    // ===== МАТ (для цензуры) =====
    const PROFANITY = [
        'бля', 'хуй', 'пизд', 'еба', 'нах', 'сук', 'пидор', 'гандон',
        'мудак', 'долбоеб', 'уебан', 'шалава', 'шлюха'
    ];

    // ===== ПРОВЕРКА ТЕКСТА =====
    function check(text, context = 'general') {
        if (!text || text.trim() === '') {
            return { isValid: true, violations: [], cleanText: text };
        }

        const originalText = text;
        let cleanText = text;
        const lowerText = text.toLowerCase();
        let violations = [];

        // 1. Стоп-слова
        for (let word of STOP_WORDS) {
            if (lowerText.includes(word)) {
                violations.push({ 
                    type: 'stop_word', 
                    word: word,
                    severity: 'high'
                });
                
                // Маскируем стоп-слова
                const regex = new RegExp(word, 'gi');
                cleanText = cleanText.replace(regex, '[цензура]');
            }
        }

        // 2. Ссылки
        const urlRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|(t\.me\/[^\s]+)|(vk\.com\/[^\s]+)/gi;
        if (urlRegex.test(text)) {
            violations.push({ type: 'url', severity: 'high' });
            cleanText = cleanText.replace(urlRegex, '[ссылка удалена]');
        }

        // 3. Телефоны
        const phoneRegex = /(\+7|8)[\s(]?(\d{3})[\s)]?[\s-]?(\d{3})[\s-]?(\d{2})[\s-]?(\d{2})/g;
        if (phoneRegex.test(text)) {
            violations.push({ type: 'phone', severity: 'medium' });
            cleanText = cleanText.replace(phoneRegex, '[телефон удален]');
        }

        // 4. Email
        const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
        if (emailRegex.test(text)) {
            violations.push({ type: 'email', severity: 'medium' });
            cleanText = cleanText.replace(emailRegex, '[email удален]');
        }

        // 5. Мат
        for (let word of PROFANITY) {
            if (lowerText.includes(word)) {
                violations.push({ 
                    type: 'profanity', 
                    word: word,
                    severity: 'medium'
                });
                
                // Маскируем мат
                const regex = new RegExp(word, 'gi');
                cleanText = cleanText.replace(regex, (match) => {
                    return match[0] + '*'.repeat(match.length - 1);
                });
            }
        }

        // 6. Капс (если больше 50% заглавных)
        if (text.length > 10) {
            const upperCount = (text.match(/[А-ЯA-Z]/g) || []).length;
            if (upperCount > text.length * 0.5) {
                violations.push({ type: 'caps', severity: 'low' });
            }
        }

        // 7. Повторяющиеся символы
        if (/(.)\1{4,}/.test(text)) {
            violations.push({ type: 'spam_chars', severity: 'low' });
        }

        const isValid = violations.length === 0;
        
        // Определяем причину блокировки
        let reason = null;
        if (!isValid) {
            const highSeverity = violations.some(v => v.severity === 'high');
            if (highSeverity) {
                reason = 'Текст содержит запрещённые слова или ссылки';
            } else {
                reason = 'Текст содержит нежелательный контент';
            }
        }

        return {
            isValid,
            violations,
            reason,
            cleanText,
            originalText
        };
    }

    // ===== ОЧИСТКА ТЕКСТА =====
    function sanitize(text) {
        if (!text) return '';
        
        let clean = text;
        
        // Удаляем ссылки
        clean = clean.replace(/(https?:\/\/[^\s]+)/g, '[ссылка удалена]');
        clean = clean.replace(/(www\.[^\s]+)/g, '[ссылка удалена]');
        clean = clean.replace(/(t\.me\/[^\s]+)/g, '[ссылка удалена]');
        
        // Удаляем телефоны
        clean = clean.replace(/(\+7|8)[\s(]?(\d{3})[\s)]?[\s-]?(\d{3})[\s-]?(\d{2})[\s-]?(\d{2})/g, '[телефон удален]');
        
        // Удаляем email
        clean = clean.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[email удален]');
        
        // Маскируем мат
        for (let word of PROFANITY) {
            const regex = new RegExp(word, 'gi');
            clean = clean.replace(regex, (match) => {
                return match[0] + '*'.repeat(match.length - 1);
            });
        }
        
        return clean.trim();
    }

    // ===== ПРОВЕРКА ИЗОБРАЖЕНИЯ (заглушка) =====
    async function checkImage(file) {
        // В реальном проекте здесь был бы вызов API для проверки изображений
        return { isValid: true, violations: [] };
    }

    // ===== ФИЛЬТРАЦИЯ СПАМА =====
    function isSpam(text) {
        const result = check(text);
        
        // Считаем спамом, если есть high severity нарушения
        return result.violations.some(v => v.severity === 'high');
    }

    // ===== ПОЛУЧЕНИЕ СТАТИСТИКИ =====
    function getStats() {
        // Здесь можно хранить статистику в localStorage
        const stats = {
            checked: 0,
            blocked: 0,
            lastCheck: null
        };
        
        try {
            const saved = localStorage.getItem('moderation_stats');
            if (saved) {
                return JSON.parse(saved);
            }
        } catch (e) {}
        
        return stats;
    }

    function updateStats(isBlocked) {
        try {
            const stats = getStats();
            stats.checked++;
            if (isBlocked) stats.blocked++;
            stats.lastCheck = Date.now();
            localStorage.setItem('moderation_stats', JSON.stringify(stats));
        } catch (e) {}
    }

    // ===== ПУБЛИЧНОЕ API =====
    const api = {
        check,
        sanitize,
        checkImage,
        isSpam,
        getStats,
        
        // Константы для внешнего использования
        STOP_WORDS: STOP_WORDS.slice(0), // копия
        PROFANITY: PROFANITY.slice(0)
    };

    window.__MODERATION_INITIALIZED__ = true;
    console.log('✅ Moderation сервис загружен');
    
    return Object.freeze(api);
})();

// Глобальный доступ
window.Moderation = Moderation;