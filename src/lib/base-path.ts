/**
 * GitHub Pages дээр сайт `/Environment` дэд замд байрлана.
 * `<Link>`, `usePathname()` нь basePath-ыг өөрөө зохицуулдаг ч
 * гар `fetch`, worker-ийн хаяг зэрэг түүхий зам үүнийг мэддэггүй.
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Түүхий замыг basePath-тай нь холбоно. */
export const asset = (path: string) => `${BASE_PATH}${path}`;
