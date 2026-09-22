import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@pricewatch/ui",
    "@pricewatch/shared",
    "@pricewatch/api",
  ],
};

export default nextConfig;
