// ===== js/services/cdn.js =====
// CDN ДЛЯ ФОТО (сжатие, WebP, ленивая загрузка)

const CDNService = (function() {
    // Конфигурация
    const CONFIG = {
        CDN_URL: 'https://your-cdn.com',
        IMAGE_SIZES: {
            thumbnail: { width: 100, height: 100 },
            small: { width: 300, height: 300 },
            medium: { width: 600, height: 600 },
            large: { width: 1200, height: 1200 }
        },
        SUPPORTED_FORMATS: ['webp', 'jpeg', 'png'],
        QUALITY: 80
    };

    /**
     * Проверка поддержки WebP
     */
    function supportsWebP() {
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        
        // Более надежная проверка
        return canvas.toDataURL('image/webp').indexOf('image/webp') === 5;
    }

    /**
     * Получение оптимального URL изображения
     */
    function getImageUrl(originalUrl, size = 'medium') {
        if (!originalUrl) return null;

        // Если уже с CDN, возвращаем как есть
        if (originalUrl.includes(CONFIG.CDN_URL)) {
            return originalUrl;
        }

        // Проверяем размер
        const dimensions = CONFIG.IMAGE_SIZES[size] || CONFIG.IMAGE_SIZES.medium;

        // Определяем формат
        let format = 'jpeg';
        if (supportsWebP()) {
            format = 'webp';
        }

        // Генерируем путь для CDN
        // В реальном проекте здесь должен быть ваш CDN endpoint
        const cdnUrl = `${CONFIG.CDN_URL}/images/${encodeURIComponent(originalUrl)}`;
        
        // Добавляем параметры
        const params = new URLSearchParams({
            w: dimensions.width,
            h: dimensions.height,
            fit: 'cover',
            format: format,
            quality: CONFIG.QUALITY
        });

        return `${cdnUrl}?${params}`;
    }

    /**
     * Создание ленивой загрузки
     */
    function setupLazyLoading() {
        if ('IntersectionObserver' in window) {
            const imageObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        if (img.dataset.src) {
                            img.src = img.dataset.src;
                        }
                        if (img.dataset.srcset) {
                            img.srcset = img.dataset.srcset;
                        }
                        img.classList.remove('lazy');
                        imageObserver.unobserve(img);
                    }
                });
            }, {
                rootMargin: '50px 0px',
                threshold: 0.01
            });

            document.querySelectorAll('img.lazy').forEach(img => {
                imageObserver.observe(img);
            });
            
            return true;
        } else {
            // Fallback для старых браузеров
            document.querySelectorAll('img.lazy').forEach(img => {
                if (img.dataset.src) {
                    img.src = img.dataset.src;
                }
            });
            return false;
        }
    }

    /**
     * Загрузка и сжатие изображения
     */
    async function compressImage(file, options = {}) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');

                    // Рассчитываем новые размеры
                    let width = img.width;
                    let height = img.height;
                    
                    const maxWidth = options.maxWidth || 1200;
                    const maxHeight = options.maxHeight || 1200;

                    if (width > maxWidth) {
                        height = (height * maxWidth) / width;
                        width = maxWidth;
                    }
                    if (height > maxHeight) {
                        width = (width * maxHeight) / height;
                        height = maxHeight;
                    }

                    // Округляем до целых
                    width = Math.round(width);
                    height = Math.round(height);

                    canvas.width = width;
                    canvas.height = height;

                    // Рисуем и сжимаем
                    ctx.drawImage(img, 0, 0, width, height);
                    
                    canvas.toBlob((blob) => {
                        if (!blob) {
                            reject(new Error('Не удалось сжать изображение'));
                            return;
                        }
                        
                        resolve(new File([blob], file.name.replace(/\.[^/.]+$/, '.jpg'), {
                            type: 'image/jpeg',
                            lastModified: Date.now()
                        }));
                    }, 'image/jpeg', options.quality || 0.8);
                };
                
                img.onerror = () => {
                    reject(new Error('Ошибка загрузки изображения'));
                };
            };
            
            reader.onerror = reject;
        });
    }

    /**
     * Создание превью
     */
    async function createThumbnail(file) {
        return compressImage(file, {
            maxWidth: 200,
            maxHeight: 200,
            quality: 0.7
        });
    }

    /**
     * Пакетная загрузка изображений
     */
    async function uploadImages(files, path, onProgress = null) {
        const results = [];
        const total = files.length;

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            
            try {
                // Сжимаем
                const compressed = await compressImage(file);
                
                // Создаем имя файла
                const timestamp = Date.now();
                const random = Math.random().toString(36).substr(2, 9);
                const fileName = `${timestamp}_${random}.jpg`;
                const storageRef = storage.ref(`${path}/${fileName}`);
                
                // Загружаем
                const uploadTask = storageRef.put(compressed);
                
                // Отслеживаем прогресс
                if (onProgress) {
                    uploadTask.on('state_changed', (snapshot) => {
                        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                        onProgress(i, total, progress);
                    });
                }

                await uploadTask;
                const url = await storageRef.getDownloadURL();
                
                results.push({
                    original: file,
                    url: url,
                    thumbnail: getImageUrl(url, 'thumbnail'),
                    small: getImageUrl(url, 'small'),
                    medium: getImageUrl(url, 'medium'),
                    success: true
                });

            } catch (error) {
                console.error('Ошибка загрузки:', error);
                results.push({
                    original: file,
                    error: error.message,
                    success: false
                });
            }
        }

        return results;
    }

    /**
     * Кэширование изображений
     */
    function precacheImages(urls) {
        if ('caches' in window) {
            caches.open('images-v1').then(cache => {
                urls.forEach(url => {
                    fetch(url, { mode: 'no-cors' }).then(response => {
                        if (response.ok) {
                            cache.put(url, response);
                        }
                    }).catch(err => {
                        console.warn('Не удалось закэшировать:', url, err);
                    });
                });
            });
        }
    }

    /**
     * Получение доминирующего цвета изображения
     */
    function getDominantColor(imageUrl) {
        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            img.src = imageUrl;
            
            // Таймаут на случай ошибки
            const timeout = setTimeout(() => {
                resolve('#cccccc');
            }, 5000);
            
            img.onload = () => {
                clearTimeout(timeout);
                
                try {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    
                    canvas.width = 1;
                    canvas.height = 1;
                    
                    ctx.drawImage(img, 0, 0, 1, 1);
                    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
                    
                    resolve(`rgb(${r}, ${g}, ${b})`);
                } catch (e) {
                    console.warn('Ошибка получения цвета:', e);
                    resolve('#cccccc');
                }
            };
            
            img.onerror = () => {
                clearTimeout(timeout);
                resolve('#cccccc');
            };
        });
    }

    /**
     * Очистка старых изображений из кэша
     */
    function clearOldCache(maxAge = 7 * 24 * 60 * 60 * 1000) { // 7 дней
        if ('caches' in window) {
            caches.open('images-v1').then(cache => {
                cache.keys().then(requests => {
                    requests.forEach(request => {
                        cache.match(request).then(response => {
                            const date = response.headers.get('date');
                            if (date) {
                                const age = Date.now() - new Date(date).getTime();
                                if (age > maxAge) {
                                    cache.delete(request);
                                }
                            }
                        });
                    });
                });
            });
        }
    }

    // Публичное API
    return {
        getImageUrl,
        setupLazyLoading,
        compressImage,
        createThumbnail,
        uploadImages,
        precacheImages,
        getDominantColor,
        supportsWebP,
        clearOldCache
    };
})();

window.CDNService = CDNService;