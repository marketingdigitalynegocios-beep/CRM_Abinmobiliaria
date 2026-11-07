import { and, desc, eq, inArray, like, sql } from "drizzle-orm";
import slugify from "slugify";
import type { Db } from "./client";
import {
  aiAgentConfigs,
  deals,
  documents,
  googleCalendarConnections,
  leadActivities,
  leadPropertyInterests,
  leads,
  notifications,
  properties,
  propertyImages,
  propertyOwners,
  propertyReviews,
  tasks,
  tenants,
  user as userTable,
  visits,
  whatsappMessages,
} from "./schema";
import type { CreatePropertyInput, UpdatePropertyInput } from "../validations/property";
import type {
  CreatePropertyOwnerInput,
  UpdatePropertyOwnerInput,
} from "../validations/property-owner";
import type { UpdateLeadInput } from "../validations/lead";
import type { CreateDealInput, UpdateDealInput } from "../validations/deal";
import type { CreateVisitInput, UpdateVisitInput } from "../validations/visit";
import type { CreateTaskInput, UpdateTaskInput } from "../validations/task";

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

/**
 * Resuelve el lead dueño de un número de WhatsApp, comparando solo los
 * últimos 10 dígitos — el `from` que manda Meta viene con indicativo de país
 * (ej. "573001234567") mientras que `leads.whatsapp`/`leads.phone` suelen
 * guardarse sin él. No hay forma de indexar esto en SQLite sin una función
 * regexp, así que se compara en memoria sobre los leads del tenant (volumen
 * esperado de una sola inmobiliaria, no miles de leads).
 */
export async function findLeadByPhoneForTenant(db: Db, tenantId: string, rawPhone: string) {
  const digits = rawPhone.replace(/\D/g, "").slice(-10);
  if (!digits) return null;

  const tenantLeads = await getLeadsForTenant(db, tenantId);
  return (
    tenantLeads.find((lead) => {
      const whatsappDigits = lead.whatsapp?.replace(/\D/g, "").slice(-10);
      const phoneDigits = lead.phone?.replace(/\D/g, "").slice(-10);
      return whatsappDigits === digits || phoneDigits === digits;
    }) ?? null
  );
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
    preferredCity?: string;
    preferredType?: "apartment" | "house" | "commercial" | "land";
    preferredOperation?: "sale" | "rent" | "sale_rent";
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

  // Solo se notifica al equipo cuando el lead llega por un canal público
  // (website/whatsapp/referral) — un alta manual desde el dashboard la hizo
  // el propio usuario, notificarle su propia acción sería ruido.
  if (input.source !== "manual") {
    await notifyTenantTeam(
      db,
      tenantId,
      "new_lead",
      `Nuevo lead: ${lead.fullName}`,
      `Llegó por ${input.source}${input.notes ? ` — "${input.notes}"` : ""}`,
      `/dashboard/crm/${lead.id}`
    );
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

  if (row && input.stage && input.stage !== existing.stage) {
    await logLeadActivity(
      db,
      tenantId,
      leadId,
      "stage_change",
      `Cambió de etapa: "${existing.stage}" → "${input.stage}"`
    );
  }

  return row ?? null;
}

// =============================================
// Timeline de interacciones y mensajes de WhatsApp (Fase 6, ver
// plan-implementacion.md §1-bis)
// =============================================

/**
 * Inserta una fila en el timeline del lead. Nunca se llama directo desde un
 * route handler — siempre desde las funciones de este archivo que mutan
 * estado (updateLeadForTenant, createDealForTenant, createVisitForTenant) o
 * desde `recordWhatsappMessage`, para que el timeline refleje eventos reales,
 * no lo que un cliente diga que pasó.
 */
export async function logLeadActivity(
  db: Db,
  tenantId: string,
  leadId: string,
  type: "stage_change" | "note" | "call" | "deal_created" | "visit_scheduled" | "whatsapp_message",
  body: string,
  actorId?: string
) {
  const [row] = await db
    .insert(leadActivities)
    .values({ id: crypto.randomUUID(), tenantId, leadId, type, body, actorId })
    .returning();
  return row;
}

export async function listLeadActivitiesForTenant(db: Db, tenantId: string, leadId: string) {
  return db
    .select()
    .from(leadActivities)
    .where(and(eq(leadActivities.tenantId, tenantId), eq(leadActivities.leadId, leadId)))
    .orderBy(desc(leadActivities.createdAt));
}

/**
 * Registra un mensaje real de WhatsApp (entrante o saliente) y, si ya hay un
 * lead resuelto para ese número, agrega también una entrada al timeline —
 * ver `app/api/webhooks/whatsapp/route.ts`.
 */
export async function recordWhatsappMessage(
  db: Db,
  tenantId: string,
  input: {
    leadId?: string | null;
    phoneNumberId: string;
    direction: "inbound" | "outbound";
    body: string;
    waMessageId?: string;
    status?: "received" | "sent" | "failed";
  }
) {
  const [message] = await db
    .insert(whatsappMessages)
    .values({ id: crypto.randomUUID(), tenantId, ...input })
    .returning();

  if (input.leadId) {
    await logLeadActivity(
      db,
      tenantId,
      input.leadId,
      "whatsapp_message",
      input.direction === "inbound" ? `Cliente: ${input.body}` : `Agente: ${input.body}`
    );
  }

  return message;
}

export async function listWhatsappMessagesForLead(db: Db, tenantId: string, leadId: string) {
  return db
    .select()
    .from(whatsappMessages)
    .where(and(eq(whatsappMessages.tenantId, tenantId), eq(whatsappMessages.leadId, leadId)))
    .orderBy(whatsappMessages.createdAt);
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

  if (deal) {
    await logLeadActivity(
      db,
      tenantId,
      input.leadId,
      "deal_created",
      `Se abrió una oportunidad sobre "${property.title}"`
    );
  }

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

/** Igual que `listVisitsForTenant`, pero con el nombre del lead, el título de
 * la propiedad y el asesor ya resueltos — para pintar agenda/resumen, no para
 * lógica de negocio. */
export async function listVisitsWithContextForTenant(db: Db, tenantId: string) {
  return db
    .select({
      id: visits.id,
      scheduledAt: visits.scheduledAt,
      status: visits.status,
      notes: visits.notes,
      leadId: visits.leadId,
      propertyId: visits.propertyId,
      leadName: leads.fullName,
      propertyTitle: properties.title,
      advisorName: userTable.name,
    })
    .from(visits)
    .innerJoin(leads, eq(visits.leadId, leads.id))
    .innerJoin(properties, eq(visits.propertyId, properties.id))
    .leftJoin(userTable, eq(visits.advisorId, userTable.id))
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

  if (visit) {
    const visitLabel = `Visita agendada a "${property.title}" para ${new Date(input.scheduledAt).toLocaleString("es-CO")}`;
    await logLeadActivity(db, tenantId, input.leadId, "visit_scheduled", visitLabel);

    if (input.advisorId) {
      await createNotificationForTenant(
        db,
        tenantId,
        input.advisorId,
        "visit_scheduled",
        `Visita con ${lead.fullName}`,
        visitLabel,
        `/dashboard/crm/${lead.id}`
      );
    } else {
      await notifyTenantTeam(
        db,
        tenantId,
        "visit_scheduled",
        `Visita con ${lead.fullName}`,
        `${visitLabel} — sin asesor asignado`,
        `/dashboard/crm/${lead.id}`
      );
    }
  }

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
  const { amenities, images, ...rest } = input;

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

  if (images && images.length > 0) {
    await db.insert(propertyImages).values(
      images.map((imageId, position) => ({
        id: crypto.randomUUID(),
        propertyId: row.id,
        imageId,
        altText: row.title,
        position,
      }))
    );
  }

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

  const { amenities, images, ...rest } = input;
  const patch: Record<string, unknown> = { ...rest };
  if (amenities !== undefined) patch.amenitiesJson = JSON.stringify(amenities);

  if (images !== undefined) {
    await db.delete(propertyImages).where(eq(propertyImages.propertyId, propertyId));
    if (images.length > 0) {
      await db.insert(propertyImages).values(
        images.map((imageId, position) => ({
          id: crypto.randomUUID(),
          propertyId,
          imageId,
          altText: existing.title,
          position,
        }))
      );
    }
  }

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

/**
 * Único lugar donde se listan tenants sin filtrar por uno solo — lo usa el
 * handler de cron (`app/api/cron/check-tasks/route.ts`), que corre a nivel de
 * app, no de un tenant autenticado. Nunca se expone a un endpoint con sesión.
 */
export async function listAllTenantIds(db: Db) {
  const rows = await db.select({ id: tenants.id }).from(tenants);
  return rows.map((r) => r.id);
}

// =============================================
// Perfil de la inmobiliaria (Fase 3 — /dashboard/settings/agency, /dashboard/website)
// =============================================

export async function getTenantForTenant(db: Db, tenantId: string) {
  const rows = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
  return rows[0] ?? null;
}

/**
 * Genera el token del feed de portales externos (Fase 12) si el tenant
 * todavía no tiene uno, y lo devuelve. Idempotente: si ya existe, se
 * reutiliza — regenerarlo invalidaría la URL que el tenant ya haya
 * registrado en Fincaraíz/Metrocuadrado.
 */
export async function getOrCreatePortalFeedToken(db: Db, tenantId: string) {
  const tenant = await getTenantForTenant(db, tenantId);
  if (!tenant) return null;
  if (tenant.portalFeedToken) return tenant.portalFeedToken;

  const token = crypto.randomUUID().replaceAll("-", "");
  await db.update(tenants).set({ portalFeedToken: token }).where(eq(tenants.id, tenantId));
  return token;
}

export async function getTenantByPortalFeedToken(db: Db, token: string) {
  const rows = await db.select().from(tenants).where(eq(tenants.portalFeedToken, token)).limit(1);
  return rows[0] ?? null;
}

// =============================================
// Reseñas y testimonios (Fase 13, ver plan-implementacion.md §1-bis)
// =============================================

export async function createReviewForTenant(
  db: Db,
  tenantId: string,
  input: { propertyId?: string; authorName: string; rating: number; comment: string }
) {
  if (input.propertyId && !(await getPropertyForTenant(db, tenantId, input.propertyId))) return null;

  const [row] = await db
    .insert(propertyReviews)
    .values({ id: crypto.randomUUID(), tenantId, ...input })
    .returning();
  return row;
}

/** Todas las reseñas del tenant (publicadas o no) — para el panel de moderación del admin. */
export async function listReviewsForTenant(db: Db, tenantId: string) {
  return db
    .select()
    .from(propertyReviews)
    .where(eq(propertyReviews.tenantId, tenantId))
    .orderBy(desc(propertyReviews.createdAt));
}

/** Solo las publicadas — para la página pública. */
export async function listPublishedReviewsForTenant(
  db: Db,
  tenantId: string,
  propertyId?: string
) {
  const conditions = [eq(propertyReviews.tenantId, tenantId), eq(propertyReviews.isPublished, true)];
  if (propertyId) conditions.push(eq(propertyReviews.propertyId, propertyId));

  return db
    .select()
    .from(propertyReviews)
    .where(and(...conditions))
    .orderBy(desc(propertyReviews.createdAt));
}

export async function updateReviewForTenant(
  db: Db,
  tenantId: string,
  reviewId: string,
  input: { isPublished?: boolean }
) {
  const rows = await db
    .select()
    .from(propertyReviews)
    .where(and(eq(propertyReviews.id, reviewId), eq(propertyReviews.tenantId, tenantId)));
  if (!rows[0]) return null;

  const [row] = await db
    .update(propertyReviews)
    .set(input)
    .where(and(eq(propertyReviews.id, reviewId), eq(propertyReviews.tenantId, tenantId)))
    .returning();
  return row ?? null;
}

export async function deleteReviewForTenant(db: Db, tenantId: string, reviewId: string) {
  const rows = await db
    .select({ id: propertyReviews.id })
    .from(propertyReviews)
    .where(and(eq(propertyReviews.id, reviewId), eq(propertyReviews.tenantId, tenantId)));
  if (!rows[0]) return false;

  await db
    .delete(propertyReviews)
    .where(and(eq(propertyReviews.id, reviewId), eq(propertyReviews.tenantId, tenantId)));
  return true;
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

// =============================================
// Agente de IA / WhatsApp (Fase 4)
// =============================================

export async function getAiAgentConfigForTenant(db: Db, tenantId: string) {
  const rows = await db
    .select()
    .from(aiAgentConfigs)
    .where(eq(aiAgentConfigs.tenantId, tenantId))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Crea la fila de config si todavía no existe (primera vez que el admin
 * entra a `/dashboard/ai-agent`) o la actualiza si ya existe. `geminiKeyEnc`
 * se pasa ya cifrado (ver lib/crypto.ts) — esta función no cifra nada, solo
 * persiste.
 */
export async function upsertAiAgentConfigForTenant(
  db: Db,
  tenantId: string,
  input: { isActive?: boolean; systemPrompt?: string; welcomeMessage?: string; geminiKeyEnc?: string }
) {
  const existing = await getAiAgentConfigForTenant(db, tenantId);

  if (!existing) {
    const [row] = await db
      .insert(aiAgentConfigs)
      .values({ id: crypto.randomUUID(), tenantId, ...input })
      .returning();
    return row;
  }

  if (Object.keys(input).length === 0) return existing;

  const [row] = await db
    .update(aiAgentConfigs)
    .set(input)
    .where(eq(aiAgentConfigs.tenantId, tenantId))
    .returning();
  return row ?? existing;
}

/** Guarda lo que devuelve Embedded Signup — nunca un token por tenant (ver blueprint §11/§15 riesgo 10). */
export async function saveWhatsappConnectionForTenant(
  db: Db,
  tenantId: string,
  connection: { whatsappWabaId: string; whatsappPhoneNumberId: string; whatsappDisplayNumber?: string }
) {
  const existing = await getAiAgentConfigForTenant(db, tenantId);

  if (!existing) {
    const [row] = await db
      .insert(aiAgentConfigs)
      .values({ id: crypto.randomUUID(), tenantId, ...connection })
      .returning();
    return row;
  }

  const [row] = await db
    .update(aiAgentConfigs)
    .set(connection)
    .where(eq(aiAgentConfigs.tenantId, tenantId))
    .returning();
  return row ?? existing;
}

/**
 * Resuelve qué tenant corresponde a un mensaje entrante de WhatsApp — el
 * webhook de Meta es uno solo para toda la app (ver blueprint §11), así que
 * `phone_number_id` es la única forma de saber de qué tenant es cada mensaje.
 * Sin filtro de tenant propio porque ESTE es el punto que resuelve el tenant,
 * no uno que lo reciba ya resuelto.
 */
export async function getAiAgentConfigByPhoneNumberId(db: Db, phoneNumberId: string) {
  const rows = await db
    .select()
    .from(aiAgentConfigs)
    .where(eq(aiAgentConfigs.whatsappPhoneNumberId, phoneNumberId))
    .limit(1);
  return rows[0] ?? null;
}

// =============================================
// Tareas y recordatorios (Fase 7, ver plan-implementacion.md §1-bis)
// =============================================

export async function listTasksForTenant(
  db: Db,
  tenantId: string,
  filters: { leadId?: string; dealId?: string; status?: "pending" | "done" } = {}
) {
  const conditions = [eq(tasks.tenantId, tenantId)];
  if (filters.leadId) conditions.push(eq(tasks.leadId, filters.leadId));
  if (filters.dealId) conditions.push(eq(tasks.dealId, filters.dealId));
  if (filters.status) conditions.push(eq(tasks.status, filters.status));

  return db
    .select()
    .from(tasks)
    .where(and(...conditions))
    .orderBy(tasks.dueAt);
}

export async function getTaskForTenant(db: Db, tenantId: string, taskId: string) {
  const rows = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.tenantId, tenantId)));
  return rows[0] ?? null;
}

export async function createTaskForTenant(db: Db, tenantId: string, input: CreateTaskInput) {
  const [task] = await db
    .insert(tasks)
    .values({ id: crypto.randomUUID(), tenantId, ...input })
    .returning();
  return task;
}

export async function updateTaskForTenant(
  db: Db,
  tenantId: string,
  taskId: string,
  input: UpdateTaskInput
) {
  const existing = await getTaskForTenant(db, tenantId, taskId);
  if (!existing) return null;
  if (Object.keys(input).length === 0) return existing;

  const [row] = await db
    .update(tasks)
    .set(input)
    .where(and(eq(tasks.id, taskId), eq(tasks.tenantId, tenantId)))
    .returning();

  return row ?? null;
}

export async function deleteTaskForTenant(db: Db, tenantId: string, taskId: string) {
  const existing = await getTaskForTenant(db, tenantId, taskId);
  if (!existing) return false;

  await db.delete(tasks).where(and(eq(tasks.id, taskId), eq(tasks.tenantId, tenantId)));
  return true;
}

/**
 * Tareas pendientes con fecha de vencimiento en el pasado — usada por el
 * handler de "tarea vencida" (ver app/api/cron/check-tasks/route.ts) y por el
 * widget del Resumen. No filtra por `assigneeId`: cada endpoint decide a
 * quién mostrárselo o notificarlo.
 */
export async function listOverdueTasksForTenant(db: Db, tenantId: string, asOf: Date = new Date()) {
  const rows = await listTasksForTenant(db, tenantId, { status: "pending" });
  return rows.filter((t) => t.dueAt && new Date(t.dueAt).getTime() <= asOf.getTime());
}

// =============================================
// Notificaciones in-app (Fase 7)
// =============================================

export async function createNotificationForTenant(
  db: Db,
  tenantId: string,
  userId: string,
  type: "new_lead" | "visit_scheduled" | "task_due",
  title: string,
  body?: string,
  link?: string
) {
  const [row] = await db
    .insert(notifications)
    .values({ id: crypto.randomUUID(), tenantId, userId, type, title, body, link })
    .returning();
  return row;
}

/** Crea una notificación idéntica para cada miembro del equipo del tenant. */
export async function notifyTenantTeam(
  db: Db,
  tenantId: string,
  type: "new_lead" | "visit_scheduled" | "task_due",
  title: string,
  body?: string,
  link?: string
) {
  const team = await listTeamMembersForTenant(db, tenantId);
  await Promise.all(
    team.map((member) => createNotificationForTenant(db, tenantId, member.id, type, title, body, link))
  );
}

export async function listNotificationsForUser(
  db: Db,
  tenantId: string,
  userId: string,
  limit = 20
) {
  return db
    .select()
    .from(notifications)
    .where(and(eq(notifications.tenantId, tenantId), eq(notifications.userId, userId)))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}

export async function countUnreadNotificationsForUser(db: Db, tenantId: string, userId: string) {
  const rows = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(
      and(
        eq(notifications.tenantId, tenantId),
        eq(notifications.userId, userId),
        eq(notifications.read, false)
      )
    );
  return rows.length;
}

export async function markNotificationReadForUser(
  db: Db,
  tenantId: string,
  userId: string,
  notificationId: string
) {
  const [row] = await db
    .update(notifications)
    .set({ read: true })
    .where(
      and(
        eq(notifications.id, notificationId),
        eq(notifications.tenantId, tenantId),
        eq(notifications.userId, userId)
      )
    )
    .returning();
  return row ?? null;
}

/** Evita notificar dos veces la misma tarea vencida en corridas sucesivas del cron. */
export async function hasNotificationForLink(
  db: Db,
  tenantId: string,
  userId: string,
  link: string
) {
  const rows = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(
      and(
        eq(notifications.tenantId, tenantId),
        eq(notifications.userId, userId),
        eq(notifications.link, link)
      )
    )
    .limit(1);
  return rows.length > 0;
}

export async function markAllNotificationsReadForUser(db: Db, tenantId: string, userId: string) {
  await db
    .update(notifications)
    .set({ read: true })
    .where(and(eq(notifications.tenantId, tenantId), eq(notifications.userId, userId)));
}

// =============================================
// Reportes y comisiones (Fase 8, ver plan-implementacion.md §1-bis)
// =============================================

/**
 * Comisión por deal `closed_won`: `dealValueCents * (commissionPercentage / 100)`
 * de la propiedad asociada. Agrupado por asesor — los deals sin `advisorId`
 * (como los sembrados en la demo antes de tener asignación real) caen en el
 * grupo `null`, que la UI muestra como "Sin asesor asignado" en vez de
 * inventar un nombre o romper el reporte.
 */
export async function getCommissionsReportForTenant(db: Db, tenantId: string) {
  const rows = await db
    .select({
      dealId: deals.id,
      dealValueCents: deals.dealValueCents,
      advisorId: deals.advisorId,
      advisorName: userTable.name,
      commissionPercentage: properties.commissionPercentage,
      closedAt: deals.updatedAt,
    })
    .from(deals)
    .innerJoin(properties, eq(deals.propertyId, properties.id))
    .leftJoin(userTable, eq(deals.advisorId, userTable.id))
    .where(and(eq(deals.tenantId, tenantId), eq(deals.stage, "closed_won")));

  const byAdvisor = new Map<
    string,
    { advisorId: string | null; advisorName: string | null; dealCount: number; commissionCents: number }
  >();

  for (const row of rows) {
    const key = row.advisorId ?? "__sin_asesor__";
    const commissionCents = Math.round(
      (row.dealValueCents ?? 0) * ((row.commissionPercentage ?? 0) / 100)
    );
    const existing = byAdvisor.get(key);
    if (existing) {
      existing.dealCount += 1;
      existing.commissionCents += commissionCents;
    } else {
      byAdvisor.set(key, {
        advisorId: row.advisorId,
        advisorName: row.advisorName,
        dealCount: 1,
        commissionCents,
      });
    }
  }

  return {
    deals: rows,
    byAdvisor: Array.from(byAdvisor.values()).sort((a, b) => b.commissionCents - a.commissionCents),
    totalCommissionCents: rows.reduce(
      (acc, r) => acc + Math.round((r.dealValueCents ?? 0) * ((r.commissionPercentage ?? 0) / 100)),
      0
    ),
  };
}

/** Tasa de conversión por canal de origen del lead (website/whatsapp/referral/manual). */
export async function getConversionBySourceForTenant(db: Db, tenantId: string) {
  const allLeads = await db
    .select({ id: leads.id, source: leads.source })
    .from(leads)
    .where(eq(leads.tenantId, tenantId));

  const wonLeadIds = new Set(
    (
      await db
        .select({ leadId: deals.leadId })
        .from(deals)
        .where(and(eq(deals.tenantId, tenantId), eq(deals.stage, "closed_won")))
    ).map((d) => d.leadId)
  );

  const bySource = new Map<string, { source: string; total: number; won: number }>();
  for (const lead of allLeads) {
    const existing = bySource.get(lead.source);
    const won = wonLeadIds.has(lead.id) ? 1 : 0;
    if (existing) {
      existing.total += 1;
      existing.won += won;
    } else {
      bySource.set(lead.source, { source: lead.source, total: 1, won });
    }
  }

  return Array.from(bySource.values()).map((s) => ({
    ...s,
    conversionRate: s.total > 0 ? Math.round((s.won / s.total) * 100) : 0,
  }));
}

/**
 * Velocidad de cierre real: días entre `createdAt` y `updatedAt` de cada deal
 * `closed_won`. No hay una columna `closed_at` separada — `updatedAt` se
 * actualiza automáticamente en cada `PATCH` (ver `timestamps` en `_shared.ts`),
 * y el último cambio de un deal que terminó en `closed_won` es, en la
 * práctica, el momento del cierre. Documentado como aproximación, no como
 * dato exacto de auditoría.
 */
export async function getAverageClosingDaysForTenant(db: Db, tenantId: string) {
  const rows = await db
    .select({ createdAt: deals.createdAt, updatedAt: deals.updatedAt })
    .from(deals)
    .where(and(eq(deals.tenantId, tenantId), eq(deals.stage, "closed_won")));

  if (rows.length === 0) return null;

  const totalDays = rows.reduce((acc, r) => {
    const days = (new Date(r.updatedAt).getTime() - new Date(r.createdAt).getTime()) / 86_400_000;
    return acc + Math.max(0, days);
  }, 0);

  return Math.round((totalDays / rows.length) * 10) / 10;
}

/** Ranking de asesores por deals `closed_won`, de más a menos. */
export async function getAdvisorRankingForTenant(db: Db, tenantId: string) {
  const rows = await db
    .select({
      advisorId: deals.advisorId,
      advisorName: userTable.name,
      dealValueCents: deals.dealValueCents,
    })
    .from(deals)
    .leftJoin(userTable, eq(deals.advisorId, userTable.id))
    .where(and(eq(deals.tenantId, tenantId), eq(deals.stage, "closed_won")));

  const byAdvisor = new Map<
    string,
    { advisorId: string | null; advisorName: string | null; dealCount: number; totalValueCents: number }
  >();

  for (const row of rows) {
    const key = row.advisorId ?? "__sin_asesor__";
    const existing = byAdvisor.get(key);
    if (existing) {
      existing.dealCount += 1;
      existing.totalValueCents += row.dealValueCents ?? 0;
    } else {
      byAdvisor.set(key, {
        advisorId: row.advisorId,
        advisorName: row.advisorName,
        dealCount: 1,
        totalValueCents: row.dealValueCents ?? 0,
      });
    }
  }

  return Array.from(byAdvisor.values()).sort((a, b) => b.dealCount - a.dealCount);
}

// =============================================
// Documentos y contratos (Fase 9, ver plan-implementacion.md §1-bis)
// =============================================

/**
 * Registra la fila del documento ya subido a R2 (el `put` del objeto en sí
 * vive en el route handler, que es quien tiene el archivo en memoria — ver
 * app/api/documents/route.ts). Esta función solo valida que, si se pasó
 * lead/deal/propiedad, pertenezcan al mismo tenant antes de guardar la
 * referencia.
 */
export async function createDocumentForTenant(
  db: Db,
  tenantId: string,
  input: {
    leadId?: string;
    dealId?: string;
    propertyId?: string;
    type: "contract" | "mandate" | "id_copy" | "other";
    fileName: string;
    contentType: string;
    sizeBytes: number;
    storageKey: string;
    uploadedBy?: string;
  }
) {
  if (input.leadId && !(await getLeadForTenant(db, tenantId, input.leadId))) return null;
  if (input.dealId && !(await getDealForTenant(db, tenantId, input.dealId))) return null;
  if (input.propertyId && !(await getPropertyForTenant(db, tenantId, input.propertyId))) return null;

  const [row] = await db
    .insert(documents)
    .values({ id: crypto.randomUUID(), tenantId, ...input })
    .returning();
  return row;
}

export async function listDocumentsForTenant(
  db: Db,
  tenantId: string,
  filters: { leadId?: string; dealId?: string; propertyId?: string } = {}
) {
  const conditions = [eq(documents.tenantId, tenantId)];
  if (filters.leadId) conditions.push(eq(documents.leadId, filters.leadId));
  if (filters.dealId) conditions.push(eq(documents.dealId, filters.dealId));
  if (filters.propertyId) conditions.push(eq(documents.propertyId, filters.propertyId));

  return db
    .select()
    .from(documents)
    .where(and(...conditions))
    .orderBy(desc(documents.createdAt));
}

export async function getDocumentForTenant(db: Db, tenantId: string, documentId: string) {
  const rows = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, documentId), eq(documents.tenantId, tenantId)));
  return rows[0] ?? null;
}

export async function deleteDocumentForTenant(db: Db, tenantId: string, documentId: string) {
  const existing = await getDocumentForTenant(db, tenantId, documentId);
  if (!existing) return null;

  await db.delete(documents).where(and(eq(documents.id, documentId), eq(documents.tenantId, tenantId)));
  return existing;
}

// =============================================
// Calendario y sincronización con Google Calendar (Fase 10, ver
// plan-implementacion.md §1-bis)
// =============================================

export async function getGoogleCalendarConnectionForUser(db: Db, tenantId: string, userId: string) {
  const rows = await db
    .select()
    .from(googleCalendarConnections)
    .where(
      and(
        eq(googleCalendarConnections.tenantId, tenantId),
        eq(googleCalendarConnections.userId, userId)
      )
    );
  return rows[0] ?? null;
}

export async function saveGoogleCalendarConnectionForUser(
  db: Db,
  tenantId: string,
  userId: string,
  input: { accessTokenEnc: string; refreshTokenEnc: string; expiresAt: string; calendarId?: string }
) {
  const existing = await getGoogleCalendarConnectionForUser(db, tenantId, userId);
  if (!existing) {
    const [row] = await db
      .insert(googleCalendarConnections)
      .values({ id: crypto.randomUUID(), tenantId, userId, ...input })
      .returning();
    return row;
  }

  const [row] = await db
    .update(googleCalendarConnections)
    .set(input)
    .where(eq(googleCalendarConnections.userId, userId))
    .returning();
  return row ?? existing;
}

export async function deleteGoogleCalendarConnectionForUser(db: Db, tenantId: string, userId: string) {
  await db
    .delete(googleCalendarConnections)
    .where(
      and(
        eq(googleCalendarConnections.tenantId, tenantId),
        eq(googleCalendarConnections.userId, userId)
      )
    );
}

// =============================================
// Matching inteligente lead ↔ propiedad (Fase 11, ver plan-implementacion.md
// §1-bis)
// =============================================

/**
 * Sugiere propiedades activas y publicadas del tenant que calzan con las
 * preferencias del lead (ciudad, tipo, operación, presupuesto). Si el lead no
 * tiene ninguna preferencia capturada, devuelve una lista vacía en vez de
 * sugerir al azar — sugerir sin criterio sería peor que no sugerir nada.
 */
export async function getMatchingPropertiesForLead(db: Db, tenantId: string, leadId: string) {
  const lead = await getLeadForTenant(db, tenantId, leadId);
  if (!lead) return [];

  const hasPreferences =
    lead.preferredCity || lead.preferredType || lead.preferredOperation || lead.budgetMinCents || lead.budgetMaxCents;
  if (!hasPreferences) return [];

  const { properties: activeProperties } = await listPropertiesForTenant(db, tenantId, {
    status: "active",
    limit: 500,
  });

  return activeProperties
    .filter((p) => {
      if (lead.preferredType && p.type !== lead.preferredType) return false;
      if (
        lead.preferredOperation &&
        p.operation !== lead.preferredOperation &&
        p.operation !== "sale_rent" &&
        lead.preferredOperation !== "sale_rent"
      ) {
        return false;
      }
      if (
        lead.preferredCity &&
        !(p.city ?? "").toLowerCase().includes(lead.preferredCity.toLowerCase())
      ) {
        return false;
      }
      if (lead.budgetMaxCents && p.priceCents > lead.budgetMaxCents) return false;
      if (lead.budgetMinCents && p.priceCents < lead.budgetMinCents) return false;
      return true;
    })
    .slice(0, 6);
}
