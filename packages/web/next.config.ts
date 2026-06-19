import path from "node:path"
import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // Produce a self-contained server bundle at .next/standalone for the Docker
  // runner stage (Dockerfile.web COPYs it and runs packages/web/server.js).
  output: "standalone",
  async headers() {
    return [
      {
        // COOP/COEP on the upload page only — enables SharedArrayBuffer which
        // FFmpeg.wasm needs for its multi-threaded (fast) encode mode.
        source: "/upload",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          // credentialless (vs require-corp) lets us load FFmpeg WASM from CDN
          // without needing CORP headers on those assets.
          { key: "Cross-Origin-Embedder-Policy", value: "credentialless" },
        ],
      },
    ]
  },
  // The build runs from packages/web inside a Bun workspace, so point file
  // tracing at the monorepo root to bundle workspace deps (@pixfete/shared).
  outputFileTracingRoot: path.join(__dirname, "../../"),
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  },
  transpilePackages: ["@pixfete/shared"],
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
}

export default nextConfig
