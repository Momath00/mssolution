import type { NextConfig } from "next";

const apiUrlInternal = process.env.API_URL_INTERNAL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "http", hostname: "localhost", port: "8000" },
      { protocol: "http", hostname: "web", port: "8000" },
    ],
  },
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${apiUrlInternal}/api/:path*` },
      { source: "/media/:path*", destination: `${apiUrlInternal}/media/:path*` },
    ];
  },
};

export default nextConfig;
