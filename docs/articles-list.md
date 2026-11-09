# Статьи о печах и каминах

Секция подключена на главной после производителей, перед техническим UI Kit.
Реализована статическим Astro, без клиентского JavaScript и новых зависимостей.
Композиция соответствует reference/Desktop_Article_List.jpg и Mobile_Article_List.jpg.
Карточки акций изучены, но не переиспользованы: у статей горизонтальное
изображение и анонс, иная семантика article. Система SCSS и токенов общая.

## Файлы и API

- src/data/articles.ts: тип ArticleItem и исходный ArticlesData, десять объектов
  name/img/text/href. Тексты сохранены, включая многоточия, двойной пробел
  четвёртого заголовка и начальный/неразрывные пробелы последнего анонса.
- src/components/home/articles/ArticlesList.astro: секция, h2 и список.
- src/components/home/articles/ArticleCard.astro: article с одной ссылкой на всю
  карточку, h3 и p; доступное имя ссылки связано с заголовком, alt изображения пустой.
- src/components/home/articles/images.ts: Vite glob с ImageMetadata, реальные
  размеры и хешированные пути. Публичные CMS-URL также поддерживаются.
- src/styles/components/_articles-list.scss: БЭМ, единый CSS entry point.
- src/pages/index.astro, src/styles/main.scss: подключения.

```astro
---
import ArticlesList from '../components/home/articles/ArticlesList.astro';
import { ArticlesData } from '../data/articles';
---
<ArticlesList />
<ArticlesList title="Полезные материалы" items={ArticlesData.slice(0, 3)} />
```

По умолчанию десять статей; items задаёт количество и порядок, первые десять
попадают в вывод. Пустой массив скрывает секцию. Каждый экземпляр и заголовки
карточек получают уникальные ID. name/text экранируются Astro, URL проверяет
существующий safeUrl. Все текущие href="#", без JS-перехвата и выдуманных маршрутов.

Все десять изображений найдены с точным регистром, в том числе prev.jpg.
Если впоследствии локальное изображение отсутствует, выдаётся предупреждение
сборки и текстовый fallback вместо битого img. Данные не заменяются внешними.

## Дизайн и адаптивность

Текущие Manrope, container, токены text/muted/action/border/surface,
space, radius-sm, text-base/sm, duration-fast и breakpoint mixins.
Белый фон, тонкая нейтральная граница, без тени и масштабирования.
Hover/focus меняют границу и цвет заголовка, active возвращает основной цвет.
Клавиатурный outline использует существующее глобальное focus-visible.
Reduced motion отключает переходы; соседние стили не меняются.

До 768 px одна колонка, изображение сверху в области 128×128 px,
центрированный полный заголовок. От 768 px одна широкая колонка,
изображение 120×120 слева, текст справа. От 992 px две равные колонки,
при десяти записях пять рядов в исходном построчном порядке.
Gap 16 px, карточки растут по содержимому. Изображения object-fit:contain,
lazy/async и width/height, область зарезервирована до загрузки.

Анонс ограничен CSS line-clamp и совместимым -webkit-line-clamp:
пять строк на Mobile, четыре от md. Полный текст остаётся в данных и DOM,
JS-обрезки нет. overflow-wrap:anywhere защищает сетку от длинных слов и URL.
Заголовки не ограничены по строкам и высоте.

## Проверки

- npm run check: 0 ошибок, 0 warnings; один прежний hint
  scripts/test-featured-products-browser.mjs.
- npm run build и verify-dist: успешны. Сохранились существующие Sass
  deprecations Bootstrap и предупреждения о двух изображениях ProductCard.
  В финальной сборке предупреждений статей нет.
- node scripts/test-articles-static.mjs --browser: проверка точного регистра
  всех изображений, количества 0–10 и ограничения десятью, нескольких экземпляров,
  уникальных ID, полного текста/порядка в HTML; Chrome headless на
  375/768/1024/1440, десять загруженных img, композиция карточек, сетка/ряды,
  отсутствие переполнений и обрезанных заголовков, CSS clamp, href,
  hover/active/focus, Tab, reduced motion, работа без JS, ошибки консоли.
  Отдельный тестовый анонс более 5000 символов и длинный заголовок проверены
  на всех четырёх ширинах. Все проверки прошли.

Для браузерного теста запустить npm run preview -- --host 127.0.0.1.
Отдельный smoke: node scripts/test-articles-browser.mjs. CHROME_PATH задаёт
браузер, SHOWCASE_BASE_URL — адрес. Полный тест создаёт временную страницу
из scripts/fixtures/articles.astro.txt, удаляет её и пересобирает production.
Скриншоты и результаты: artifacts/articles/. В этой среде build и Chrome
запускались с разрешением вне песочницы.

## CMS и ограничения

Перенести section из dist/index.html вместе с общими ресурсами по README.
Заменить цикл Astro серверным циклом CMS, сохранить классы и связи aria-labelledby,
экранировать текст и проверять URL. Менять href/name/img/text можно через данные.
Реальные страницы, CMS/API, поиск, фильтры и пагинация не реализованы.
Safari, Firefox, физические устройства и экранный диктор не проверялись.
Полная регрессия интерактивных сценариев соседних компонентов не выполнялась.
