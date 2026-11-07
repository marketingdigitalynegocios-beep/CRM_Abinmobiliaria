import { beforeEach, describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "../lib/db/schema";
import type { Db } from "../lib/db/client";
import {
  createLeadForTenant,
  createPropertyForTenant,
  getMatchingPropertiesForLead,
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
    status: "active" as const,
    city: "Medellín",
    ...overrides,
  };
}

describe("lib/db/tenant-scope.ts — matching lead ↔ propiedad (Fase 11)", () => {
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

  it("no sugiere nada si el lead no tiene ninguna preferencia capturada", async () => {
    await createPropertyForTenant(db, tenantAId, baseProperty());
    const lead = await createLeadForTenant(db, tenantAId, { fullName: "Lead sin datos", source: "manual" });

    const matches = await getMatchingPropertiesForLead(db, tenantAId, lead.id);
    expect(matches).toHaveLength(0);
  });

  it("sugiere una propiedad que calza por ciudad y presupuesto", async () => {
    const property = await createPropertyForTenant(db, tenantAId, baseProperty());
    const lead = await createLeadForTenant(db, tenantAId, {
      fullName: "Lead con presupuesto",
      source: "manual",
      preferredCity: "medel",
      budgetMinCents: 40_000_000_00,
      budgetMaxCents: 50_000_000_00,
    });

    const matches = await getMatchingPropertiesForLead(db, tenantAId, lead.id);
    expect(matches.map((p) => p.id)).toContain(property.id);
  });

  it("excluye propiedades fuera del presupuesto del lead", async () => {
    const expensive = await createPropertyForTenant(
      db,
      tenantAId,
      baseProperty({ title: "Penthouse caro", priceCents: 900_000_000_00 })
    );
    const lead = await createLeadForTenant(db, tenantAId, {
      fullName: "Lead presupuesto bajo",
      source: "manual",
      budgetMaxCents: 100_000_000_00,
    });

    const matches = await getMatchingPropertiesForLead(db, tenantAId, lead.id);
    expect(matches.map((p) => p.id)).not.toContain(expensive.id);
  });

  it("excluye propiedades de otro tipo cuando el lead pidió un tipo específico", async () => {
    const house = await createPropertyForTenant(db, tenantAId, baseProperty({ type: "house", title: "Casa" }));
    const lead = await createLeadForTenant(db, tenantAId, {
      fullName: "Lead busca apto",
      source: "manual",
      preferredType: "apartment",
    });

    const matches = await getMatchingPropertiesForLead(db, tenantAId, lead.id);
    expect(matches.map((p) => p.id)).not.toContain(house.id);
  });

  it("no sugiere propiedades de otro tenant", async () => {
    await createPropertyForTenant(db, tenantBId, baseProperty());
    const leadA = await createLeadForTenant(db, tenantAId, {
      fullName: "Lead A",
      source: "manual",
      preferredCity: "Medellín",
    });

    const matches = await getMatchingPropertiesForLead(db, tenantAId, leadA.id);
    expect(matches).toHaveLength(0);
  });

  it("actualizar preferencias de un lead existente habilita el matching", async () => {
    const property = await createPropertyForTenant(db, tenantAId, baseProperty());
    const lead = await createLeadForTenant(db, tenantAId, { fullName: "Lead", source: "manual" });

    expect(await getMatchingPropertiesForLead(db, tenantAId, lead.id)).toHaveLength(0);

    await updateLeadForTenant(db, tenantAId, lead.id, { preferredCity: "Medellín" });

    const matches = await getMatchingPropertiesForLead(db, tenantAId, lead.id);
    expect(matches.map((p) => p.id)).toContain(property.id);
  });
});
