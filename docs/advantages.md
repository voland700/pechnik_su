# Наши преимущества

Секция на главной после акций: `src/components/home/advantages/Advantages.astro`.
Данные — `src/data/advantages.ts`, стили — `src/styles/components/_advantages.scss`,
восемь оригинальных SVG — `src/assets/icons/inline/advantage-*.svg`.
Подключение — `src/pages/index.astro` и `src/styles/main.scss`.

```astro
---
import Advantages from '../components/home/advantages/Advantages.astro';
import { advantagesData } from '../data/advantages';
---
<Advantages />
<Advantages title="Преимущества компании" items={advantagesData.slice(0, 3)} />
```

`items` — readonly массив `{ icon, title, description }`; порядок задаётся массивом.
Без props выводятся все восемь; переданный массив ограничивается первыми восемью,
пустой массив не создаёт секцию. Каждый экземпляр получает уникальный ID заголовка.
Названия и описания экранирует Astro. В описании ассортимента исходный `<br>`
нормализован в точку и пробел согласно тексту таблицы задания.

SVG обрабатывает существующий `Icon`: доверенный локальный ресурс включается
inline на этапе сборки, без внешнего запроса. Геометрия и viewBox сохранены,
устаревшие атрибуты корневого SVG удалены. Цвет — currentColor.
Декоративные изображения имеют aria-hidden и focusable=false.
Семантика: section / h2 / ul / li / h3 / p, без ссылок и клиентского JS.

Применены существующие Manrope, container, токены типографики и отступов.
Цвет SVG — action (#ab4800), при наведении на само изображение — accent (#e96500).
Описание — muted, размер изображения 140×120 px. Изображения не обрезаются.
Hover доступен только при hover:hover и pointer:fine: scale(1.05), 300 мс.
Reduced motion отключает transform и transition (общий стиль проекта также
задаёт практически нулевую длительность анимации).

CSS Grid: одна колонка до 576 px, две от sm (576), четыре от lg (992).
На desktop восемь элементов занимают два ряда. Текстовые области растут свободно.

Для CMS перенесите section из dist/index.html и общий stylesheet по инструкции
README. Замените перебор items циклом CMS, сохранив классы и inline SVG.
SVG должны оставаться доверенными ресурсами разработчика; текст нужно экранировать.
Astro и Node на production не требуются. Зависимости не добавлены.

## Проверка

- `npm run check`: 0 ошибок, 0 warnings; существующий hint в test-featured-products-browser.mjs.
- `npm run build`: успешная статическая сборка и verify-dist.
- `node scripts/test-advantages-static.mjs`: реальный Astro-рендер 0–8 элементов,
  ограничение восемью, значения по умолчанию, уникальные ID, сравнение исходной
  SVG-геометрии, текстов и порядка. Временная страница удаляется, production пересобирается.
- `node scripts/test-advantages-browser.mjs`: установленный Chrome headless,
  ширины 375/768/1024/1440, сетка, переполнения, центрирование, отсутствие ссылок,
  декоративные SVG, hover без сдвига текста, reduced motion, работа без JS.
  Скриншоты и результаты — artifacts/advantages/.

Для браузерного теста запустить `npm run preview -- --host 127.0.0.1`.
SHOWCASE_BASE_URL меняет адрес сервера; CHROME_PATH — путь к Chrome.
В данной среде build и запуск Chrome требуют разрешения вне песочницы.

Существующие предупреждения сборки: deprecated Sass imports Bootstrap и два
отсутствующих изображения ProductCard. Новых предупреждений компонента нет.
Firefox, Safari, физические устройства и экранный диктор не проверялись.
