# Преимущества товара — Benefit

Демонстрация: `/benefits/`, все четыре объекта `assets/benefits.json` и отдельные
варианты со ссылкой, без ссылки, в узкой колонке и с форматированным описанием.

`src/components/catalog/Benefit.astro` отображает один блок: article / h3 /
изображение и HTML-описание. Размещайте его под заголовком раздела h2.
Обязательные props: `title`, `img` (готовый URL), `text` (доверенный HTML).
Дополнительно: `href`, `alt` (по умолчанию title), `listStyle`
(`plain` по умолчанию, `bulleted` для обычных маркеров).

```astro
---
import Benefit from '../components/catalog/Benefit.astro';
import { benefits } from '../data/benefits';
---
<Benefit {...benefits[0]} />
<Benefit {...benefits[0]} href={`${import.meta.env.BASE_URL}benefits/`} />
{benefits.length > 0 && (
  <div class="benefits-list">
    {benefits.map(item => <Benefit {...item} />)}
  </div>
)}
```

При отсутствии href в блоке нет ссылок. Если href задан, заголовок и изображение
ведут по одному адресу. Передавайте проверенные URL из источника данных.
Компонент не загружает клиентский JavaScript и не содержит собственных данных.

`src/data/benefits.ts` импортирует исходный JSON без изменения текста и названий.
Vite `?url` выпускает изображения из `assets/` в production-ресурсы. В исходном
JSON четвёртый файл ошибочно назван benefit_4.jpg: явное соответствие в модуле
данных подключает существующий benefit_4.png. При добавлении записей проверьте
их alt; отсутствующее изображение останавливает сборку с понятной ошибкой.

Стили подключены через main.scss в общий CSS. Использованы токены проекта,
breakpoint sm и container query: изображение 64/80 px с object-fit: contain,
внутри контейнера до 240 px содержимое располагается вертикально. Контейнер
не задаёт глобальную ширину. `.benefits-list` отвечает только за интервал.
Обычные ul без маркеров оформляются через модификатор описания, исходный HTML
сохраняется. `.benefit__accent` выделяет отдельные фрагменты цветом action.

Для CMS перенесите article и общий CSS, замените props и цикл данными CMS.
`set:html` не очищает HTML: проверка или очистка должна выполняться источником.
Astro-атрибуты, клиентские islands и дополнительные зависимости не используются.

Проверки:

- `npm run check`: 0 ошибок, 0 warnings; существующий hint в
  test-featured-products-browser.mjs.
- `npm run build`: статическая сборка, общий CSS и verify-dist.
- `node scripts/test-benefit-browser.mjs` при запущенном preview: Chrome headless,
  320/390/768/1024/1440 px, колонка 210 px, отсутствие переполнений, загрузка
  изображений, contain, наличие и отсутствие ссылок, списки и focus-visible,
  с отключённым JavaScript страницы. SHOWCASE_BASE_URL задаёт адрес preview.
- Скриншоты и отчёт: `artifacts/benefits/`.

Существующие предупреждения build: устаревшие Sass imports Bootstrap и отсутствующее
изображение ProductCard (не Benefit). В этой среде build и Chrome требуют запуска
вне песочницы. Сайт-референс не ответил вовремя; использован локальный скриншот.
Firefox, Safari, реальные мобильные устройства и экранный диктор не проверялись.
