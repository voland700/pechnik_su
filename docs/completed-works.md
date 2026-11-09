# Выполненные нами работы

Компонент `src/components/home/completed-works/CompletedWorks.astro` подключён
на главной после преимуществ, перед техническим UI Kit. Остальные секции
сохраняют порядок. Ориентиры — reference/workExemple.jpg и блок работ pechnik.su.

Данные: `src/data/completed-works.ts`, readonly массив `workExempleData`
из объектов `{ title, href }`. Все шесть текстов сохранены, все href равны `#`.
Стили: `src/styles/components/_completed-works.scss`, подключение через main.scss.
Новых зависимостей и клиентского JS нет.

```astro
---
import CompletedWorks from '../components/home/completed-works/CompletedWorks.astro';
import { workExempleData } from '../data/completed-works';
---
<CompletedWorks />
<CompletedWorks title="Наши работы" items={workExempleData.slice(0, 3)} />
```

Без props выводятся шесть записей. Другой массив меняет количество и порядок
без изменения шаблона; пустой массив скрывает секцию. У каждого экземпляра
уникальный ID h2, связанный с section через aria-labelledby. Семантика списка:
ul / li / a. Текст экранируется Astro, URL проверяет существующий safeUrl;
пустые и небезопасные адреса получают `#`.

Ссылки обычные, без data-demo-link и JS-обработчиков. Их `#` сохраняет нативное
поведение браузера. При появлении страниц достаточно поменять href в данных.
Для CMS переносится section из dist/index.html, данные заменяются серверным
циклом с экранированием текста и проверкой URL; подключается общий stylesheet.

Используются Manrope, container, токены text/action/accent, space, text-base,
leading-body, layout-control и duration-fast (160 мс). Заголовок соответствует
типографике соседних секций. Ссылки подчёркнуты, маркер — декоративный пустой
псевдоэлемент 8 px; привязан к центру первой строки. Нет изображений и карточек.
Hover меняет цвет на action, active возвращает text, focus-visible — общий
контрастный outline. Минимальная высота ссылки 44 px. Reduced motion учитывается.

Сетка построчная: 1 колонка до md, 2 от 768 px, 3 от lg (992 px).
Длинные названия переносятся, высота не ограничена.

## Проверки

- `npm run check`: 0 ошибок и 0 диагностических warnings, один прежний hint
  в test-featured-products-browser.mjs. При первичном запуске также были
  сообщения Vite о разрешении optimizeDeps в песочнице.
- `npm run build`: успешно, обе статические страницы, два CSS, проверка ресурсов.
  Сохранились существующие Sass deprecations Bootstrap и предупреждения о двух
  отсутствующих изображениях ProductCard; компонент новых предупреждений не добавил.
- `node scripts/test-completed-works-browser.mjs`: Chrome headless на
  375/768/1024/1440 px; точные названия/порядок/href, количество колонок,
  построчная раскладка, отсутствие переполнения и обрезания, маркер,
  высота нажатия, hover/active/focus, порядок Tab, reduced motion, вывод без JS
  и отсутствие ошибок браузера.

Для воспроизведения браузерной проверки: `npm run preview -- --host 127.0.0.1`,
затем скрипт. Параметры окружения CHROME_PATH и SHOWCASE_BASE_URL меняют браузер
и адрес. Снимки и результаты — artifacts/completed-works/.
В этой среде сборка и Chrome запускались с разрешением вне песочницы.

Не создавались детальные страницы, галереи и интеграция с CMS/API.
Safari, Firefox и физические устройства не проверялись; полная регрессия
интерактивных сценариев остальных компонентов не выполнялась.
