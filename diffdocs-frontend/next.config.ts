import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // Pin the workspace root to this project so a stray lockfile in a parent
    // directory (e.g. C:\Users\<you>\package-lock.json) isn't mistaken for it.
    root: path.join(__dirname),
  },
};

export default nextConfig;
