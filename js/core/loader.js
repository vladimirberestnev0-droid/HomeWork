// ============================================
// УЛУЧШЕННЫЙ ЗАГРУЗЧИК С ОЧЕРЕДЬЮ ЗАДАЧ (ИСПРАВЛЕНО)
// ============================================
(function() {
    if (window.__LOADER_INITIALIZED__) return;
    window.__LOADER_INITIALIZED__ = true;

    const LOADER_ID = 'global-loader';
    const MAX_LOADER_TIME = 20000; // 20 секунд
    const CLEANUP_INTERVAL = 60000; // 1 минута

    let loader = null;
    let originalTitle = document.title;
    
    // Очередь задач: Map<taskId, { text, timeoutId, progress, startTime }>
    const taskQueue = new Map();
    let taskCounter = 0;
    let cleanupTimer = null;

    function ensureLoader() {
        if (loader) return loader;
        
        loader = document.getElementById(LOADER_ID);
        if (!loader) {
            loader = document.createElement('div');
            loader.id = LOADER_ID;
            loader.className = 'global-loader';
            loader.innerHTML = `
                <div class="loader-content">
                    <div class="spinner-glow"></div>
                    <p class="loader-text" id="loader-text">Загрузка...</p>
                    <div class="loader-progress d-none" id="loader-progress">
                        <div class="progress-bar"></div>
                    </div>
                </div>
            `;
            document.body.appendChild(loader);
            addLoaderStyles();
        }
        return loader;
    }

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
            .global-loader.active {
                opacity: 1;
                pointer-events: all;
            }
            .global-loader .loader-content {
                text-align: center;
                transform: translateY(-20px);
                transition: transform 0.3s ease;
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
            .global-loader .loader-progress {
                width: 300px;
                max-width: 80vw;
                height: 4px;
                background: rgba(44, 213, 196, 0.2);
                border-radius: 2px;
                margin-top: 20px;
                overflow: hidden;
            }
            .global-loader .loader-progress .progress-bar {
                height: 100%;
                background: var(--accent, #2CD5C4);
                width: 0%;
                transition: width 0.2s ease;
                border-radius: 2px;
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

    // Запуск периодической очистки
    function startCleanupTimer() {
        if (cleanupTimer) clearInterval(cleanupTimer);
        cleanupTimer = setInterval(() => {
            cleanupStaleTasks();
        }, CLEANUP_INTERVAL);
    }

    function stopCleanupTimer() {
        if (cleanupTimer) {
            clearInterval(cleanupTimer);
            cleanupTimer = null;
        }
    }

    // Очистка зависших задач
    function cleanupStaleTasks() {
        const now = Date.now();
        const staleTimeout = MAX_LOADER_TIME * 2; // 40 секунд
        
        taskQueue.forEach((task, taskId) => {
            if (now - task.startTime > staleTimeout) {
                console.warn(`⚠️ Задача ${taskId} зависла, принудительно удаляем`);
                if (task.timeoutId) clearTimeout(task.timeoutId);
                taskQueue.delete(taskId);
            }
        });
        
        if (taskQueue.size === 0) {
            stopCleanupTimer();
        }
        
        updateLoader();
    }

    // Показать лоадер с задачей (ИСПРАВЛЕНО)
    function show(text = 'Загрузка...', options = {}) {
        const taskId = `task_${++taskCounter}_${Date.now()}`;
        const timeout = options.timeout || MAX_LOADER_TIME;
        const startTime = Date.now();
        
        // Таймаут для автоматического скрытия
        const timeoutId = setTimeout(() => {
            if (taskQueue.has(taskId)) {
                console.warn(`⚠️ Задача ${taskId} превысила таймаут (${timeout}ms)`);
                taskQueue.delete(taskId);
                updateLoader();
                if (taskQueue.size === 0) stopCleanupTimer();
            }
        }, timeout);
        
        taskQueue.set(taskId, {
            text,
            timeoutId,
            progress: options.progress || null,
            startTime
        });
        
        // Запускаем очистку если ещё не запущена
        if (taskQueue.size === 1) {
            startCleanupTimer();
        }
        
        updateLoader();
        return taskId;
    }

    // Скрыть лоадер (по taskId) - ИСПРАВЛЕНО: очистка таймаута
    function hide(taskId) {
        if (taskId) {
            const task = taskQueue.get(taskId);
            if (task && task.timeoutId) {
                clearTimeout(task.timeoutId);
            }
            taskQueue.delete(taskId);
        } else {
            // Если ID не указан, скрываем последнюю задачу
            const lastTask = Array.from(taskQueue.entries()).pop();
            if (lastTask) {
                const [id, task] = lastTask;
                if (task.timeoutId) clearTimeout(task.timeoutId);
                taskQueue.delete(id);
            }
        }
        
        if (taskQueue.size === 0) {
            stopCleanupTimer();
        }
        
        updateLoader();
    }

    // Обновление прогресса задачи
    function updateProgress(taskId, percent) {
        const task = taskQueue.get(taskId);
        if (task) {
            task.progress = Math.min(100, Math.max(0, percent));
            
            const progressEl = document.getElementById('loader-progress');
            const progressBar = progressEl?.querySelector('.progress-bar');
            
            if (progressEl && progressBar) {
                progressEl.classList.remove('d-none');
                progressBar.style.width = `${task.progress}%`;
            }
        }
    }

    // Обновление состояния лоадера
    function updateLoader() {
        const loaderEl = ensureLoader();
        const textEl = document.getElementById('loader-text');
        const progressEl = document.getElementById('loader-progress');
        
        if (taskQueue.size === 0) {
            // Нет активных задач - скрываем
            loaderEl.classList.remove('active');
            document.body.classList.remove('loader-active');
            document.title = originalTitle;
            if (progressEl) progressEl.classList.add('d-none');
        } else {
            // Есть задачи - показываем
            loaderEl.classList.add('active');
            document.body.classList.add('loader-active');
            
            // Показываем текст последней задачи
            const lastTask = Array.from(taskQueue.values()).pop();
            if (textEl) textEl.textContent = lastTask.text;
            
            // Обновляем прогресс
            if (progressEl) {
                if (lastTask.progress !== null) {
                    progressEl.classList.remove('d-none');
                    const progressBar = progressEl.querySelector('.progress-bar');
                    if (progressBar) progressBar.style.width = `${lastTask.progress}%`;
                } else {
                    progressEl.classList.add('d-none');
                }
            }
            
            // Обновляем заголовок
            if (taskQueue.size > 0) {
                document.title = `(${taskQueue.size}) ${originalTitle}`;
            }
        }
    }

    // Выполнить операцию с автоматическим показом/скрытием лоадера
    async function withLoader(promise, text = 'Загрузка...') {
        const taskId = show(text);
        try {
            return await promise;
        } finally {
            hide(taskId);
        }
    }

    // Переход на другую страницу
    function navigateTo(url, text = 'Переходим...') {
        const taskId = show(text);
        setTimeout(() => {
            window.location.href = url;
            // Не вызываем hide, потому что страница перезагрузится
        }, 300);
    }

    // Принудительное скрытие (для аварийных случаев)
    function forceHide() {
        taskQueue.forEach((task, id) => {
            if (task.timeoutId) clearTimeout(task.timeoutId);
        });
        taskQueue.clear();
        stopCleanupTimer();
        updateLoader();
    }

    // Получение состояния
    function getState() {
        return {
            activeTasks: taskQueue.size,
            tasks: Array.from(taskQueue.entries()).map(([id, task]) => ({
                id,
                text: task.text,
                progress: task.progress,
                age: Date.now() - task.startTime
            }))
        };
    }

    const api = {
        show,
        hide,
        updateProgress,
        withLoader,
        navigateTo,
        forceHide,
        getState
    };

    window.Loader = api;

    // Автоинициализация
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            ensureLoader();
            window.addEventListener('load', () => setTimeout(forceHide, 100));
        });
    } else {
        ensureLoader();
        setTimeout(forceHide, 100);
    }

    // Очистка при выгрузке страницы
    window.addEventListener('beforeunload', () => {
        stopCleanupTimer();
        taskQueue.forEach((task, id) => {
            if (task.timeoutId) clearTimeout(task.timeoutId);
        });
        taskQueue.clear();
    });

    console.log('✅ Loader с очередью задач инициализирован (исправленная версия)');
})();