import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Silences the "multiple lockfiles" warning: this app is an npm workspace
  // member, but it also keeps its own lockfile from before the workspace
  // existed. Pinning root here (instead of deleting either lockfile) avoids
  // touching install state we haven't verified is safe to remove.
  turbopack: {
    root: path.join(__dirname, "..", ".."),
  },
  // Traces the minimal set of files/node_modules the server actually needs
  // into .next/standalone — the production Docker image copies just that
  // instead of the full workspace node_modules.
  output: "standalone",
};

export default nextConfig;
