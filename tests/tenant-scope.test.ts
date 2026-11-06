import { beforeEach, describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "../lib/db/schema";
import type { Db } from "../lib/db/client";
import {
  getLeadForTenant,
  getLeadsForTenant,
  getPropertyForTenant,
  listPropertiesForTenant,
} from "../lib/db/tenant-scope";
import { applyMigrations } from "./setup/migrate";

/**
 * Prueba de aislamiento multitenant exigida por el criterio de salida de la
 * Fase 0 (plan-implementacion.md) y el criterio de done #15 del blueprint:
 * un usuario del tenant A nunca puede leer datos del tenant B a través de la
 * capa de `tenant-scope.ts`, que es lo único que reemplaza las políticas RLS
 * que tendríamos en Postgres.
 */
describe("aislamiento multitenant (lib/db/tenant-scope.ts)", () => {
  let db: Db;
  let tenantAId: string;
  let tenantBId: string;
  let propertyAId: string;
  let propertyBId: string;
  let leadAId: string;
  let leadBId: string;

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

    propertyAId = crypto.randomUUID();
    propertyBId = crypto.randomUUID();

    db.insert(schema.properties)
      .values([
        {
          id: propertyAId,
          tenantId: tenantAId,
          title: "Apartamento A",
          slug: "apartamento-a",
          type: "apartment",
          operation: "sale",
          priceCents: 50_000_000_00,
        },
        {
          id: propertyBId,
          tenantId: tenantBId,
          title: "Apartamento B",
          slug: "apartamento-b",
          type: "apartment",
          operation: "sale",
          priceCents: 30_000_000_00,
        },
      ])
      .run();

    leadAId = crypto.randomUUID();
    leadBId = crypto.randomUUID();

    db.insert(schema.leads)
      .values([
        { id: leadAId, tenantId: tenantAId, fullName: "Lead A" },
        { id: leadBId, tenantId: tenantBId, fullName: "Lead B" },
      ])
      .run();
  });

  it("solo devuelve las propiedades del propio tenant en listPropertiesForTenant", async () => {
    const resultA = await listPropertiesForTenant(db, tenantAId);
    expect(resultA.properties).toHaveLength(1);
    expect(resultA.properties[0].id).toBe(propertyAId);
    expect(resultA.total).toBe(1);

    const resultB = await listPropertiesForTenant(db, tenantBId);
    expect(resultB.properties).toHaveLength(1);
    expect(resultB.properties[0].id).toBe(propertyBId);
  });

  it("no permite leer una propiedad de otro tenant por id (getPropertyForTenant)", async () => {
    const ownProperty = await getPropertyForTenant(db, tenantAId, propertyAId);
    expect(ownProperty).not.toBeNull();

    const crossTenantRead = await getPropertyForTenant(db, tenantAId, propertyBId);
    expect(crossTenantRead).toBeNull();
  });

  it("solo devuelve los leads del propio tenant en getLeadsForTenant", async () => {
    const leadsA = await getLeadsForTenant(db, tenantAId);
    expect(leadsA).toHaveLength(1);
    expect(leadsA[0].id).toBe(leadAId);
  });

  it("no permite leer un lead de otro tenant por id (getLeadForTenant)", async () => {
    const crossTenantRead = await getLeadForTenant(db, tenantAId, leadBId);
    expect(crossTenantRead).toBeNull();

    const ownRead = await getLeadForTenant(db, tenantBId, leadBId);
    expect(ownRead).not.toBeNull();
  });
});
