export interface NavigationItem { id: string; label: string; url: string; }
// Preliminary CMS routes. No corresponding pages are generated at this stage.
export const navigation: NavigationItem[] = [
  { id: 'about', label: 'О печном центре', url: '/about/' },
  { id: 'articles', label: 'Статьи', url: '/articles/' },
  { id: 'installation', label: 'Монтаж', url: '/installation/' },
  { id: 'works', label: 'Наши работы', url: '/works/' },
  { id: 'delivery', label: 'Доставка', url: '/delivery/' },
  { id: 'contacts', label: 'Контакты', url: '/contacts/' },
  { id: 'offers', label: 'Акции', url: '/offers/' },
];
