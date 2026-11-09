import type { NextConfig } from "next";

/**
 * Config notes:
 *  - `output: "standalone"` only for self-hosted/Docker runs (sandbox).
 *    On Vercel we let the platform use its own optimized output.
 *  - Headers: the Service Worker must always revalidate (so PWA updates
 *    ship instantly), while icons/manifest can be cached hard.
 */
const nextConfig: NextConfig = {
  output: process.env.VERCEL ? undefined : "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/manifest.json",
        headers: [{ key: "Cache-Control", value: "public, max-age=3600" }],
      },
      {
        source: "/icons/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400" }],
      },
      {
        source: "/images/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400" }],
      },
    ];
  },
};

export default nextConfig;
