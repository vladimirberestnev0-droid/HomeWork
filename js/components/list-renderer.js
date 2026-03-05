// ============================================
// УНИВЕРСАЛЬНЫЙ РЕНДЕРЕР СПИСКОВ
// ============================================
const ListRenderer = (function() {
    if (window.__LIST_RENDERER_INITIALIZED__) return window.ListRenderer;

    // Шаблоны по умолчанию
    const DEFAULT_LOADING = `
        <div class="text-center p-5">
            <div class="spinner-glow"></div>
            <p class="mt-3 text-secondary">Загрузка...</p>
        </div>
    `;

    const DEFAULT_EMPTY = `
        <div class="empty-state p-5">
            <i class="fas fa-inbox fa-3x mb-3" style="color: var(--border);"></i>
            <h5>Нет данных</h5>
            <p class="text-secondary">Здесь пока ничего нет</p>
        </div>
    `;

    class ListRenderer {
        constructor(config) {
            this.container = config.container;
            if (!this.container) {
                throw new Error('ListRenderer: container обязателен');
            }

            // Функция загрузки данных
            this.fetchFn = config.fetchFn;
            if (!this.fetchFn) {
                throw new Error('ListRenderer: fetchFn обязательна');
            }

            // Функция рендеринга элемента
            this.renderItem = config.renderItem;
            if (!this.renderItem) {
                throw new Error('ListRenderer: renderItem обязательна');
            }

            // Опции
            this.emptyTemplate = config.emptyTemplate || DEFAULT_EMPTY;
            this.loadingTemplate = config.loadingTemplate || DEFAULT_LOADING;
            this.paginationType = config.paginationType || 'button'; // 'button' или 'scroll'
            this.itemsPerPage = config.itemsPerPage || 10;
            this.autoLoad = config.autoLoad !== false;

            // Состояние
            this.items = [];
            this.lastDoc = null;
            this.hasMore = true;
            this.isLoading = false;
            this.filters = config.initialFilters || {};
            this.sort = config.initialSort || null;
            
            // DOM элементы
            this.loadMoreEl = null;
            this.scrollSentinel = null;
            this.observer = null;

            // Колбэки
            this.onLoadStart = config.onLoadStart || null;
            this.onLoadEnd = config.onLoadEnd || null;
            this.onError = config.onError || null;

            // Инициализация
            if (this.autoLoad) {
                this.load(true);
            }
        }

        // Загрузка данных
        async load(reset = true) {
            if (this.isLoading) return;

            this.isLoading = true;
            if (this.onLoadStart) this.onLoadStart();

            if (reset) {
                this.items = [];
                this.lastDoc = null;
                this.hasMore = true;
                this.container.innerHTML = this.loadingTemplate;
                this.hideLoadMore();
            }

            try {
                const params = {
                    filters: this.filters,
                    sort: this.sort,
                    lastDoc: this.lastDoc,
                    limit: this.itemsPerPage
                };

                const result = await this.fetchFn(params);

                if (!result || !result.items) {
                    throw new Error('fetchFn должна возвращать { items, lastDoc, hasMore }');
                }

                this.lastDoc = result.lastDoc;
                this.hasMore = result.hasMore !== false;
                
                if (reset) {
                    this.items = result.items;
                } else {
                    this.items = [...this.items, ...result.items];
                }

                this.render();

                if (this.onLoadEnd) this.onLoadEnd();
            } catch (error) {
                console.error('ListRenderer error:', error);
                if (this.onError) this.onError(error);
                
                if (reset) {
                    this.container.innerHTML = `
                        <div class="text-center p-5 text-danger">
                            <i class="fas fa-exclamation-triangle fa-3x mb-3"></i>
                            <h5>Ошибка загрузки</h5>
                            <p class="text-secondary">${error.message || 'Попробуйте позже'}</p>
                            <button class="btn btn-outline-primary mt-3" onclick="location.reload()">
                                <i class="fas fa-sync-alt me-2"></i>Обновить
                            </button>
                        </div>
                    `;
                }
            } finally {
                this.isLoading = false;
            }
        }

        // Рендеринг списка
        render() {
            if (this.items.length === 0) {
                this.container.innerHTML = this.emptyTemplate;
                return;
            }

            this.container.innerHTML = this.items.map((item, index) => {
                return this.renderItem(item, index);
            }).join('');

            if (this.hasMore) {
                this.setupLoadMore();
            } else {
                this.hideLoadMore();
            }
        }

        // Настройка подгрузки
        setupLoadMore() {
            if (this.paginationType === 'scroll') {
                this.setupInfiniteScroll();
            } else {
                this.setupLoadMoreButton();
            }
        }

        // Бесконечный скролл
        setupInfiniteScroll() {
            if (this.observer) return;

            this.scrollSentinel = document.createElement('div');
            this.scrollSentinel.className = 'scroll-sentinel';
            this.scrollSentinel.style.height = '20px';
            this.scrollSentinel.style.margin = '20px 0';
            this.scrollSentinel.innerHTML = '<div class="text-center"><div class="spinner-border spinner-border-sm"></div></div>';
            
            this.container.appendChild(this.scrollSentinel);

            this.observer = new IntersectionObserver((entries) => {
                const entry = entries[0];
                if (entry.isIntersecting && !this.isLoading && this.hasMore) {
                    this.load(false);
                }
            }, {
                rootMargin: '100px'
            });

            this.observer.observe(this.scrollSentinel);
        }

        // Кнопка "Загрузить ещё"
        setupLoadMoreButton() {
            if (this.loadMoreEl) return;

            this.loadMoreEl = document.createElement('div');
            this.loadMoreEl.className = 'text-center mt-4 mb-3';
            this.loadMoreEl.innerHTML = `
                <button class="btn btn-outline-primary rounded-pill px-5 py-3 load-more-btn">
                    <i class="fas fa-chevron-down me-2"></i>Показать ещё
                </button>
            `;

            const btn = this.loadMoreEl.querySelector('button');
            btn.addEventListener('click', () => this.load(false));

            this.container.parentNode.insertBefore(this.loadMoreEl, this.container.nextSibling);
        }

        // Скрыть элементы подгрузки
        hideLoadMore() {
            if (this.scrollSentinel) {
                this.scrollSentinel.remove();
                this.scrollSentinel = null;
            }
            if (this.observer) {
                this.observer.disconnect();
                this.observer = null;
            }
            if (this.loadMoreEl) {
                this.loadMoreEl.remove();
                this.loadMoreEl = null;
            }
        }

        // Обновление фильтров
        updateFilters(newFilters) {
            this.filters = { ...this.filters, ...newFilters };
            this.load(true);
        }

        // Обновление сортировки
        updateSort(newSort) {
            this.sort = newSort;
            this.load(true);
        }

        // Добавление элемента в начало (optimistic update)
        prependItem(item) {
            this.items = [item, ...this.items];
            this.render();
        }

        // Добавление элемента в конец
        appendItem(item) {
            this.items = [...this.items, item];
            this.render();
        }

        // Обновление элемента
        updateItem(itemId, newData, idField = 'id') {
            const index = this.items.findIndex(item => item[idField] === itemId);
            if (index !== -1) {
                this.items[index] = { ...this.items[index], ...newData };
                this.render();
            }
        }

        // Удаление элемента
        removeItem(itemId, idField = 'id') {
            this.items = this.items.filter(item => item[idField] !== itemId);
            this.render();
        }

        // Очистка
        destroy() {
            this.hideLoadMore();
            this.container.innerHTML = '';
            this.items = [];
            this.lastDoc = null;
            this.hasMore = true;
        }

        // Получение состояния
        getState() {
            return {
                total: this.items.length,
                hasMore: this.hasMore,
                isLoading: this.isLoading,
                filters: this.filters,
                sort: this.sort
            };
        }
    }

    const api = ListRenderer;

    window.__LIST_RENDERER_INITIALIZED__ = true;
    console.log('✅ ListRenderer загружен');

    return ListRenderer;
})();

window.ListRenderer = ListRenderer;