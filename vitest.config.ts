import { defineConfig } from "vitest/config";

/**
 * Config de Vitest separada de vite.config.ts a propósito: ese archivo trae
 * los plugins de vinext/Cloudflare, que no deben aplicarse a los tests
 * unitarios de Node (rompen la carga del addon nativo de better-sqlite3,
 * usado solo para probar lib/db/tenant-scope.ts contra SQLite real sin un
 * binding D1).
 */
export default defineConfig({
  test: {
    environment: "node",
  },
});
