import { sqliteTable, text, integer, real, unique, index, check } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { idColumn, timestamps } from "./_shared";
import { user } from "./auth";

export const tenants = sqliteTable("tenants", {
  id: idColumn(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  logoImageId: text("logo_image_id"),
  phone: text("phone"),
  email: text("email"),
  city: text("city"),
  address: text("address"),
  website: text("website"),
  primaryColor: text("primary_color").notNull().default("#1B4FBF"),
  template: text("template", { enum: ["modern", "classic", "minimal"] })
    .notNull()
    .default("modern"),
  whatsappNumber: text("whatsapp_number"),
  description: text("description"),
  // Token opaco para el feed XML de portales externos (Fase 12, ver
  // plan-implementacion.md §1-bis) — el feed es público (lo consume el
  // crawler del portal, sin sesión), así que se protege por token impredecible
  // en la URL en vez de autenticación.
  portalFeedToken: text("portal_feed_token").unique(),
  ...timestamps,
}, (t) => [check("tenants_template_check", sql`${t.template} IN ('modern', 'classic', 'minimal')`)]);

export const propertyOwners = sqliteTable(
  "property_owners",
  {
    id: idColumn(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    fullName: text("full_name").notNull(),
    documentId: text("document_id"),
    phone: text("phone"),
    email: text("email"),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [index("idx_property_owners_tenant").on(t.tenantId)]
);

export const properties = sqliteTable(
  "properties",
  {
    id: idColumn(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    advisorId: text("advisor_id").references(() => user.id),
    ownerId: text("owner_id").references(() => propertyOwners.id),
    internalCode: text("internal_code"),
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    type: text("type", { enum: ["apartment", "house", "commercial", "land"] }).notNull(),
    operation: text("operation", { enum: ["sale", "rent", "sale_rent"] }).notNull(),
    priceCents: integer("price_cents").notNull(),
    currency: text("currency").notNull().default("COP"),
    areaM2: real("area_m2"),
    bedrooms: integer("bedrooms"),
    bathrooms: integer("bathrooms"),
    parkingSpots: integer("parking_spots").notNull().default(0),
    stratum: integer("stratum"),
    city: text("city"),
    neighborhood: text("neighborhood"),
    address: text("address"),
    latitude: real("latitude"),
    longitude: real("longitude"),
    coverImageId: text("cover_image_id"),
    isFeatured: integer("is_featured", { mode: "boolean" }).notNull().default(false),
    status: text("status", { enum: ["active", "inactive", "sold", "rented"] })
      .notNull()
      .default("active"),
    visibility: text("visibility", { enum: ["draft", "published", "archived"] })
      .notNull()
      .default("published"),
    listingType: text("listing_type", { enum: ["exclusive", "shared", "open"] })
      .notNull()
      .default("exclusive"),
    mandateStartDate: text("mandate_start_date"),
    mandateEndDate: text("mandate_end_date"),
    commissionPercentage: real("commission_percentage"),
    amenitiesJson: text("amenities_json").notNull().default("[]"),
    ...timestamps,
  },
  (t) => [
    unique("properties_tenant_slug_unique").on(t.tenantId, t.slug),
    unique("properties_tenant_internal_code_unique").on(t.tenantId, t.internalCode),
    index("idx_properties_tenant").on(t.tenantId),
    index("idx_properties_status").on(t.status),
    index("idx_properties_type").on(t.type),
    index("idx_properties_owner").on(t.ownerId),
    check("properties_type_check", sql`${t.type} IN ('apartment', 'house', 'commercial', 'land')`),
    check("properties_operation_check", sql`${t.operation} IN ('sale', 'rent', 'sale_rent')`),
    check("properties_status_check", sql`${t.status} IN ('active', 'inactive', 'sold', 'rented')`),
    check("properties_visibility_check", sql`${t.visibility} IN ('draft', 'published', 'archived')`),
    check("properties_listing_type_check", sql`${t.listingType} IN ('exclusive', 'shared', 'open')`),
  ]
);

export const propertyImages = sqliteTable("property_images", {
  id: idColumn(),
  propertyId: text("property_id")
    .notNull()
    .references(() => properties.id, { onDelete: "cascade" }),
  imageId: text("image_id").notNull(),
  altText: text("alt_text"),
  position: integer("position").notNull().default(0),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const leads = sqliteTable(
  "leads",
  {
    id: idColumn(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    advisorId: text("advisor_id").references(() => user.id),
    fullName: text("full_name").notNull(),
    email: text("email"),
    phone: text("phone"),
    whatsapp: text("whatsapp"),
    source: text("source", { enum: ["website", "whatsapp", "referral", "manual"] })
      .notNull()
      .default("website"),
    // Solo calificación del contacto; el pipeline de venta vive en `deals` (ver blueprint §14, "Separar Lead de Deal").
    stage: text("stage", { enum: ["new", "contacted", "disqualified"] })
      .notNull()
      .default("new"),
    notes: text("notes"),
    budgetMinCents: integer("budget_min_cents"),
    budgetMaxCents: integer("budget_max_cents"),
    // Preferencias estructuradas para el matching automático (Fase 11, ver
    // plan-implementacion.md §1-bis) — se decidió pedirlas explícitas en vez
    // de extraerlas con IA de `notes`: son 3 campos opcionales que el asesor
    // ya conoce al calificar el lead, sin costo ni latencia de un modelo.
    preferredCity: text("preferred_city"),
    preferredType: text("preferred_type", {
      enum: ["apartment", "house", "commercial", "land"],
    }),
    preferredOperation: text("preferred_operation", { enum: ["sale", "rent", "sale_rent"] }),
    ...timestamps,
  },
  (t) => [
    index("idx_leads_tenant").on(t.tenantId),
    index("idx_leads_stage").on(t.stage),
    check("leads_source_check", sql`${t.source} IN ('website', 'whatsapp', 'referral', 'manual')`),
    check("leads_stage_check", sql`${t.stage} IN ('new', 'contacted', 'disqualified')`),
    check(
      "leads_preferred_type_check",
      sql`${t.preferredType} IS NULL OR ${t.preferredType} IN ('apartment', 'house', 'commercial', 'land')`
    ),
    check(
      "leads_preferred_operation_check",
      sql`${t.preferredOperation} IS NULL OR ${t.preferredOperation} IN ('sale', 'rent', 'sale_rent')`
    ),
  ]
);

export const leadPropertyInterests = sqliteTable(
  "lead_property_interests",
  {
    id: idColumn(),
    leadId: text("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    propertyId: text("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (t) => [unique("lead_property_interests_unique").on(t.leadId, t.propertyId)]
);

// Oportunidad de venta/arriendo sobre una propiedad concreta. Un mismo lead puede
// tener varios deals simultáneos. Alimenta el KanbanBoard (ver blueprint §8/§14).
export const deals = sqliteTable(
  "deals",
  {
    id: idColumn(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    leadId: text("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    propertyId: text("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    advisorId: text("advisor_id").references(() => user.id),
    title: text("title"),
    dealValueCents: integer("deal_value_cents"),
    stage: text("stage", {
      enum: [
        "new",
        "meeting_scheduled",
        "qualified",
        "proposal_sent",
        "negotiation",
        "closed_won",
        "closed_lost",
      ],
    })
      .notNull()
      .default("new"),
    nextAction: text("next_action"),
    expectedCloseDate: text("expected_close_date"),
    ...timestamps,
  },
  (t) => [
    index("idx_deals_tenant").on(t.tenantId),
    index("idx_deals_stage").on(t.stage),
    index("idx_deals_lead").on(t.leadId),
    index("idx_deals_property").on(t.propertyId),
    check(
      "deals_stage_check",
      sql`${t.stage} IN ('new', 'meeting_scheduled', 'qualified', 'proposal_sent', 'negotiation', 'closed_won', 'closed_lost')`
    ),
  ]
);

export const visits = sqliteTable(
  "visits",
  {
    id: idColumn(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    leadId: text("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    propertyId: text("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    dealId: text("deal_id").references(() => deals.id, { onDelete: "set null" }),
    advisorId: text("advisor_id").references(() => user.id),
    scheduledAt: text("scheduled_at").notNull(),
    status: text("status", { enum: ["scheduled", "completed", "cancelled"] })
      .notNull()
      .default("scheduled"),
    notes: text("notes"),
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (t) => [
    index("idx_visits_tenant").on(t.tenantId),
    index("idx_visits_scheduled").on(t.scheduledAt),
    check("visits_status_check", sql`${t.status} IN ('scheduled', 'completed', 'cancelled')`),
  ]
);

export const aiAgentConfigs = sqliteTable(
  "ai_agent_configs",
  {
    id: idColumn(),
    tenantId: text("tenant_id")
      .notNull()
      .unique()
      .references(() => tenants.id, { onDelete: "cascade" }),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(false),
    whatsappWabaId: text("whatsapp_waba_id"),
    whatsappPhoneNumberId: text("whatsapp_phone_number_id"),
    whatsappDisplayNumber: text("whatsapp_display_number"),
    // Sin whatsapp_access_token_enc por tenant: se envía con un System User
    // Token único a nivel de app (env.META_SYSTEM_USER_TOKEN) — ver blueprint
    // §11/§14/§15 riesgo 10, resuelto en v1.7 auditando WhatsflowAI-V2.
    geminiKeyEnc: text("gemini_key_enc"),
    systemPrompt: text("system_prompt"),
    welcomeMessage: text("welcome_message"),
    ...timestamps,
  },
  (t) => [index("idx_ai_agent_phone_number").on(t.whatsappPhoneNumberId)]
);

// Historial real de conversaciones de WhatsApp (Fase 6, ver plan-implementacion.md
// §1-bis) — sin esto no hay forma de auditar qué dijo el agente ni de medir
// volumen/tiempo de respuesta reales. `leadId` es nullable porque un mensaje
// entrante puede llegar de un número que todavía no tiene lead creado.
export const whatsappMessages = sqliteTable(
  "whatsapp_messages",
  {
    id: idColumn(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    leadId: text("lead_id").references(() => leads.id, { onDelete: "set null" }),
    phoneNumberId: text("phone_number_id").notNull(),
    direction: text("direction", { enum: ["inbound", "outbound"] }).notNull(),
    body: text("body").notNull(),
    waMessageId: text("wa_message_id"),
    status: text("status", { enum: ["received", "sent", "failed"] })
      .notNull()
      .default("received"),
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (t) => [
    index("idx_whatsapp_messages_tenant").on(t.tenantId),
    index("idx_whatsapp_messages_lead").on(t.leadId),
    check("whatsapp_messages_direction_check", sql`${t.direction} IN ('inbound', 'outbound')`),
    check("whatsapp_messages_status_check", sql`${t.status} IN ('received', 'sent', 'failed')`),
  ]
);

// Timeline de interacciones de un lead (Fase 6) — una fila por cada evento real
// (cambio de etapa, nota, llamada, deal abierto, visita agendada, mensaje de
// WhatsApp). Se escribe desde las mismas funciones de tenant-scope.ts que ya
// mutan el estado, nunca desde el cliente directamente.
export const leadActivities = sqliteTable(
  "lead_activities",
  {
    id: idColumn(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    leadId: text("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    type: text("type", {
      enum: ["stage_change", "note", "call", "deal_created", "visit_scheduled", "whatsapp_message"],
    }).notNull(),
    body: text("body").notNull(),
    actorId: text("actor_id").references(() => user.id),
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (t) => [
    index("idx_lead_activities_tenant").on(t.tenantId),
    index("idx_lead_activities_lead").on(t.leadId),
    check(
      "lead_activities_type_check",
      sql`${t.type} IN ('stage_change', 'note', 'call', 'deal_created', 'visit_scheduled', 'whatsapp_message')`
    ),
  ]
);

// Seguimiento/recordatorios (Fase 7, ver plan-implementacion.md §1-bis). Una
// tarea puede colgar de un lead, de un deal, de ambos, o de ninguno (recordatorio
// suelto) — por eso `leadId`/`dealId` son nullable.
export const tasks = sqliteTable(
  "tasks",
  {
    id: idColumn(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    leadId: text("lead_id").references(() => leads.id, { onDelete: "cascade" }),
    dealId: text("deal_id").references(() => deals.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    dueAt: text("due_at"),
    status: text("status", { enum: ["pending", "done"] }).notNull().default("pending"),
    assigneeId: text("assignee_id").references(() => user.id),
    ...timestamps,
  },
  (t) => [
    index("idx_tasks_tenant").on(t.tenantId),
    index("idx_tasks_due").on(t.dueAt),
    index("idx_tasks_status").on(t.status),
    check("tasks_status_check", sql`${t.status} IN ('pending', 'done')`),
  ]
);

// Notificaciones in-app (Fase 7) — una fila por usuario, no por tenant, porque
// cada miembro del equipo marca sus propias como leídas de forma independiente.
export const notifications = sqliteTable(
  "notifications",
  {
    id: idColumn(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: text("type", { enum: ["new_lead", "visit_scheduled", "task_due"] }).notNull(),
    title: text("title").notNull(),
    body: text("body"),
    link: text("link"),
    read: integer("read", { mode: "boolean" }).notNull().default(false),
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (t) => [
    index("idx_notifications_tenant_user").on(t.tenantId, t.userId),
    index("idx_notifications_user_read").on(t.userId, t.read),
    check(
      "notifications_type_check",
      sql`${t.type} IN ('new_lead', 'visit_scheduled', 'task_due')`
    ),
  ]
);

// Documentos y contratos (Fase 9, ver plan-implementacion.md §1-bis). El
// archivo en sí vive en R2 (`env.DOCUMENTS`, ver cloudflare.config.ts) — acá
// solo se guarda la referencia (`storageKey`) y a qué registro pertenece.
// Nunca se expone una URL pública directa del bucket: se sirve streameado
// desde `GET /api/documents/[id]/download`, que valida el tenant primero.
export const documents = sqliteTable(
  "documents",
  {
    id: idColumn(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    leadId: text("lead_id").references(() => leads.id, { onDelete: "cascade" }),
    dealId: text("deal_id").references(() => deals.id, { onDelete: "cascade" }),
    propertyId: text("property_id").references(() => properties.id, { onDelete: "cascade" }),
    type: text("type", { enum: ["contract", "mandate", "id_copy", "other"] })
      .notNull()
      .default("other"),
    fileName: text("file_name").notNull(),
    contentType: text("content_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    storageKey: text("storage_key").notNull(),
    uploadedBy: text("uploaded_by").references(() => user.id),
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (t) => [
    index("idx_documents_tenant").on(t.tenantId),
    index("idx_documents_lead").on(t.leadId),
    index("idx_documents_deal").on(t.dealId),
    index("idx_documents_property").on(t.propertyId),
    check("documents_type_check", sql`${t.type} IN ('contract', 'mandate', 'id_copy', 'other')`),
  ]
);

// Sincronización con Google Calendar (Fase 10, ver plan-implementacion.md
// §1-bis) — una conexión OAuth2 por asesor (`userId` único), no por tenant,
// porque cada asesor usa su propio calendario de Google.
export const googleCalendarConnections = sqliteTable("google_calendar_connections", {
  id: idColumn(),
  tenantId: text("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: "cascade" }),
  accessTokenEnc: text("access_token_enc").notNull(),
  refreshTokenEnc: text("refresh_token_enc").notNull(),
  expiresAt: text("expires_at").notNull(),
  calendarId: text("calendar_id").notNull().default("primary"),
  ...timestamps,
});

// Reseñas y testimonios (Fase 13, ver plan-implementacion.md §1-bis). Se
// cargan desde el dashboard (el asesor registra lo que el cliente le
// compartió, ej. por WhatsApp) y quedan sin publicar hasta que un admin las
// revisa — no hay formulario público de reseñas en este MVP.
export const propertyReviews = sqliteTable(
  "property_reviews",
  {
    id: idColumn(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    propertyId: text("property_id").references(() => properties.id, { onDelete: "cascade" }),
    authorName: text("author_name").notNull(),
    rating: integer("rating").notNull(),
    comment: text("comment").notNull(),
    isPublished: integer("is_published", { mode: "boolean" }).notNull().default(false),
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (t) => [
    index("idx_property_reviews_tenant").on(t.tenantId),
    index("idx_property_reviews_property").on(t.propertyId),
    check("property_reviews_rating_check", sql`${t.rating} BETWEEN 1 AND 5`),
  ]
);

export const subscriptions = sqliteTable(
  "subscriptions",
  {
    id: idColumn(),
    tenantId: text("tenant_id")
      .notNull()
      .unique()
      .references(() => tenants.id, { onDelete: "cascade" }),
    plan: text("plan", { enum: ["free", "starter", "pro", "enterprise"] })
      .notNull()
      .default("free"),
    status: text("status", { enum: ["active", "past_due", "cancelled", "trialing"] })
      .notNull()
      .default("active"),
    wompiReference: text("wompi_reference"),
    currentPeriodStart: text("current_period_start"),
    currentPeriodEnd: text("current_period_end"),
    ...timestamps,
  },
  (t) => [
    check("subscriptions_plan_check", sql`${t.plan} IN ('free', 'starter', 'pro', 'enterprise')`),
    check(
      "subscriptions_status_check",
      sql`${t.status} IN ('active', 'past_due', 'cancelled', 'trialing')`
    ),
  ]
);
