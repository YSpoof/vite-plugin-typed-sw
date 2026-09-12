export function generateRegisterCode(
  swUrl: string,
  swScope: string,
  manifestUrl: string | undefined,
  enabled: boolean,
): string {
  const header = `export const swUrl = ${JSON.stringify(swUrl)};
export const swScope = ${JSON.stringify(swScope)};
export const manifestUrl = ${manifestUrl === undefined ? "undefined" : JSON.stringify(manifestUrl)};
`;

  if (!enabled) {
    return `${header}
export function registerSW() {
  return Promise.resolve(undefined);
}
`;
  }

  return `${header}
export function registerSW(options = {}) {
  const { immediate = false } = options;

  const doRegister = async () => {
    if (!("serviceWorker" in navigator)) return;

    const registration = await navigator.serviceWorker.register(swUrl, {
      type: "module",
      scope: swScope,
    });

    if (import.meta.hot) {
      import.meta.hot.on("typed-sw-update", () => {
        void registration.update();
      });
    }

    return registration;
  };

  if (immediate || document.readyState === "complete") return doRegister();

  const { promise, resolve, reject } = Promise.withResolvers();
  window.addEventListener(
    "load",
    () => {
      doRegister().then(resolve, reject);
    },
    { once: true },
  );
  return promise;
}
`;
}
