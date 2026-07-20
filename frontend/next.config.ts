import type { NextConfig } from "next";

const apiUrlInternal = process.env.API_URL_INTERNAL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const nextConfig: NextConfig = {
  // Next redirige /api/x -> /api/x (sans slash final) avant d'appliquer les rewrites,
  // ce qui casse le proxy vers Django (APPEND_SLASH=False, toutes les routes finissent par /).
  skipTrailingSlashRedirect: true,
  images: {
    remotePatterns: [
      { protocol: "http", hostname: "localhost", port: "8000" },
      { protocol: "http", hostname: "web", port: "8000" },
    ],
  },
  async rewrites() {
    return [
      // :path* drops the trailing slash on reconstruction, but every Django route
      // here requires one (APPEND_SLASH=False) — append it explicitly.
      { source: "/api/:path*", destination: `${apiUrlInternal}/api/:path*/` },
      { source: "/media/:path*", destination: `${apiUrlInternal}/media/:path*` },
    ];
  },
};

export default nextConfig;
