export const mediaUrl = (itemId: string): string => `downtube-media://item/${itemId}`;
export const thumbUrl = (itemId: string): string => `downtube-media://thumb/${itemId}`;
export const coverUrl = (collectionId: string): string => `downtube-media://cover/${collectionId}`;
export const subtitleUrl = (itemId: string, lang: string): string => `downtube-media://sub/${itemId}/${encodeURIComponent(lang)}`;
