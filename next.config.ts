import type { NextConfig } from "next";

/**
 * GitHub Pages — статик экспорт.
 * `NEXT_PUBLIC_BASE_PATH` нь repo-гийн дэд зам (`/Environment`).
 * Дотоод хөгжүүлэлтэд хоосон тул `next dev` хэвийн ажиллана.
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
