const Moderation = (function() {
    // Стоп-слова
    const STOP_WORDS = [
        'спам', 'реклама', 'сайт', 'ссылк', 'чат', 'telegram', 'ватсап',
        'whatsapp', 'телеграм', 'секс', 'интим', 'казино', 'наркотик',
        'оружие', 'взлом', 'мошенник', 'обман'
    ];

    // Проверка текста
    function check(text, context = 'general') {
        if (!text || text.trim() === '') {
            return { isValid: true, violations: [] };
        }

        const lowerText = text.toLowerCase();
        let violations = [];

        // Стоп-слова
        for (let word of STOP_WORDS) {
            if (lowerText.includes(word)) {
                violations.push({ type: 'stop_word', word });
            }
        }

        // Ссылки
        if (/(https?:\/\/[^\s]+)|(www\.[^\s]+)|(t\.me\/[^\s]+)/gi.test(text)) {
            violations.push({ type: 'url' });
        }

        // Телефоны
        if (/(\+7|8)[\s(]?(\d{3})[\s)]?[\s-]?(\d{3})[\s-]?(\d{2})[\s-]?(\d{2})/g.test(text)) {
            violations.push({ type: 'phone' });
        }

        // Email
        if (/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g.test(text)) {
            violations.push({ type: 'email' });
        }

        // Мат (простейший)
        if (/(бля|хуй|пизд|еба|нах|сук|пидор|гандон)/gi.test(text)) {
            violations.push({ type: 'profanity' });
        }

        const isValid = violations.length === 0;
        
        return {
            isValid,
            violations,
            reason: isValid ? null : 'Текст содержит запрещённые слова или ссылки'
        };
    }

    // Очистка текста
    function sanitize(text) {
        if (!text) return '';
        
        return text
            .replace(/(https?:\/\/[^\s]+)/g, '[ссылка удалена]')
            .replace(/(\+7|8)[\s(]?(\d{3})[\s)]?[\s-]?(\d{3})[\s-]?(\d{2})[\s-]?(\d{2})/g, '[телефон удален]')
            .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[email удален]')
            .trim();
    }

    return { check, sanitize };
})();

window.Moderation = Moderation;