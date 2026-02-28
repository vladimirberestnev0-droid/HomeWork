// ===== welcome-modal.js =====
// Полноэкранная приветственная модалка с описанием всех возможностей (один раз за сессию)
// Адаптивная, с учётом мобильных устройств.

(function() {
    const MODAL_KEY = 'workhom_welcome_shown_session';

    // Если уже показывали в этой сессии – выходим
    if (sessionStorage.getItem(MODAL_KEY)) return;

    // Стили модалки
    const style = document.createElement('style');
    style.textContent = `
        /* Затемнение фона */
        .modal-fullscreen .modal-dialog {
            max-width: 95vw;
            height: 95vh;
            margin: 2.5vh auto;
        }
        .modal-fullscreen .modal-content {
            height: 100%;
            border-radius: 40px;
            overflow: hidden;
            background: var(--bg-white, #ffffff);
            color: var(--text-dark, #212529);
            box-shadow: 0 30px 60px rgba(0,0,0,0.3);
        }
        .modal-fullscreen .modal-header {
            border-bottom: 2px solid var(--border, #dee2e6);
            padding: 1.5rem 2rem;
            background: linear-gradient(135deg, var(--accent, #E67A4B), var(--accent-dark, #D45C2F));
            color: white;
            display: flex;
            align-items: center;
            justify-content: flex-start;
        }
        .modal-fullscreen .modal-title {
            font-size: 2rem;
            font-weight: 800;
            margin: 0;
            display: flex;
            align-items: center;
            gap: 15px;
        }
        .modal-fullscreen .modal-title i {
            font-size: 2.5rem;
        }
        .modal-fullscreen .btn-close {
            order: -1;
            margin-right: 20px;
            background: transparent;
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
        }
        .modal-fullscreen .btn-close:hover {
            background: white;
            color: var(--accent);
            transform: scale(1.1);
        }
        .modal-fullscreen .modal-body {
            padding: 2rem;
            overflow-y: auto;
            background: var(--bg-light, #f8fafc);
        }
        .modal-fullscreen .welcome-subtitle {
            font-size: 1.5rem;
            text-align: center;
            margin-bottom: 2rem;
            color: var(--text-soft, #6c757d);
            font-weight: 500;
        }
        .modal-fullscreen .features-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 20px;
            margin-bottom: 2rem;
        }
        .modal-fullscreen .feature-card {
            background: var(--bg-white, #ffffff);
            border-radius: 20px;
            padding: 20px 15px;
            box-shadow: 0 10px 20px rgba(0,0,0,0.03);
            transition: all 0.3s;
            border: 1px solid var(--border, #e9ecef);
            display: flex;
            flex-direction: column;
            align-items: flex-start;
        }
        .modal-fullscreen .feature-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 20px 30px rgba(230,122,75,0.1);
            border-color: var(--accent);
        }
        .modal-fullscreen .feature-icon {
            font-size: 2rem;
            color: var(--accent);
            margin-bottom: 12px;
        }
        .modal-fullscreen .feature-title {
            font-size: 1.2rem;
            font-weight: 700;
            margin-bottom: 5px;
            color: var(--text-dark);
        }
        .modal-fullscreen .feature-desc {
            font-size: 0.9rem;
            color: var(--text-soft);
            line-height: 1.4;
        }
        .modal-fullscreen .modal-footer {
            border-top: 2px solid var(--border);
            padding: 1.5rem 2rem;
            justify-content: center;
            background: var(--bg-white);
        }
        .modal-fullscreen .btn-accept {
            background: var(--accent);
            color: white;
            border: none;
            border-radius: 60px;
            padding: 16px 50px;
            font-size: 1.5rem;
            font-weight: 700;
            letter-spacing: 1px;
            box-shadow: 0 10px 25px rgba(230,122,75,0.4);
            transition: all 0.3s;
            min-width: 250px;
        }
        .modal-fullscreen .btn-accept:hover {
            background: var(--accent-dark);
            transform: translateY(-3px);
            box-shadow: 0 20px 35px rgba(230,122,75,0.5);
        }

        /* Мобильная адаптация */
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
                font-size: 1.4rem;
            }
            .modal-fullscreen .modal-title i {
                font-size: 1.8rem;
            }
            .modal-fullscreen .btn-close {
                width: 40px;
                height: 40px;
                font-size: 1.4rem;
                margin-right: 10px;
            }
            .modal-fullscreen .modal-body {
                padding: 1rem;
            }
            .modal-fullscreen .welcome-subtitle {
                font-size: 1.2rem;
                margin-bottom: 1.5rem;
            }
            .modal-fullscreen .features-grid {
                grid-template-columns: 1fr;
                gap: 12px;
            }
            .modal-fullscreen .feature-card {
                padding: 15px;
            }
            .modal-fullscreen .btn-accept {
                padding: 12px 30px;
                font-size: 1.2rem;
                min-width: 200px;
            }
        }

        @media (max-width: 480px) {
            .modal-fullscreen .modal-header {
                padding: 0.8rem;
            }
            .modal-fullscreen .modal-title {
                font-size: 1.2rem;
            }
            .modal-fullscreen .modal-title i {
                font-size: 1.5rem;
            }
            .modal-fullscreen .btn-close {
                width: 35px;
                height: 35px;
                font-size: 1.2rem;
            }
            .modal-fullscreen .welcome-subtitle {
                font-size: 1rem;
            }
        }

        /* Тёмная тема */
        body.dark-theme .modal-fullscreen .modal-content {
            background: var(--bg-card, #1e293b);
            color: var(--text-dark, #f1f5f9);
        }
        body.dark-theme .modal-fullscreen .modal-body {
            background: var(--bg-light, #0f172a);
        }
        body.dark-theme .modal-fullscreen .feature-card {
            background: var(--bg-card, #1e293b);
            border-color: var(--border, #334155);
        }
        body.dark-theme .modal-fullscreen .feature-title {
            color: var(--text-dark);
        }
        body.dark-theme .modal-fullscreen .feature-desc {
            color: var(--text-soft, #cbd5e1);
        }
        body.dark-theme .modal-fullscreen .modal-footer {
            background: var(--bg-card);
            border-top-color: var(--border);
        }
    `;
    document.head.appendChild(style);

    // HTML модалки с 12 карточками преимуществ
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
                             Присоединяйтесь!
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

    // Показываем модалку через небольшую задержку
    setTimeout(() => {
        const modalEl = document.getElementById('welcomeModal');
        if (modalEl && window.bootstrap) {
            const modal = new bootstrap.Modal(modalEl, {
                backdrop: 'static',
                keyboard: false
            });
            modal.show();
            sessionStorage.setItem(MODAL_KEY, 'true');
        }
    }, 1000);
})();