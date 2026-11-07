import { beforeEach, describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "../lib/db/schema";
import type { Db } from "../lib/db/client";
import {
  createDealForTenant,
  createLeadForTenant,
  createPropertyForTenant,
  createVisitForTenant,
  findLeadByPhoneForTenant,
  listLeadActivitiesForTenant,
  listWhatsappMessagesForLead,
  recordWhatsappMessage,
  updateLeadForTenant,
} from "../lib/db/tenant-scope";
import { applyMigrations } from "./setup/migrate";

function baseProperty(overrides: Partial<Parameters<typeof createPropertyForTenant>[2]> = {}) {
  return {
    title: "Apartamento Laureles",
    type: "apartment" as const,
    operation: "sale" as const,
    priceCents: 45_000_000_00,
    currency: "COP",
    parkingSpots: 0,
    amenities: [] as string[],
    isFeatured: false,
    visibility: "published" as const,
    listingType: "exclusive" as const,
    ...overrides,
  };
}

describe("lib/db/tenant-scope.ts — timeline y mensajes de WhatsApp (Fase 6)", () => {
  let db: Db;
  let tenantAId: string;
  let tenantBId: string;

  beforeEach(() => {
    const sqlite = new Database(":memory:");
    sqlite.pragma("foreign_keys = ON");
    applyMigrations(sqlite);
    db = drizzle(sqlite, { schema }) as unknown as Db;

    tenantAId = crypto.randomUUID();
    tenantBId = crypto.randomUUID();
    db.insert(schema.tenants)
      .values([
        { id: tenantAId, slug: "inmobiliaria-a", name: "Inmobiliaria A" },
        { id: tenantBId, slug: "inmobiliaria-b", name: "Inmobiliaria B" },
      ])
      .run();
  });

  it("registra un cambio de etapa en el timeline del lead", async () => {
    const lead = await createLeadForTenant(db, tenantAId, { fullName: "Lead A", source: "website" });
    await updateLeadForTenant(db, tenantAId, lead.id, { stage: "contacted" });

    const activities = await listLeadActivitiesForTenant(db, tenantAId, lead.id);
    expect(activities).toHaveLength(1);
    expect(activities[0].type).toBe("stage_change");
  });

  it("no registra actividad si el stage no cambia", async () => {
    const lead = await createLeadForTenant(db, tenantAId, { fullName: "Lead A", source: "website" });
    await updateLeadForTenant(db, tenantAId, lead.id, { notes: "solo una nota" });

    const activities = await listLeadActivitiesForTenant(db, tenantAId, lead.id);
    expect(activities).toHaveLength(0);
  });

  it("abrir una oportunidad registra 'deal_created' en el timeline", async () => {
    const property = await createPropertyForTenant(db, tenantAId, baseProperty());
    const lead = await createLeadForTenant(db, tenantAId, { fullName: "Lead A", source: "website" });
    await createDealForTenant(db, tenantAId, { leadId: lead.id, propertyId: property.id });

    const activities = await listLeadActivitiesForTenant(db, tenantAId, lead.id);
    expect(activities.some((a) => a.type === "deal_created")).toBe(true);
  });

  it("agendar una visita registra 'visit_scheduled' en el timeline", async () => {
    const property = await createPropertyForTenant(db, tenantAId, baseProperty());
    const lead = await createLeadForTenant(db, tenantAId, { fullName: "Lead A", source: "website" });
    await createVisitForTenant(db, tenantAId, {
      leadId: lead.id,
      propertyId: property.id,
      scheduledAt: "2026-12-01T15:00:00.000Z",
    });

    const activities = await listLeadActivitiesForTenant(db, tenantAId, lead.id);
    expect(activities.some((a) => a.type === "visit_scheduled")).toBe(true);
  });

  it("no expone el timeline de un lead a otro tenant", async () => {
    const lead = await createLeadForTenant(db, tenantAId, { fullName: "Lead A", source: "website" });
    await updateLeadForTenant(db, tenantAId, lead.id, { stage: "contacted" });

    const crossTenantActivities = await listLeadActivitiesForTenant(db, tenantBId, lead.id);
    expect(crossTenantActivities).toHaveLength(0);
  });

  it("recordWhatsappMessage guarda el mensaje y, si hay lead, agrega actividad", async () => {
    const lead = await createLeadForTenant(db, tenantAId, { fullName: "Lead A", source: "website" });

    await recordWhatsappMessage(db, tenantAId, {
      leadId: lead.id,
      phoneNumberId: "123456",
      direction: "inbound",
      body: "Hola, ¿tienen apartamentos?",
      status: "received",
    });

    const messages = await listWhatsappMessagesForLead(db, tenantAId, lead.id);
    expect(messages).toHaveLength(1);
    expect(messages[0].direction).toBe("inbound");

    const activities = await listLeadActivitiesForTenant(db, tenantAId, lead.id);
    expect(activities.some((a) => a.type === "whatsapp_message")).toBe(true);
  });

  it("recordWhatsappMessage sin leadId no rompe y no genera actividad huérfana", async () => {
    const message = await recordWhatsappMessage(db, tenantAId, {
      phoneNumberId: "123456",
      direction: "inbound",
      body: "Mensaje de un número desconocido",
      status: "received",
    });
    expect(message).toBeTruthy();
    expect(message?.leadId).toBeNull();
  });

  it("no mezcla mensajes de WhatsApp entre tenants", async () => {
    const leadA = await createLeadForTenant(db, tenantAId, { fullName: "Lead A", source: "website" });
    await recordWhatsappMessage(db, tenantAId, {
      leadId: leadA.id,
      phoneNumberId: "123456",
      direction: "inbound",
      body: "Mensaje del tenant A",
    });

    const crossTenantMessages = await listWhatsappMessagesForLead(db, tenantBId, leadA.id);
    expect(crossTenantMessages).toHaveLength(0);
  });

  it("findLeadByPhoneForTenant encuentra el lead comparando solo los últimos 10 dígitos", async () => {
    const lead = await createLeadForTenant(db, tenantAId, {
      fullName: "Lead con WhatsApp",
      source: "manual",
      whatsapp: "3001234567",
    });

    const found = await findLeadByPhoneForTenant(db, tenantAId, "573001234567");
    expect(found?.id).toBe(lead.id);
  });

  it("findLeadByPhoneForTenant no encuentra leads de otro tenant", async () => {
    await createLeadForTenant(db, tenantAId, {
      fullName: "Lead con WhatsApp",
      source: "manual",
      whatsapp: "3001234567",
    });

    const found = await findLeadByPhoneForTenant(db, tenantBId, "573001234567");
    expect(found).toBeNull();
  });
});
