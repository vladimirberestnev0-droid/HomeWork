// ============================================
// ГЛОБАЛЬНЫЙ ЗАГРУЗЧИК СТРАНИЦ
// ============================================

(function() {
    // Защита от повторной инициализации
    if (window.__LOADER_INITIALIZED__) {
        return;
    }
    window.__LOADER_INITIALIZED__ = true;

    // Константы
    const LOADER_ID = 'global-loader';
    const MAX_LOADER_TIME = 20000; // 20 секунд (было 10)

    // Переменные
    let loader = null;
    let timeoutId = null;
    let isTransitioning = false;
    let originalTitle = document.title;
    let loaderCounter = 0;

    // ===== СОЗДАНИЕ ЛОУДЕРА =====
    function ensureLoader() {
        if (loader) return loader;
        
        loader = document.getElementById(LOADER_ID);
        
        if (!loader) {
            // Создаём лоадер программно
            loader = document.createElement('div');
            loader.id = LOADER_ID;
            loader.className = 'global-loader';
            loader.innerHTML = `
                <div class="loader-content">
                    <div class="spinner-glow"></div>
                    <p class="loader-text" id="loader-text">Загрузка...</p>
                </div>
            `;
            document.body.appendChild(loader);
            
            // Добавляем стили если их нет
            addLoaderStyles();
        }
        
        return loader;
    }

    // ===== ДОБАВЛЕНИЕ СТИЛЕЙ =====
    function addLoaderStyles() {
        if (document.getElementById('loader-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'loader-styles';
        style.textContent = `
            .global-loader {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: var(--bg-main, #0B1E33);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 999999;
                opacity: 0;
                pointer-events: none;
                transition: opacity 0.3s ease;
                backdrop-filter: blur(5px);
            }
            
            .global-loader .loader-content {
                text-align: center;
                transform: translateY(-20px);
                transition: transform 0.3s ease;
            }
            
            .global-loader.active {
                opacity: 1;
                pointer-events: all;
            }
            
            .global-loader.active .loader-content {
                transform: translateY(0);
            }
            
            .global-loader .spinner-glow {
                width: 60px;
                height: 60px;
                border: 4px solid rgba(44, 213, 196, 0.2);
                border-top-color: var(--accent, #2CD5C4);
                border-radius: 50%;
                animation: loader-spin 1s linear infinite, loader-glow 1.5s ease-in-out infinite;
                margin: 0 auto 20px;
            }
            
            .global-loader .loader-text {
                color: var(--accent, #2CD5C4);
                font-size: 1.1rem;
                font-weight: 600;
                letter-spacing: 0.5px;
                animation: loader-pulse 1.5s ease-in-out infinite;
            }
            
            @keyframes loader-spin {
                to { transform: rotate(360deg); }
            }
            
            @keyframes loader-glow {
                0%, 100% { box-shadow: 0 0 20px var(--accent, #2CD5C4); }
                50% { box-shadow: 0 0 40px var(--accent, #2CD5C4); }
            }
            
            @keyframes loader-pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.7; }
            }
            
            body.loader-active {
                overflow: hidden;
            }
        `;
        document.head.appendChild(style);
    }

    // ===== ПОКАЗАТЬ ЛОУДЕР =====
    function showLoader(text = 'Загрузка...') {
        loaderCounter++;
        console.log(`🔄 Loader показан (${loaderCounter}): ${text}`);
        
        const loaderEl = ensureLoader();
        const textEl = document.getElementById('loader-text') || loaderEl.querySelector('.loader-text');
        
        if (textEl) {
            textEl.textContent = text;
        }
        
        loaderEl.classList.add('active');
        document.body.classList.add('loader-active');
        
        // Меняем заголовок
        originalTitle = document.title;
        document.title = `⏳ ${text} | ${originalTitle}`;
        
        // Защита от вечных лоадеров
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
        
        timeoutId = setTimeout(() => {
            if (loaderCounter > 0) {
                console.warn(`⚠️ Аварийное скрытие лоадера (превышено время ${MAX_LOADER_TIME/1000}с)`);
                // Принудительно сбрасываем счётчик
                loaderCounter = 0;
                hideLoader();
            }
        }, MAX_LOADER_TIME);
        
        return loaderEl;
    }

    // ===== СКРЫТЬ ЛОУДЕР =====
    function hideLoader() {
        if (loaderCounter > 0) {
            loaderCounter = Math.max(0, loaderCounter - 1);
            console.log(`🔄 Loader скрыт (осталось: ${loaderCounter})`);
        }
        
        // Если есть ещё активные вызовы - не скрываем
        if (loaderCounter > 0) {
            return;
        }
        
        const loaderEl = ensureLoader();
        loaderEl.classList.remove('active');
        document.body.classList.remove('loader-active');
        
        // Восстанавливаем заголовок
        document.title = originalTitle;
        
        // Очищаем таймаут
        if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
        }
    }

    // ===== ПРИНУДИТЕЛЬНО СКРЫТЬ ЛОУДЕР =====
    function forceHideLoader() {
        console.log('⚠️ Принудительное скрытие лоадера');
        loaderCounter = 0;
        
        const loaderEl = ensureLoader();
        loaderEl.classList.remove('active');
        document.body.classList.remove('loader-active');
        
        // Восстанавливаем заголовок
        document.title = originalTitle;
        
        // Очищаем таймаут
        if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
        }
    }

    // ===== ПОКАЗАТЬ НА ВРЕМЯ =====
    function showTemporary(text = 'Загрузка...', duration = 1500) {
        showLoader(text);
        
        setTimeout(() => {
            hideLoader();
        }, duration);
    }

    // ===== ПЕРЕХОД НА ДРУГУЮ СТРАНИЦУ =====
    function navigateTo(url, text = 'Переходим...') {
        // Защита от множественных переходов
        if (isTransitioning) {
            console.log('⚠️ Уже выполняется переход');
            return;
        }
        
        isTransitioning = true;
        
        // Показываем лоадер
        showLoader(text);
        
        // Небольшая задержка для плавности
        setTimeout(() => {
            window.location.href = url;
        }, 300);
    }

    // ===== ПЕРЕХОД ПОСЛЕ АВТОРИЗАЦИИ =====
    function navigateAfterAuth(url, text = 'Вход выполнен...') {
        showTemporary(text, 1000);
        
        setTimeout(() => {
            window.location.href = url;
        }, 1200);
    }

    // ===== ПЕРЕХВАТ ССЫЛОК =====
    function setupLinkIntercept() {
        document.addEventListener('click', (e) => {
            // Ищем ссылку
            const link = e.target.closest('a[href]');
            
            if (link) {
                const href = link.getAttribute('href');
                const noLoader = link.hasAttribute('data-no-loader');
                
                // Не перехватываем внешние ссылки, якоря и ссылки с атрибутом data-no-loader
                if (!noLoader && 
                    href && 
                    !href.startsWith('http') && 
                    !href.startsWith('#') && 
                    !href.startsWith('javascript:') &&
                    !href.startsWith('tel:') &&
                    !href.startsWith('mailto:')) {
                    
                    // Не перехватываем ссылки на текущую страницу
                    if (href !== window.location.pathname && href !== window.location.href) {
                        e.preventDefault();
                        navigateTo(href);
                    }
                }
            }
        });
    }

    // ===== АВТОМАТИЧЕСКОЕ СКРЫТИЕ ПРИ ЗАГРУЗКЕ =====
    function setupAutoHide() {
        // Если страница уже загружена
        if (document.readyState === 'complete') {
            setTimeout(forceHideLoader, 100);
        } else {
            window.addEventListener('load', () => {
                setTimeout(forceHideLoader, 100);
            });
        }
        
        // Если долгая загрузка - меняем текст
        const longLoadTimeout = setTimeout(() => {
            const loaderEl = ensureLoader();
            const textEl = document.getElementById('loader-text') || loaderEl.querySelector('.loader-text');
            
            if (loaderEl.classList.contains('active') && textEl) {
                textEl.textContent = 'Немного ещё...';
            }
        }, 3000);
        
        window.addEventListener('load', () => {
            clearTimeout(longLoadTimeout);
        });
        
        // Дополнительная защита - скрываем при любых ошибках
        window.addEventListener('error', () => {
            forceHideLoader();
        });
        
        window.addEventListener('unhandledrejection', () => {
            forceHideLoader();
        });
    }

    // ===== ПОЛУЧИТЬ ТЕКУЩЕЕ СОСТОЯНИЕ =====
    function getState() {
        return {
            visible: document.getElementById(LOADER_ID)?.classList.contains('active') || false,
            counter: loaderCounter,
            transitioning: isTransitioning
        };
    }

    // ===== ИНИЦИАЛИЗАЦИЯ =====
    function init() {
        ensureLoader();
        setupAutoHide();
        setupLinkIntercept();
        console.log('✅ Loader инициализирован (со счётчиком и защитой)');
        
        // Глобальная функция для отладки
        window.debugLoader = function() {
            console.log('🔍 Состояние лоадера:', getState());
        };
    }

    // Запускаем после загрузки DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // ===== ПУБЛИЧНОЕ API =====
    window.Loader = {
        show: showLoader,
        hide: hideLoader,
        forceHide: forceHideLoader,
        showTemporary: showTemporary,
        navigateTo: navigateTo,
        navigateAfterAuth: navigateAfterAuth,
        getState: getState
    };
})();