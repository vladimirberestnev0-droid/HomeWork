// ===== /functions/deepseek-proxy.js =====
// Прокси для DeepSeek API (Firebase Function)

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const fetch = require('node-fetch');

admin.initializeApp();

// Конфигурация (ключ ТОЛЬКО на сервере!)
const CONFIG = {
    API_KEY: 'sk-or-v1-sk-dktm7dKCFrBGNaAkn6Z7Y0SA55lNYsqY', // Здесь ключ в безопасности!
    API_URL: 'https://openrouter.ai/api/v1/chat/completions',
    MODEL: 'deepseek/deepseek-chat',
    MAX_TOKENS: 500,
    TIMEOUT: 10000
};

exports.deepseekProxy = functions.https.onRequest(async (req, res) => {
    // CORS
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }

    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    try {
        const { message, userId } = req.body;

        if (!message) {
            res.status(400).json({ error: 'Message is required' });
            return;
        }

        // Логируем запрос (для аналитики)
        console.log(`🤖 DeepSeek request from user: ${userId || 'anonymous'}`);

        // Создаём таймаут
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), CONFIG.TIMEOUT);

        const response = await fetch(CONFIG.API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${CONFIG.API_KEY}`,
                'HTTP-Referer': 'https://воркхом.рф',
                'X-Title': 'ВоркХом'
            },
            body: JSON.stringify({
                model: CONFIG.MODEL,
                messages: [
                    {
                        role: 'system',
                        content: 'Ты — бро-помощник на сайте ВоркХом. Ты общаешься неформально, с юмором, используешь слова типа "бро", "короче", "слушай". Ты помогаешь с поиском мастеров, советами по ремонту, ценами. Ты позитивный и энергичный! Отвечай кратко, по делу, но с огоньком!'
                    },
                    {
                        role: 'user',
                        content: message
                    }
                ],
                temperature: 0.8,
                max_tokens: CONFIG.MAX_TOKENS
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('DeepSeek API error:', response.status, errorText);
            throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();

        // Сохраняем в историю (опционально)
        if (userId) {
            await admin.firestore().collection('ai_logs').add({
                userId,
                message,
                response: data.choices?.[0]?.message?.content,
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            });
        }

        res.json(data);

    } catch (error) {
        console.error('Proxy error:', error);
        
        if (error.name === 'AbortError') {
            res.status(504).json({ error: 'Request timeout' });
        } else {
            res.status(500).json({ error: 'Internal server error' });
        }
    }
});