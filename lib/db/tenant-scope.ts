import { and, desc, eq, inArray, like, sql } from "drizzle-orm";
import slugify from "slugify";
import type { Db } from "./client";
import {
  deals,
  leadPropertyInterests,
  leads,
  properties,
  propertyImages,
  propertyOwners,
  tenants,
  user as userTable,
  visits,
} from "./schema";
import type { CreatePropertyInput, UpdatePropertyInput } from "../validations/property";
import type {
  CreatePropertyOwnerInput,
  UpdatePropertyOwnerInput,
} from "../validations/property-owner";
import type { UpdateLeadInput } from "../validations/lead";
import type { CreateDealInput, UpdateDealInput } from "../validations/deal";
import type { CreateVisitInput, UpdateVisitInput } from "../validations/visit";

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
// Leads — CRM (Fase 0 lectura, Fase 2 escritura/calificación)
// =============================================

export async function getLeadsForTenant(db: Db, tenantId: string, stage?: string) {
  const conditions = [eq(leads.tenantId, tenantId)];
  if (stage) conditions.push(eq(leads.stage, stage as any));
  return db
    .select()
    .from(leads)
    .where(and(...conditions))
    .orderBy(desc(leads.createdAt));
}

export async function getLeadForTenant(db: Db, tenantId: string, leadId: string) {
  const rows = await db
    .select()
    .from(leads)
    .where(and(eq(leads.id, leadId), eq(leads.tenantId, tenantId)));
  return rows[0] ?? null;
}

/**
 * Crea un lead ya con el `tenantId` resuelto server-side (desde el `slug`
 * para el formulario público, o desde la sesión para el alta manual) — ver
 * blueprint §7 `POST /api/leads`.
 */
export async function createLeadForTenant(
  db: Db,
  tenantId: string,
  input: {
    fullName: string;
    email?: string;
    phone?: string;
    whatsapp?: string;
    source: "website" | "whatsapp" | "referral" | "manual";
    notes?: string;
    budgetMinCents?: number;
    budgetMaxCents?: number;
  },
  propertyId?: string
) {
  const [lead] = await db
    .insert(leads)
    .values({ id: crypto.randomUUID(), tenantId, ...input })
    .returning();

  if (propertyId) {
    // La propiedad debe pertenecer al mismo tenant; si no existe o es de otro
    // tenant, simplemente no se registra el interés (no se filtra nada, no se
    // rompe la creación del lead).
    const ownProperty = await getPropertyForTenant(db, tenantId, propertyId);
    if (ownProperty) {
      await db
        .insert(leadPropertyInterests)
        .values({ id: crypto.randomUUID(), leadId: lead.id, propertyId })
        .onConflictDoNothing();
    }
  }

  return lead;
}

export async function updateLeadForTenant(
  db: Db,
  tenantId: string,
  leadId: string,
  input: UpdateLeadInput
) {
  const existing = await getLeadForTenant(db, tenantId, leadId);
  if (!existing) return null;
  if (Object.keys(input).length === 0) return existing;

  const [row] = await db
    .update(leads)
    .set(input)
    .where(and(eq(leads.id, leadId), eq(leads.tenantId, tenantId)))
    .returning();

  return row ?? null;
}

/** Ver blueprint §6: nunca se expone `propertyId` sin validar antes que el lead es del tenant. */
export async function addLeadPropertyInterest(db: Db, tenantId: string, leadId: string, propertyId: string) {
  const lead = await getLeadForTenant(db, tenantId, leadId);
  const property = await getPropertyForTenant(db, tenantId, propertyId);
  if (!lead || !property) return null;

  const [row] = await db
    .insert(leadPropertyInterests)
    .values({ id: crypto.randomUUID(), leadId, propertyId })
    .onConflictDoNothing()
    .returning();

  return row ?? { leadId, propertyId, alreadyExisted: true };
}

export async function listLeadPropertyInterests(db: Db, leadId: string) {
  return db
    .select({ property: properties })
    .from(leadPropertyInterests)
    .innerJoin(properties, eq(leadPropertyInterests.propertyId, properties.id))
    .where(eq(leadPropertyInterests.leadId, leadId));
}

// =============================================
// Deals — oportunidades (Fase 2, ver blueprint §14 "Separar Lead de Deal")
// =============================================

export interface DealFilters {
  stage?: string;
  leadId?: string;
  propertyId?: string;
}

export async function listDealsForTenant(db: Db, tenantId: string, filters: DealFilters = {}) {
  const conditions = [eq(deals.tenantId, tenantId)];
  if (filters.stage) conditions.push(eq(deals.stage, filters.stage as any));
  if (filters.leadId) conditions.push(eq(deals.leadId, filters.leadId));
  if (filters.propertyId) conditions.push(eq(deals.propertyId, filters.propertyId));

  return db
    .select()
    .from(deals)
    .where(and(...conditions))
    .orderBy(desc(deals.createdAt));
}

/** Igual que `listDealsForTenant`, pero con el nombre del lead y el título de
 * la propiedad ya resueltos — solo para pintar el kanban, no para lógica de negocio. */
export async function listDealsWithContextForTenant(
  db: Db,
  tenantId: string,
  filters: DealFilters = {}
) {
  const conditions = [eq(deals.tenantId, tenantId)];
  if (filters.stage) conditions.push(eq(deals.stage, filters.stage as any));
  if (filters.leadId) conditions.push(eq(deals.leadId, filters.leadId));
  if (filters.propertyId) conditions.push(eq(deals.propertyId, filters.propertyId));

  return db
    .select({
      id: deals.id,
      title: deals.title,
      stage: deals.stage,
      dealValueCents: deals.dealValueCents,
      nextAction: deals.nextAction,
      leadId: deals.leadId,
      propertyId: deals.propertyId,
      leadName: leads.fullName,
      propertyTitle: properties.title,
    })
    .from(deals)
    .innerJoin(leads, eq(deals.leadId, leads.id))
    .innerJoin(properties, eq(deals.propertyId, properties.id))
    .where(and(...conditions))
    .orderBy(desc(deals.createdAt));
}

export async function getDealForTenant(db: Db, tenantId: string, dealId: string) {
  const rows = await db
    .select()
    .from(deals)
    .where(and(eq(deals.id, dealId), eq(deals.tenantId, tenantId)));
  return rows[0] ?? null;
}

export async function createDealForTenant(db: Db, tenantId: string, input: CreateDealInput) {
  // El lead y la propiedad deben pertenecer al tenant — si cualquiera de los
  // dos no existe para este tenant, no se crea el deal (nunca se confía en
  // los ids del body por sí solos).
  const [lead, property] = await Promise.all([
    getLeadForTenant(db, tenantId, input.leadId),
    getPropertyForTenant(db, tenantId, input.propertyId),
  ]);
  if (!lead || !property) return null;

  const [deal] = await db
    .insert(deals)
    .values({ id: crypto.randomUUID(), tenantId, ...input })
    .returning();

  return deal;
}

export async function updateDealForTenant(
  db: Db,
  tenantId: string,
  dealId: string,
  input: UpdateDealInput
) {
  const existing = await getDealForTenant(db, tenantId, dealId);
  if (!existing) return null;
  if (Object.keys(input).length === 0) return existing;

  const [row] = await db
    .update(deals)
    .set(input)
    .where(and(eq(deals.id, dealId), eq(deals.tenantId, tenantId)))
    .returning();

  return row ?? null;
}

// =============================================
// Visits — agenda (Fase 2)
// =============================================

export async function listVisitsForTenant(db: Db, tenantId: string) {
  return db
    .select()
    .from(visits)
    .where(eq(visits.tenantId, tenantId))
    .orderBy(visits.scheduledAt);
}

export async function listVisitsForLead(db: Db, tenantId: string, leadId: string) {
  return db
    .select()
    .from(visits)
    .where(and(eq(visits.tenantId, tenantId), eq(visits.leadId, leadId)))
    .orderBy(visits.scheduledAt);
}

export async function createVisitForTenant(db: Db, tenantId: string, input: CreateVisitInput) {
  const [lead, property] = await Promise.all([
    getLeadForTenant(db, tenantId, input.leadId),
    getPropertyForTenant(db, tenantId, input.propertyId),
  ]);
  if (!lead || !property) return null;

  if (input.dealId) {
    const deal = await getDealForTenant(db, tenantId, input.dealId);
    if (!deal) return null;
  }

  // Conflicto de agenda simple: mismo asesor, misma franja exacta ya agendada
  // (ver blueprint §7, 409). No es un chequeo de solapamiento de rangos — el
  // MVP agenda visitas en franjas discretas, no bloques de duración variable.
  if (input.advisorId) {
    const clash = await db
      .select({ id: visits.id })
      .from(visits)
      .where(
        and(
          eq(visits.tenantId, tenantId),
          eq(visits.advisorId, input.advisorId),
          eq(visits.scheduledAt, input.scheduledAt),
          eq(visits.status, "scheduled")
        )
      )
      .limit(1);
    if (clash.length > 0) return "conflict" as const;
  }

  const [visit] = await db
    .insert(visits)
    .values({ id: crypto.randomUUID(), tenantId, ...input })
    .returning();

  return visit;
}

export async function updateVisitForTenant(
  db: Db,
  tenantId: string,
  visitId: string,
  input: UpdateVisitInput
) {
  const rows = await db
    .select()
    .from(visits)
    .where(and(eq(visits.id, visitId), eq(visits.tenantId, tenantId)));
  const existing = rows[0];
  if (!existing) return null;
  if (Object.keys(input).length === 0) return existing;

  const [row] = await db
    .update(visits)
    .set(input)
    .where(and(eq(visits.id, visitId), eq(visits.tenantId, tenantId)))
    .returning();

  return row ?? null;
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

// =============================================
// Perfil de la inmobiliaria (Fase 3 — /dashboard/settings/agency, /dashboard/website)
// =============================================

export async function getTenantForTenant(db: Db, tenantId: string) {
  const rows = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
  return rows[0] ?? null;
}

// =============================================
// Equipo / asesores (Fase 3 — /dashboard/settings/team)
// =============================================

export async function listTeamMembersForTenant(db: Db, tenantId: string) {
  return db
    .select({
      id: userTable.id,
      name: userTable.name,
      email: userTable.email,
      role: userTable.role,
      isActive: userTable.isActive,
      createdAt: userTable.createdAt,
    })
    .from(userTable)
    .where(eq(userTable.tenantId, tenantId))
    .orderBy(userTable.createdAt);
}

export async function isEmailAlreadyRegistered(db: Db, email: string) {
  const rows = await db
    .select({ id: userTable.id })
    .from(userTable)
    .where(eq(userTable.email, email))
    .limit(1);
  return rows.length > 0;
}

export async function updateTenantForTenant(
  db: Db,
  tenantId: string,
  input: Partial<{
    name: string;
    logoImageId: string;
    phone: string;
    email: string;
    city: string;
    address: string;
    website: string;
    primaryColor: string;
    template: "modern" | "classic" | "minimal";
    whatsappNumber: string;
    description: string;
  }>
) {
  if (Object.keys(input).length === 0) return getTenantForTenant(db, tenantId);

  const [row] = await db.update(tenants).set(input).where(eq(tenants.id, tenantId)).returning();

  return row ?? null;
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
