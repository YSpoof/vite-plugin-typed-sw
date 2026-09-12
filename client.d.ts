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
