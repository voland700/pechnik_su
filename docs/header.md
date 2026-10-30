# Header Pechnik.su

Актуальное поведение: шапка прокручивается вместе со страницей, sticky отключён; sentinel, наблюдатели sticky-состояния и связанный scroll-padding удалены. Дополнительная строка «Литьё, теплоизоляция» центра «Заокск» убрана из данных (включая мобильное меню). Основной `main.site-main` имеет верхний padding 24 px. Проверены Astro check, production build и Chrome на 390/768/1024/1440/1920 px: отсутствие прилипания, отступ main, контакты, поиск, мобильное меню, focus/Escape, восстановление прокрутки; ошибок браузера нет. Эти изменения заменяют первоначальное описание sticky ниже.

Header по умолчанию выводится в BaseLayout. Слот `header` позволяет заменить его экземпляром с нужными данными:

```astro
---
import Header from '../components/layout/header/Header.astro';
---
<BaseLayout title="Доставка" description="Условия доставки">
  <Header slot="header" activeMenu="delivery" cartCount={7} isAuthenticated={false} />
  <!-- содержимое страницы -->
</BaseLayout>
```

## Архитектура и API

Astro выпускает обычный HTML. Данные меню и магазинов отделены от разметки. Стили подключены через общий `main.scss`, логика — условным импортом из `main.ts`. Дополнительных зависимостей нет.

| Компонент | Props |
| --- | --- |
| `Header.astro` | `activeMenu?: string`, `cartCount = 0`, `isAuthenticated = false`, `homeUrl = BASE_URL`, `catalogUrl = '/catalog/'`, `cartUrl = '/cart/'`, `accountUrl = '/personal/'`, `loginUrl = '/login/'`, `searchAction = '/search/'`, `searchParameter = 'q'`, `menuItems = navigation`, `stores = contacts`, `id = 'site-header'` |
| `TopNavigation.astro` | `items: NavigationItem[]`, `activeMenu?: string`, `mobile = false` |
| `SearchForm.astro` | `action = '/search/'`, `parameter = 'q'` |
| `CartLink.astro` | `href = '/cart/'`, `count = 0` |
| `StoreContacts.astro` | `stores: StoreContact[]` |
| `WorkingHours.astro` | Нет props: единый согласованный график для двух магазинов |
| Существующий `Logo.astro` | `href = BASE_URL`; оригинальный SVG и надпись «Печной центр» |

Невалидное, отрицательное или дробное количество корзины нормализуется в конечное целое от нуля. Все URL можно заменить при интеграции. Для нескольких экземпляров задавайте разные `id`; штатный сценарий — одна шапка на страницу.

## Адаптивность и sticky

- От 1200 px: верхнее меню со служебными действиями; основная строка с логотипом, каталогом, поиском, графиком и корзиной; два открытых блока контактов.
- 992–1199 px: бургер, компактные основные элементы, поиск отдельной строкой; оба магазина и четыре телефона по-прежнему видны под шапкой.
- 768–991 px: навигация, график и контакты доступны в боковой панели; каталог остаётся в основной строке.
- Ниже 768 px: бургер, уменьшенный логотип и корзина; поиск постоянно виден отдельной строкой. Ссылка каталога доступна в боковой панели.

Основная строка использует `position: sticky; top: 0` и остаётся в потоке без placeholder и изменения высоты. Обёртка Header имеет `display: contents`, поэтому sticky не ограничивается высотой шапки. Верхняя строка и контакты прокручиваются. IntersectionObserver добавляет тень; ResizeObserver задаёт компенсацию якорей `scroll-padding-top`. На мобильном поиск входит в sticky-строку. Для интеграции не помещайте шапку в ограничивающую по высоте или прокрутке обёртку.

## Меню и доступность

Единственный нативный `dialog` открывается слева через `showModal()`. Он содержит навигацию, каталог, вход, callback, график и оба магазина. Содержимое прокручивается внутри панели. Нативная модальность делает фон недоступным; обработчик Tab дополнительно удерживает фокус. Закрытие: кнопка, Escape, backdrop и переход к ширине от 1200 px. После закрытия восстанавливаются позиция страницы, исходные inline-стили body и фокус бургера. `aria-controls`, `aria-expanded`, заголовок dialog и доступные имена предусмотрены. Анимации используют transform/opacity, reduced motion отключает задержку закрытия.

Без JavaScript доступны desktop-ссылки, контакты, поиск и график; открытие мобильной панели требует JavaScript. Callback — только точка будущей интеграции, без фиктивного окна: `button[data-action="callback"]`.

## Московское время

`Intl.DateTimeFormat` с `timeZone: 'Europe/Moscow'` вычисляет часы независимо от локальной зоны. Рабочий интервал `[09:00, 18:00)`, включая воскресенье. Статический HTML содержит только расписание; статус изначально скрыт. JS показывает текст и зелёный/тёмно-красный индикатор. Одноразовый таймер рассчитывается до ближайшей границы; пересчёт также выполняется при visibilitychange, pageshow и возвращении фокуса окна. Секундного интервала нет. Источник времени — системные часы устройства.

## Изменение данных и перенос в Битрикс

- Меню: `src/data/navigation.ts`, поля `id`, `label`, `url`; активный `id` передать как `activeMenu`. Сервер может вместо этого сформировать HTML с `.active` и `aria-current="page"`.
- Контакты: `src/data/contacts.ts`, тип `StoreContact`; массив можно передать через `stores`. Телефоны задаются парой читаемая подпись / `tel:` URL.
- Авторизация: `isAuthenticated`, `loginUrl`, `accountUrl`; хранение клиентского состояния отсутствует.
- Корзина: `cartCount`, `cartUrl`. При обновлении через CMS заменить `[data-cart-count]`, переключить `.header-cart__count--filled` при количестве больше нуля и обновить `aria-label` у `[data-cart-link]`.
- Поиск: `searchAction`, `searchParameter`. Нативный GET-submit, включая Enter; серверную выдачу предоставляет CMS.
- Callback: подключить будущую форму к `[data-action="callback"]` в обеих версиях разметки.
- При переносе сохранить `data-*`, семантику, классы и DOM-порядок. `initHeader()` безопасен при повторной инициализации существующих узлов; экспорт позволяет подключить новые узлы после серверной замены.

Предварительные маршруты: `/about/`, `/articles/`, `/installation/`, `/works/`, `/delivery/`, `/contacts/`, `/offers/`, `/catalog/`, `/cart/`, `/personal/`, `/login/`, `/search/`. Страницы намеренно не созданы и до интеграции могут возвращать 404. `verify-dist.mjs` исключает только этот явный список будущих маршрутов из проверки наличия HTML, продолжая проверять локальные ресурсы.

Production: `dist/css/style.css`, `dist/css/style.min.css`, `dist/js/main.js`; библиотеки — отдельные хешированные JS-чанки. Подключать только min CSS, сохранять все папки `css`, `js`, `assets`. Для фиксированных имён требуется сброс кеша при деплое.

## Файлы

Созданы:

- `src/components/layout/header/{Header,TopNavigation,SearchForm,CartLink,WorkingHours,StoreContacts}.astro`.
- `src/data/{navigation,contacts}.ts`.
- `src/scripts/modules/{header,mobile-menu,working-hours}.ts`.
- `src/styles/layout/_header.scss`, `src/styles/components/{_mobile-menu,_store-contacts}.scss`.
- `scripts/test-header-browser.mjs`, `scripts/test-working-hours.mjs`, `scripts/fixtures/header-check.astro.txt`, `docs/header.md`.
- `artifacts/header/`: снимки пяти ширин, JSON браузерного прогона, журналы сборки.

Изменены: `README.md`, `astro.config.mjs`, `scripts/{finalize-css,verify-dist}.mjs`, `src/components/layout/Logo.astro`, `src/layouts/BaseLayout.astro`, `src/pages/index.astro`, `src/scripts/main.ts`, `src/styles/main.scss`, `src/styles/abstracts/_tokens.scss`. Исходный пользовательский `assets/cart.svg` не изменён: корзина использует существующий Icon.

## Проверки

- `npm run check`: 0 ошибок, предупреждений и подсказок.
- `npm run build`: успешно; два CSS, фиксированный JS, шрифты и локальные ресурсы проверены. Известные Sass deprecation warnings относятся к Bootstrap 5.2.
- `node scripts/test-working-hours.mjs`: границы 08:59:59.900 / 09:00 / 17:59:59.900 / 18:00, задержки таймера, воскресенье и UTC-ввод.
- `npm run preview -- --host 127.0.0.1`, затем `node scripts/test-header-browser.mjs`: реальный headless Chrome, ширины 390/768/1024/1440/1920, отсутствие переполнения, видимость контактов, все `tel:`, sticky и поиск, отправка GET-полей по Enter (submit перехвачен тестом), открытие/закрытие меню, Escape, backdrop, фокус, смена ширины, блокировка и восстановление прокрутки. Ошибок JS не обнаружено. Снимки 390 и 1440 дополнительно просмотрены визуально.
- Временная Astro-страница используется для SSR-проверки корзины 0/7/100, двух состояний входа и активного меню; в финальную сборку она не входит.

Повтор SSR-проверки в PowerShell: скопировать `scripts/fixtures/header-check.astro.txt` в `src/pages/header-check.astro`, выполнить `npm run build`, запустить preview и `$env:HEADER_FIXTURE='1'; node scripts/test-header-browser.mjs`. После проверки удалить именно `src/pages/header-check.astro` и повторить build. Сама fixture хранится вне страниц и не публикуется. Для другого установленного Chrome задайте `CHROME_PATH`; для другого preview — `HEADER_TEST_URL`.

Ограничения: проверен Chromium; Safari/Firefox, физические мобильные устройства и реальные screen reader не проверялись. Требуются современные браузеры с dialog, Intl, IntersectionObserver и ResizeObserver. Серверные страницы, поиск, callback, авторизация и бизнес-логика корзины относятся к последующим этапам. Подвал и остальное содержимое UI Kit не перерабатывались.
