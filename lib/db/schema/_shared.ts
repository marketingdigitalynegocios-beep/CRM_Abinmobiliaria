import { text } from "drizzle-orm/sqlite-core";

/**
 * Columna de id para toda tabla de dominio: TEXT generado en la aplicación con
 * crypto.randomUUID() (disponible nativamente en el runtime de Workers), no en
 * la base de datos — ver blueprint-saas-inmobiliario.md §6.
 */
export function idColumn() {
  return text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());
}

/**
 * created_at/updated_at generados en la aplicación (no con triggers SQL como en
 * el SQL de referencia del blueprint — ver bitacora-desarrollo.md, entrada de
 * Fase 0 sobre esta desviación menor de implementación).
 */
export const timestamps = {
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString())
    .$onUpdate(() => new Date().toISOString()),
};
