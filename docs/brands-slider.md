# Товары производителей

Секция подключена после «Выполненные нами работы» на главной, перед UI Kit.
Использует установленный Swiper 14.3.0, общий CSS core/A11y и существующий Icon.
Новых зависимостей нет. Референс: reference/brandSlider.jpg; pechi-tula.ru вернул
403 при проверке, его HTML/CSS не копировались.

## Файлы и API

- src/data/brands.ts — readonly brandsData, тип BrandItem: name, img, href?.
- src/components/home/brands/BrandsSlider.astro — секция и цикл слайдов.
- src/components/home/brands/images.ts — локальные изображения через Vite glob
  и Astro ImageMetadata, с реальными размерами и хешированными выходными путями.
- src/scripts/modules/brands-slider.ts — отдельная инициализация Swiper.
- src/styles/components/_brands-slider.scss — БЭМ-стили в общей SCSS-сборке.
- src/scripts/main.ts, src/styles/main.scss, src/pages/index.astro — подключения.

```astro
---
import BrandsSlider from '../components/home/brands/BrandsSlider.astro';
import { brandsData } from '../data/brands';
---
<BrandsSlider />
<BrandsSlider title="Производители" items={brandsData.slice(0, 3)} />
```

По умолчанию выводятся все 17 производителей; пустой массив скрывает секцию.
Порядок и количество задаются данными, ограничения на количество нет.
Все 17 оригинальных JPG найдены, включая amaora.jpg; регистр проверен строго.
У всех текущих записей href="#"; safeUrl проверяет будущие URL.
Публичные CMS-изображения также поддерживаются. Если локальный файл отсутствует,
сборка сообщает предупреждение, вместо битого img выводится название бренда.

Ссылка имеет одно доступное название «Товары производителя …», alt изображения
пустой, чтобы не повторять бренд. Каждый экземпляр имеет уникальный heading ID.

## Поведение и оформление

Динамический импорт запускается только при наличии data-brands-slider.
Импортируются Navigation и A11y, без Autoplay/Pagination/loop. WeakMap защищает
от повторной инициализации. Кнопки привязаны внутри конкретной секции.
ArrowLeft/ArrowRight обрабатываются только при фокусе внутри неё; Tab доступен
для всех ссылок, A11y прокручивает скрытый слайд при получении фокуса.
При destroy снимаются собственные обработчики и удаляется запись WeakMap.
Reduced motion учитывается при инициализации и при смене настройки в системе.

Стандартные Manrope, container, section heading, space, muted/action/border,
layout-control и duration токены. Тонкие линии сверху и снизу. Область логотипа
112 px, изображение вписывается с object-fit:contain, высота до 80 px,
пропорции сохранены. Grayscale применяется только к img: 100% по умолчанию,
0 при hover на поддерживающих устройствах и focus-visible, transition 300 мс.
Кнопки 44×44 px, нейтральные с акцентным hover и видимым общим outline.
Фокусная рамка ссылок помещается в padding viewport и не зависит от фильтра.

Видимые слайды: 2 до 768, 3 от md (768), 4 от lg (992), 5 от xl (1200).
Без JS все ссылки доступны в горизонтально прокручиваемой области, кнопки
скрыты. Высота области задана до инициализации и не зависит от загрузки img.

## Проверки

- npm run check: 0 ошибок, 0 warnings, один прежний hint в
  scripts/test-featured-products-browser.mjs.
- npm run build: успешно, verify-dist проверяет HTML/CSS/fonts и ресурсы.
  Сохранились прежние предупреждения Sass Bootstrap и два отсутствующих
  изображения ProductCard; новых предупреждений слайдера нет.
- node scripts/test-brands-static.mjs --browser: проверка регистра всех 17
  файлов, пустого/одного/трёх/17 элементов, уникальных ID; Chrome headless на
  375/768/1024/1440; точный порядок, href, загрузка всех JPG, отсутствие
  переполнения, стрелки и границы, ArrowRight, Tab через все бренды, focus,
  grayscale hover/возврат, reduced motion, эмулированный touch, независимые
  экземпляры, работа без JS и отсутствие ошибок консоли. Успешно.

Перед тестом запустить npm run preview -- --host 127.0.0.1. Статический тест
создаёт временную страницу из scripts/fixtures/brands.astro.txt и удаляет её
в finally, затем пересобирает production. Обычный браузерный smoke-тест:
node scripts/test-brands-browser.mjs. CHROME_PATH и SHOWCASE_BASE_URL задают
браузер и адрес. Артефакты: artifacts/brands/, четыре снимка и results.json.
В этой среде build и Chrome требуют запуска вне песочницы.

## Перенос в CMS и ограничения

Перенести section из dist/index.html, общий CSS и все dist/js/assets по README.
Генерировать слайды циклом CMS, сохраняя классы и data-атрибуты. URL и текст
проверять и экранировать на сервере. Для реальных каталогов заменить href
в данных, шаблон и клиентская инициализация не меняются. Ссылки сейчас сохраняют
нативное поведение href="#", без JS-подмены переходов.

Каталоги брендов, CMS/API, фильтры и галереи не создавались. Safari, Firefox,
физические сенсорные устройства и экранный диктор не проверялись.
Полная регрессия соседних интерактивных компонентов не выполнялась.
