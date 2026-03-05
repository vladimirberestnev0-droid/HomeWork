// ============================================
// РЕНДЕРИНГ ЗВЕЗД РЕЙТИНГА
// ============================================
const StarsRenderer = (function() {
    if (window.__STARS_RENDERER_INITIALIZED__) return window.StarsRenderer;

    // Кэш для часто используемых рейтингов
    const cache = new Map();

    // Размеры
    const SIZES = {
        xs: { class: 'fs-8', width: 12, height: 12 },
        sm: { class: 'fs-7', width: 14, height: 14 },
        md: { class: 'fs-6', width: 16, height: 16 },
        lg: { class: 'fs-4', width: 24, height: 24 },
        xl: { class: 'fs-2', width: 32, height: 32 }
    };

    // Рендеринг звезд
    function render(rating, options = {}) {
        const size = options.size || 'md';
        const showNumber = options.showNumber !== false;
        const interactive = options.interactive || false;
        readonly = options.readonly !== false;
        
        // Нормализуем рейтинг
        const normalizedRating = Math.min(5, Math.max(0, parseFloat(rating) || 0));
        const roundedRating = Math.round(normalizedRating * 2) / 2; // округление до 0.5
        
        const fullStars = Math.floor(roundedRating);
        const hasHalf = roundedRating % 1 !== 0;
        
        // Проверяем кэш
        const cacheKey = `${normalizedRating}_${size}_${showNumber}_${interactive}`;
        if (cache.has(cacheKey) && !interactive) {
            return cache.get(cacheKey);
        }

        const sizeConfig = SIZES[size] || SIZES.md;

        // Генерируем звезды
        let starsHtml = '';
        
        for (let i = 1; i <= 5; i++) {
            const starClass = sizeConfig.class;
            
            if (i <= fullStars) {
                // Полная звезда
                starsHtml += `<i class="fas fa-star text-warning ${starClass}" data-rating="${i}"></i>`;
            } else if (i === fullStars + 1 && hasHalf) {
                // Половина звезды
                starsHtml += `<i class="fas fa-star-half-alt text-warning ${starClass}" data-rating="${i - 0.5}"></i>`;
            } else {
                // Пустая звезда
                starsHtml += `<i class="far fa-star text-muted ${starClass}" data-rating="${i}"></i>`;
            }
        }

        // Добавляем числовое значение
        if (showNumber) {
            starsHtml += `<span class="ms-1 text-secondary ${sizeConfig.class}">${normalizedRating.toFixed(1)}</span>`;
        }

        // Если интерактивный режим
        if (interactive) {
            const wrapper = document.createElement('div');
            wrapper.className = 'stars-interactive d-inline-flex align-items-center';
            wrapper.innerHTML = starsHtml;
            
            // Добавляем обработчики
            const stars = wrapper.querySelectorAll('[data-rating]');
            
            stars.forEach(star => {
                star.addEventListener('click', (e) => {
                    if (readonly) return;
                    const newRating = parseFloat(e.target.dataset.rating);
                    if (options.onRate) options.onRate(newRating);
                    
                    // Обновляем визуал
                    stars.forEach((s, idx) => {
                        const starRating = parseFloat(s.dataset.rating);
                        if (starRating <= newRating) {
                            s.className = `fas fa-star text-warning ${sizeConfig.class}`;
                        } else {
                            s.className = `far fa-star text-muted ${sizeConfig.class}`;
                        }
                    });
                });

                star.addEventListener('mouseenter', (e) => {
                    if (readonly) return;
                    const hoverRating = parseFloat(e.target.dataset.rating);
                    
                    stars.forEach((s, idx) => {
                        const starRating = parseFloat(s.dataset.rating);
                        if (starRating <= hoverRating) {
                            s.className = `fas fa-star text-warning ${sizeConfig.class}`;
                        } else {
                            s.className = `far fa-star text-muted ${sizeConfig.class}`;
                        }
                    });
                });

                wrapper.addEventListener('mouseleave', () => {
                    if (readonly) return;
                    // Возвращаем исходное состояние
                    stars.forEach((s, idx) => {
                        const starRating = parseFloat(s.dataset.rating);
                        if (starRating <= normalizedRating) {
                            s.className = `fas fa-star text-warning ${sizeConfig.class}`;
                        } else {
                            s.className = `far fa-star text-muted ${sizeConfig.class}`;
                        }
                    });
                });
            });

            starsHtml = wrapper.outerHTML;
        }

        const result = `<div class="stars-container d-inline-flex align-items-center">${starsHtml}</div>`;

        // Кэшируем неинтерактивные версии
        if (!interactive) {
            cache.set(cacheKey, result);
        }

        return result;
    }

    // Рендеринг только числа (без звезд)
    function renderNumber(rating, options = {}) {
        const size = options.size || 'md';
        const sizeConfig = SIZES[size] || SIZES.md;
        
        return `<span class="rating-number ${sizeConfig.class} ${options.class || ''}">${(rating || 0).toFixed(1)}</span>`;
    }

    // Создание интерактивного компонента выбора рейтинга
    function createPicker(container, options = {}) {
        const initialRating = options.initialRating || 0;
        const size = options.size || 'lg';
        
        const picker = document.createElement('div');
        picker.className = 'rating-picker text-center';
        picker.innerHTML = render(initialRating, { 
            size, 
            showNumber: false, 
            interactive: true,
            readonly: false,
            onRate: (rating) => {
                if (options.onRate) options.onRate(rating);
            }
        });

        if (container) {
            container.appendChild(picker);
        }

        return picker;
    }

    const api = {
        render,
        renderNumber,
        createPicker,
        SIZES
    };

    window.__STARS_RENDERER_INITIALIZED__ = true;
    console.log('✅ StarsRenderer загружен');

    return Object.freeze(api);
})();

window.StarsRenderer = StarsRenderer;