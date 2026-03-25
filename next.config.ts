import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "generator-called-jean-informed.trycloudflare.com",
    "*.trycloudflare.com",
  ],
};

export default nextConfig;
