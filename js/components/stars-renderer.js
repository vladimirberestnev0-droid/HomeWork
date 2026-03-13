// ============================================
// РЕНДЕРИНГ ЗВЕЗД РЕЙТИНГА - БЕЗОПАСНАЯ ВЕРСИЯ
// ============================================

const StarsRenderer = (function() {
    if (window.__STARS_RENDERER_INITIALIZED__) return window.StarsRenderer;

    // Кэш для часто используемых рейтингов (только для неинтерактивных)
    const cache = new Map();

    // Размеры
    const SIZES = {
        xs: { class: 'fs-8', width: 12 },
        sm: { class: 'fs-7', width: 14 },
        md: { class: 'fs-6', width: 16 },
        lg: { class: 'fs-4', width: 24 },
        xl: { class: 'fs-2', width: 32 }
    };

    // ===== БЕЗОПАСНОЕ СОЗДАНИЕ ЗВЕЗД =====
    function createStarElement(type, className, dataset = null) {
        const star = document.createElement('i');
        
        // Безопасно устанавливаем классы
        star.className = `${type === 'full' ? 'fas fa-star' : type === 'half' ? 'fas fa-star-half-alt' : 'far fa-star'} ${className}`;
        
        // Добавляем data-rating если нужно
        if (dataset && dataset.rating !== undefined) {
            star.dataset.rating = dataset.rating;
        }
        
        // Стили для интерактивных звезд
        if (dataset?.interactive) {
            star.style.cursor = 'pointer';
            star.style.transition = 'all 0.2s ease';
        }
        
        return star;
    }

    // ===== ОСНОВНАЯ ФУНКЦИЯ РЕНДЕРИНГА =====
    function render(rating, options = {}) {
        const size = options.size || 'md';
        const showNumber = options.showNumber !== false;
        const interactive = options.interactive || false;
        const readonly = options.readonly !== false;
        
        // Нормализуем рейтинг
        const normalizedRating = Math.min(5, Math.max(0, parseFloat(rating) || 0));
        const roundedRating = Math.round(normalizedRating * 2) / 2;
        
        const fullStars = Math.floor(roundedRating);
        const hasHalf = roundedRating % 1 !== 0;
        
        // Проверяем кэш для неинтерактивных версий
        const cacheKey = `${normalizedRating}_${size}_${showNumber}`;
        if (!interactive && cache.has(cacheKey)) {
            return cache.get(cacheKey);
        }

        const sizeConfig = SIZES[size] || SIZES.md;
        
        // СОЗДАЕМ КОНТЕЙНЕР (безопасно)
        const container = document.createElement('div');
        container.className = `stars-container d-inline-flex align-items-center`;
        
        // Генерируем звезды
        for (let i = 1; i <= 5; i++) {
            let starType = 'empty';
            if (i <= fullStars) {
                starType = 'full';
            } else if (i === fullStars + 1 && hasHalf) {
                starType = 'half';
            }
            
            const star = createStarElement(
                starType, 
                sizeConfig.class,
                interactive ? { rating: i, interactive: true } : null
            );
            
            container.appendChild(star);
        }

        // Добавляем числовое значение
        if (showNumber) {
            const ratingSpan = document.createElement('span');
            ratingSpan.className = `ms-1 text-secondary ${sizeConfig.class}`;
            ratingSpan.textContent = normalizedRating.toFixed(1);
            container.appendChild(ratingSpan);
        }

        // Если интерактивный режим - добавляем обработчики
        if (interactive) {
            makeInteractive(container, normalizedRating, options);
        }

        // Кэшируем неинтерактивные версии
        if (!interactive) {
            cache.set(cacheKey, container.cloneNode(true));
        }

        return container;
    }

    // ===== ИНТЕРАКТИВНЫЙ РЕЖИМ =====
    function makeInteractive(container, initialRating, options) {
        const stars = Array.from(container.querySelectorAll('i'));
        const readonly = options.readonly !== false;
        let currentRating = initialRating;

        // Функция обновления звезд
        function updateStars(rating) {
            stars.forEach((star, index) => {
                if (index < Math.floor(rating)) {
                    star.className = `fas fa-star text-warning ${SIZES[options.size || 'md'].class}`;
                } else if (index === Math.floor(rating) && rating % 1 >= 0.5) {
                    star.className = `fas fa-star-half-alt text-warning ${SIZES[options.size || 'md'].class}`;
                } else {
                    star.className = `far fa-star text-muted ${SIZES[options.size || 'md'].class}`;
                }
            });
        }

        // Добавляем обработчики
        stars.forEach((star, index) => {
            star.addEventListener('click', () => {
                if (readonly) return;
                const newRating = index + 1;
                currentRating = newRating;
                updateStars(newRating);
                if (options.onRate) options.onRate(newRating);
            });

            star.addEventListener('mouseenter', () => {
                if (readonly) return;
                updateStars(index + 1);
            });

            star.addEventListener('mouseleave', () => {
                if (readonly) return;
                updateStars(currentRating);
            });
        });
    }

    // ===== РЕНДЕРИНГ ТОЛЬКО ЧИСЛА =====
    function renderNumber(rating, options = {}) {
        const size = options.size || 'md';
        const sizeConfig = SIZES[size] || SIZES.md;
        
        const span = document.createElement('span');
        span.className = `rating-number ${sizeConfig.class} ${options.class || ''}`;
        span.textContent = (rating || 0).toFixed(1);
        return span;
    }

    // ===== СОЗДАНИЕ ПИКЕРА =====
    function createPicker(container, options = {}) {
        const initialRating = options.initialRating || 0;
        
        const pickerContainer = document.createElement('div');
        pickerContainer.className = 'rating-picker text-center';
        
        const stars = render(initialRating, {
            size: options.size || 'lg',
            showNumber: false,
            interactive: true,
            readonly: false,
            onRate: (rating) => {
                if (options.onRate) options.onRate(rating);
            }
        });
        
        pickerContainer.appendChild(stars);

        if (container) {
            container.appendChild(pickerContainer);
        }

        return pickerContainer;
    }

    // ===== ПУБЛИЧНОЕ API =====
    const api = {
        render,
        renderNumber,
        createPicker,
        SIZES
    };

    window.__STARS_RENDERER_INITIALIZED__ = true;
    console.log('✅ StarsRenderer загружен (безопасная версия)');
    
    return Object.freeze(api);
})();

window.StarsRenderer = StarsRenderer;