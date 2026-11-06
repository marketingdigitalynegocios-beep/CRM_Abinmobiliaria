import { beforeEach, describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "../lib/db/schema";
import type { Db } from "../lib/db/client";
import {
  addLeadPropertyInterest,
  createDealForTenant,
  createLeadForTenant,
  createPropertyForTenant,
  createVisitForTenant,
  getDealForTenant,
  getLeadForTenant,
  listDealsForTenant,
  listLeadPropertyInterests,
  updateDealForTenant,
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

describe("lib/db/tenant-scope.ts — leads", () => {
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

  it("crea un lead y, si se pasa una propiedad del mismo tenant, registra el interés", async () => {
    const property = await createPropertyForTenant(db, tenantAId, baseProperty());
    const lead = await createLeadForTenant(
      db,
      tenantAId,
      { fullName: "María Pérez", source: "website" },
      property.id
    );

    const interests = await listLeadPropertyInterests(db, lead.id);
    expect(interests).toHaveLength(1);
    expect(interests[0].property.id).toBe(property.id);
  });

  it("no registra interés en una propiedad de otro tenant, pero el lead igual se crea", async () => {
    const otherTenantProperty = await createPropertyForTenant(db, tenantBId, baseProperty());
    const lead = await createLeadForTenant(
      db,
      tenantAId,
      { fullName: "Lead colado", source: "website" },
      otherTenantProperty.id
    );

    expect(lead).toBeTruthy();
    const interests = await listLeadPropertyInterests(db, lead.id);
    expect(interests).toHaveLength(0);
  });

  it("no permite calificar un lead de otro tenant", async () => {
    const lead = await createLeadForTenant(db, tenantAId, { fullName: "Lead A", source: "website" });
    const crossTenantUpdate = await updateLeadForTenant(db, tenantBId, lead.id, { stage: "contacted" });
    expect(crossTenantUpdate).toBeNull();

    const stillNew = await getLeadForTenant(db, tenantAId, lead.id);
    expect(stillNew?.stage).toBe("new");
  });

  it("addLeadPropertyInterest es idempotente (no duplica el interés)", async () => {
    const property = await createPropertyForTenant(db, tenantAId, baseProperty());
    const lead = await createLeadForTenant(db, tenantAId, { fullName: "Lead A", source: "website" });

    await addLeadPropertyInterest(db, tenantAId, lead.id, property.id);
    await addLeadPropertyInterest(db, tenantAId, lead.id, property.id);

    const interests = await listLeadPropertyInterests(db, lead.id);
    expect(interests).toHaveLength(1);
  });
});

describe("lib/db/tenant-scope.ts — deals", () => {
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

  it("crea un deal cuando el lead y la propiedad son del mismo tenant", async () => {
    const property = await createPropertyForTenant(db, tenantAId, baseProperty());
    const lead = await createLeadForTenant(db, tenantAId, { fullName: "Lead A", source: "website" });

    const deal = await createDealForTenant(db, tenantAId, {
      leadId: lead.id,
      propertyId: property.id,
      dealValueCents: 44_000_000_00,
    });

    expect(deal).not.toBeNull();
    expect(deal?.stage).toBe("new");
  });

  it("no crea el deal si la propiedad es de otro tenant, aunque el lead sí sea propio", async () => {
    const lead = await createLeadForTenant(db, tenantAId, { fullName: "Lead A", source: "website" });
    const otherTenantProperty = await createPropertyForTenant(db, tenantBId, baseProperty());

    const deal = await createDealForTenant(db, tenantAId, {
      leadId: lead.id,
      propertyId: otherTenantProperty.id,
    });

    expect(deal).toBeNull();
  });

  it("un lead puede tener varios deals abiertos en paralelo", async () => {
    const propertyOne = await createPropertyForTenant(db, tenantAId, baseProperty());
    const propertyTwo = await createPropertyForTenant(
      db,
      tenantAId,
      baseProperty({ title: "Casa Envigado" })
    );
    const lead = await createLeadForTenant(db, tenantAId, { fullName: "Lead A", source: "website" });

    await createDealForTenant(db, tenantAId, { leadId: lead.id, propertyId: propertyOne.id });
    await createDealForTenant(db, tenantAId, { leadId: lead.id, propertyId: propertyTwo.id });

    const dealsForLead = await listDealsForTenant(db, tenantAId, { leadId: lead.id });
    expect(dealsForLead).toHaveLength(2);
  });

  it("no permite mover un deal de otro tenant en el kanban", async () => {
    const property = await createPropertyForTenant(db, tenantAId, baseProperty());
    const lead = await createLeadForTenant(db, tenantAId, { fullName: "Lead A", source: "website" });
    const deal = await createDealForTenant(db, tenantAId, { leadId: lead.id, propertyId: property.id });

    const crossTenantUpdate = await updateDealForTenant(db, tenantBId, deal!.id, {
      stage: "closed_won",
    });
    expect(crossTenantUpdate).toBeNull();

    const stillNew = await getDealForTenant(db, tenantAId, deal!.id);
    expect(stillNew?.stage).toBe("new");
  });
});

describe("lib/db/tenant-scope.ts — visits", () => {
  let db: Db;
  let tenantAId: string;

  beforeEach(() => {
    const sqlite = new Database(":memory:");
    sqlite.pragma("foreign_keys = ON");
    applyMigrations(sqlite);
    db = drizzle(sqlite, { schema }) as unknown as Db;

    tenantAId = crypto.randomUUID();
    db.insert(schema.tenants)
      .values([{ id: tenantAId, slug: "inmobiliaria-a", name: "Inmobiliaria A" }])
      .run();
  });

  it("detecta conflicto de agenda: mismo asesor, misma franja exacta", async () => {
    const property = await createPropertyForTenant(db, tenantAId, baseProperty());
    const leadOne = await createLeadForTenant(db, tenantAId, { fullName: "Lead 1", source: "website" });
    const leadTwo = await createLeadForTenant(db, tenantAId, { fullName: "Lead 2", source: "website" });
    const advisorId = crypto.randomUUID();
    const scheduledAt = "2026-12-01T15:00:00.000Z";

    db.insert(schema.user)
      .values({
        id: advisorId,
        name: "Asesor",
        email: "asesor@test.com",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tenantId: tenantAId,
      })
      .run();

    const first = await createVisitForTenant(db, tenantAId, {
      leadId: leadOne.id,
      propertyId: property.id,
      scheduledAt,
      advisorId,
    });
    expect(first).not.toBe("conflict");

    const second = await createVisitForTenant(db, tenantAId, {
      leadId: leadTwo.id,
      propertyId: property.id,
      scheduledAt,
      advisorId,
    });
    expect(second).toBe("conflict");
  });
});
