import fs from "node:fs";
import path from "node:path";
import type { Plugin as EsbuildPlugin } from "esbuild";

export function joinUrl(base: string, name: string): string {
  return `${base.replace(/\/$/, "")}/${name.replace(/^\//, "")}`;
}

/**
 * Recursively collect all file paths under `publicDir`,
 * returning them as URL strings prefixed with `base`.
 */
export function getPublicFiles(
  publicDir: string | false | undefined,
  base: string,
): string[] {
  if (!publicDir || typeof publicDir !== "string" || !fs.existsSync(publicDir)) {
    return [];
  }

  const files: string[] = [];
  function walk(dir: string): void {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else {
        const relativePath = path
          .relative(publicDir as string, fullPath)
          .replace(/\\/g, "/");
        files.push(joinUrl(base, relativePath));
      }
    }
  }
  walk(publicDir);
  return files;
}

/**
 * esbuild plugin that resolves `virtual:typed-sw-extras` to a module
 * exporting the build files, public files, and version as static values.
 */
export function createSwExtrasPlugin(
  buildFiles: string[],
  publicFiles: string[],
  version: string,
): EsbuildPlugin {
  return {
    name: "typed-sw-extras",
    setup(build) {
      build.onResolve({ filter: /^virtual:typed-sw-extras$/ }, (args) => ({
        path: args.path,
        namespace: "typed-sw-extras",
      }));

      build.onLoad(
        { filter: /.*/, namespace: "typed-sw-extras" },
        () => ({
          contents: [
            `export const buildFiles = ${JSON.stringify(buildFiles)};`,
            `export const publicFiles = ${JSON.stringify(publicFiles)};`,
            `export const version = ${JSON.stringify(version)};`,
          ].join("\n"),
          loader: "js",
        }),
      );
    },
  };
}
