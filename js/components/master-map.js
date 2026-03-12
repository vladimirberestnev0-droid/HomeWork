// ============================================
// КОМПОНЕНТ КАРТЫ ДЛЯ КАБИНЕТА МАСТЕРА
// ============================================

const MasterMap = (function() {
    if (window.__MASTER_MAP_INITIALIZED__) return window.MasterMap;

    let map = null;
    let clusterer = null;
    let masterPosition = null;
    let currentRadius = 3;
    let allOrders = [];
    let filteredOrders = [];

    // Центр Нягани
    const CITY_CENTER = [62.1406, 65.3936];
    const DEFAULT_ZOOM = 13;

    // Размеры иконок
    const ICON_SIZES = {
        small: { size: 30, price: 1000, color: '#00A86B' },
        medium: { size: 40, price: 5000, color: '#2CD5C4' },
        large: { size: 50, price: 20000, color: '#FFB020' },
        vip: { size: 65, price: Infinity, color: '#DC3545' }
    };

    // Инициализация карты
    async function init(containerId = 'masterMap') {
        console.log('🗺️ Инициализация карты мастера...');

        if (!window.ymaps) {
            console.warn('⚠️ Яндекс.Карты не загружены');
            return false;
        }

        return new Promise((resolve) => {
            ymaps.ready(async () => {
                try {
                    await getMasterLocation();
                    
                    map = new ymaps.Map(containerId, {
                        center: masterPosition || CITY_CENTER,
                        zoom: DEFAULT_ZOOM,
                        controls: ['zoomControl', 'fullscreenControl', 'geolocationControl']
                    });

                    // Кластеризатор
                    clusterer = new ymaps.Clusterer({
                        preset: 'islands#invertedVioletClusterIcons',
                        clusterDisableClickZoom: false,
                        clusterOpenBalloonOnClick: true,
                        clusterBalloonContentLayout: 'cluster#balloonCarousel',
                        clusterBalloonItemContentLayout: getClusterLayout(),
                        clusterBalloonPagerSize: 5
                    });

                    map.geoObjects.add(clusterer);
                    
                    // Загружаем заказы
                    await loadOrders();
                    
                    console.log('✅ Карта мастера готова');
                    resolve(true);
                } catch (error) {
                    console.error('❌ Ошибка создания карты:', error);
                    resolve(false);
                }
            });
        });
    }

    // Получение местоположения мастера
    function getMasterLocation() {
        return new Promise((resolve) => {
            if (!navigator.geolocation) {
                masterPosition = CITY_CENTER;
                resolve(CITY_CENTER);
                return;
            }

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    masterPosition = [position.coords.latitude, position.coords.longitude];
                    
                    if (map) {
                        const myPlacemark = new ymaps.Placemark(masterPosition, {
                            hintContent: 'Вы здесь',
                            balloonContent: 'Ваше местоположение'
                        }, {
                            preset: 'islands#blueCircleIcon',
                            iconColor: '#2CD5C4'
                        });
                        map.geoObjects.add(myPlacemark);
                    }
                    
                    resolve(masterPosition);
                },
                (error) => {
                    masterPosition = CITY_CENTER;
                    resolve(CITY_CENTER);
                }
            );
        });
    }

    // Загрузка заказов
    async function loadOrders(radius = 3) {
        currentRadius = radius;
        
        try {
            const result = await Orders.getOpenOrders({
                city: 'nyagan'
            }, { limit: 50 });

            allOrders = result.orders || [];
            
            filterOrdersByRadius();
            renderOrders();
            updateStats();

        } catch (error) {
            console.error('❌ Ошибка загрузки заказов:', error);
        }
    }

    // Фильтрация по радиусу
    function filterOrdersByRadius() {
        if (!masterPosition) {
            filteredOrders = allOrders;
            return;
        }

        filteredOrders = allOrders.filter(order => {
            if (!order.coordinates) return false;
            
            const distance = calculateDistance(
                masterPosition,
                [order.coordinates.lat, order.coordinates.lng]
            );
            
            order.distance = distance;
            return distance <= currentRadius;
        });

        filteredOrders.sort((a, b) => a.distance - b.distance);
    }

    // Расчёт расстояния
    function calculateDistance(point1, point2) {
        const [lat1, lon1] = point1;
        const [lat2, lon2] = point2;
        
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return Math.round(R * c * 10) / 10;
    }

    // Отображение заказов
    function renderOrders() {
        if (!clusterer) return;

        clusterer.removeAll();

        const placemarks = filteredOrders.map(order => {
            if (!order.coordinates) return null;

            const size = getIconSize(order.price);
            const color = getIconColor(order.price);
            const distance = order.distance ? `${order.distance} км` : '?';

            return new ymaps.Placemark(
                [order.coordinates.lat, order.coordinates.lng],
                {
                    hintContent: `${order.title} - ${Utils.formatMoney(order.price)}`,
                    balloonContent: `
                        <div class="map-order-balloon">
                            <div class="balloon-category">
                                <i class="fas ${getCategoryIcon(order.category)}"></i>
                                ${getCategoryName(order.category)}
                            </div>
                            <div class="balloon-title">${Utils.escapeHtml(order.title)}</div>
                            <div class="balloon-price" style="color: ${color};">
                                ${Utils.formatMoney(order.price)}
                            </div>
                            <div class="balloon-address">
                                <i class="fas fa-map-marker-alt"></i>
                                ${Utils.escapeHtml(order.address || '')}
                            </div>
                            ${order.distance ? `
                                <div class="balloon-distance">
                                    <i class="fas fa-route"></i>
                                    ${distance} от вас
                                </div>
                            ` : ''}
                            <button class="balloon-respond-btn" 
                                    onclick="MasterMap.respondToOrder('${order.id}')">
                                <i class="fas fa-reply"></i> Откликнуться
                            </button>
                        </div>
                    `
                },
                {
                    iconLayout: 'default#image',
                    iconImageHref: getIconUrl(color),
                    iconImageSize: [size, size],
                    iconImageOffset: [-size/2, -size/2]
                }
            );
        }).filter(pm => pm !== null);

        clusterer.add(placemarks);
    }

    // Размер иконки
    function getIconSize(price) {
        if (price < ICON_SIZES.small.price) return ICON_SIZES.small.size;
        if (price < ICON_SIZES.medium.price) return ICON_SIZES.medium.size;
        if (price < ICON_SIZES.large.price) return ICON_SIZES.large.size;
        return ICON_SIZES.vip.size;
    }

    // Цвет иконки
    function getIconColor(price) {
        if (price < ICON_SIZES.small.price) return ICON_SIZES.small.color;
        if (price < ICON_SIZES.medium.price) return ICON_SIZES.medium.color;
        if (price < ICON_SIZES.large.price) return ICON_SIZES.large.color;
        return ICON_SIZES.vip.color;
    }

    // URL иконки
    function getIconUrl(color) {
        return `https://api-maps.yandex.ru/services/constructor/icon/icon/?params={"color":"${color.replace('#', '')}","size":"medium"}`;
    }

    // Шаблон кластера
    function getClusterLayout() {
        return `
            <div style="padding: 10px; max-width: 200px;">
                <strong>{{ properties.balloonContentHeader }}</strong>
                <div>{{ properties.balloonContentBody }}</div>
            </div>
        `;
    }

    // Обновление статистики
    function updateStats() {
        const totalOrders = filteredOrders.length;
        const totalSum = filteredOrders.reduce((sum, o) => sum + (o.price || 0), 0);
        const avgPrice = totalOrders ? Math.round(totalSum / totalOrders) : 0;

        const totalEl = document.getElementById('mapOrdersTotal');
        if (totalEl) totalEl.textContent = totalOrders;

        const sumEl = document.getElementById('mapOrdersSum');
        if (sumEl) sumEl.textContent = Utils.formatMoney(totalSum);

        const avgEl = document.getElementById('mapOrdersAvg');
        if (avgEl) avgEl.textContent = Utils.formatMoney(avgPrice);
    }

    // Изменение радиуса
    function setRadius(radius) {
        currentRadius = radius;
        filterOrdersByRadius();
        renderOrders();
        updateStats();
        
        document.querySelectorAll('.radius-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.radius == radius);
        });
    }

    // Отклик на заказ
    function respondToOrder(orderId) {
        const order = allOrders.find(o => o.id === orderId);
        if (!order) return;

        if (window.showRespondModal) {
            window.showRespondModal(orderId, order.title, order.category, order.price);
        }
    }

    // Вспомогательные функции
    function getCategoryIcon(category) {
        const icons = {
            'sanitary': 'fa-wrench',
            'electric': 'fa-bolt',
            'repair': 'fa-tools',
            'assembly': 'fa-chair'
        };
        return icons[category] || 'fa-tag';
    }

    function getCategoryName(category) {
        const cat = ORDER_CATEGORIES?.find(c => c.id === category);
        return cat?.name || category || 'Услуга';
    }

    // Очистка
    function destroy() {
        if (map) {
            map.destroy();
            map = null;
            clusterer = null;
        }
    }

    // Публичное API
    const api = {
        init,
        loadOrders,
        setRadius,
        respondToOrder,
        destroy,
        ICON_SIZES
    };

    window.__MASTER_MAP_INITIALIZED__ = true;
    return Object.freeze(api);
})();

window.MasterMap = MasterMap;