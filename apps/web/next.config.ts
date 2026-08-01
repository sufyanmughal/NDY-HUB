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
  // instead of the full workspace node_modules. Vercel sets its own
  // packaging for serverless functions and explicitly documents
  // output:"standalone" as unnecessary there — worse, it's a known cause of
  // "Serverless Function has crashed" (FUNCTION_INVOCATION_FAILED) on
  // Vercel specifically, since the standalone server.js conflicts with how
  // Vercel wraps the app. process.env.VERCEL is set automatically by
  // Vercel's build environment, so this only turns standalone mode on for
  // the Docker build path, never on Vercel.
  output: process.env.VERCEL ? undefined : "standalone",
};

export default nextConfig;
