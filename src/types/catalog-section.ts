export interface CatalogSubcategory {
  name: string;
  img: string;
  url: string;
}

/** Text is escaped by Astro; only explicitly marked fragments become strong. */
export interface CatalogNoticeFragment {
  text: string;
  strong?: boolean;
}

export type CatalogNotice = string | CatalogNoticeFragment[];
