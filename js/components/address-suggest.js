// ============================================
// КОМПОНЕНТ ПОДСКАЗОК АДРЕСОВ (ЯНДЕКС)
// ============================================

const AddressSuggest = (function() {
    if (window.__ADDRESS_SUGGEST_INITIALIZED__) return window.AddressSuggest;

    let suggestTimer = null;
    let currentSuggestions = [];
    let selectedIndex = -1;
    let onSelectCallback = null;
    let currentInput = null;
    let currentContainer = null;

    // Кэш для подсказок
    const suggestionsCache = new Map();

    // Инициализация поля ввода
    function init(inputId, options = {}) {
        const input = document.getElementById(inputId);
        if (!input) return null;

        const {
            containerClass = 'address-suggest-container',
            itemClass = 'address-suggest-item',
            onSelect = null,
            minChars = 3,
            delay = 300,
            city = 'Нягань'
        } = options;

        onSelectCallback = onSelect;
        currentInput = input;

        // Удаляем старый контейнер если есть
        const oldContainer = document.querySelector(`.${containerClass}`);
        if (oldContainer) oldContainer.remove();

        // Создаём контейнер для подсказок
        let suggestionsContainer = document.createElement('div');
        suggestionsContainer.className = containerClass;
        suggestionsContainer.id = `suggest-${inputId}`;
        input.parentNode.insertBefore(suggestionsContainer, input.nextSibling);
        currentContainer = suggestionsContainer;

        // Добавляем иконку в поле
        input.classList.add('address-input');

        // Обработчик ввода
        input.addEventListener('input', function(e) {
            const query = e.target.value.trim();
            
            if (suggestTimer) clearTimeout(suggestTimer);
            
            if (query.length < minChars) {
                hideSuggestions();
                return;
            }

            suggestTimer = setTimeout(() => {
                fetchSuggestions(query, city, itemClass);
            }, delay);
        });

        // Обработчик клавиш
        input.addEventListener('keydown', function(e) {
            const items = suggestionsContainer.querySelectorAll(`.${itemClass}`);
            
            if (items.length === 0) return;

            switch(e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    selectedIndex = (selectedIndex + 1) % items.length;
                    updateSelectedItem(items);
                    break;
                    
                case 'ArrowUp':
                    e.preventDefault();
                    selectedIndex = (selectedIndex - 1 + items.length) % items.length;
                    updateSelectedItem(items);
                    break;
                    
                case 'Enter':
                    e.preventDefault();
                    if (selectedIndex >= 0 && items[selectedIndex]) {
                        items[selectedIndex].click();
                    }
                    break;
                    
                case 'Escape':
                    hideSuggestions();
                    selectedIndex = -1;
                    break;
            }
        });

        // Прячем при клике вне
        document.addEventListener('click', function(e) {
            if (!input.contains(e.target) && !suggestionsContainer.contains(e.target)) {
                hideSuggestions();
            }
        });

        // Обновляем позицию при скролле
        window.addEventListener('scroll', () => {
            if (suggestionsContainer.style.display === 'block') {
                positionSuggestions();
            }
        });

        // Обновляем позицию при ресайзе
        window.addEventListener('resize', () => {
            if (suggestionsContainer.style.display === 'block') {
                positionSuggestions();
            }
        });

        return {
            input,
            container: suggestionsContainer,
            destroy: () => {
                if (suggestTimer) clearTimeout(suggestTimer);
                suggestionsContainer.remove();
            }
        };
    }

    // Получение подсказок от Яндекса
    async function fetchSuggestions(query, city, itemClass) {
        if (!window.YANDEX_MAPS_API_KEY) {
            console.warn('⚠️ Не указан ключ Яндекс.Карт');
            return;
        }

        try {
            // Проверяем кэш
            const cacheKey = `${city}_${query}`;
            if (suggestionsCache.has(cacheKey)) {
                showSuggestions(suggestionsCache.get(cacheKey), itemClass);
                return;
            }

            // Используем Яндекс.Геокодер
            const url = `https://geocode-maps.yandex.ru/1.x/?` +
                `apikey=${YANDEX_MAPS_API_KEY}&` +
                `geocode=${encodeURIComponent(query + ', ' + city)}&` +
                `format=json&` +
                `results=7&` +
                `lang=ru_RU&` +
                `rspn=1&` + // Ограничиваем область поиска
                `ll=62.1406,65.3936&` + // Центр Нягани
                `spn=0.5,0.5`; // Радиус поиска

            const response = await fetch(url);
            const data = await response.json();
            
            if (!data.response) {
                console.warn('Нет ответа от Яндекса');
                return;
            }

            const suggestions = parseYandexResponse(data);
            
            suggestionsCache.set(cacheKey, suggestions);
            showSuggestions(suggestions, itemClass);

        } catch (error) {
            console.error('Ошибка получения подсказок:', error);
        }
    }

    // Парсинг ответа Яндекса
    function parseYandexResponse(data) {
        const suggestions = [];
        const geoObjects = data.response.GeoObjectCollection.featureMember;

        for (const item of geoObjects) {
            const geo = item.GeoObject;
            const fullAddress = geo.metaDataProperty.GeocoderMetaData.text;
            const coordinates = geo.Point.pos.split(' ').reverse(); // lat, lng
            
            // Извлекаем короткий адрес
            let shortAddress = fullAddress;
            const parts = fullAddress.split(', ');
            
            if (parts.length > 2) {
                shortAddress = parts.slice(0, 2).join(', ');
            }

            // Определяем район
            let district = '';
            const metaData = geo.metaDataProperty.GeocoderMetaData;
            if (metaData.AddressDetails && metaData.AddressDetails.Country) {
                const locality = metaData.AddressDetails.Country.AdministrativeArea?.Locality;
                if (locality && locality.Premise) {
                    district = locality.Premise.PremiseName || '';
                }
            }

            suggestions.push({
                full: fullAddress,
                short: shortAddress,
                district: district,
                coordinates: {
                    lat: parseFloat(coordinates[0]),
                    lng: parseFloat(coordinates[1])
                }
            });
        }

        return suggestions;
    }

    // Показ подсказок
    function showSuggestions(suggestions, itemClass) {
        if (!currentContainer || !currentInput) return;

        if (!suggestions || suggestions.length === 0) {
            hideSuggestions();
            return;
        }

        currentSuggestions = suggestions;
        selectedIndex = -1;

        currentContainer.innerHTML = suggestions.map((s, index) => `
            <div class="${itemClass}" data-index="${index}">
                <div class="suggest-main">
                    <i class="fas fa-map-marker-alt"></i>
                    <span>${escapeHtml(s.short)}</span>
                </div>
                ${s.district ? `
                    <div class="suggest-district">
                        <i class="fas fa-building"></i>
                        ${escapeHtml(s.district)} район
                    </div>
                ` : ''}
                <div class="suggest-full">${escapeHtml(s.full)}</div>
            </div>
        `).join('');

        currentContainer.style.display = 'block';
        positionSuggestions();

        // Добавляем обработчики
        currentContainer.querySelectorAll(`.${itemClass}`).forEach((item, index) => {
            item.addEventListener('click', () => {
                selectSuggestion(suggestions[index]);
            });

            item.addEventListener('mouseenter', () => {
                selectedIndex = index;
                updateSelectedItem(currentContainer.querySelectorAll(`.${itemClass}`));
            });
        });
    }

    // Выбор подсказки
    function selectSuggestion(suggestion) {
        if (!currentInput || !currentContainer) return;

        currentInput.value = suggestion.full;
        currentInput.dataset.lat = suggestion.coordinates.lat;
        currentInput.dataset.lng = suggestion.coordinates.lng;
        currentInput.dataset.addressFull = suggestion.full;
        
        hideSuggestions();
        
        if (onSelectCallback) {
            onSelectCallback(suggestion);
        }
        
        currentInput.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // Позиционирование подсказок
    function positionSuggestions() {
        if (!currentContainer || !currentInput) return;

        const rect = currentInput.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        
        currentContainer.style.top = (rect.bottom + scrollTop) + 'px';
        currentContainer.style.left = rect.left + 'px';
        currentContainer.style.width = rect.width + 'px';
    }

    // Обновление выбранного элемента
    function updateSelectedItem(items) {
        items.forEach((item, index) => {
            if (index === selectedIndex) {
                item.classList.add('selected');
                item.scrollIntoView({ block: 'nearest' });
            } else {
                item.classList.remove('selected');
            }
        });
    }

    // Скрытие подсказок
    function hideSuggestions() {
        if (currentContainer) {
            currentContainer.style.display = 'none';
        }
        selectedIndex = -1;
    }

    // Экранирование HTML
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Очистка кэша
    function clearCache() {
        suggestionsCache.clear();
    }

    // Публичное API
    const api = {
        init,
        clearCache,
        hideSuggestions
    };

    // Добавляем стили
    const style = document.createElement('style');
    style.textContent = `
        .address-suggest-container {
            position: absolute;
            z-index: 10000;
            background: var(--aurora-deep);
            border: 1px solid rgba(44, 213, 196, 0.3);
            border-radius: 16px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            max-height: 300px;
            overflow-y: auto;
            display: none;
            backdrop-filter: blur(10px);
        }

        .address-suggest-item {
            padding: 12px 16px;
            cursor: pointer;
            border-bottom: 1px solid rgba(44, 213, 196, 0.1);
            transition: all 0.2s ease;
        }

        .address-suggest-item:last-child {
            border-bottom: none;
        }

        .address-suggest-item:hover,
        .address-suggest-item.selected {
            background: rgba(44, 213, 196, 0.1);
        }

        .address-suggest-item .suggest-main {
            display: flex;
            align-items: center;
            gap: 10px;
            color: white;
            font-weight: 500;
        }

        .address-suggest-item .suggest-main i {
            color: var(--aurora-accent);
            width: 20px;
        }

        .address-suggest-item .suggest-district {
            margin-left: 30px;
            font-size: 0.85rem;
            color: var(--aurora-text-soft);
        }

        .address-suggest-item .suggest-district i {
            color: var(--aurora-accent);
            font-size: 0.8rem;
            margin-right: 5px;
        }

        .address-suggest-item .suggest-full {
            margin-left: 30px;
            font-size: 0.8rem;
            color: var(--aurora-text-muted);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .address-input {
            padding-left: 45px !important;
            background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="%232CD5C4" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>');
            background-repeat: no-repeat;
            background-position: 15px center;
            background-size: 16px;
        }

        @keyframes suggestFadeIn {
            from {
                opacity: 0;
                transform: translateY(-10px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        .address-suggest-container {
            animation: suggestFadeIn 0.2s ease;
        }
    `;
    document.head.appendChild(style);

    window.__ADDRESS_SUGGEST_INITIALIZED__ = true;
    return Object.freeze(api);
})();

window.AddressSuggest = AddressSuggest;