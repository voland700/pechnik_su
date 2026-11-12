import source from '../../assets/benefits.json';

// Vite emits these source assets with production-safe URLs. Keep the JSON intact.
const images = import.meta.glob<string>('../../assets/images/benefits/*.{jpg,jpeg,png,webp,avif}', {
  eager: true, query: '?url', import: 'default',
});
const imageAliases: Record<string, string> = {
  'assets/images/benefits/benefit_4.jpg': 'assets/images/benefits/benefit_4.png',
};
const alts = [
  'Камни для банной печи Атмосфера',
  'Камни для бани в упаковке',
  'Логотип HWAM',
  'Символ выгодного предложения — поднятый большой палец',
];

export const benefits = source.map((item, index) => {
  const path = imageAliases[item.img] ?? item.img;
  const img = images[`../../${path}`];
  if (!img) throw new Error(`[Benefit] Missing image: ${path}`);
  return { ...item, img, alt: alts[index] ?? item.title };
});
