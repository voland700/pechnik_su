export interface HeroSlideData {
  name: string;
  /** Controlled HTML only; CMS must sanitize using the documented allowlist. */
  text?: string;
  link?: string;
  backgraund?: string;
  img?: string;
  imageWidth?: number;
  imageHeight?: number;
  overlay?: string;
  backgroundPosition?: string;
}
