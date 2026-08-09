import { defineConfig } from "vite";
import type { Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { cpSync } from "node:fs";
import { relative, resolve } from "node:path";

const isGitHubPages = process.env.GITHUB_PAGES === "true";
const remoteVoicePackBaseUrl = process.env.VITE_VOICE_PACK_BASE_URL?.trim();

if (isGitHubPages && !remoteVoicePackBaseUrl) {
  throw new Error(
    "GitHub Pages builds require VITE_VOICE_PACK_BASE_URL. Set the VOICE_PACK_BASE_URL repository variable to the public HTTPS /voices URL.",
  );
}

function copyPagesPublicAssetsWithoutVoiceWavs(): Plugin {
  let projectRoot = process.cwd();
  let outputDirectory = resolve(projectRoot, "dist");

  return {
    name: "copy-pages-public-assets-without-voice-wavs",
    apply: "build",
    configResolved(config) {
      projectRoot = config.root;
      outputDirectory = resolve(projectRoot, config.build.outDir);
    },
    closeBundle() {
      const publicDirectory = resolve(projectRoot, "public");
      cpSync(publicDirectory, outputDirectory, {
        recursive: true,
        force: true,
        filter(source) {
          const publicPath = relative(publicDirectory, source).replaceAll("\\", "/");
          return !(
            publicPath.startsWith("audio/voices/") &&
            publicPath.toLowerCase().endsWith(".wav")
          );
        },
      });
    },
  };
}

export default defineConfig({
  base: isGitHubPages ? "/Japanese-app/" : "/",
  publicDir: isGitHubPages ? false : "public",
  plugins: [
    react(),
    ...(isGitHubPages ? [copyPagesPublicAssetsWithoutVoiceWavs()] : []),
  ],
});
