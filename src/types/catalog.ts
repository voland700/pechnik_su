export interface CatalogCategory {
  name: string;
  img: string;
  children: string[];
  url?: string;
  /** Optional CMS URLs keyed by the unchanged child label. */
  childUrls?: Record<string, string>;
}

export interface CatalogNavigationItem {
  name: string;
  url: string;
}
