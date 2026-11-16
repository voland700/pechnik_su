import type { ImageMetadata } from 'astro';

export interface Store {
  id: string;
  name: string;
  image: ImageMetadata;
  url: string;
  address: string;
  workingHours: string;
  contacts: { department?: string; phone: string; phoneHref: string }[];
}
