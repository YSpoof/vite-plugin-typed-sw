# vite-plugin-typed-sw

A modern, zero-boilerplate Vite plugin to auto-inject, compile, and hot-reload type-safe ESM Service Workers.

Instead of manually registering your Service Worker and struggling with WebWorker TypeScript types conflicting with the DOM, this plugin handles everything for you. It seamlessly bundles your Service Worker using `esbuild`, supports native ES Modules, auto-injects the registration logic, and provides real-time Hot Module Replacement (HMR) during development.

## Features

- **🚀 100% ESM:** Compiles and registers your Service Worker as a modern ES Module (`type: 'module'`). No legacy IIFE or CJS.
- **🔥 Native HMR:** Edits to your `sw.ts` (or any files it imports) instantly trigger an update in the browser without full page reloads.
- **✨ Auto-Injection:** Zero client-side boilerplate. Auto-injects `manifest.json` and SW registration directly into your `index.html`.
- **🛠️ Type-Safe:** Safely isolate your Service Worker types from your DOM types.
- **📦 Bundled Imports:** Import utilities and other modules inside your `sw.ts`—it all gets bundled automatically.

## Installation

```bash
npm install -D vite-plugin-typed-sw
# or
yarn add -D vite-plugin-typed-sw
# or
pnpm add -D vite-plugin-typed-sw
```

## Usage

### 1. Update your Vite config

Add the plugin to your `vite.config.ts`:

```typescript
import { defineConfig } from 'vite';
import typedSwPlugin from 'vite-plugin-typed-sw';

export default defineConfig({
  plugins: [
    typedSwPlugin({
      serviceWorkerFile: './src/sw.ts',
      manifestPath: '/manifest.json', // Path to your manifest in the public folder
    })
  ]
});
```

### 2. Write your Service Worker

Create `./src/sw.ts` and write your modern ESM service worker.

```typescript
// src/sw.ts
// You can use standard ES imports here!
// import { myUtility } from './utils.ts'; 

const sw = self as unknown as ServiceWorkerGlobalScope;

sw.addEventListener('install', (event) => {
  console.log('[SW] Installed');
  event.waitUntil(sw.skipWaiting());
});

sw.addEventListener('fetch', (event) => {
  // event.request is fully typed!
  console.log('[SW] Fetching:', event.request.url);
});
```

## TypeScript Configuration (Type Safety)

Service Workers use a different global scope (`ServiceWorkerGlobalScope`) than standard web code (`Window`). To prevent TypeScript from throwing errors when you use `self`, you should isolate your SW types.

1. Create a `tsconfig.sw.json` in your project root:

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

2. Exclude the service worker from your main `tsconfig.json` so the DOM and WebWorker types don't clash:

```json
{
  "compilerOptions": {
    // ... your standard DOM config
  },
  "exclude": ["src/sw.ts"]
}
```

## Configuration Options

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `serviceWorkerFile` | `string` | **Required** | The absolute or relative path to your entry Service Worker file (e.g., `./src/sw.ts`). |
| `manifestPath` | `string` | `'/manifest.json'` | Path to your Web App Manifest. Set to `false` or empty string to disable auto-injection. |
| `load` | `boolean` | `true` | Whether the plugin should compile and inject the SW. Useful if you want to conditionally disable it via `process.env`. |

## License

MIT
