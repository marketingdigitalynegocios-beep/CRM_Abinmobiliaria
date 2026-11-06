import { drizzle } from "drizzle-orm/d1";
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
 * `Db` es el tipo del driver de producción (D1). En tests (better-sqlite3,
 * ver tests/tenant-scope.test.ts) se castea explícitamente con
 * `as unknown as Db`: ambos drivers exponen la misma API de query builder de
 * drizzle-orm/sqlite-core en runtime, pero unir sus dos tipos (`A | B`) rompe
 * la inferencia de TypeScript al encadenar `.select().where()...` — Drizzle no
 * resuelve bien los overloads de un query builder sobre un tipo unión. El cast
 * es la forma correcta de modelar "mismo contrato en runtime, un solo tipo
 * nominal en producción" acá, no un atajo para evitar escribir el tipo bien.
 */
export type Db = ReturnType<typeof getDb>;
