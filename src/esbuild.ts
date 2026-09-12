import type { ResolvedConfig } from "vite";

function resolveEsbuildAlias(config: ResolvedConfig): Record<string, string> {
  const alias = config.resolve.alias;
  const result: Record<string, string> = {};

  if (Array.isArray(alias)) {
    for (const entry of alias) {
      if (typeof entry.find === "string" && typeof entry.replacement === "string") {
        result[entry.find] = entry.replacement;
      }
    }
    return result;
  }

  if (!alias) return result;

  for (const [key, value] of Object.entries(alias)) {
    if (typeof value === "string") result[key] = value;
  }

  return result;
}

export function getEsbuildOptions(config: ResolvedConfig, entryPoints: string[]): {
  entryPoints: string[];
  bundle: true;
  format: "esm";
  write: false;
  target: "esnext";
  absWorkingDir: string;
  alias: Record<string, string>;
} {
  return {
    entryPoints,
    bundle: true,
    format: "esm" as const,
    write: false,
    target: "esnext" as const,
    absWorkingDir: config.root,
    alias: resolveEsbuildAlias(config),
  };
}
