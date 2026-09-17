import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  minify: true,
  fixedExtension: true,
  exports: {
    customExports(exports) {
      exports["./client"] = { types: "./client.d.ts" };
      exports["./tsconfig/service-worker"] = "./tsconfig.sw.json";
      exports["./sw"] = "./tsconfig.sw.json";
      return exports;
    },
  },
  deps: {
    neverBundle: ["vite", "esbuild"],
  },
});
