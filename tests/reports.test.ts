import { beforeEach, describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "../lib/db/schema";
import type { Db } from "../lib/db/client";
import {
  createDealForTenant,
  createLeadForTenant,
  createPropertyForTenant,
  getAdvisorRankingForTenant,
  getAverageClosingDaysForTenant,
  getCommissionsReportForTenant,
  getConversionBySourceForTenant,
  updateDealForTenant,
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

describe("lib/db/tenant-scope.ts — reportes y comisiones (Fase 8)", () => {
  let db: Db;
  let tenantAId: string;
  let tenantBId: string;
  let advisorId: string;

  beforeEach(() => {
    const sqlite = new Database(":memory:");
    sqlite.pragma("foreign_keys = ON");
    applyMigrations(sqlite);
    db = drizzle(sqlite, { schema }) as unknown as Db;

    tenantAId = crypto.randomUUID();
    tenantBId = crypto.randomUUID();
    advisorId = crypto.randomUUID();

    db.insert(schema.tenants)
      .values([
        { id: tenantAId, slug: "inmobiliaria-a", name: "Inmobiliaria A" },
        { id: tenantBId, slug: "inmobiliaria-b", name: "Inmobiliaria B" },
      ])
      .run();

    db.insert(schema.user)
      .values({
        id: advisorId,
        name: "Carlos Asesor",
        email: "carlos@test.com",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tenantId: tenantAId,
      })
      .run();
  });

  it("calcula la comisión de un deal closed_won según el % de la propiedad", async () => {
    const property = await createPropertyForTenant(
      db,
      tenantAId,
      baseProperty({ commissionPercentage: 3 })
    );
    const lead = await createLeadForTenant(db, tenantAId, { fullName: "Lead A", source: "manual" });
    const deal = await createDealForTenant(db, tenantAId, {
      leadId: lead.id,
      propertyId: property.id,
      dealValueCents: 100_000_000_00,
      advisorId,
    });
    await updateDealForTenant(db, tenantAId, deal!.id, { stage: "closed_won" });

    const report = await getCommissionsReportForTenant(db, tenantAId);
    expect(report.totalCommissionCents).toBe(3_000_000_00);
    expect(report.byAdvisor).toHaveLength(1);
    expect(report.byAdvisor[0].advisorName).toBe("Carlos Asesor");
  });

  it("agrupa los deals sin asesor bajo advisorId null", async () => {
    const property = await createPropertyForTenant(
      db,
      tenantAId,
      baseProperty({ commissionPercentage: 5 })
    );
    const lead = await createLeadForTenant(db, tenantAId, { fullName: "Lead A", source: "manual" });
    const deal = await createDealForTenant(db, tenantAId, {
      leadId: lead.id,
      propertyId: property.id,
      dealValueCents: 50_000_000_00,
    });
    await updateDealForTenant(db, tenantAId, deal!.id, { stage: "closed_won" });

    const report = await getCommissionsReportForTenant(db, tenantAId);
    expect(report.byAdvisor[0].advisorId).toBeNull();
  });

  it("no incluye deals closed_lost ni de otros tenants en el reporte de comisiones", async () => {
    const propertyA = await createPropertyForTenant(
      db,
      tenantAId,
      baseProperty({ commissionPercentage: 3 })
    );
    const leadA = await createLeadForTenant(db, tenantAId, { fullName: "Lead A", source: "manual" });
    const lostDeal = await createDealForTenant(db, tenantAId, {
      leadId: leadA.id,
      propertyId: propertyA.id,
      dealValueCents: 100_000_000_00,
    });
    await updateDealForTenant(db, tenantAId, lostDeal!.id, { stage: "closed_lost" });

    const propertyB = await createPropertyForTenant(
      db,
      tenantBId,
      baseProperty({ commissionPercentage: 10 })
    );
    const leadB = await createLeadForTenant(db, tenantBId, { fullName: "Lead B", source: "manual" });
    const dealB = await createDealForTenant(db, tenantBId, {
      leadId: leadB.id,
      propertyId: propertyB.id,
      dealValueCents: 200_000_000_00,
    });
    await updateDealForTenant(db, tenantBId, dealB!.id, { stage: "closed_won" });

    const report = await getCommissionsReportForTenant(db, tenantAId);
    expect(report.totalCommissionCents).toBe(0);
    expect(report.byAdvisor).toHaveLength(0);
  });

  it("calcula la tasa de conversión por canal de origen", async () => {
    const property = await createPropertyForTenant(db, tenantAId, baseProperty());
    const wonLead = await createLeadForTenant(db, tenantAId, {
      fullName: "Lead ganado",
      source: "whatsapp",
    });
    await createLeadForTenant(db, tenantAId, { fullName: "Lead perdido", source: "whatsapp" });

    const deal = await createDealForTenant(db, tenantAId, {
      leadId: wonLead.id,
      propertyId: property.id,
    });
    await updateDealForTenant(db, tenantAId, deal!.id, { stage: "closed_won" });

    const conversion = await getConversionBySourceForTenant(db, tenantAId);
    const whatsappRow = conversion.find((c) => c.source === "whatsapp");
    expect(whatsappRow?.total).toBe(2);
    expect(whatsappRow?.won).toBe(1);
    expect(whatsappRow?.conversionRate).toBe(50);
  });

  it("getAverageClosingDaysForTenant devuelve null sin deals cerrados", async () => {
    const result = await getAverageClosingDaysForTenant(db, tenantAId);
    expect(result).toBeNull();
  });

  it("getAdvisorRankingForTenant ordena por cantidad de deals cerrados", async () => {
    const property = await createPropertyForTenant(db, tenantAId, baseProperty());
    const lead1 = await createLeadForTenant(db, tenantAId, { fullName: "Lead 1", source: "manual" });
    const lead2 = await createLeadForTenant(db, tenantAId, { fullName: "Lead 2", source: "manual" });

    const deal1 = await createDealForTenant(db, tenantAId, {
      leadId: lead1.id,
      propertyId: property.id,
      advisorId,
    });
    await updateDealForTenant(db, tenantAId, deal1!.id, { stage: "closed_won" });

    const deal2 = await createDealForTenant(db, tenantAId, {
      leadId: lead2.id,
      propertyId: property.id,
      advisorId,
    });
    await updateDealForTenant(db, tenantAId, deal2!.id, { stage: "closed_won" });

    const ranking = await getAdvisorRankingForTenant(db, tenantAId);
    expect(ranking[0].advisorId).toBe(advisorId);
    expect(ranking[0].dealCount).toBe(2);
  });
});
