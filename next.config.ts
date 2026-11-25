import type { NextConfig } from "next";

// On Bonto (bonto.dev) we build with `npm run build:bonto`, which sets
// STANDALONE_OUTPUT=1 so Next.js produces a self-contained server at
// .next/standalone/server.js (Bonto injects PORT automatically).
const isStandalone = process.env.STANDALONE_OUTPUT === "1";

const nextConfig: NextConfig = {
  ...(isStandalone ? { output: "standalone" as const } : {}),
  images: {
    unoptimized: true,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "2gb",
    },
    proxyClientMaxBodySize: "2gb",
  },
};

export default nextConfig;
