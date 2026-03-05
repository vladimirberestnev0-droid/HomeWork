// ============================================
// СЕРВИС ЗАГРУЗКИ ФАЙЛОВ (ИСПРАВЛЕНО: валидация по сигнатурам)
// ============================================
const UploadService = (function() {
    if (window.__UPLOAD_SERVICE_INITIALIZED__) return window.UploadService;

    const DEFAULT_OPTIONS = {
        maxSize: 10 * 1024 * 1024, // 10MB
        maxTotalSize: 50 * 1024 * 1024, // 50MB
        maxFiles: 5,
        allowedTypes: [
            'image/jpeg', 'image/png', 'image/gif', 'image/webp',
            'application/pdf', 'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'text/plain'
        ],
        compressImages: true,
        quality: 0.8,
        maxWidth: 1920,
        maxHeight: 1080
    };

    // Магические числа для валидации файлов
    const MAGIC_NUMBERS = {
        'image/jpeg': [
            [0xFF, 0xD8, 0xFF]
        ],
        'image/png': [
            [0x89, 0x50, 0x4E, 0x47]
        ],
        'image/gif': [
            [0x47, 0x49, 0x46, 0x38, 0x37, 0x61],
            [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]
        ],
        'image/webp': [
            [0x52, 0x49, 0x46, 0x46], // RIFF
            // после 4 байт размера должны быть 0x57, 0x45, 0x42, 0x50 (WEBP)
        ],
        'application/pdf': [
            [0x25, 0x50, 0x44, 0x46] // %PDF
        ]
    };

    // Статистика загрузок
    const stats = {
        totalUploads: 0,
        totalBytes: 0,
        failedUploads: 0
    };

    // Чтение заголовка файла (первые байты)
    async function readFileHeader(file, bytes = 8) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const arr = new Uint8Array(e.target.result);
                resolve(arr);
            };
            reader.onerror = reject;
            reader.readAsArrayBuffer(file.slice(0, bytes));
        });
    }

    // Проверка сигнатуры файла
    async function checkFileSignature(file, mimeType) {
        const signatures = MAGIC_NUMBERS[mimeType];
        if (!signatures) return true; // если нет сигнатур для этого типа, пропускаем проверку
        
        try {
            const header = await readFileHeader(file, 16); // читаем 16 байт
            const headerArray = Array.from(header);
            
            // Проверяем каждую сигнатуру
            for (const sig of signatures) {
                let match = true;
                for (let i = 0; i < sig.length; i++) {
                    if (headerArray[i] !== sig[i]) {
                        match = false;
                        break;
                    }
                }
                if (match) return true;
            }
            
            // Специальная проверка для WebP
            if (mimeType === 'image/webp' && headerArray[0] === 0x52 && headerArray[1] === 0x49 && 
                headerArray[2] === 0x46 && headerArray[3] === 0x46) {
                // Проверяем, что после размера идёт WEBP
                if (headerArray[8] === 0x57 && headerArray[9] === 0x45 && 
                    headerArray[10] === 0x42 && headerArray[11] === 0x50) {
                    return true;
                }
            }
            
            return false;
        } catch (error) {
            console.warn('Ошибка чтения сигнатуры файла:', error);
            return false; // при ошибке считаем невалидным
        }
    }

    // Валидация файла (ИСПРАВЛЕНО)
    async function validateFile(file, options = {}) {
        const config = { ...DEFAULT_OPTIONS, ...options };
        const errors = [];

        // Проверка размера
        if (file.size > config.maxSize) {
            errors.push(`Файл слишком большой (макс ${formatBytes(config.maxSize)})`);
        }

        // Проверка типа
        if (!config.allowedTypes.includes(file.type) && !file.type.startsWith('image/')) {
            errors.push(`Неподдерживаемый тип файла: ${file.type || 'неизвестный'}`);
        }

        // Проверка имени (безопасность)
        if (!isValidFileName(file.name)) {
            errors.push('Некорректное имя файла');
        }

        // Проверка сигнатуры (для изображений и PDF)
        if (errors.length === 0 && (file.type.startsWith('image/') || file.type === 'application/pdf')) {
            const validSignature = await checkFileSignature(file, file.type);
            if (!validSignature) {
                errors.push('Файл повреждён или имеет неверный формат');
            }
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    // Валидация имени файла (защита от path traversal)
    function isValidFileName(name) {
        return /^[^\\/:*?"<>|]+$/.test(name) && !name.startsWith('.') && name.length > 0 && name.length < 255;
    }

    // Форматирование байт
    function formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

    // Сжатие изображения
    async function compressImage(file, options = {}) {
        const config = { ...DEFAULT_OPTIONS, ...options };
        
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                
                img.onload = () => {
                    // Вычисляем новые размеры
                    let width = img.width;
                    let height = img.height;
                    
                    if (width > config.maxWidth) {
                        height = (config.maxWidth / width) * height;
                        width = config.maxWidth;
                    }
                    
                    if (height > config.maxHeight) {
                        width = (config.maxHeight / height) * width;
                        height = config.maxHeight;
                    }
                    
                    // Создаем canvas
                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    
                    // Конвертируем в blob
                    canvas.toBlob((blob) => {
                        const compressedFile = new File([blob], file.name, {
                            type: file.type,
                            lastModified: Date.now()
                        });
                        
                        // Добавляем оригинальный размер для информации
                        compressedFile.originalSize = file.size;
                        compressedFile.compressedSize = blob.size;
                        compressedFile.compressionRatio = ((file.size - blob.size) / file.size * 100).toFixed(1);
                        
                        resolve(compressedFile);
                    }, file.type, config.quality);
                };
                
                img.onerror = reject;
            };
            
            reader.onerror = reject;
        });
    }

    // Загрузка одного файла (ИСПРАВЛЕНО: асинхронная валидация)
    async function uploadFile(file, path, options = {}) {
        const config = { ...DEFAULT_OPTIONS, ...options };
        
        // Валидация (теперь асинхронная)
        const validation = await validateFile(file, config);
        if (!validation.valid) {
            stats.failedUploads++;
            throw new Error(validation.errors.join(', '));
        }

        let fileToUpload = file;

        // Сжатие для изображений
        if (config.compressImages && file.type.startsWith('image/')) {
            try {
                fileToUpload = await compressImage(file, config);
                console.log(`📸 Сжатие: ${formatBytes(file.size)} → ${formatBytes(fileToUpload.size)} (${fileToUpload.compressionRatio}%)`);
            } catch (error) {
                console.warn('⚠️ Ошибка сжатия, загружаем оригинал:', error);
            }
        }

        // Генерация безопасного имени
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 8);
        const safeName = fileToUpload.name
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-zA-Z0-9.]/g, '_')
            .toLowerCase();
        
        const fileName = `${timestamp}_${random}_${safeName}`;
        const fullPath = `${path}/${fileName}`;

        // Загрузка
        return new Promise((resolve, reject) => {
            const uploadTask = firebase.storage().ref(fullPath).put(fileToUpload);
            
            let lastProgress = 0;
            
            uploadTask.on(
                'state_changed',
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    
                    // Вызываем колбэк прогресса не чаще чем раз в 100ms
                    if (options.onProgress && Math.abs(progress - lastProgress) > 1) {
                        lastProgress = progress;
                        options.onProgress(progress, fileToUpload.name);
                    }
                },
                (error) => {
                    stats.failedUploads++;
                    reject(error);
                },
                async () => {
                    const url = await uploadTask.snapshot.ref.getDownloadURL();
                    
                    stats.totalUploads++;
                    stats.totalBytes += fileToUpload.size;
                    
                    resolve({
                        url,
                        name: file.name,
                        size: fileToUpload.size,
                        originalSize: fileToUpload.originalSize,
                        type: file.type,
                        path: fullPath,
                        uploadedAt: new Date().toISOString()
                    });
                }
            );
        });
    }

    // Загрузка нескольких файлов
    async function uploadMultiple(files, path, options = {}) {
        const config = { ...DEFAULT_OPTIONS, ...options };
        
        // Проверка количества файлов
        if (files.length > config.maxFiles) {
            throw new Error(`Максимум ${config.maxFiles} файлов`);
        }

        // Проверка общего размера
        const totalSize = files.reduce((sum, file) => sum + file.size, 0);
        if (totalSize > config.maxTotalSize) {
            throw new Error(`Общий размер файлов превышает ${formatBytes(config.maxTotalSize)}`);
        }

        const results = [];
        const errors = [];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            try {
                // Прогресс по каждому файлу
                const fileOptions = {
                    ...options,
                    onProgress: (progress, fileName) => {
                        if (options.onFileProgress) {
                            options.onFileProgress(i, progress, fileName);
                        }
                    }
                };
                
                const result = await uploadFile(file, path, fileOptions);
                results.push(result);
                
                // Общий прогресс
                if (options.onTotalProgress) {
                    const overallProgress = ((i + 1) / files.length) * 100;
                    options.onTotalProgress(overallProgress);
                }
            } catch (error) {
                errors.push({ file: file.name, error: error.message });
                stats.failedUploads++;
            }
        }

        return {
            success: results,
            failed: errors,
            totalSuccess: results.length,
            totalFailed: errors.length
        };
    }

    // Удаление файла
    async function deleteFile(path) {
        try {
            await firebase.storage().ref(path).delete();
            return { success: true, path };
        } catch (error) {
            console.error('Ошибка удаления файла:', error);
            return { success: false, error: error.message };
        }
    }

    // Получение статистики
    function getStats() {
        return { ...stats };
    }

    // Сброс статистики
    function resetStats() {
        stats.totalUploads = 0;
        stats.totalBytes = 0;
        stats.failedUploads = 0;
    }

    const api = {
        uploadFile,
        uploadMultiple,
        deleteFile,
        compressImage,
        validateFile,
        formatBytes,
        getStats,
        resetStats,
        DEFAULT_OPTIONS
    };

    window.__UPLOAD_SERVICE_INITIALIZED__ = true;
    console.log('✅ UploadService загружен (исправленная версия с проверкой сигнатур)');
    
    return Object.freeze(api);
})();

window.UploadService = UploadService;