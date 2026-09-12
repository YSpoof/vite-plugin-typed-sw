# vite-plugin-typed-sw

Vite plugin to compile ESM type-safe Service Workers with HMR, precache build assets, and inject Web App Manifests.

## Features

- **ESM Service Worker:** Compiles and registers with `type: 'module'`.
- **HMR in Dev:** Edits to your service worker or its imports automatically call `registration.update()`.
- **Asset Extraction & Versioning:** Import `buildFiles`, `publicFiles`, and `version` directly in the worker.
- **SvelteKit-Style Type Isolation:** Zero conflict between `WebWorker` and `DOM` globals.
- **Optional Manifest:** Auto-injects `<link rel="manifest">` when `manifestPath` is set.

## Installation

```bash
npm install -D vite-plugin-typed-sw
# or
pnpm add -D vite-plugin-typed-sw
```

## Quick Start

### 1. Vite Config

```typescript
// vite.config.ts
import { defineConfig } from "vite";
import typedSwPlugin from "vite-plugin-typed-sw";

export default defineConfig({
  plugins: [
    typedSwPlugin(),
  ],
});
```

> Defaults to `./src/service-worker/index.ts`. You can customize the path via `serviceWorkerFile`.

### 2. Write your Service Worker

```typescript
// src/service-worker/index.ts
import { buildFiles, publicFiles, version } from "virtual:typed-sw-extras";

declare let self: ServiceWorkerGlobalScope;

const CACHE = `myapp-${version}`;
const ASSETS = [...buildFiles, ...publicFiles];

self.addEventListener("install", (event) => {
  // Create a new cache and add all files to it
  async function addFilesToCache() {
    const cache = await caches.open(CACHE);
    await cache.addAll(ASSETS);
  }
  self.skipWaiting();
  event.waitUntil(addFilesToCache());
});

self.addEventListener("activate", (event) => {
  // Remove previous cached data from disk
  async function deleteOldCaches() {
    for (const key of await caches.keys()) {
      if (key !== CACHE) await caches.delete(key);
    }
  }

  event.waitUntil(
    (async () => {
      await deleteOldCaches();
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || !req.url.startsWith("http")) return;

  async function respond() {
    const url = new URL(event.request.url);
    const cache = await caches.open(CACHE);

    if (ASSETS.includes(url.pathname)) {
      const response = await cache.match(url.pathname);

      if (response) return response;
    }

    // for everything else, network only
    return await fetch(event.request);
  }

  event.respondWith(respond());
});
```

### 3. TypeScript Configuration (Type Safety)

Isolate `WebWorker` types from the rest of your app with a dedicated config:

1. Create `src/service-worker/tsconfig.json`:

```json
{
  "extends": "vite-plugin-typed-sw/tsconfig/service-worker"
}
```

1. Exclude `src/service-worker` from your root `tsconfig.json`:

```json
{
  "compilerOptions": { ... },
  "include": ["src"],
  "exclude": ["src/service-worker"]
}
```

Cursor, VS Code, and other editors automatically load the worker preset for `src/service-worker`, giving you full type-checking and autocompletion with zero DOM collisions.

## Virtual Modules

### `virtual:typed-sw-extras` (Inside Service Worker)

Provides emitted build assets and cache versioning:

```typescript
import { buildFiles, publicFiles, version } from "virtual:typed-sw-extras";
```

| Export        | Type       | Description                                                                                   |
| ------------- | ---------- | --------------------------------------------------------------------------------------------- |
| `buildFiles`  | `string[]` | Emitted client build files (JS chunks, CSS, images). Prefixed with Vite `base`. Empty in dev. |
| `publicFiles` | `string[]` | Files found in your `public/` directory. Prefixed with Vite `base`.                           |
| `version`     | `string`   | Unique build timestamp (`Date.now().toString(13)`). Set to `"dev"` in dev mode.               |

### `virtual:typed-sw-register` (Inside Client App)

For manual registration (SSR, SvelteKit, etc.) or accessing registration info:

```typescript
import { registerSW, swUrl, swScope, manifestUrl } from "virtual:typed-sw-register";

registerSW();
```

> If you don't import this module, registration is injected into `index.html` automatically.

Add client types to your root `tsconfig.json`:

```json
{
  "compilerOptions": {
    "types": ["vite/client", "vite-plugin-typed-sw/client"]
  }
}
```

## Configuration Options

| Option              | Type      | Default                         | Description                                                            |
| ------------------- | --------- | ------------------------------- | ---------------------------------------------------------------------- |
| `serviceWorkerFile` | `string`  | `./src/service-worker/index.ts` | Path to the Service Worker entry.                                      |
| `manifestPath`      | `string`  | unset                           | Resolved manifest href (e.g. `/manifest.json`). Auto-injected in HTML. |
| `load`              | `boolean` | `true`                          | Compile, serve, emit, and register the SW. Set `false` to disable.     |
| `scope`             | `string`  | Vite `base`                     | Service worker registration scope.                                     |
| `version`           | `string`  | timestamp                       | Custom cache version identifier exposed via `virtual:typed-sw-extras`. |

## Source Code

Since this plugin is MIT licensed, you can also contribute to it at it's repo on [GitHub](https://github.com/YSpoof/vite-plugin-typed-sw)