// ===== js/core/constants.js =====
// Глобальные константы проекта

// Роли пользователей
const USER_ROLE = {
    CLIENT: 'client',
    MASTER: 'master',
    ADMIN: 'admin'
};

// Статусы заказов
const ORDER_STATUS = {
    OPEN: 'open',
    IN_PROGRESS: 'in_progress',
    COMPLETED: 'completed'
};

// Настройки пагинации
const PAGINATION = {
    ORDERS_PER_PAGE: 20,
    MASTERS_PER_PAGE: 10,
    MESSAGES_PER_PAGE: 50,
    RESPONSES_PER_PAGE: 20,
    ORDERS_INITIAL: 10,
    ORDERS_LOAD_MORE: 5
};

// ID администратора
const ADMIN_UID = "dUUNkDJbXmN3efOr3JPKOyBrc8M2";

// Цвета для уведомлений и тем
const COLORS = {
    accent: '#E67A4B',
    success: '#00A86B',
    warning: '#FFB020',
    danger: '#DC3545',
    info: '#0984e3'
};

// Категории заказов с иконками
const ORDER_CATEGORIES = [
    { id: 'all', name: 'Все', icon: 'fa-list-ul' },
    { id: 'Сантехника', name: 'Сантехника', icon: 'fa-wrench' },
    { id: 'Электрика', name: 'Электрика', icon: 'fa-bolt' },
    { id: 'Отделочные работы', name: 'Отделочные работы', icon: 'fa-paint-roller' },
    { id: 'Мебель', name: 'Мебель', icon: 'fa-couch' },
    { id: 'Окна и двери', name: 'Окна и двери', icon: 'fa-window-maximize' },
    { id: 'Бытовой ремонт', name: 'Бытовой ремонт', icon: 'fa-tools' },
    { id: 'Клининг', name: 'Клининг', icon: 'fa-broom' },
    { id: 'Ремонт техники', name: 'Ремонт техники', icon: 'fa-gear' }
];

// Иконки для категорий (для обратной совместимости)
const CATEGORY_ICONS = {
    'Сантехника': 'fa-wrench',
    'Электрика': 'fa-bolt',
    'Отделочные работы': 'fa-paint-roller',
    'Мебель': 'fa-couch',
    'Окна и двери': 'fa-window-maximize',
    'Бытовой ремонт': 'fa-tools',
    'Клининг': 'fa-broom',
    'Ремонт техники': 'fa-gear'
};

// ПОЛНЫЙ СПИСОК НАСЕЛЕННЫХ ПУНКТОВ ХМАО ПО РАЙОНАМ
const CITIES_BY_DISTRICT = {
    'Все города': [
        { id: 'all', name: 'Все города', icon: 'fa-map-marker-alt' }
    ],
    '🏙️ ГОРОДА ОКРУЖНОГО ПОДЧИНЕНИЯ': [
        { id: 'beloyarsky', name: 'Белоярский', icon: 'fa-city' },
        { id: 'kogalym', name: 'Когалым', icon: 'fa-city' },
        { id: 'langepas', name: 'Лангепас', icon: 'fa-city' },
        { id: 'lyantor', name: 'Лянтор', icon: 'fa-city' },
        { id: 'megion', name: 'Мегион', icon: 'fa-city' },
        { id: 'nefteyugansk', name: 'Нефтеюганск', icon: 'fa-city' },
        { id: 'nizhnevartovsk', name: 'Нижневартовск', icon: 'fa-city' },
        { id: 'nyagan', name: 'Нягань', icon: 'fa-city' },
        { id: 'pokachi', name: 'Покачи', icon: 'fa-city' },
        { id: 'pyt-yakh', name: 'Пыть-Ях', icon: 'fa-city' },
        { id: 'raduzhny', name: 'Радужный', icon: 'fa-city' },
        { id: 'sovetsky', name: 'Советский', icon: 'fa-city' },
        { id: 'surgut', name: 'Сургут', icon: 'fa-city' },
        { id: 'uray', name: 'Урай', icon: 'fa-city' },
        { id: 'khanty-mansiysk', name: 'Ханты-Мансийск', icon: 'fa-city' },
        { id: 'yugorsk', name: 'Югорск', icon: 'fa-city' }
    ],
    '🏘️ ПОСЕЛКИ ГОРОДСКОГО ТИПА': [
        { id: 'agirish', name: 'Агириш', icon: 'fa-building' },
        { id: 'andra', name: 'Андра', icon: 'fa-building' },
        { id: 'barsovo', name: 'Барсово', icon: 'fa-building' },
        { id: 'bely-yar', name: 'Белый Яр', icon: 'fa-building' },
        { id: 'berezovo', name: 'Берёзово', icon: 'fa-building' },
        { id: 'vysoky', name: 'Высокий', icon: 'fa-building' },
        { id: 'zelenoborsk', name: 'Зеленоборск', icon: 'fa-building' },
        { id: 'igrim', name: 'Игрим', icon: 'fa-building' },
        { id: 'izluchinsk', name: 'Излучинск', icon: 'fa-building' },
        { id: 'kommunistichesky', name: 'Коммунистический', icon: 'fa-building' },
        { id: 'kondinskoe', name: 'Кондинское', icon: 'fa-building' },
        { id: 'kuminsky', name: 'Куминский', icon: 'fa-building' },
        { id: 'lugovoy', name: 'Луговой', icon: 'fa-building' },
        { id: 'malinovsky', name: 'Малиновский', icon: 'fa-building' },
        { id: 'mezhdurechensky', name: 'Междуреченский', icon: 'fa-building' },
        { id: 'mortka', name: 'Мортка', icon: 'fa-building' },
        { id: 'novoagansk', name: 'Новоаганск', icon: 'fa-building' },
        { id: 'oktyabrskoe', name: 'Октябрьское', icon: 'fa-building' },
        { id: 'pionersky', name: 'Пионерский', icon: 'fa-building' },
        { id: 'poykovsky', name: 'Пойковский', icon: 'fa-building' },
        { id: 'priobye', name: 'Приобье', icon: 'fa-building' },
        { id: 'tayozhny', name: 'Таёжный', icon: 'fa-building' },
        { id: 'talinka', name: 'Талинка', icon: 'fa-building' },
        { id: 'fyodorovsky', name: 'Фёдоровский', icon: 'fa-building' }
    ],
    '📍 БЕЛОЯРСКИЙ РАЙОН': [
        { id: 'vanzewat', name: 'Ванзеват', icon: 'fa-tree' },
        { id: 'verkhnekazymsky', name: 'Верхнеказымский', icon: 'fa-tree' },
        { id: 'kazym', name: 'Казым', icon: 'fa-tree' },
        { id: 'lykhma', name: 'Лыхма', icon: 'fa-tree' },
        { id: 'numto', name: 'Нумто', icon: 'fa-tree' },
        { id: 'pashtory', name: 'Пашторы', icon: 'fa-tree' },
        { id: 'polnovat', name: 'Полноват', icon: 'fa-tree' },
        { id: 'sorum', name: 'Сорум', icon: 'fa-tree' },
        { id: 'sosnovka', name: 'Сосновка', icon: 'fa-tree' },
        { id: 'tugiyany', name: 'Тугияны', icon: 'fa-tree' },
        { id: 'yuilsk', name: 'Юильск', icon: 'fa-tree' }
    ],
    '📍 БЕРЁЗОВСКИЙ РАЙОН': [
        { id: 'aneeva', name: 'Анеева', icon: 'fa-tree' },
        { id: 'vanzetur', name: 'Ванзетур', icon: 'fa-tree' },
        { id: 'verkhnenildina', name: 'Верхненильдина', icon: 'fa-tree' },
        { id: 'deminskaya', name: 'Деминская', icon: 'fa-tree' },
        { id: 'kimkyasuy', name: 'Кимкьясуй', icon: 'fa-tree' },
        { id: 'lombovozh', name: 'Ломбовож', icon: 'fa-tree' },
        { id: 'nerokhi', name: 'Нерохи', icon: 'fa-tree' },
        { id: 'nyaksimvol', name: 'Няксимволь', icon: 'fa-tree' },
        { id: 'ripolyarny', name: 'Приполярный', icon: 'fa-tree' },
        { id: 'pugory', name: 'Пугоры', icon: 'fa-tree' },
        { id: 'ranpaul', name: 'Саранпауль', icon: 'fa-tree' },
        { id: 'rtynya', name: 'Сартынья', icon: 'fa-tree' },
        { id: 'svetly', name: 'Светлый', icon: 'fa-tree' },
        { id: 'sosva', name: 'Сосьва', icon: 'fa-tree' },
        { id: 'tegi', name: 'Теги', icon: 'fa-tree' },
        { id: 'ustryom', name: 'Устрём', icon: 'fa-tree' },
        { id: 'ust-manya', name: 'Усть-Манья', icon: 'fa-tree' },
        { id: 'khulimsunt', name: 'Хулимсунт', icon: 'fa-tree' },
        { id: 'khurumpaul', name: 'Хурумпауль', icon: 'fa-tree' },
        { id: 'shaitanka', name: 'Шайтанка', icon: 'fa-tree' },
        { id: 'shchekurya', name: 'Щекурья', icon: 'fa-tree' },
        { id: 'yasunt', name: 'Ясунт', icon: 'fa-tree' }
    ],
    '📍 КОНДИНСКИЙ РАЙОН': [
        { id: 'altay', name: 'Алтай', icon: 'fa-tree' },
        { id: 'bolchary', name: 'Болчары', icon: 'fa-tree' },
        { id: 'dalny', name: 'Дальний', icon: 'fa-tree' },
        { id: 'ilichevka', name: 'Ильичевка', icon: 'fa-tree' },
        { id: 'kama', name: 'Кама', icon: 'fa-tree' },
        { id: 'karym', name: 'Карым', icon: 'fa-tree' },
        { id: 'leushi', name: 'Леуши', icon: 'fa-tree' },
        { id: 'listvenichny', name: 'Лиственичный', icon: 'fa-tree' },
        { id: 'mulymya', name: 'Мулымья', icon: 'fa-tree' },
        { id: 'nazarovo', name: 'Назарово', icon: 'fa-tree' },
        { id: 'nikulkina', name: 'Никулкина', icon: 'fa-tree' },
        { id: 'polovinka', name: 'Половинка', icon: 'fa-tree' },
        { id: 'sotnik', name: 'Сотник', icon: 'fa-tree' },
        { id: 'stary-katysh', name: 'Старый Катыш', icon: 'fa-tree' },
        { id: 'supra', name: 'Супра', icon: 'fa-tree' },
        { id: 'ushya', name: 'Ушья', icon: 'fa-tree' },
        { id: 'chantyrya', name: 'Чантырья', icon: 'fa-tree' },
        { id: 'shaim', name: 'Шаим', icon: 'fa-tree' },
        { id: 'shugur', name: 'Шугур', icon: 'fa-tree' },
        { id: 'yumas', name: 'Юмас', icon: 'fa-tree' },
        { id: 'yagodny', name: 'Ягодный', icon: 'fa-tree' },
        { id: 'yamki', name: 'Ямки', icon: 'fa-tree' }
    ],
    '📍 НЕФТЕЮГАНСКИЙ РАЙОН': [
        { id: 'karkateevy', name: 'Каркатеевы', icon: 'fa-tree' },
        { id: 'kut-yakh', name: 'Куть-Ях', icon: 'fa-tree' },
        { id: 'lempino', name: 'Лемпино', icon: 'fa-tree' },
        { id: 'salym', name: 'Салым', icon: 'fa-tree' },
        { id: 'sentyabrsky', name: 'Сентябрьский', icon: 'fa-tree' },
        { id: 'sivys-yakh', name: 'Сивысь-Ях', icon: 'fa-tree' },
        { id: 'singapay', name: 'Сингапай', icon: 'fa-tree' },
        { id: 'ust-yugan', name: 'Усть-Юган', icon: 'fa-tree' },
        { id: 'cheuskino', name: 'Чеускино', icon: 'fa-tree' },
        { id: 'yuganskaya-ob', name: 'Юганская Обь', icon: 'fa-tree' }
    ],
    '📍 НИЖНЕВАРТОВСКИЙ РАЙОН': [
        { id: 'agan', name: 'Аган', icon: 'fa-tree' },
        { id: 'bolshetarkhovo', name: 'Большетархово', icon: 'fa-tree' },
        { id: 'bolshoy-laryak', name: 'Большой Ларьяк', icon: 'fa-tree' },
        { id: 'bylino', name: 'Былино', icon: 'fa-tree' },
        { id: 'vampugol', name: 'Вампугол', icon: 'fa-tree' },
        { id: 'varyogan', name: 'Варьеган', icon: 'fa-tree' },
        { id: 'vata', name: 'Вата', icon: 'fa-tree' },
        { id: 'vakhovsk', name: 'Ваховск', icon: 'fa-tree' },
        { id: 'zaitseva-rechka', name: 'Зайцева Речка', icon: 'fa-tree' },
        { id: 'korliki', name: 'Корлики', icon: 'fa-tree' },
        { id: 'laryak', name: 'Ларьяк', icon: 'fa-tree' },
        { id: 'okhteurye', name: 'Охтеурье', icon: 'fa-tree' },
        { id: 'pasol', name: 'Пасол', icon: 'fa-tree' },
        { id: 'pokur', name: 'Покур', icon: 'fa-tree' },
        { id: 'sosnina', name: 'Соснина', icon: 'fa-tree' },
        { id: 'sosnovy-bor', name: 'Сосновый Бор', icon: 'fa-tree' },
        { id: 'cheklomey', name: 'Чехломей', icon: 'fa-tree' }
    ],
    '📍 ОКТЯБРЬСКИЙ РАЙОН': [
        { id: 'bolshie-leushi', name: 'Большие Леуши', icon: 'fa-tree' },
        { id: 'bolshoy-atlym', name: 'Большой Атлым', icon: 'fa-tree' },
        { id: 'bolshoy-kamen', name: 'Большой Камень', icon: 'fa-tree' },
        { id: 'verkhnie-narykary', name: 'Верхние Нарыкары', icon: 'fa-tree' },
        { id: 'gornorechensk', name: 'Горнореченск', icon: 'fa-tree' },
        { id: 'zarechny', name: 'Заречный', icon: 'fa-tree' },
        { id: 'kamennoe', name: 'Каменное', icon: 'fa-tree' },
        { id: 'karymkary', name: 'Карымкары', icon: 'fa-tree' },
        { id: 'komsomolsky', name: 'Комсомольский', icon: 'fa-tree' },
        { id: 'kormuzhikhanka', name: 'Кормужиханка', icon: 'fa-tree' },
        { id: 'maly-atlym', name: 'Малый Атлым', icon: 'fa-tree' },
        { id: 'nizhnie-narykary', name: 'Нижние Нарыкары', icon: 'fa-tree' },
        { id: 'palyanovo', name: 'Пальяново', icon: 'fa-tree' },
        { id: 'peregrebnoe', name: 'Перегрёбное', icon: 'fa-tree' },
        { id: 'sergino', name: 'Сергино', icon: 'fa-tree' },
        { id: 'un-yugan', name: 'Унъюган', icon: 'fa-tree' },
        { id: 'shekaly', name: 'Шеркалы', icon: 'fa-tree' }
    ],
    '📍 СОВЕТСКИЙ РАЙОН': [
        { id: 'alyabyevsky', name: 'Алябьевский', icon: 'fa-tree' },
        { id: 'nyurikh', name: 'Нюрих', icon: 'fa-tree' },
        { id: 'timkapaul', name: 'Тимкапауль', icon: 'fa-tree' },
        { id: 'yubileyny', name: 'Юбилейный', icon: 'fa-tree' }
    ],
    '📍 СУРГУТСКИЙ РАЙОН': [
        { id: 'banny', name: 'Банный', icon: 'fa-tree' },
        { id: 'verkhne-mysovaya', name: 'Верхне-Мысовая', icon: 'fa-tree' },
        { id: 'vysoky-mys', name: 'Высокий Мыс', icon: 'fa-tree' },
        { id: 'gorny', name: 'Горный', icon: 'fa-tree' },
        { id: 'kayukova', name: 'Каюкова', icon: 'fa-tree' },
        { id: 'kochevaya', name: 'Кочевая', icon: 'fa-tree' },
        { id: 'lokosovo', name: 'Локосово', icon: 'fa-tree' },
        { id: 'lyamina', name: 'Лямина', icon: 'fa-tree' },
        { id: 'maloyugansky', name: 'Малоюганский', icon: 'fa-tree' },
        { id: 'nizhnesortymsky', name: 'Нижнесортымский', icon: 'fa-tree' },
        { id: 'peschany', name: 'Песчаный', icon: 'fa-tree' },
        { id: 'russkinskaya', name: 'Русскинская', icon: 'fa-tree' },
        { id: 'saygatina', name: 'Сайгатина', icon: 'fa-tree' },
        { id: 'solnechny', name: 'Солнечный', icon: 'fa-tree' },
        { id: 'sytomino', name: 'Сытомино', icon: 'fa-tree' },
        { id: 'taylakova', name: 'Тайлакова', icon: 'fa-tree' },
        { id: 'taurova', name: 'Таурова', icon: 'fa-tree' },
        { id: 'trom-agan', name: 'Тром-Аган', icon: 'fa-tree' },
        { id: 'tundrino', name: 'Тундрино', icon: 'fa-tree' },
        { id: 'ugut', name: 'Угут', icon: 'fa-tree' },
        { id: 'ult-yagun', name: 'Ульт-Ягун', icon: 'fa-tree' },
        { id: 'yugan', name: 'Юган', icon: 'fa-tree' }
    ],
    '📍 ХАНТЫ-МАНСИЙСКИЙ РАЙОН': [
        { id: 'bazyany', name: 'Базьяны', icon: 'fa-tree' },
        { id: 'batovo', name: 'Батово', icon: 'fa-tree' },
        { id: 'belogorye', name: 'Белогорье', icon: 'fa-tree' },
        { id: 'bobrovsky', name: 'Бобровский', icon: 'fa-tree' },
        { id: 'vykatnoy', name: 'Выкатной', icon: 'fa-tree' },
        { id: 'gornopravdinsk', name: 'Горноправдинск', icon: 'fa-tree' },
        { id: 'dolgoe-pleso', name: 'Долгое Плесо', icon: 'fa-tree' },
        { id: 'elizarovo', name: 'Елизарово', icon: 'fa-tree' },
        { id: 'zenkovo', name: 'Зенково', icon: 'fa-tree' },
        { id: 'kedrovy', name: 'Кедровый', icon: 'fa-tree' },
        { id: 'kirpichny', name: 'Кирпичный', icon: 'fa-tree' },
        { id: 'krasnoleninsky', name: 'Красноленинский', icon: 'fa-tree' },
        { id: 'kyshik', name: 'Кышик', icon: 'fa-tree' },
        { id: 'lugovskoy', name: 'Луговской', icon: 'fa-tree' },
        { id: 'lugofilinskaya', name: 'Лугофилинская', icon: 'fa-tree' },
        { id: 'nyalina', name: 'Нялина', icon: 'fa-tree' },
        { id: 'nyalinskoe', name: 'Нялинское', icon: 'fa-tree' },
        { id: 'pyryakh', name: 'Пырьях', icon: 'fa-tree' },
        { id: 'repolovo', name: 'Реполово', icon: 'fa-tree' },
        { id: 'seliyarovo', name: 'Селиярово', icon: 'fa-tree' },
        { id: 'semeyka', name: 'Семейка', icon: 'fa-tree' },
        { id: 'sibirsky', name: 'Сибирский', icon: 'fa-tree' },
        { id: 'skripunova', name: 'Скрипунова', icon: 'fa-tree' },
        { id: 'sogom', name: 'Согом', icon: 'fa-tree' },
        { id: 'sukhorukova', name: 'Сухорукова', icon: 'fa-tree' },
        { id: 'troitsa', name: 'Троица', icon: 'fa-tree' },
        { id: 'tyuli', name: 'Тюли', icon: 'fa-tree' },
        { id: 'urmanny', name: 'Урманный', icon: 'fa-tree' },
        { id: 'tsingaly', name: 'Цингалы', icon: 'fa-tree' },
        { id: 'chembakchina', name: 'Чембакчина', icon: 'fa-tree' },
        { id: 'shapsha', name: 'Шапша', icon: 'fa-tree' },
        { id: 'yaguryakh', name: 'Ягурьях', icon: 'fa-tree' },
        { id: 'yarki', name: 'Ярки', icon: 'fa-tree' }
    ]
};

// ========== НОВЫЙ КОД: СОРТИРОВКА И ГРУППИРОВКА ==========

// 1. Создаем ОТСОРТИРОВАННЫЙ массив всех городов (для обратной совместимости)
const ALL_CITIES_SORTED = [];

// Собираем все города (кроме 'Все города')
Object.keys(CITIES_BY_DISTRICT).forEach(district => {
    if (district !== 'Все города') {
        CITIES_BY_DISTRICT[district].forEach(city => {
            if (city.id !== 'all') {
                ALL_CITIES_SORTED.push({
                    id: city.id,
                    name: city.name,
                    district: district,
                    icon: city.icon || 'fa-map-marker-alt'
                });
            }
        });
    }
});

// Сортируем все города по алфавиту (для быстрого поиска)
ALL_CITIES_SORTED.sort((a, b) => a.name.localeCompare(b.name, 'ru'));

// 2. Создаем плоский массив CITIES с "Все города" в начале и отсортированными остальными
const CITIES = [
    { id: 'all', name: 'Все города', icon: 'fa-map-marker-alt' },
    ...ALL_CITIES_SORTED.map(c => ({ id: c.id, name: c.name, icon: c.icon }))
];

// 3. Создаем ОТСОРТИРОВАННУЮ версию CITIES_BY_DISTRICT (для группировки в UI)
const SORTED_CITIES_BY_DISTRICT = {};

// Порядок районов для отображения
const DISTRICT_ORDER = [
    'Все города',
    '🏙️ ГОРОДА ОКРУЖНОГО ПОДЧИНЕНИЯ',
    '🏘️ ПОСЕЛКИ ГОРОДСКОГО ТИПА',
    '📍 БЕЛОЯРСКИЙ РАЙОН',
    '📍 БЕРЁЗОВСКИЙ РАЙОН',
    '📍 КОНДИНСКИЙ РАЙОН',
    '📍 НЕФТЕЮГАНСКИЙ РАЙОН',
    '📍 НИЖНЕВАРТОВСКИЙ РАЙОН',
    '📍 ОКТЯБРЬСКИЙ РАЙОН',
    '📍 СОВЕТСКИЙ РАЙОН',
    '📍 СУРГУТСКИЙ РАЙОН',
    '📍 ХАНТЫ-МАНСИЙСКИЙ РАЙОН'
];

// Сортируем города внутри каждого района
DISTRICT_ORDER.forEach(district => {
    if (CITIES_BY_DISTRICT[district]) {
        // Копируем массив городов района
        const districtCities = [...CITIES_BY_DISTRICT[district]];
        
        // Сортируем города внутри района (кроме 'Все города')
        if (district !== 'Все города') {
            districtCities.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
        }
        
        SORTED_CITIES_BY_DISTRICT[district] = districtCities;
    }
});

// Добавляем оставшиеся районы (на всякий случай)
Object.keys(CITIES_BY_DISTRICT).forEach(district => {
    if (!DISTRICT_ORDER.includes(district) && district !== 'Все города') {
        const districtCities = [...CITIES_BY_DISTRICT[district]];
        districtCities.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
        SORTED_CITIES_BY_DISTRICT[district] = districtCities;
    }
});

// ========== ЭКСПОРТ ==========

window.USER_ROLE = USER_ROLE;
window.ORDER_STATUS = ORDER_STATUS;
window.PAGINATION = PAGINATION;
window.ADMIN_UID = ADMIN_UID;
window.COLORS = COLORS;
window.ORDER_CATEGORIES = ORDER_CATEGORIES;
window.CATEGORY_ICONS = CATEGORY_ICONS;
window.CITIES = CITIES;                          // плоский отсортированный массив
window.CITIES_BY_DISTRICT = CITIES_BY_DISTRICT;  // оригинал (без сортировки)
window.SORTED_CITIES_BY_DISTRICT = SORTED_CITIES_BY_DISTRICT; // отсортированный по районам

console.log('✅ Constants loaded');
console.log(`🏙️ Загружено ${ALL_CITIES_SORTED.length} населенных пунктов ХМАО`);
console.log(`📍 Количество районов: ${Object.keys(CITIES_BY_DISTRICT).length}`);
console.log('✅ Города отсортированы по алфавиту (глобально и по районам)');