// ===== js/services/telegram-client.js =====
// Клиентская часть для работы с Telegram

const TelegramClient = (function() {
    const CONFIG = {
        BOT_USERNAME: '@WorkHomBot',
        BOT_LINK: 'https://t.me/WorkHomBot'
    };

    /**
     * Проверка, привязан ли Telegram к аккаунту
     */
    async function isLinked(userId) {
        try {
            if (!userId) return false;
            const userDoc = await db.collection('users').doc(userId).get();
            return !!userDoc.data()?.telegramChatId;
        } catch (error) {
            console.error('Ошибка проверки Telegram:', error);
            return false;
        }
    }

    /**
     * Показать инструкцию по привязке Telegram
     */
    function showLinkInstructions() {
        const modalHtml = `
            <div class="modal fade" id="telegramLinkModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                <i class="fab fa-telegram me-2" style="color: #0088cc;"></i>
                                Привязка Telegram
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="text-center mb-4">
                                <i class="fab fa-telegram fa-3x mb-3" style="color: #0088cc;"></i>
                                <h6>Подключи Telegram-бота</h6>
                                <p class="text-secondary">Получай уведомления о новых заказах и сообщениях прямо в Telegram</p>
                            </div>
                            
                            <div class="alert alert-info">
                                <i class="fas fa-info-circle me-2"></i>
                                <strong>Как подключить:</strong>
                            </div>
                            
                            <ol class="mb-4">
                                <li class="mb-2">Перейди в бота: <a href="${CONFIG.BOT_LINK}" target="_blank" class="fw-bold">${CONFIG.BOT_USERNAME}</a></li>
                                <li class="mb-2">Нажми "Start" или напиши /start</li>
                                <li class="mb-2">Отправь боту команду /connect и свой email</li>
                                <li class="mb-2">Готово! Теперь ты будешь получать уведомления</li>
                            </ol>
                            
                            <div class="text-center">
                                <a href="${CONFIG.BOT_LINK}" target="_blank" class="btn" style="background: #0088cc; color: white;">
                                    <i class="fab fa-telegram me-2"></i>
                                    Перейти в Telegram
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        const oldModal = document.getElementById('telegramLinkModal');
        if (oldModal) oldModal.remove();

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modal = new bootstrap.Modal(document.getElementById('telegramLinkModal'));
        modal.show();
    }

    return {
        isLinked,
        showLinkInstructions
    };
})();

window.TelegramClient = TelegramClient;