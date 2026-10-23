import type { NextConfig } from "next";

const desktopExport = process.env.ALINHA_DESKTOP_EXPORT === "1";

const nextConfig: NextConfig = {
  // Desktop bundles only static assets; no Node server or unsupported Next features.
  ...(desktopExport ? {output: "export" as const, images: {unoptimized: true}} : {}),
  // Keep screenshots and local demos free of development-only UI.
  devIndicators: false,
  cacheComponents: !desktopExport,
  partialPrefetching: !desktopExport,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
