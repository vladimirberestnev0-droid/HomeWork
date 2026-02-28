// ===== welcome-modal.js =====
// Улучшенная полноэкранная приветственная модалка с «вау»-эффектами
// Появляется один раз за сессию, содержит 12 карточек преимуществ,
// анимации, конфетти и стеклянный дизайн.

(function() {
    const MODAL_KEY = 'workhom_welcome_shown_session';

    // Если уже показывали в этой сессии – выходим
    if (sessionStorage.getItem(MODAL_KEY)) return;

    // Подключаем библиотеку конфетти (CDN) для эффектного появления
    const confettiScript = document.createElement('script');
    confettiScript.src = 'https://cdn.jsdelivr.net/npm/canvas-confetti@1';
    document.head.appendChild(confettiScript);

    // Стили модалки – полностью переработаны в стиле "премиум"
    const style = document.createElement('style');
    style.textContent = `
        /* Затемнение фона с размытием */
        .modal-fullscreen.show {
            display: flex !important;
            background-color: rgba(0, 0, 0, 0.5);
            backdrop-filter: blur(8px);
            transition: backdrop-filter 0.3s ease;
        }

        .modal-fullscreen .modal-dialog {
            max-width: 95vw;
            height: 95vh;
            margin: 2.5vh auto;
            transform: scale(0.9);
            opacity: 0;
            transition: transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.4s ease;
        }

        .modal-fullscreen.show .modal-dialog {
            transform: scale(1);
            opacity: 1;
        }

        .modal-fullscreen .modal-content {
            height: 100%;
            border-radius: 50px;
            overflow: hidden;
            background: rgba(255, 255, 255, 0.75);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.5);
            box-shadow: 0 30px 60px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(230, 122, 75, 0.2) inset;
            color: var(--text-dark, #212529);
            transition: all 0.3s;
        }

        /* Тёмная тема для модалки */
        body.dark-theme .modal-fullscreen .modal-content {
            background: rgba(30, 41, 59, 0.8);
            border-color: rgba(255, 255, 255, 0.1);
            box-shadow: 0 30px 60px rgba(0, 0, 0, 0.6);
        }

        /* Шапка с градиентом и эффектом свечения */
        .modal-fullscreen .modal-header {
            border-bottom: none;
            padding: 1.5rem 2rem;
            background: linear-gradient(135deg, rgba(230, 122, 75, 0.9), rgba(212, 92, 47, 0.9));
            backdrop-filter: blur(10px);
            color: white;
            display: flex;
            align-items: center;
            justify-content: flex-start;
            position: relative;
            overflow: hidden;
        }

        .modal-fullscreen .modal-header::after {
            content: '';
            position: absolute;
            top: -50%;
            left: -50%;
            width: 200%;
            height: 200%;
            background: radial-gradient(circle, rgba(255,255,255,0.3) 0%, transparent 70%);
            opacity: 0.5;
            animation: rotate 20s linear infinite;
        }

        @keyframes rotate {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }

        .modal-fullscreen .modal-title {
            font-size: 2.2rem;
            font-weight: 800;
            margin: 0;
            display: flex;
            align-items: center;
            gap: 15px;
            text-shadow: 0 4px 15px rgba(0,0,0,0.2);
            z-index: 2;
        }

        .modal-fullscreen .modal-title i {
            font-size: 2.8rem;
            filter: drop-shadow(0 4px 8px rgba(0,0,0,0.3));
            animation: bounceIcon 2s infinite;
        }

        @keyframes bounceIcon {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-5px); }
        }

        .modal-fullscreen .btn-close {
            order: -1;
            margin-right: 20px;
            background: rgba(255,255,255,0.2);
            border: 2px solid white;
            border-radius: 50%;
            width: 50px;
            height: 50px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.8rem;
            color: white;
            cursor: pointer;
            transition: all 0.3s;
            z-index: 2;
            backdrop-filter: blur(5px);
        }

        .modal-fullscreen .btn-close:hover {
            background: white;
            color: var(--accent);
            transform: scale(1.1) rotate(90deg);
            box-shadow: 0 0 20px white;
        }

        .modal-fullscreen .modal-body {
            padding: 2rem;
            overflow-y: auto;
            background: transparent;
        }

        .modal-fullscreen .welcome-subtitle {
            font-size: 1.6rem;
            text-align: center;
            margin-bottom: 2rem;
            color: var(--text-soft, #4b5563);
            font-weight: 500;
            text-shadow: 0 2px 5px rgba(0,0,0,0.05);
        }

        /* Сетка карточек (адаптивная) */
        .modal-fullscreen .features-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 20px;
            margin-bottom: 2rem;
        }

        /* Стеклянная карточка */
        .modal-fullscreen .feature-card {
            background: rgba(255, 255, 255, 0.5);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border-radius: 30px;
            padding: 25px 20px;
            box-shadow: 0 15px 35px rgba(0,0,0,0.1);
            transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            border: 1px solid rgba(255, 255, 255, 0.6);
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            position: relative;
            overflow: hidden;
        }

        .modal-fullscreen .feature-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: radial-gradient(circle at 20% 30%, rgba(230,122,75,0.2), transparent 70%);
            opacity: 0;
            transition: opacity 0.4s;
        }

        .modal-fullscreen .feature-card:hover {
            transform: translateY(-10px) scale(1.02);
            border-color: var(--accent);
            box-shadow: 0 30px 45px -15px rgba(230,122,75,0.4);
            background: rgba(255, 255, 255, 0.7);
        }

        .modal-fullscreen .feature-card:hover::before {
            opacity: 1;
        }

        .modal-fullscreen .feature-icon {
            font-size: 2.4rem;
            color: var(--accent);
            margin-bottom: 15px;
            transition: transform 0.3s;
            filter: drop-shadow(0 5px 10px rgba(230,122,75,0.3));
        }

        .modal-fullscreen .feature-card:hover .feature-icon {
            transform: scale(1.1) rotate(5deg);
            color: var(--accent-dark);
        }

        .modal-fullscreen .feature-title {
            font-size: 1.3rem;
            font-weight: 700;
            margin-bottom: 8px;
            color: var(--text-dark);
        }

        .modal-fullscreen .feature-desc {
            font-size: 0.95rem;
            color: var(--text-soft);
            line-height: 1.5;
        }

        /* Тёмная тема для карточек */
        body.dark-theme .modal-fullscreen .feature-card {
            background: rgba(30, 41, 59, 0.6);
            border-color: rgba(255, 255, 255, 0.1);
        }

        body.dark-theme .modal-fullscreen .feature-card:hover {
            background: rgba(30, 41, 59, 0.8);
            border-color: var(--accent);
        }

        /* Футер модалки */
        .modal-fullscreen .modal-footer {
            border-top: 1px solid rgba(255, 255, 255, 0.3);
            padding: 1.5rem 2rem;
            justify-content: center;
            background: rgba(255, 255, 255, 0.2);
            backdrop-filter: blur(10px);
        }

        /* Кнопка с супер-эффектами */
        .modal-fullscreen .btn-accept {
            background: linear-gradient(145deg, var(--accent), var(--accent-dark));
            color: white;
            border: none;
            border-radius: 60px;
            padding: 18px 60px;
            font-size: 1.6rem;
            font-weight: 800;
            letter-spacing: 1px;
            box-shadow: 0 15px 30px rgba(230,122,75,0.5);
            transition: all 0.3s;
            min-width: 280px;
            position: relative;
            overflow: hidden;
            cursor: pointer;
            z-index: 1;
        }

        .modal-fullscreen .btn-accept::after {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
            transition: left 0.5s;
            z-index: -1;
        }

        .modal-fullscreen .btn-accept:hover {
            transform: translateY(-5px) scale(1.05);
            box-shadow: 0 25px 45px rgba(230,122,75,0.7);
        }

        .modal-fullscreen .btn-accept:hover::after {
            left: 100%;
        }

        .modal-fullscreen .btn-accept:active {
            transform: translateY(0) scale(0.98);
        }

        /* Адаптивность */
        @media (max-width: 768px) {
            .modal-fullscreen .modal-dialog {
                max-width: 100vw;
                height: 100vh;
                margin: 0;
            }
            .modal-fullscreen .modal-content {
                border-radius: 0;
            }
            .modal-fullscreen .modal-header {
                padding: 1rem;
            }
            .modal-fullscreen .modal-title {
                font-size: 1.5rem;
            }
            .modal-fullscreen .modal-title i {
                font-size: 2rem;
            }
            .modal-fullscreen .btn-close {
                width: 40px;
                height: 40px;
                font-size: 1.5rem;
                margin-right: 10px;
            }
            .modal-fullscreen .modal-body {
                padding: 1rem;
            }
            .modal-fullscreen .welcome-subtitle {
                font-size: 1.2rem;
            }
            .modal-fullscreen .features-grid {
                grid-template-columns: 1fr;
                gap: 12px;
            }
            .modal-fullscreen .feature-card {
                padding: 18px;
            }
            .modal-fullscreen .btn-accept {
                padding: 14px 30px;
                font-size: 1.3rem;
                min-width: 220px;
            }
        }

        @media (max-width: 480px) {
            .modal-fullscreen .modal-title {
                font-size: 1.2rem;
            }
            .modal-fullscreen .btn-accept {
                padding: 12px 20px;
                font-size: 1.1rem;
                min-width: 180px;
            }
        }

        /* Анимация для появления карточек */
        .modal-fullscreen .feature-card {
            opacity: 0;
            transform: translateY(20px);
            animation: fadeInUp 0.5s ease forwards;
        }

        .modal-fullscreen .feature-card:nth-child(1) { animation-delay: 0.1s; }
        .modal-fullscreen .feature-card:nth-child(2) { animation-delay: 0.2s; }
        .modal-fullscreen .feature-card:nth-child(3) { animation-delay: 0.3s; }
        .modal-fullscreen .feature-card:nth-child(4) { animation-delay: 0.4s; }
        .modal-fullscreen .feature-card:nth-child(5) { animation-delay: 0.5s; }
        .modal-fullscreen .feature-card:nth-child(6) { animation-delay: 0.6s; }
        .modal-fullscreen .feature-card:nth-child(7) { animation-delay: 0.7s; }
        .modal-fullscreen .feature-card:nth-child(8) { animation-delay: 0.8s; }
        .modal-fullscreen .feature-card:nth-child(9) { animation-delay: 0.9s; }
        .modal-fullscreen .feature-card:nth-child(10) { animation-delay: 1s; }
        .modal-fullscreen .feature-card:nth-child(11) { animation-delay: 1.1s; }
        .modal-fullscreen .feature-card:nth-child(12) { animation-delay: 1.2s; }

        @keyframes fadeInUp {
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
    `;
    document.head.appendChild(style);

    // HTML модалки (текст карточек можно оставить прежним, но я немного обновил)
    const modalHTML = `
        <div class="modal fade modal-fullscreen" id="welcomeModal" tabindex="-1" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">
                            <i class="fas fa-handshake"></i>
                            Добро пожаловать в ВоркХом
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close">✕</button>
                    </div>
                    <div class="modal-body">
                        <div class="welcome-subtitle">
                            Одна заявка — множество предложений. Для мастеров и клиентов.
                        </div>

                        <div class="features-grid">
                            <div class="feature-card">
                                <div class="feature-icon"><i class="fas fa-pen"></i></div>
                                <div class="feature-title">Простая заявка</div>
                                <div class="feature-desc">2 минуты — и мастера уже откликаются.</div>
                            </div>
                            <div class="feature-card">
                                <div class="feature-icon"><i class="fas fa-users"></i></div>
                                <div class="feature-title">Выбор мастера</div>
                                <div class="feature-desc">До 10 предложений, рейтинги, отзывы.</div>
                            </div>
                            <div class="feature-card">
                                <div class="feature-icon"><i class="fas fa-comments"></i></div>
                                <div class="feature-title">Чат с файлами</div>
                                <div class="feature-desc">Обсуждайте детали, отправляйте фото и документы.</div>
                            </div>
                            <div class="feature-card">
                                <div class="feature-icon"><i class="fas fa-bell"></i></div>
                                <div class="feature-title">Уведомления</div>
                                <div class="feature-desc">Мгновенно узнавайте о новых заказах и сообщениях.</div>
                            </div>
                            <div class="feature-card">
                                <div class="feature-icon"><i class="fas fa-level-up-alt"></i></div>
                                <div class="feature-title">Уровни и комиссия</div>
                                <div class="feature-desc">Чем выше уровень мастера — тем ниже комиссия платформы.</div>
                            </div>
                            <div class="feature-card">
                                <div class="feature-icon"><i class="fas fa-map-marked-alt"></i></div>
                                <div class="feature-title">Гео-трекинг</div>
                                <div class="feature-desc">Отслеживайте мастера на карте в реальном времени.</div>
                            </div>
                            <div class="feature-card">
                                <div class="feature-icon"><i class="fas fa-moon"></i></div>
                                <div class="feature-title">Тёмная тема</div>
                                <div class="feature-desc">Комфортный интерфейс в любое время суток.</div>
                            </div>
                            <div class="feature-card">
                                <div class="feature-icon"><i class="fas fa-images"></i></div>
                                <div class="feature-title">Портфолио</div>
                                <div class="feature-desc">Смотрите примеры работ мастеров до заказа.</div>
                            </div>
                            <div class="feature-card">
                                <div class="feature-icon"><i class="fas fa-lock"></i></div>
                                <div class="feature-title">Безопасная сделка</div>
                                <div class="feature-desc">Оплата только после приёмки работы.</div>
                            </div>
                            <div class="feature-card">
                                <div class="feature-icon"><i class="fas fa-star"></i></div>
                                <div class="feature-title">Рейтинги и отзывы</div>
                                <div class="feature-desc">Честные оценки, прозрачная история.</div>
                            </div>
                            <div class="feature-card">
                                <div class="feature-icon"><i class="fas fa-id-card"></i></div>
                                <div class="feature-title">Личный кабинет</div>
                                <div class="feature-desc">Все заказы, избранное, статистика.</div>
                            </div>
                            <div class="feature-card">
                                <div class="feature-icon"><i class="fas fa-mobile-alt"></i></div>
                                <div class="feature-title">Адаптивный дизайн</div>
                                <div class="feature-desc">Удобно на любом устройстве — телефоне, планшете, ПК.</div>
                            </div>
                        </div>

                        <p class="text-center mt-4" style="font-size: 1rem; color: var(--text-muted);">
                            Присоединяйтесь к тысячам довольных клиентов и мастеров!
                        </p>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-accept" data-bs-dismiss="modal" id="welcomeModalGotIt">
                            Отлично, я понял!
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Функция запуска конфетти (будет вызвана после открытия модалки)
    function launchConfetti() {
        if (typeof confetti !== 'function') return;
        confetti({
            particleCount: 150,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#E67A4B', '#FF9F4B', '#ffffff', '#f8fafc']
        });
        // дополнительный взрыв через 0.3 сек
        setTimeout(() => {
            confetti({
                particleCount: 100,
                angle: 60,
                spread: 55,
                origin: { x: 0, y: 0.5 }
            });
            confetti({
                particleCount: 100,
                angle: 120,
                spread: 55,
                origin: { x: 1, y: 0.5 }
            });
        }, 300);
    }

    // Показываем модалку через небольшую задержку и запускаем конфетти
    setTimeout(() => {
        const modalEl = document.getElementById('welcomeModal');
        if (modalEl && window.bootstrap) {
            const modal = new bootstrap.Modal(modalEl, {
                backdrop: 'static',
                keyboard: false
            });
            modal.show();
            sessionStorage.setItem(MODAL_KEY, 'true');

            // Запускаем конфетти после открытия
            launchConfetti();

            // Можно добавить конфетти также при клике на кнопку "Понял"
            const gotItBtn = document.getElementById('welcomeModalGotIt');
            if (gotItBtn) {
                gotItBtn.addEventListener('click', function(e) {
                    launchConfetti(); // ещё разок для радости
                });
            }
        }
    }, 1000);
})();