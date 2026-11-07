import { beforeEach, describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "../lib/db/schema";
import type { Db } from "../lib/db/client";
import { getOrCreatePortalFeedToken, getTenantByPortalFeedToken } from "../lib/db/tenant-scope";
import { applyMigrations } from "./setup/migrate";

describe("lib/db/tenant-scope.ts — feed de portales externos (Fase 12)", () => {
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

  it("genera un token la primera vez que se pide", async () => {
    const token = await getOrCreatePortalFeedToken(db, tenantAId);
    expect(token).toBeTruthy();
    expect(token!.length).toBeGreaterThan(10);
  });

  it("reutiliza el mismo token en llamadas sucesivas", async () => {
    const first = await getOrCreatePortalFeedToken(db, tenantAId);
    const second = await getOrCreatePortalFeedToken(db, tenantAId);
    expect(first).toBe(second);
  });

  it("cada tenant tiene un token distinto", async () => {
    const tokenA = await getOrCreatePortalFeedToken(db, tenantAId);
    const tokenB = await getOrCreatePortalFeedToken(db, tenantBId);
    expect(tokenA).not.toBe(tokenB);
  });

  it("resuelve el tenant correcto a partir de su token", async () => {
    const token = await getOrCreatePortalFeedToken(db, tenantAId);
    const tenant = await getTenantByPortalFeedToken(db, token!);
    expect(tenant?.id).toBe(tenantAId);
  });

  it("un token inexistente no resuelve ningún tenant", async () => {
    const tenant = await getTenantByPortalFeedToken(db, "token-que-no-existe");
    expect(tenant).toBeNull();
  });
});
