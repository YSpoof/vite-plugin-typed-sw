import type { HtmlTagDescriptor, Plugin, ResolvedConfig } from "vite";
import { build } from "esbuild";
import path from "node:path";
import fs from "node:fs";
import { getEsbuildOptions } from "./esbuild.js";
import { generateRegisterCode } from "./register.js";
import { getPublicFiles, createSwExtrasPlugin, joinUrl } from "./assets.js";

export interface TypedSwOptions {
  /**
   * Path to the Service Worker entry.
   * If omitted, searches for `src/service-worker/index.ts` or `src/sw/index.ts`.
   * @default "./src/service-worker/index.ts"
   */
  serviceWorkerFile?: string;
  /** Inject `<link rel="manifest">` only when set. */
  manifestPath?: string;
  load?: boolean;
  /** SW registration scope. Defaults to Vite `base`. */
  scope?: string;
  /**
   * Build version exposed via `virtual:typed-sw-extras`.
   * Defaults to `Date.now().toString(13)` (unique per build).
   */
  version?: string;
}

const VIRTUAL_MODULE_ID = "virtual:typed-sw-register";
const RESOLVED_VIRTUAL_MODULE_ID = "\0" + VIRTUAL_MODULE_ID;

function resolveSwEntry(configuredPath?: string, root: string = process.cwd()): string {
  if (configuredPath) return path.resolve(root, configuredPath);

  const candidates = [
    "src/service-worker/index.ts",
    "src/service-worker/index.js",
    "src/sw/index.ts",
    "src/sw/index.js",
  ];

  for (const candidate of candidates) {
    const fullPath = path.resolve(root, candidate);
    if (fs.existsSync(fullPath)) {
      return fullPath;
    }
  }

  return path.resolve(root, "src/service-worker/index.ts");
}

function resolveSwOutputName(entryPath: string): string {
  const parsed = path.parse(entryPath);
  if (parsed.name === "index") {
    const parentDirName = path.basename(parsed.dir);
    return (parentDirName || "sw") + ".js";
  }
  return parsed.name + ".js";
}

export default function typedSwPlugin(options: TypedSwOptions = {}): Plugin {
  let viteConfig: ResolvedConfig;
  let swDependencies = new Set<string>();
  let useImportRegister = false;

  const { serviceWorkerFile, manifestPath, load = true, scope, version } = options;

  let resolvedSwFile = resolveSwEntry(serviceWorkerFile);
  let swName = resolveSwOutputName(resolvedSwFile);

  function getSwUrl() {
    return joinUrl(viteConfig?.base || "/", swName);
  }

  function getScope() {
    return scope ?? (viteConfig?.base || "/");
  }

  function getManifestUrl() {
    if (!manifestPath) return undefined;
    return joinUrl(viteConfig?.base || "/", manifestPath.replace(/^\//, ""));
  }

  return {
    name: "vite-plugin-typed-sw",
    enforce: "post",

    configResolved(config) {
      viteConfig = config;
      resolvedSwFile = resolveSwEntry(serviceWorkerFile, config.root);
      swName = resolveSwOutputName(resolvedSwFile);
    },

    resolveId(id) {
      if (id === VIRTUAL_MODULE_ID) return RESOLVED_VIRTUAL_MODULE_ID;
    },

    load(id) {
      if (id !== RESOLVED_VIRTUAL_MODULE_ID) return;

      useImportRegister = true;
      return generateRegisterCode(getSwUrl(), getScope(), getManifestUrl(), load);
    },

    configureServer(server) {
      if (!load) return;

      server.middlewares.use(async (req, res, next) => {
        const reqPath = req.url?.split("?")[0];

        if (reqPath === getSwUrl()) {
          try {
            const result = await build({
              ...getEsbuildOptions(viteConfig, [resolvedSwFile]),
              plugins: [
                createSwExtrasPlugin(
                  [],
                  getPublicFiles(viteConfig.publicDir, viteConfig.base || "/"),
                  "dev",
                ),
              ],
              sourcemap: "inline",
              metafile: true,
            });

            if (result.metafile) {
              swDependencies = new Set(
                Object.keys(result.metafile.inputs).map((p) => path.resolve(p)),
              );
            }

            res.setHeader("Content-Type", "application/javascript");
            res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
            res.end(result.outputFiles[0].contents);
          } catch (err) {
            console.error("[vite-plugin-typed-sw] Dev SW build failed:", err);
            next(err);
          }
        } else {
          next();
        }
      });
    },

    handleHotUpdate({ file, server }) {
      if (!load) return;

      if (file === resolvedSwFile || swDependencies.has(file)) {
        server.ws.send({
          type: "custom",
          event: "typed-sw-update",
        });
      }
    },

    async generateBundle(_options, bundle) {
      if (!load) return;

      if (!fs.existsSync(resolvedSwFile)) {
        this.error(`Service worker file not found at: ${resolvedSwFile}`);
      }

      const base = viteConfig.base || "/";
      const collectedBuildFiles = Object.keys(bundle)
        .filter((f) => !f.endsWith(".map") && f !== swName)
        .map((f) => joinUrl(base, f));
      const collectedPublicFiles = getPublicFiles(viteConfig.publicDir, base);
      const buildVersion = version ?? Date.now().toString(13);

      const result = await build({
        ...getEsbuildOptions(viteConfig, [resolvedSwFile]),
        plugins: [
          createSwExtrasPlugin(
            collectedBuildFiles,
            collectedPublicFiles,
            buildVersion,
          ),
        ],
        minify: viteConfig.isProduction,
      });

      if (result.outputFiles && result.outputFiles.length > 0) {
        this.emitFile({
          type: "asset",
          fileName: swName,
          source: result.outputFiles[0].contents,
        });
      }
    },

    transformIndexHtml() {
      if (useImportRegister) return;

      const tags: HtmlTagDescriptor[] = [];

      const resolvedManifestPath = getManifestUrl();
      if (resolvedManifestPath) {
        tags.push({
          tag: "link",
          attrs: { rel: "manifest", href: resolvedManifestPath },
          injectTo: "head",
        });
      }

      if (load) {
        tags.push({
          tag: "script",
          attrs: { type: "module" },
          children: `import { registerSW } from "${VIRTUAL_MODULE_ID}";\nregisterSW();`,
          injectTo: "body",
        });
      }

      return tags;
    },
  };
}
