import type { FilterGroup } from '../types/catalog-filter';

const choices = [
  ['offers', 'Наши предложения', ['Хит', 'Новинка']],
  ['brand', 'Бренд', ['LODE', 'КС-Керамик', 'Донские Зори', 'ЛСР', 'ОАО Керамика', 'Боровичи']],
  ['kind', 'Вид', ['Лицевой', 'Рабочий', 'Шамотный']],
  ['color', 'Цвет', ['Бордовый', 'Желтый', 'Коричневый', 'Красный', 'Пестрый', 'Разноцветный', 'Светлый', 'Серый', 'Черный']],
  ['shape', 'Форма', ['Стандартный', 'Фигурный']],
  ['format', 'Формат', ['Европейский WDF', 'Одинарный (1НФ)', 'Спецформат', 'Фасадный']],
] satisfies [string, string, string[]][];

export const catalogFilterGroups: FilterGroup[] = [
  { id: 'price', label: 'Цена, ₽', type: 'range', min: 0, max: 42490, minName: 'price_from', maxName: 'price_to', open: true },
  ...choices.map(([id, label, values]) => ({
    id, label, type: 'checkbox' as const, name: `${id}[]`,
    options: values.map((label, index) => ({ id: `${id}-${index}`, value: String(index), label })),
  })),
];
