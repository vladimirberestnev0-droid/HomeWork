// api/deepseek.js
export default async function handler(req, res) {
  // Разрешаем запросы с GitHub Pages
  res.setHeader('Access-Control-Allow-Origin', 'https://vladimirberestnev0-droid.github.io');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Обрабатываем preflight запрос
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Метод не поддерживается' });
  }

  const { messages } = req.body;

  const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

  if (!DEEPSEEK_API_KEY) {
    return res.status(500).json({ error: 'API ключ не настроен' });
  }

  try {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: 'Ты — бро-помощник на сайте ВоркХом. Ты общаешься неформально, с юмором, используешь слова типа "бро", "короче", "слушай". Ты помогаешь с поиском мастеров, советами по ремонту, ценами. Ты позитивный и энергичный!'
          },
          ...messages
        ],
        temperature: 0.9,
        max_tokens: 500
      })
    });

    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    console.error('DeepSeek error:', error);
    res.status(500).json({ error: 'Что-то пошло не так, бро!' });
  }
}