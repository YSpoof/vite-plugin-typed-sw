import type { Plugin, ResolvedConfig } from 'vite';
import { build } from 'esbuild';
import path from 'node:path';
import fs from 'node:fs';

export interface TypedSwOptions {
  serviceWorkerFile: string;
  manifestPath?: string;
  load?: boolean;
}

export default function typedSwPlugin(options: TypedSwOptions): Plugin {
  let viteConfig: ResolvedConfig;
  let swDependencies = new Set<string>();
  
  const {
    serviceWorkerFile,
    manifestPath = '/manifest.json',
    // Default to true so HMR works out of the box in dev.
    // User can explicitly pass `process.env.NODE_ENV === 'production'` to disable in dev.
    load = true,
  } = options;

  const resolvedSwFile = path.resolve(serviceWorkerFile);
  const swName = path.parse(serviceWorkerFile).name + '.js';

  return {
    name: 'vite-plugin-typed-sw',
    enforce: 'post',

    configResolved(config) {
      viteConfig = config;
    },

    // 1. Dev Server Compilation (ESM format, bundled on-the-fly)
    configureServer(server) {
      if (!load) return;

      server.middlewares.use(async (req, res, next) => {
        const reqPath = req.url?.split('?')[0]; 
        
        if (reqPath === `/${swName}`) {
          try {
            const result = await build({
              entryPoints: [resolvedSwFile],
              bundle: true,
              format: 'esm',
              write: false,
              sourcemap: 'inline',
              metafile: true, 
              target: 'esnext',
            });

            // Track dependencies (e.g. imported utils) so HMR works on those too
            if (result.metafile) {
              swDependencies = new Set(
                Object.keys(result.metafile.inputs).map((p) => path.resolve(p))
              );
            }

            // Force no-cache so registration.update() always grabs the fresh file
            res.setHeader('Content-Type', 'application/javascript');
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
            res.end(result.outputFiles[0].contents);
          } catch (err) {
            console.error('[vite-plugin-typed-sw] Dev SW build failed:', err);
            next(err);
          }
        } else {
          next();
        }
      });
    },

    // 2. Intercept File Changes for SW HMR
    handleHotUpdate({ file, server }) {
      if (!load) return;

      if (file === resolvedSwFile || swDependencies.has(file)) {
        // Broadcast custom HMR event without triggering a full page reload
        server.ws.send({
          type: 'custom',
          event: 'typed-sw-update'
        });
      }
    },

    // 3. Compile ESM Worker for Production
    async generateBundle() {
      if (!load) return;

      if (!fs.existsSync(resolvedSwFile)) {
        this.error(`Service worker file not found at: ${resolvedSwFile}`);
      }

      const result = await build({
        entryPoints: [resolvedSwFile],
        bundle: true,
        format: 'esm', // Pure modern ES module output
        minify: viteConfig.isProduction,
        write: false,
        target: 'esnext',
      });

      if (result.outputFiles && result.outputFiles.length > 0) {
        this.emitFile({
          type: 'asset',
          fileName: swName,
          source: result.outputFiles[0].contents,
        });
      }
    },

    // 4. Inject Manifest, SW Registration, and HMR Listener
    transformIndexHtml(html) {
      if (!load) return html;

      const base = viteConfig.base || '/';
      const swUrl = `${base}${swName}`.replace(/\/\//g, '/');
      const tags: any[] = [];

      if (manifestPath) {
        const resolvedManifestPath = `${base}${manifestPath.replace(/^\//, '')}`;
        tags.push({
          tag: 'link',
          attrs: { rel: 'manifest', href: resolvedManifestPath },
          injectTo: 'head',
        });
      }

      // Registers SW strictly as `{ type: 'module' }`
      // Connects Vite's client HMR socket to the Service Worker lifecycle
      const scriptCode = `
        if ('serviceWorker' in navigator) {
          window.addEventListener('load', () => {
            navigator.serviceWorker.register('${swUrl}', { type: 'module' })
              .then(reg => {
                console.log('[Typed SW] Registered successfully as ES Module.', reg);
                
                // HMR Integration
                if (import.meta.hot) {
                  import.meta.hot.on('typed-sw-update', () => {
                    console.log('[Typed SW] Update detected. Refreshing Service Worker...');
                    reg.update();
                  });
                }
              })
              .catch(err => console.error('[Typed SW] Registration failed:', err));
          });
        }
      `;

      tags.push({
        tag: 'script',
        attrs: { type: 'module' },
        children: scriptCode,
        injectTo: 'body',
      });

      return tags;
    }
  };
}
