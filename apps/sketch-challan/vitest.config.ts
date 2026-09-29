import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

// `npm test` = the app's own tests only: skip the copies a production build leaves in .next/standalone.
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  test: { exclude: [...configDefaults.exclude, ".next/**"] },
});
