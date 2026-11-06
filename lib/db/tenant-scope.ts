import { and, eq, inArray, like, sql } from "drizzle-orm";
import slugify from "slugify";
import type { Db } from "./client";
import { leads, properties, propertyImages, propertyOwners, tenants } from "./schema";
import type { CreatePropertyInput, UpdatePropertyInput } from "../validations/property";
import type {
  CreatePropertyOwnerInput,
  UpdatePropertyOwnerInput,
} from "../validations/property-owner";

/**
 * Capa obligatoria de acceso a datos por tenant (ver blueprint-saas-inmobiliario.md
 * §6, "Aislamiento multitenant: sin RLS, forzado en código"). D1 no tiene Row
 * Level Security, así que esta es la única garantía de que un tenant no puede
 * leer ni escribir filas de otro. Regla: ninguna query de dominio se escribe
 * fuera de este archivo — `tenantId` siempre viene de la sesión autenticada
 * (ver lib/auth/session.ts) o del `slug` resuelto server-side, nunca del body
 * o query de un request.
 */

// =============================================
// Leads (referencia del patrón, Fase 0)
// =============================================

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

// =============================================
// Properties — módulo de Inventario (Fase 1)
// =============================================

export interface PropertyFilters {
  type?: string;
  status?: string;
  operation?: string;
  ownerId?: string;
  visibility?: string;
  internalCode?: string;
  page?: number;
  limit?: number;
}

function buildPropertyConditions(tenantId: string, filters: PropertyFilters) {
  const conditions = [eq(properties.tenantId, tenantId)];
  if (filters.type) conditions.push(eq(properties.type, filters.type as any));
  if (filters.status) conditions.push(eq(properties.status, filters.status as any));
  if (filters.operation) conditions.push(eq(properties.operation, filters.operation as any));
  if (filters.ownerId) conditions.push(eq(properties.ownerId, filters.ownerId));
  if (filters.visibility) conditions.push(eq(properties.visibility, filters.visibility as any));
  if (filters.internalCode) conditions.push(eq(properties.internalCode, filters.internalCode));
  return and(...conditions);
}

export async function listPropertiesForTenant(
  db: Db,
  tenantId: string,
  filters: PropertyFilters = {}
) {
  const page = Math.max(filters.page ?? 1, 1);
  const limit = Math.min(Math.max(filters.limit ?? 20, 1), 100);
  const offset = (page - 1) * limit;
  const where = buildPropertyConditions(tenantId, filters);

  const [rows, countRows] = await Promise.all([
    db.select().from(properties).where(where).limit(limit).offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(properties).where(where),
  ]);

  return { properties: rows, total: countRows[0]?.count ?? 0, page, limit };
}

export async function getPropertyForTenant(db: Db, tenantId: string, propertyId: string) {
  const rows = await db
    .select()
    .from(properties)
    .where(and(eq(properties.id, propertyId), eq(properties.tenantId, tenantId)));
  return rows[0] ?? null;
}

async function generateUniquePropertySlug(db: Db, tenantId: string, title: string) {
  const base = slugify(title, { lower: true, strict: true });
  let candidate = base || "propiedad";
  let suffix = 1;
  // Volumen esperado por tenant (20-200 propiedades, ver blueprint §1) hace que
  // esta verificación secuencial sea aceptable; no hace falta una estrategia
  // más sofisticada para el MVP.
  while (true) {
    const existing = await db
      .select({ id: properties.id })
      .from(properties)
      .where(and(eq(properties.tenantId, tenantId), eq(properties.slug, candidate)))
      .limit(1);
    if (existing.length === 0) return candidate;
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }
}

export async function createPropertyForTenant(
  db: Db,
  tenantId: string,
  input: CreatePropertyInput
) {
  const slug = await generateUniquePropertySlug(db, tenantId, input.title);
  const { amenities, ...rest } = input;

  const [row] = await db
    .insert(properties)
    .values({
      id: crypto.randomUUID(),
      tenantId,
      slug,
      ...rest,
      amenitiesJson: JSON.stringify(amenities ?? []),
    })
    .returning();

  return row;
}

export async function updatePropertyForTenant(
  db: Db,
  tenantId: string,
  propertyId: string,
  input: UpdatePropertyInput
) {
  const existing = await getPropertyForTenant(db, tenantId, propertyId);
  if (!existing) return null;

  const { amenities, ...rest } = input;
  const patch: Record<string, unknown> = { ...rest };
  if (amenities !== undefined) patch.amenitiesJson = JSON.stringify(amenities);

  if (Object.keys(patch).length === 0) return existing;

  const [row] = await db
    .update(properties)
    .set(patch)
    .where(and(eq(properties.id, propertyId), eq(properties.tenantId, tenantId)))
    .returning();

  return row ?? null;
}

export async function deletePropertyForTenant(db: Db, tenantId: string, propertyId: string) {
  const result = await db
    .delete(properties)
    .where(and(eq(properties.id, propertyId), eq(properties.tenantId, tenantId)))
    .returning({ id: properties.id });
  return result.length > 0;
}

export async function bulkUpdatePropertyStatusForTenant(
  db: Db,
  tenantId: string,
  propertyIds: string[],
  patch: { status?: string; visibility?: string }
) {
  const set: Record<string, unknown> = {};
  if (patch.status) set.status = patch.status;
  if (patch.visibility) set.visibility = patch.visibility;
  if (Object.keys(set).length === 0 || propertyIds.length === 0) return 0;

  const result = await db
    .update(properties)
    .set(set)
    // El filtro por tenantId acá es lo que impide que un bulk-status con ids
    // ajenos (por error o por manipulación del request) toque filas de otro
    // tenant, incluso si `propertyIds` trae un id que no es de este tenant.
    .where(and(eq(properties.tenantId, tenantId), inArray(properties.id, propertyIds)))
    .returning({ id: properties.id });

  return result.length;
}

// =============================================
// Property owners — módulo de Inventario (Fase 1)
// =============================================

export async function listPropertyOwnersForTenant(db: Db, tenantId: string, search?: string) {
  const conditions = [eq(propertyOwners.tenantId, tenantId)];
  if (search) conditions.push(like(propertyOwners.fullName, `%${search}%`));
  return db
    .select()
    .from(propertyOwners)
    .where(and(...conditions));
}

export async function getPropertyOwnerForTenant(db: Db, tenantId: string, ownerId: string) {
  const rows = await db
    .select()
    .from(propertyOwners)
    .where(and(eq(propertyOwners.id, ownerId), eq(propertyOwners.tenantId, tenantId)));
  return rows[0] ?? null;
}

export async function createPropertyOwnerForTenant(
  db: Db,
  tenantId: string,
  input: CreatePropertyOwnerInput
) {
  const [row] = await db
    .insert(propertyOwners)
    .values({ id: crypto.randomUUID(), tenantId, ...input })
    .returning();
  return row;
}

export async function updatePropertyOwnerForTenant(
  db: Db,
  tenantId: string,
  ownerId: string,
  input: UpdatePropertyOwnerInput
) {
  const existing = await getPropertyOwnerForTenant(db, tenantId, ownerId);
  if (!existing) return null;
  if (Object.keys(input).length === 0) return existing;

  const [row] = await db
    .update(propertyOwners)
    .set(input)
    .where(and(eq(propertyOwners.id, ownerId), eq(propertyOwners.tenantId, tenantId)))
    .returning();

  return row ?? null;
}

export async function deletePropertyOwnerForTenant(db: Db, tenantId: string, ownerId: string) {
  const linkedProperties = await db
    .select({ id: properties.id })
    .from(properties)
    .where(and(eq(properties.tenantId, tenantId), eq(properties.ownerId, ownerId)))
    .limit(1);

  if (linkedProperties.length > 0) {
    return { deleted: false as const, reason: "has_properties" as const };
  }

  const result = await db
    .delete(propertyOwners)
    .where(and(eq(propertyOwners.id, ownerId), eq(propertyOwners.tenantId, tenantId)))
    .returning({ id: propertyOwners.id });

  return { deleted: result.length > 0, reason: null };
}

// =============================================
// Catálogo público — resuelto por slug, nunca por tenant_id del cliente
// =============================================

export async function getTenantBySlug(db: Db, slug: string) {
  const rows = await db.select().from(tenants).where(eq(tenants.slug, slug)).limit(1);
  return rows[0] ?? null;
}

export interface PublicPropertyFilters {
  type?: string;
  operation?: string;
  minPriceCents?: number;
  maxPriceCents?: number;
  page?: number;
  limit?: number;
}

export async function listPublishedPropertiesForTenant(
  db: Db,
  tenantId: string,
  filters: PublicPropertyFilters = {}
) {
  const conditions = [eq(properties.tenantId, tenantId), eq(properties.visibility, "published")];
  if (filters.type) conditions.push(eq(properties.type, filters.type as any));
  if (filters.operation) conditions.push(eq(properties.operation, filters.operation as any));
  if (filters.minPriceCents !== undefined)
    conditions.push(sql`${properties.priceCents} >= ${filters.minPriceCents}`);
  if (filters.maxPriceCents !== undefined)
    conditions.push(sql`${properties.priceCents} <= ${filters.maxPriceCents}`);

  const page = Math.max(filters.page ?? 1, 1);
  const limit = Math.min(Math.max(filters.limit ?? 20, 1), 100);
  const offset = (page - 1) * limit;
  const where = and(...conditions);

  const [rows, countRows] = await Promise.all([
    db.select().from(properties).where(where).limit(limit).offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(properties).where(where),
  ]);

  return { properties: rows, total: countRows[0]?.count ?? 0, page, limit };
}

/**
 * Sin filtro de tenant propio: `property_images` solo tiene FK a `property_id`,
 * así que esto se llama DESPUÉS de validar con `getPublishedPropertyForTenant`
 * / `getPropertyForTenant` que esa propiedad pertenece al tenant correcto —
 * nunca se expone un `propertyId` sin esa validación previa.
 */
export async function listPropertyImages(db: Db, propertyId: string) {
  return db
    .select()
    .from(propertyImages)
    .where(eq(propertyImages.propertyId, propertyId))
    .orderBy(propertyImages.position);
}

export async function getPublishedPropertyForTenant(
  db: Db,
  tenantId: string,
  propertyId: string
) {
  const rows = await db
    .select()
    .from(properties)
    .where(
      and(
        eq(properties.id, propertyId),
        eq(properties.tenantId, tenantId),
        eq(properties.visibility, "published")
      )
    );
  return rows[0] ?? null;
}
