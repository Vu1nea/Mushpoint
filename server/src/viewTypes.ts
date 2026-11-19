import type { VisionItem } from './types';

/** A vision item as the API returns it: the stored path plus a short-lived signed URL. */
export type VisionItemView = VisionItem & { imageUrl: string | null };
