# vite-plugin-typed-sw

Vite plugin that compiles your ESM Service Worker with esbuild, serves it with HMR in development, and emits it at build. You write the worker. Manifest injection is opt-in.

## Features

- **ESM Service Worker:** Compiles and registers as `type: 'module'`.
- **HMR:** Edits to `sw.ts` (or files it imports) call `registration.update()` without a full page reload.
- **Your SW:** No Workbox, no caching strategy. Bring your own implementation.
- **Optional manifest:** Injects `<link rel="manifest">` only when you set `manifestPath`.
- **Type-safe SW:** Isolate WebWorker types from DOM types via a separate tsconfig.

## Installation

```bash
npm install -D vite-plugin-typed-sw
# or
yarn add -D vite-plugin-typed-sw
# or
pnpm add -D vite-plugin-typed-sw
```

## Usage

### 1. Vite config

```typescript
import { defineConfig } from "vite";
import typedSwPlugin from "vite-plugin-typed-sw";

export default defineConfig({
  plugins: [
    typedSwPlugin({
      serviceWorkerFile: "./src/sw.ts",
    }),
  ],
});
```

If you never import `virtual:typed-sw-register`, apps with `index.html` get register (and optional manifest) injected automatically. To also inject a web app manifest:

```typescript
typedSwPlugin({
  serviceWorkerFile: "./src/sw.ts",
  manifestPath: "/manifest.json", // file in `public/`
});
```

### 2. Write your Service Worker

```typescript
// src/sw.ts
const sw = self as unknown as ServiceWorkerGlobalScope;

sw.addEventListener("install", (event) => {
  console.log("[SW] Installed");
  event.waitUntil(sw.skipWaiting());
});

sw.addEventListener("fetch", (event) => {
  console.log("[SW] Fetching:", event.request.url);
});
```

## TypeScript Configuration (Type Safety)

Service Workers use `ServiceWorkerGlobalScope`, not `Window`. Isolate SW types so they do not clash with DOM lib types.

1. Create `tsconfig.sw.json` in the project root:

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "lib": ["ESNext", "WebWorker"],
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true
  },
  "include": ["src/sw.ts"]
}
```

2. Exclude the service worker from the main `tsconfig.json`:

```json
{
  "compilerOptions": {
    // ... your standard DOM config
  },
  "exclude": ["src/sw.ts"]
}
```

### 3. Manual registration (SSR / frameworks without `index.html`)

Import the virtual module (Solid Start, SvelteKit, etc.):

```typescript
import { registerSW, swUrl, swScope, manifestUrl } from "virtual:typed-sw-register";

registerSW();

// or register yourself:
navigator.serviceWorker.register(swUrl, { type: "module", scope: swScope });
```

Importing the virtual module skips **all** HTML injection (register script and manifest link). You wire both:

```tsx
{manifestUrl && <link rel="manifest" href={manifestUrl} />}
```

Add types to `tsconfig.json`:

```json
{
  "compilerOptions": {
    "types": ["vite/client", "vite-plugin-typed-sw/client"]
  }
}
```

`registerSW({ immediate: true })` registers immediately instead of waiting for `window` `load`.

## Configuration Options

| Option              | Type        | Default      | Description                                                                                         |
| :------------------ | :---------- | :----------- | :-------------------------------------------------------------------------------------------------- |
| `serviceWorkerFile` | `string`    | **Required** | Path to the Service Worker entry (e.g. `./src/sw.ts`).                                              |
| `manifestPath`      | `string`    | unset        | Resolved manifest href. Auto-injected in HTML unless the virtual module is imported; then use `manifestUrl`. |
| `load`              | `boolean`   | `true`       | Compile, serve, emit, and register the SW. Useful to disable via `process.env`. Does not gate the manifest. |
| `scope`             | `string`    | Vite `base`  | Service worker registration scope.                                                                  |

## License

MIT
