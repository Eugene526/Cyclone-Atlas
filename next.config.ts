import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {'/api/weather': ['./public/vendor/eccodes.wasm.gz','./public/vendor/icon-world-025.indices.gz'],'/api/weather/*': ['./public/vendor/eccodes.wasm.gz','./public/vendor/icon-world-025.indices.gz']},
};

export default nextConfig;
