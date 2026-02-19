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

// ПОЛНЫЙ СПИСОК НАСЕЛЕННЫХ ПУНКТОВ ХМАО (141)
const CITIES = [
    // А
    { id: 'all', name: 'Все города', icon: 'fa-map-marker-alt' },
    { id: 'agan', name: 'Аган', icon: 'fa-city' },
    { id: 'agirish', name: 'Агириш', icon: 'fa-city' },
    { id: 'altay', name: 'Алтай', icon: 'fa-city' },
    { id: 'alyabyevsky', name: 'Алябьевский', icon: 'fa-city' },
    { id: 'andra', name: 'Андра', icon: 'fa-city' },
    { id: 'aneeva', name: 'Анеева', icon: 'fa-city' },
    
    // Б
    { id: 'bazyany', name: 'Базьяны', icon: 'fa-city' },
    { id: 'banny', name: 'Банный', icon: 'fa-city' },
    { id: 'barsovo', name: 'Барсово', icon: 'fa-city' },
    { id: 'batovo', name: 'Батово', icon: 'fa-city' },
    { id: 'belogorye', name: 'Белогорье', icon: 'fa-city' },
    { id: 'beloyarsky', name: 'Белоярский', icon: 'fa-city' },
    { id: 'bely-yar', name: 'Белый Яр', icon: 'fa-city' },
    { id: 'berezovo', name: 'Берёзово', icon: 'fa-city' },
    { id: 'bobrovsky', name: 'Бобровский', icon: 'fa-city' },
    { id: 'bolchary', name: 'Болчары', icon: 'fa-city' },
    { id: 'bolshetarkhovo', name: 'Большетархово', icon: 'fa-city' },
    { id: 'bolshie-leushi', name: 'Большие Леуши', icon: 'fa-city' },
    { id: 'bolshoy-kamen', name: 'Большой Камень', icon: 'fa-city' },
    { id: 'bolshoy-atlym', name: 'Большой Атлым', icon: 'fa-city' },
    { id: 'bolshoy-laryak', name: 'Большой Ларьяк', icon: 'fa-city' },
    { id: 'bylino', name: 'Былино', icon: 'fa-city' },
    
    // В
    { id: 'vampugol', name: 'Вампугол', icon: 'fa-city' },
    { id: 'vanzewat', name: 'Ванзеват', icon: 'fa-city' },
    { id: 'vanzetur', name: 'Ванзетур', icon: 'fa-city' },
    { id: 'varyogan', name: 'Варьёган', icon: 'fa-city' },
    { id: 'vata', name: 'Вата', icon: 'fa-city' },
    { id: 'vakhovsk', name: 'Ваховск', icon: 'fa-city' },
    { id: 'verkhnekazymsky', name: 'Верхнеказымский', icon: 'fa-city' },
    { id: 'verkhne-mysovaya', name: 'Верхне-Мысовая', icon: 'fa-city' },
    { id: 'verkhnenildina', name: 'Верхненильдина', icon: 'fa-city' },
    { id: 'verkhnie-narykary', name: 'Верхние Нарыкары', icon: 'fa-city' },
    { id: 'vykatnoy', name: 'Выкатной', icon: 'fa-city' },
    { id: 'vysoky', name: 'Высокий', icon: 'fa-city' },
    { id: 'vysoky-mys', name: 'Высокий Мыс', icon: 'fa-city' },
    
    // Г
    { id: 'gornopravdinsk', name: 'Горноправдинск', icon: 'fa-city' },
    { id: 'gornorechensk', name: 'Горнореченск', icon: 'fa-city' },
    { id: 'gorny', name: 'Горный', icon: 'fa-city' },
    
    // Д
    { id: 'dalny', name: 'Дальний', icon: 'fa-city' },
    { id: 'deminskaya', name: 'Деминская', icon: 'fa-city' },
    { id: 'dolgoe-pleso', name: 'Долгое Плесо', icon: 'fa-city' },
    
    // Е
    { id: 'elizarovo', name: 'Елизарово', icon: 'fa-city' },
    
    // З
    { id: 'zaitseva-rechka', name: 'Зайцева Речка', icon: 'fa-city' },
    { id: 'zarechny', name: 'Заречный', icon: 'fa-city' },
    { id: 'zelenoborsk', name: 'Зеленоборск', icon: 'fa-city' },
    { id: 'zenkovo', name: 'Зенково', icon: 'fa-city' },
    
    // И
    { id: 'igrim', name: 'Игрим', icon: 'fa-city' },
    { id: 'izluchinsk', name: 'Излучинск', icon: 'fa-city' },
    { id: 'ilichevka', name: 'Ильичёвка', icon: 'fa-city' },
    
    // К
    { id: 'kazym', name: 'Казым', icon: 'fa-city' },
    { id: 'kama', name: 'Кама', icon: 'fa-city' },
    { id: 'kamennoe', name: 'Каменное', icon: 'fa-city' },
    { id: 'karkateevy', name: 'Каркатеевы', icon: 'fa-city' },
    { id: 'karym', name: 'Карым', icon: 'fa-city' },
    { id: 'karymkary', name: 'Карымкары', icon: 'fa-city' },
    { id: 'kayukova', name: 'Каюкова', icon: 'fa-city' },
    { id: 'kedrovy', name: 'Кедровый', icon: 'fa-city' },
    { id: 'kimkyasuy', name: 'Кимкьясуй', icon: 'fa-city' },
    { id: 'kirpichny', name: 'Кирпичный', icon: 'fa-city' },
    { id: 'kogalym', name: 'Когалым', icon: 'fa-city' },
    { id: 'kommunistichesky', name: 'Коммунистический', icon: 'fa-city' },
    { id: 'komsomolsky', name: 'Комсомольский', icon: 'fa-city' },
    { id: 'kondinskoe', name: 'Кондинское', icon: 'fa-city' },
    { id: 'korliki', name: 'Корлики', icon: 'fa-city' },
    { id: 'kormuzhikhanka', name: 'Кормужиханка', icon: 'fa-city' },
    { id: 'kochevaya', name: 'Кочевая', icon: 'fa-city' },
    { id: 'krasnoleninsky', name: 'Красноленинский', icon: 'fa-city' },
    { id: 'kuminsky', name: 'Куминский', icon: 'fa-city' },
    { id: 'kut-yakh', name: 'Куть-Ях', icon: 'fa-city' },
    { id: 'kyshik', name: 'Кышик', icon: 'fa-city' },
    
    // Л
    { id: 'langepas', name: 'Лангепас', icon: 'fa-city' },
    { id: 'laryak', name: 'Ларьяк', icon: 'fa-city' },
    { id: 'lempino', name: 'Лемпино', icon: 'fa-city' },
    { id: 'leushi', name: 'Леуши', icon: 'fa-city' },
    { id: 'listvenichny', name: 'Лиственичный', icon: 'fa-city' },
    { id: 'lokosovo', name: 'Локосово', icon: 'fa-city' },
    { id: 'lombovozh', name: 'Ломбовож', icon: 'fa-city' },
    { id: 'lugovoy', name: 'Луговой', icon: 'fa-city' },
    { id: 'lugovskoy', name: 'Луговской', icon: 'fa-city' },
    { id: 'lugofilinskaya', name: 'Лугофилинская', icon: 'fa-city' },
    { id: 'lykhma', name: 'Лыхма', icon: 'fa-city' },
    { id: 'lyamina', name: 'Лямина', icon: 'fa-city' },
    { id: 'lyantor', name: 'Лянтор', icon: 'fa-city' },
    
    // М
    { id: 'malinovsky', name: 'Малиновский', icon: 'fa-city' },
    { id: 'maly-atlym', name: 'Малый Атлым', icon: 'fa-city' },
    { id: 'maloyugansky', name: 'Малоюганский', icon: 'fa-city' },
    { id: 'mezhdurechensky', name: 'Междуреченский', icon: 'fa-city' },
    { id: 'megion', name: 'Мегион', icon: 'fa-city' },
    { id: 'mortka', name: 'Мортка', icon: 'fa-city' },
    { id: 'mulymya', name: 'Мулымья', icon: 'fa-city' },
    
    // Н
    { id: 'nazarovo', name: 'Назарово', icon: 'fa-city' },
    { id: 'nerokhi', name: 'Нерохи', icon: 'fa-city' },
    { id: 'nefteyugansk', name: 'Нефтеюганск', icon: 'fa-city' },
    { id: 'nizhnevartovsk', name: 'Нижневартовск', icon: 'fa-city' },
    { id: 'nizhnesortymsky', name: 'Нижнесортымский', icon: 'fa-city' },
    { id: 'nizhnie-narykary', name: 'Нижние Нарыкары', icon: 'fa-city' },
    { id: 'nikulkina', name: 'Никулкина', icon: 'fa-city' },
    { id: 'novoagansk', name: 'Новоаганск', icon: 'fa-city' },
    { id: 'numto', name: 'Нумто', icon: 'fa-city' },
    { id: 'nyagan', name: 'Нягань', icon: 'fa-city' },
    { id: 'nyaksimvol', name: 'Няксимволь', icon: 'fa-city' },
    { id: 'nyalina', name: 'Нялина', icon: 'fa-city' },
    { id: 'nyalinskoe', name: 'Нялинское', icon: 'fa-city' },
    { id: 'nyurikh', name: 'Нюрих', icon: 'fa-city' },
    
    // О
    { id: 'oktyabrskoe', name: 'Октябрьское', icon: 'fa-city' },
    { id: 'okhteurye', name: 'Охтеурье', icon: 'fa-city' },
    
    // П
    { id: 'palyanovo', name: 'Пальяново', icon: 'fa-city' },
    { id: 'pasol', name: 'Пасол', icon: 'fa-city' },
    { id: 'pashtory', name: 'Пашторы', icon: 'fa-city' },
    { id: 'peregrebnoe', name: 'Перегрёбное', icon: 'fa-city' },
    { id: 'peschany', name: 'Песчаный', icon: 'fa-city' },
    { id: 'pionersky', name: 'Пионерский', icon: 'fa-city' },
    { id: 'poykovsky', name: 'Пойковский', icon: 'fa-city' },
    { id: 'pokachi', name: 'Покачи', icon: 'fa-city' },
    { id: 'pokur', name: 'Покур', icon: 'fa-city' },
    { id: 'polovinka', name: 'Половинка', icon: 'fa-city' },
    { id: 'polnovat', name: 'Полноват', icon: 'fa-city' },
    { id: 'priobye', name: 'Приобье', icon: 'fa-city' },
    { id: 'ripolyarny', name: 'Приполярный', icon: 'fa-city' },
    { id: 'pugory', name: 'Пугоры', icon: 'fa-city' },
    { id: 'pyryakh', name: 'Пырьях', icon: 'fa-city' },
    { id: 'pyt-yakh', name: 'Пыть-Ях', icon: 'fa-city' },
    
    // Р
    { id: 'raduzhny', name: 'Радужный', icon: 'fa-city' },
    { id: 'repolovo', name: 'Реполово', icon: 'fa-city' },
    { id: 'russkinskaya', name: 'Русскинская', icon: 'fa-city' },
    
    // С
    { id: 'saygatina', name: 'Сайгатина', icon: 'fa-city' },
    { id: 'salym', name: 'Салым', icon: 'fa-city' },
    { id: 'ranpaul', name: 'Саранпауль', icon: 'fa-city' },
    { id: 'rtynya', name: 'Сартынья', icon: 'fa-city' },
    { id: 'svetly', name: 'Светлый', icon: 'fa-city' },
    { id: 'seliyarovo', name: 'Селиярово', icon: 'fa-city' },
    { id: 'semeyka', name: 'Семейка', icon: 'fa-city' },
    { id: 'sentyabrsky', name: 'Сентябрьский', icon: 'fa-city' },
    { id: 'sergino', name: 'Сергино', icon: 'fa-city' },
    { id: 'sibirsky', name: 'Сибирский', icon: 'fa-city' },
    { id: 'sivys-yakh', name: 'Сивысь-Ях', icon: 'fa-city' },
    { id: 'singapay', name: 'Сингапай', icon: 'fa-city' },
    { id: 'skripunova', name: 'Скрипунова', icon: 'fa-city' },
    { id: 'sogom', name: 'Согом', icon: 'fa-city' },
    { id: 'solnechny', name: 'Солнечный', icon: 'fa-city' },
    { id: 'sorum', name: 'Сорум', icon: 'fa-city' },
    { id: 'sosnina', name: 'Соснина', icon: 'fa-city' },
    { id: 'sosnovka', name: 'Сосновка', icon: 'fa-city' },
    { id: 'sosnovy-bor', name: 'Сосновый Бор', icon: 'fa-city' },
    { id: 'sosva', name: 'Сосьва', icon: 'fa-city' },
    { id: 'sotnik', name: 'Сотник', icon: 'fa-city' },
    { id: 'stary-katysh', name: 'Старый Катыш', icon: 'fa-city' },
    { id: 'supra', name: 'Супра', icon: 'fa-city' },
    { id: 'surgut', name: 'Сургут', icon: 'fa-city' },
    { id: 'sukhorukova', name: 'Сухорукова', icon: 'fa-city' },
    { id: 'sytomino', name: 'Сытомино', icon: 'fa-city' },
    
    // Т
    { id: 'tayozhny', name: 'Таёжный', icon: 'fa-city' },
    { id: 'taylakova', name: 'Тайлакова', icon: 'fa-city' },
    { id: 'talinka', name: 'Талинка', icon: 'fa-city' },
    { id: 'taurova', name: 'Таурова', icon: 'fa-city' },
    { id: 'tegi', name: 'Теги', icon: 'fa-city' },
    { id: 'timkapaul', name: 'Тимкапауль', icon: 'fa-city' },
    { id: 'troitsa', name: 'Троица', icon: 'fa-city' },
    { id: 'trom-agan', name: 'Тром-Аган', icon: 'fa-city' },
    { id: 'tugiyany', name: 'Тугияны', icon: 'fa-city' },
    { id: 'tundrino', name: 'Тундрино', icon: 'fa-city' },
    { id: 'tyuli', name: 'Тюли', icon: 'fa-city' },
    
    // У
    { id: 'ugut', name: 'Угут', icon: 'fa-city' },
    { id: 'ult-yagun', name: 'Ульт-Ягун', icon: 'fa-city' },
    { id: 'un-yugan', name: 'Унъюган', icon: 'fa-city' },
    { id: 'uray', name: 'Урай', icon: 'fa-city' },
    { id: 'urmanny', name: 'Урманный', icon: 'fa-city' },
    { id: 'ustryom', name: 'Устрём', icon: 'fa-city' },
    { id: 'ust-manya', name: 'Усть-Манья', icon: 'fa-city' },
    { id: 'ust-yugan', name: 'Усть-Юган', icon: 'fa-city' },
    { id: 'ushya', name: 'Ушья', icon: 'fa-city' },
    
    // Ф
    { id: 'fyodorovsky', name: 'Фёдоровский', icon: 'fa-city' },
    
    // Х
    { id: 'khanty-mansiysk', name: 'Ханты-Мансийск', icon: 'fa-city' },
    { id: 'khulimsunt', name: 'Хулимсунт', icon: 'fa-city' },
    { id: 'khurumpaul', name: 'Хурумпауль', icon: 'fa-city' },
    
    // Ц
    { id: 'tsingaly', name: 'Цингалы', icon: 'fa-city' },
    
    // Ч
    { id: 'chantyrya', name: 'Чантырья', icon: 'fa-city' },
    { id: 'chembakchina', name: 'Чембакчина', icon: 'fa-city' },
    { id: 'cheuskino', name: 'Чеускино', icon: 'fa-city' },
    { id: 'cheklomey', name: 'Чехломей', icon: 'fa-city' },
    
    // Ш
    { id: 'shaim', name: 'Шаим', icon: 'fa-city' },
    { id: 'shaitanka', name: 'Шайтанка', icon: 'fa-city' },
    { id: 'shapsha', name: 'Шапша', icon: 'fa-city' },
    { id: 'shekaly', name: 'Шеркалы', icon: 'fa-city' },
    { id: 'shugur', name: 'Шугур', icon: 'fa-city' },
    
    // Щ
    { id: 'shchekurya', name: 'Щекурья', icon: 'fa-city' },
    
    // Ю
    { id: 'yubileyny', name: 'Юбилейный', icon: 'fa-city' },
    { id: 'yugan', name: 'Юган', icon: 'fa-city' },
    { id: 'yuganskaya-ob', name: 'Юганская Обь', icon: 'fa-city' },
    { id: 'yugorsk', name: 'Югорск', icon: 'fa-city' },
    { id: 'yuilsk', name: 'Юильск', icon: 'fa-city' },
    { id: 'yumas', name: 'Юмас', icon: 'fa-city' },
    
    // Я
    { id: 'yagodny', name: 'Ягодный', icon: 'fa-city' },
    { id: 'yaguryakh', name: 'Ягурьях', icon: 'fa-city' },
    { id: 'yamki', name: 'Ямки', icon: 'fa-city' },
    { id: 'yarki', name: 'Ярки', icon: 'fa-city' },
    { id: 'yasunt', name: 'Ясунт', icon: 'fa-city' }
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

// Экспортируем всё в глобальную область
window.USER_ROLE = USER_ROLE;
window.ORDER_STATUS = ORDER_STATUS;
window.PAGINATION = PAGINATION;
window.ADMIN_UID = ADMIN_UID;
window.COLORS = COLORS;
window.ORDER_CATEGORIES = ORDER_CATEGORIES;
window.CATEGORY_ICONS = CATEGORY_ICONS;
window.CITIES = CITIES;

console.log('✅ Constants loaded');
console.log(`🏙️ Загружено ${CITIES.length - 1} населенных пунктов ХМАО`);