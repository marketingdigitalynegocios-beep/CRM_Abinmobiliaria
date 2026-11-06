import { drizzle } from "drizzle-orm/d1";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

/**
 * Instancia Drizzle sobre el binding D1 del Worker. Se construye por request
 * (nunca a nivel de módulo): los bindings de Cloudflare solo existen dentro del
 * contexto de un request — ver bitacora-desarrollo.md, entrada de Fase 0.
 */
export function getDb(d1: D1Database) {
  return drizzle(d1, { schema });
}

/**
 * Tipo compartido entre el driver de producción (D1) y el driver usado en
 * tests (better-sqlite3, ver tests/tenant-scope.test.ts) — ambos exponen la
 * misma API de query builder de drizzle-orm/sqlite-core, así que el código de
 * `tenant-scope.ts` se escribe una sola vez y se prueba contra SQLite real sin
 * necesitar un binding D1/Miniflare para correr el test.
 */
export type Db = DrizzleD1Database<typeof schema> | BetterSQLite3Database<typeof schema>;
