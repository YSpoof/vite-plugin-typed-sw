import type { HtmlTagDescriptor, Plugin, ResolvedConfig } from "vite";
import { build } from "esbuild";
import path from "node:path";
import fs from "node:fs";
import { getEsbuildOptions } from "./esbuild.js";
import { generateRegisterCode } from "./register.js";

export interface TypedSwOptions {
  serviceWorkerFile: string;
  /** Inject `<link rel="manifest">` only when set. */
  manifestPath?: string;
  load?: boolean;
  /** SW registration scope. Defaults to Vite `base`. */
  scope?: string;
}

const VIRTUAL_MODULE_ID = "virtual:typed-sw-register";
const RESOLVED_VIRTUAL_MODULE_ID = "\0" + VIRTUAL_MODULE_ID;

function joinUrl(base: string, name: string) {
  return `${base.replace(/\/$/, "")}/${name}`;
}

export default function typedSwPlugin(options: TypedSwOptions): Plugin {
  let viteConfig: ResolvedConfig;
  let swDependencies = new Set<string>();
  let useImportRegister = false;

  const { serviceWorkerFile, manifestPath, load = true, scope } = options;

  const resolvedSwFile = path.resolve(serviceWorkerFile);
  const swName = path.parse(serviceWorkerFile).name + ".js";

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

    async generateBundle() {
      if (!load) return;

      if (!fs.existsSync(resolvedSwFile)) {
        this.error(`Service worker file not found at: ${resolvedSwFile}`);
      }

      const result = await build({
        ...getEsbuildOptions(viteConfig, [resolvedSwFile]),
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
