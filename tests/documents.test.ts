import { beforeEach, describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "../lib/db/schema";
import type { Db } from "../lib/db/client";
import {
  createDocumentForTenant,
  createLeadForTenant,
  createPropertyForTenant,
  deleteDocumentForTenant,
  getDocumentForTenant,
  listDocumentsForTenant,
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

function baseDocument(overrides: Partial<Parameters<typeof createDocumentForTenant>[2]> = {}) {
  return {
    type: "other" as const,
    fileName: "contrato.pdf",
    contentType: "application/pdf",
    sizeBytes: 1024,
    storageKey: crypto.randomUUID(),
    ...overrides,
  };
}

describe("lib/db/tenant-scope.ts — documentos (Fase 9)", () => {
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

  it("crea un documento suelto, sin lead/deal/propiedad", async () => {
    const doc = await createDocumentForTenant(db, tenantAId, baseDocument());
    expect(doc).not.toBeNull();

    const list = await listDocumentsForTenant(db, tenantAId);
    expect(list).toHaveLength(1);
  });

  it("asocia el documento a un lead del mismo tenant", async () => {
    const lead = await createLeadForTenant(db, tenantAId, { fullName: "Lead A", source: "manual" });
    const doc = await createDocumentForTenant(db, tenantAId, baseDocument({ leadId: lead.id }));
    expect(doc?.leadId).toBe(lead.id);

    const list = await listDocumentsForTenant(db, tenantAId, { leadId: lead.id });
    expect(list).toHaveLength(1);
  });

  it("no crea el documento si el lead referenciado es de otro tenant", async () => {
    const leadB = await createLeadForTenant(db, tenantBId, { fullName: "Lead B", source: "manual" });
    const doc = await createDocumentForTenant(db, tenantAId, baseDocument({ leadId: leadB.id }));
    expect(doc).toBeNull();
  });

  it("no expone documentos de un tenant a otro", async () => {
    await createDocumentForTenant(db, tenantAId, baseDocument());
    const crossTenantList = await listDocumentsForTenant(db, tenantBId);
    expect(crossTenantList).toHaveLength(0);
  });

  it("no permite borrar un documento de otro tenant", async () => {
    const doc = await createDocumentForTenant(db, tenantAId, baseDocument());
    const deleted = await deleteDocumentForTenant(db, tenantBId, doc!.id);
    expect(deleted).toBeNull();

    const stillThere = await getDocumentForTenant(db, tenantAId, doc!.id);
    expect(stillThere).not.toBeNull();
  });

  it("borra un documento propio y devuelve su storageKey para limpiar R2", async () => {
    const doc = await createDocumentForTenant(db, tenantAId, baseDocument({ storageKey: "tenant-a/key-1" }));
    const deleted = await deleteDocumentForTenant(db, tenantAId, doc!.id);
    expect(deleted?.storageKey).toBe("tenant-a/key-1");

    const gone = await getDocumentForTenant(db, tenantAId, doc!.id);
    expect(gone).toBeNull();
  });
});
