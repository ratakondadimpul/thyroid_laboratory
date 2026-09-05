import type { NextConfig } from "next";
const isFirebaseBuild = process.env.FIREBASE_BUILD === "true";

const nextConfig: NextConfig = {
  // Warm newsprint build: no export for Vercel (SSR), static export for Firebase
  ...(isFirebaseBuild ? { output: "export" as const, images: { unoptimized: true } } : {}),
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  async rewrites() {
    // Fix DNS_HOSTNAME_RESOLVED_PRIVATE (404): never proxy production traffic to private IP
    // Production on Vercel: frontend calls same-origin /api -> api/index.py -> FastAPI (via vercel.json rewrites)
    // Only proxy to localhost in LOCAL DEVELOPMENT
    if (process.env.NODE_ENV !== "development") return [];
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
    const isLocal = backendUrl.includes("127.0.0.1") || backendUrl.includes("localhost");
    if (!isLocal) return [];
    return [
      { source: "/api/:path*", destination: `${backendUrl}/api/:path*` },
      { source: "/health", destination: `${backendUrl}/health` }
    ];
  },
};
export default nextConfig;
