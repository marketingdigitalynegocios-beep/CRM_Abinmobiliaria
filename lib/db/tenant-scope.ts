import { and, eq } from "drizzle-orm";
import type { Db } from "./client";
import { leads, properties } from "./schema";

/**
 * Capa obligatoria de acceso a datos por tenant (ver blueprint-saas-inmobiliario.md
 * §6, "Aislamiento multitenant: sin RLS, forzado en código"). D1 no tiene Row
 * Level Security, así que esta es la única garantía de que un tenant no puede
 * leer ni escribir filas de otro. Regla: ninguna query de dominio se escribe
 * fuera de este archivo (o su equivalente por tabla) — `tenantId` siempre viene
 * de la sesión autenticada o del `slug` resuelto server-side, nunca del body o
 * query de un request.
 *
 * Cubre `properties` y `leads` como referencia del patrón; el resto de las
 * tablas de dominio (`deals`, `visits`, `property_owners`, ...) se agregan acá
 * mismo, tabla por tabla, a medida que cada módulo se construye (Fase 1/2 del
 * plan de implementación) — no se repite este patrón sentado en otro archivo.
 */

export async function getPropertiesForTenant(db: Db, tenantId: string) {
  return db.select().from(properties).where(eq(properties.tenantId, tenantId));
}

export async function getPropertyForTenant(db: Db, tenantId: string, propertyId: string) {
  const rows = await db
    .select()
    .from(properties)
    .where(and(eq(properties.id, propertyId), eq(properties.tenantId, tenantId)));
  return rows[0] ?? null;
}

export async function getLeadsForTenant(db: Db, tenantId: string) {
  return db.select().from(leads).where(eq(leads.tenantId, tenantId));
}

export async function getLeadForTenant(db: Db, tenantId: string, leadId: string) {
  const rows = await db
    .select()
    .from(leads)
    .where(and(eq(leads.id, leadId), eq(leads.tenantId, tenantId)));
  return rows[0] ?? null;
}
