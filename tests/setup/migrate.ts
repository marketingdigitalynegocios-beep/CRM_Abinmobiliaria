import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type Database from "better-sqlite3";

/**
 * Aplica las migraciones generadas por drizzle-kit (drizzle/migrations/*.sql)
 * contra una instancia de better-sqlite3 en memoria, para probar el código de
 * `lib/db/tenant-scope.ts` sin necesitar un binding D1/Miniflare real.
 *
 * Los archivos usan el separador `--> statement-breakpoint` que inserta
 * drizzle-kit (pensado para drivers que no soportan exec multi-statement);
 * better-sqlite3 sí lo soporta, así que solo hace falta quitar esas líneas.
 */
export function applyMigrations(sqlite: Database.Database) {
  const migrationsDir = join(__dirname, "../../drizzle/migrations");
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const raw = readFileSync(join(migrationsDir, file), "utf-8");
    const sql = raw.replaceAll("--> statement-breakpoint", "");
    sqlite.exec(sql);
  }
}
