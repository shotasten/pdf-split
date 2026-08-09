import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  experimental: {
    useTypeScriptCli: true
  },
  turbopack: {
    root: process.cwd()
  },
  images: {
    unoptimized: true
  }
};

export default nextConfig;
