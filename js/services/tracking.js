// ===== js/services/tracking.js =====
// Трекинг мастера в реальном времени

const Tracking = (function() {
    let watchId = null;
    let currentPosition = null;

    /**
     * Начать отслеживание
     */
    async function startTracking(masterId, orderId) {
        try {
            if (!navigator.geolocation) {
                Helpers.showNotification('❌ Геолокация не поддерживается', 'error');
                return;
            }

            // Запрашиваем разрешение
            const permission = await navigator.permissions.query({ name: 'geolocation' });
            
            if (permission.state === 'denied') {
                throw new Error('Доступ к геолокации запрещён');
            }

            // Начинаем отслеживание
            watchId = navigator.geolocation.watchPosition(
                (position) => updatePosition(masterId, orderId, position),
                (error) => handleLocationError(error),
                {
                    enableHighAccuracy: true,
                    maximumAge: 30000,
                    timeout: 27000
                }
            );

            console.log('📍 Отслеживание начато');
            return { success: true };
            
        } catch (error) {
            console.error('Ошибка отслеживания:', error);
            Helpers.showNotification('❌ ' + error.message, 'error');
            return { success: false, error: error.message };
        }
    }

    /**
     * Обновление позиции
     */
    async function updatePosition(masterId, orderId, position) {
        try {
            const { latitude, longitude, accuracy, speed, heading } = position.coords;
            const timestamp = new Date(position.timestamp);

            currentPosition = {
                lat: latitude,
                lng: longitude,
                accuracy,
                speed: speed || 0,
                heading,
                timestamp
            };

            // Сохраняем в Firebase
            await db.collection('tracking').doc(masterId).set({
                orderId: orderId,
                position: currentPosition,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // Рассчитываем время прибытия если есть целевая точка
            const orderDoc = await db.collection('orders').doc(orderId).get();
            if (!orderDoc.exists) return;
            
            const order = orderDoc.data();
            
            if (order.latitude && order.longitude) {
                const eta = calculateETA(
                    { lat: latitude, lng: longitude },
                    { lat: order.latitude, lng: order.longitude },
                    speed
                );

                if (eta) {
                    await db.collection('tracking').doc(masterId).update({
                        eta: eta,
                        destination: {
                            lat: order.latitude,
                            lng: order.longitude,
                            address: order.address
                        }
                    });
                }
            }

            // Обновляем UI если нужно
            updateTrackingUI(masterId, currentPosition);
            
        } catch (error) {
            console.error('Ошибка обновления позиции:', error);
        }
    }

    /**
     * Расчет времени прибытия
     */
    function calculateETA(from, to, speed) {
        if (!speed || speed < 1) {
            return {
                distance: '...',
                minutes: '...',
                arrival: null
            };
        }

        // Формула гаверсинусов
        const R = 6371; // Радиус Земли в км
        const dLat = (to.lat - from.lat) * Math.PI / 180;
        const dLon = (to.lng - from.lng) * Math.PI / 180;
        
        const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(from.lat * Math.PI / 180) * Math.cos(to.lat * Math.PI / 180) * 
            Math.sin(dLon/2) * Math.sin(dLon/2);
        
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const distance = R * c; // Расстояние в км

        // Время в минутах
        const timeMinutes = (distance / speed) * 60;
        
        return {
            distance: Math.round(distance * 10) / 10,
            minutes: Math.round(timeMinutes),
            arrival: new Date(Date.now() + timeMinutes * 60000)
        };
    }

    /**
     * Получить позицию мастера
     */
    async function getMasterPosition(masterId) {
        try {
            const trackDoc = await db.collection('tracking').doc(masterId).get();
            
            if (!trackDoc.exists) {
                return null;
            }

            return trackDoc.data();
            
        } catch (error) {
            console.error('Ошибка получения позиции:', error);
            return null;
        }
    }

    /**
     * Слушать изменения позиции (для клиента)
     */
    function listenToMasterPosition(masterId, callback) {
        if (!masterId) return () => {};
        
        return db.collection('tracking').doc(masterId)
            .onSnapshot((doc) => {
                if (doc.exists) {
                    callback(doc.data());
                }
            }, (error) => {
                console.error('Ошибка слушателя:', error);
            });
    }

    /**
     * Остановить отслеживание
     */
    function stopTracking() {
        if (watchId !== null) {
            navigator.geolocation.clearWatch(watchId);
            watchId = null;
            console.log('📍 Отслеживание остановлено');
        }
    }

    /**
     * Обновление UI карты
     */
    function updateTrackingUI(masterId, position) {
        // Обновляем карту если есть
        const mapContainer = document.getElementById('trackingMap');
        if (!mapContainer) return;

        if (!window.trackingMap && window.ymaps) {
            // Создаём карту если нет
            window.trackingMap = new ymaps.Map('trackingMap', {
                center: [position.lat, position.lng],
                zoom: 15
            });

            window.trackingMarker = new ymaps.Placemark(
                [position.lat, position.lng],
                { balloonContent: 'Мастер здесь' },
                { preset: 'islands#blueCarIcon' }
            );
            
            window.trackingMap.geoObjects.add(window.trackingMarker);
        } else if (window.trackingMarker) {
            // Обновляем позицию
            window.trackingMarker.geometry.setCoordinates([position.lat, position.lng]);
            if (window.trackingMap) {
                window.trackingMap.setCenter([position.lat, position.lng]);
            }
        }

        // Обновляем ETA
        const etaElement = document.getElementById('masterEta');
        if (etaElement && position.eta) {
            etaElement.innerHTML = `
                🚗 ${position.eta.distance} км • 
                ⏱ ${position.eta.minutes} мин • 
                🕐 ${position.eta.arrival ? position.eta.arrival.toLocaleTimeString() : '...'}
            `;
        }
    }

    /**
     * Обработка ошибок геолокации
     */
    function handleLocationError(error) {
        const messages = {
            1: 'Нет разрешения на геолокацию',
            2: 'Позиция недоступна',
            3: 'Таймаут получения позиции'
        };

        console.error('Ошибка геолокации:', error.code, messages[error.code] || 'Неизвестная ошибка');
        Helpers.showNotification('❌ ' + (messages[error.code] || 'Ошибка геолокации'), 'error');
        stopTracking();
    }

    // Публичное API
    return {
        startTracking,
        stopTracking,
        getMasterPosition,
        listenToMasterPosition
    };
})();

window.Tracking = Tracking;