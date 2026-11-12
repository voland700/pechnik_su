# Детальные страницы товаров

Маршруты: `/catalog/product_1/`, `/catalog/product_2/`, `/catalog/product_3/`, `/catalog/product_4/`, `/catalog/product_5/`.

## Архитектура

Единственный источник данных — `assets/products_data.json`; исходные названия полей и HTML сохранены. Пять страниц выбирают запись по `file_name` и передают её в ProductDetail. ProductDetail использует существующий CatalogLayout с меню разделов без filter slot; менять layout не потребовалось. Breadcrumbs сам добавляет «Главная», поэтому первый одноимённый пункт JSON исключается при адаптации. Промежуточные разделы без предоставленного URL отображаются текстом; «Каталог» ведёт на `/catalog/`.

Созданы:

- `src/pages/catalog/product_1.astro` … `product_5.astro` — демонстрационные маршруты.
- `src/components/catalog/ProductDetail.astro` — композиция страницы, бренд, preview, Benefit, описание, информационные шаблоны.
- `src/components/catalog/ProductGallery.astro` — главное фото, лейблы, скидка, миниатюры.
- `src/components/catalog/ProductPurchase.astro` — независимые правила price, status и canBuy; существующие Button и quantity controls.
- `src/components/catalog/ProductProperties.astro` — все свойства в dl.
- `src/components/catalog/ProductDocuments.astro` — ссылки документов со спрайтом.
- `src/data/product-detail.ts` — тип из JSON, разрешение URL локальных ресурсов через Vite, HTML информационных окон на этапе сборки, определение расширений документов.
- `src/scripts/modules/product-detail.ts` — браузерная интерактивность.
- `src/styles/components/_product-detail.scss` — стили в общем CSS-графе.
- `src/assets/product-placeholder.svg` — резерв для отсутствующих изображений.
- `assets/images/icons/circle-check.svg`, `circle-xmark.svg`, `circle-exclamation.svg` — отсутствовавшие статусные иконки.
- `assets/shops.html`, `assets/baying.html` — копии предоставленных файлов из artifacts, содержимое сохранено.
- `scripts/test-product-detail-browser.mjs` — проверка через установленный headless Chrome/CDP.
- `artifacts/product-detail/` — результаты и три снимка адаптивности.
- `docs/product-detail.md` — этот документ.

Изменены: `src/scripts/main.ts` (условный импорт модуля), `src/styles/main.scss` (подключение SCSS), `README.md` (ссылка на документацию).

Переиспользованы без изменений: CatalogLayout, CatalogSidebar, Breadcrumbs, Benefit, Button, product-card quantity normalizer, типографика, токены, Bootstrap breakpoints и библиотечные CSS.

## Интерактивность и CMS

Swiper core + Navigation/A11y управляет горизонтальными миниатюрами, 3/4/5 видимых по ширине. Единственная фотография не создаёт слайдер. Активная миниатюра получает aria-pressed, рамку и нижнюю линию. Fancybox 6 получает массив фотографий и startIndex активного фото.

Количество нормализуется существующим модулем product-card: положительное целое 1–999, кнопки ±, ручной ввод и blur/change. Покупка зависит только от canBuy, статус — только от status. Кнопки покупки не создают заказ и не выполняют запросы.

Шесть информационных файлов читаются на этапе сборки и встраиваются в template. Fancybox.show({html}) открывает копию HTML без fetch и зависимости от исходной папки assets на хостинге. Соответствие «Оплата → baying» и «Как купить → payment» сохранено строго по ТЗ, даже несмотря на фактические заголовки внутри файлов.

Таблицы имеют прокрутку с клавиатуры; видео 16:9, 3D arguv — 4:3 с минимальной высотой 350px. Для старых ссылок /doc/ и /upload/ добавлен origin https://www.pechnik.su без изменения исходного JSON. HTML доверенный: при интеграции CMS необходимо очищать контент на стороне источника. После сборки нужны обычный HTML, общий CSS и все JS/assets с сохранением путей. Astro runtime и серверные API не используются.

Спрайт фактически находится в `assets/images/icons/docs_types.png`: ширина 34px, шаг строк 55px; используется размер иконки 34×35px. Поддержаны все восемь групп расширений, URL query/hash исключаются через URL.pathname. Для неизвестного типа — нейтральный значок.

## Проверки 12.11.2026

- `npm run check`: 0 errors, 0 warnings; существующий hint о неиспользуемом аргументе в test-featured-products-browser.
- `npm run build`: успешно, 11 страниц, два CSS, проверены 372 ссылки на локальные ресурсы. Сборка выполнялась вне песочницы из-за существующей ошибки разрешения astro/entrypoints/prerender внутри песочницы.
- `node scripts/test-product-detail-browser.mjs`: успешно для пяти товаров на 375/414/768/992/1280/1440px. Проверены отсутствие переполнения, один H1, отсутствие фильтра, фото, статусы, disabled, нормализация количества, 14 миниатюр/навигация, одиночное фото, Fancybox и все шесть модальных окон. Ошибок JS нет.
- Просмотрены снимки EVEREST на 375 и 1440px. Полный отчёт — artifacts/product-detail/results.json.
- Внешние iframe и удалённая иконка из описания блокировались в автоматическом тесте для независимости от провайдеров. Реальное воспроизведение Rutube/YouTube и 3D не проверено; исходные URL сохранены.

## Недостающие материалы

На момент проверки отсутствуют `assets/return.html` и `assets/install.html`. Их окна открываются с явным сообщением об отсутствии предоставленной информации. После добавления файлов достаточно пересобрать проект.

Отсутствуют изображения преимуществ `gadeit.jpg`, `Gadeit_skif_middle.jpg`, `e09e6c0791d97461ac531ada9ff457bf.jpg` в assets/images/benefits. Текст преимуществ выводится через Benefit; для изображений используется нейтральная заглушка. Все 26 фотографий товаров предоставлены и подключены.

В description product_3 уже есть встроенная техническая документация, хотя documents пуст. Она сохранена как часть исходного HTML; отдельный ProductDocuments не выводится.

В сборке остаются существующие Sass deprecation warnings Bootstrap и предупреждение ProductCard на главной об assets/images/main_XEWTaZkyPl.jpg. Они не относятся к детальным страницам.
