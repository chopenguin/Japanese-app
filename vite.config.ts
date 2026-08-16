import { defineConfig } from "vite";
import type { Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { cpSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";

type VoiceCatalog = {
  voices?: Array<{
    id?: unknown;
    audio_base_url?: unknown;
  }>;
};

function copyRegisteredPublicAssets(): Plugin {
  let projectRoot = process.cwd();
  let outputDirectory = resolve(projectRoot, "dist");

  return {
    name: "copy-registered-public-assets",
    apply: "build",
    configResolved(config) {
      projectRoot = config.root;
      outputDirectory = resolve(projectRoot, config.build.outDir);
    },
    closeBundle() {
      const publicDirectory = resolve(projectRoot, "public");
      const voiceCatalogPath = resolve(
        publicDirectory,
        "audio/voices/index.json",
      );
      const voiceCatalog = JSON.parse(
        readFileSync(voiceCatalogPath, "utf8"),
      ) as VoiceCatalog;
      const localVoiceIds = new Set(
        (voiceCatalog.voices ?? [])
          .filter((voice) => !voice.audio_base_url)
          .map((voice) => voice.id)
          .filter((voiceId): voiceId is string => typeof voiceId === "string"),
      );

      cpSync(publicDirectory, outputDirectory, {
        recursive: true,
        force: true,
        filter(source) {
          const publicPath = relative(publicDirectory, source).replaceAll(
            "\\",
            "/",
          );
          if (
            publicPath === "audio/voices/index.json" ||
            !publicPath.startsWith("audio/voices/")
          ) {
            return true;
          }

          const voiceId = publicPath.split("/")[2];
          return localVoiceIds.has(voiceId);
        },
      });
    },
  };
}

export default defineConfig(({ command }) => ({
  base: process.env.GITHUB_PAGES === "true" ? "/Japanese-app/" : "/",
  publicDir: command === "build" ? false : "public",
  plugins: [
    react(),
    ...(command === "build" ? [copyRegisteredPublicAssets()] : []),
  ],
}));
