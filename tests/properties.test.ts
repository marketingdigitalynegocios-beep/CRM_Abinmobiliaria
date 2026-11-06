import { beforeEach, describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "../lib/db/schema";
import type { Db } from "../lib/db/client";
import {
  bulkUpdatePropertyStatusForTenant,
  createPropertyForTenant,
  createPropertyOwnerForTenant,
  deletePropertyForTenant,
  deletePropertyOwnerForTenant,
  getPropertyForTenant,
  getPublishedPropertyForTenant,
  listPropertiesForTenant,
  listPublishedPropertiesForTenant,
  updatePropertyForTenant,
  updatePropertyOwnerForTenant,
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

describe("lib/db/tenant-scope.ts — inventario de propiedades", () => {
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

  it("genera un slug único por tenant, incluso con títulos repetidos", async () => {
    const p1 = await createPropertyForTenant(db, tenantAId, baseProperty());
    const p2 = await createPropertyForTenant(db, tenantAId, baseProperty());
    expect(p1.slug).toBe("apartamento-laureles");
    expect(p2.slug).toBe("apartamento-laureles-2");

    // el mismo título en OTRO tenant no choca con el slug del primero
    const p3 = await createPropertyForTenant(db, tenantBId, baseProperty());
    expect(p3.slug).toBe("apartamento-laureles");
  });

  it("no permite editar ni borrar una propiedad de otro tenant", async () => {
    const property = await createPropertyForTenant(db, tenantAId, baseProperty());

    const crossTenantUpdate = await updatePropertyForTenant(db, tenantBId, property.id, {
      title: "Hackeado",
    });
    expect(crossTenantUpdate).toBeNull();

    const crossTenantDelete = await deletePropertyForTenant(db, tenantBId, property.id);
    expect(crossTenantDelete).toBe(false);

    const stillThere = await getPropertyForTenant(db, tenantAId, property.id);
    expect(stillThere?.title).toBe("Apartamento Laureles");
  });

  it("bulk-status solo toca ids que pertenecen al tenant que lo pide", async () => {
    const ownProperty = await createPropertyForTenant(db, tenantAId, baseProperty());
    const otherTenantProperty = await createPropertyForTenant(db, tenantBId, baseProperty());

    const updated = await bulkUpdatePropertyStatusForTenant(
      db,
      tenantAId,
      [ownProperty.id, otherTenantProperty.id], // intento de colar un id de otro tenant
      { status: "sold" }
    );

    expect(updated).toBe(1); // solo se actualizó la propia

    const own = await getPropertyForTenant(db, tenantAId, ownProperty.id);
    expect(own?.status).toBe("sold");

    const other = await getPropertyForTenant(db, tenantBId, otherTenantProperty.id);
    expect(other?.status).toBe("active"); // sin tocar
  });

  it("el catálogo público solo devuelve propiedades con visibility = published", async () => {
    await createPropertyForTenant(db, tenantAId, baseProperty({ visibility: "published" }));
    const draft = await createPropertyForTenant(
      db,
      tenantAId,
      baseProperty({ visibility: "draft" })
    );

    const { properties: publicList } = await listPublishedPropertiesForTenant(db, tenantAId);
    expect(publicList).toHaveLength(1);
    expect(publicList.every((p) => p.visibility === "published")).toBe(true);

    const draftViaPublicHelper = await getPublishedPropertyForTenant(db, tenantAId, draft.id);
    expect(draftViaPublicHelper).toBeNull();
  });

  it("filtra por tipo y paginación en listPropertiesForTenant", async () => {
    await createPropertyForTenant(db, tenantAId, baseProperty({ type: "apartment" }));
    await createPropertyForTenant(db, tenantAId, baseProperty({ type: "house", title: "Casa" }));

    const { properties: onlyHouses, total } = await listPropertiesForTenant(db, tenantAId, {
      type: "house",
    });
    expect(total).toBe(1);
    expect(onlyHouses[0].type).toBe("house");
  });
});

describe("lib/db/tenant-scope.ts — propietarios/mandantes", () => {
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

  it("no deja borrar un propietario que todavía tiene propiedades asociadas", async () => {
    const owner = await createPropertyOwnerForTenant(db, tenantAId, { fullName: "Juan Pérez" });
    await createPropertyForTenant(db, tenantAId, baseProperty({ ownerId: owner.id }));

    const result = await deletePropertyOwnerForTenant(db, tenantAId, owner.id);
    expect(result.deleted).toBe(false);
    expect(result.reason).toBe("has_properties");
  });

  it("permite borrar un propietario sin propiedades asociadas", async () => {
    const owner = await createPropertyOwnerForTenant(db, tenantAId, { fullName: "Ana Gómez" });
    const result = await deletePropertyOwnerForTenant(db, tenantAId, owner.id);
    expect(result.deleted).toBe(true);
  });

  it("actualiza solo los campos enviados", async () => {
    const owner = await createPropertyOwnerForTenant(db, tenantAId, {
      fullName: "Carlos Ruiz",
      phone: "3001234567",
    });
    const updated = await updatePropertyOwnerForTenant(db, tenantAId, owner.id, {
      phone: "3009999999",
    });
    expect(updated?.fullName).toBe("Carlos Ruiz");
    expect(updated?.phone).toBe("3009999999");
  });
});
