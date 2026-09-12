declare module "virtual:typed-sw-register" {
  export const swUrl: string;
  export const swScope: string;
  /** Resolved manifest href when `manifestPath` is set, else `undefined`. */
  export const manifestUrl: string | undefined;

  export interface RegisterSWOptions {
    immediate?: boolean;
  }

  export function registerSW(
    options?: RegisterSWOptions,
  ): Promise<ServiceWorkerRegistration | undefined>;
}

declare module "virtual:typed-sw-extras" {
  /**
   * URLs of all files emitted by the Vite client build
   * (JS chunks, CSS, images, fonts, etc.).
   * Prefixed with Vite's `base` path.
   * Empty array in dev mode.
   */
  export const buildFiles: string[];

  /**
   * URLs of all files found in the `public/` directory.
   * Prefixed with Vite's `base` path.
   */
  export const publicFiles: string[];

  /**
   * Build version identifier.
   * Defaults to a timestamp-based string unique per build.
   * Override via the plugin's `version` option.
   * Set to `"dev"` in dev mode.
   */
  export const version: string;
}
