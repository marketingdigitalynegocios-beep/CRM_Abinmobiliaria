import { beforeEach, describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "../lib/db/schema";
import type { Db } from "../lib/db/client";
import {
  deleteGoogleCalendarConnectionForUser,
  getGoogleCalendarConnectionForUser,
  saveGoogleCalendarConnectionForUser,
} from "../lib/db/tenant-scope";
import { buildGoogleAuthUrl } from "../lib/google-calendar";
import { applyMigrations } from "./setup/migrate";

describe("lib/google-calendar.ts", () => {
  it("construye la URL de autorización real de Google con los parámetros correctos", () => {
    const url = buildGoogleAuthUrl(
      "test-client-id.apps.googleusercontent.com",
      "https://example.com/callback",
      "state-123"
    );
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(parsed.searchParams.get("client_id")).toBe("test-client-id.apps.googleusercontent.com");
    expect(parsed.searchParams.get("redirect_uri")).toBe("https://example.com/callback");
    expect(parsed.searchParams.get("state")).toBe("state-123");
    expect(parsed.searchParams.get("access_type")).toBe("offline");
    expect(parsed.searchParams.get("scope")).toContain("calendar.events");
  });
});

describe("lib/db/tenant-scope.ts — conexión de Google Calendar (Fase 10)", () => {
  let db: Db;
  let tenantAId: string;
  let tenantBId: string;
  let userAId: string;

  beforeEach(() => {
    const sqlite = new Database(":memory:");
    sqlite.pragma("foreign_keys = ON");
    applyMigrations(sqlite);
    db = drizzle(sqlite, { schema }) as unknown as Db;

    tenantAId = crypto.randomUUID();
    tenantBId = crypto.randomUUID();
    userAId = crypto.randomUUID();

    db.insert(schema.tenants)
      .values([
        { id: tenantAId, slug: "inmobiliaria-a", name: "Inmobiliaria A" },
        { id: tenantBId, slug: "inmobiliaria-b", name: "Inmobiliaria B" },
      ])
      .run();

    db.insert(schema.user)
      .values({
        id: userAId,
        name: "Asesor A",
        email: "a@test.com",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tenantId: tenantAId,
      })
      .run();
  });

  it("guarda una conexión nueva y la recupera", async () => {
    await saveGoogleCalendarConnectionForUser(db, tenantAId, userAId, {
      accessTokenEnc: "enc-access",
      refreshTokenEnc: "enc-refresh",
      expiresAt: new Date().toISOString(),
    });

    const connection = await getGoogleCalendarConnectionForUser(db, tenantAId, userAId);
    expect(connection?.calendarId).toBe("primary");
  });

  it("actualiza la conexión existente en vez de duplicarla", async () => {
    await saveGoogleCalendarConnectionForUser(db, tenantAId, userAId, {
      accessTokenEnc: "enc-access-1",
      refreshTokenEnc: "enc-refresh-1",
      expiresAt: new Date().toISOString(),
    });
    await saveGoogleCalendarConnectionForUser(db, tenantAId, userAId, {
      accessTokenEnc: "enc-access-2",
      refreshTokenEnc: "enc-refresh-2",
      expiresAt: new Date().toISOString(),
    });

    const connection = await getGoogleCalendarConnectionForUser(db, tenantAId, userAId);
    expect(connection?.accessTokenEnc).toBe("enc-access-2");
  });

  it("no expone la conexión de un usuario a otro tenant", async () => {
    await saveGoogleCalendarConnectionForUser(db, tenantAId, userAId, {
      accessTokenEnc: "enc-access",
      refreshTokenEnc: "enc-refresh",
      expiresAt: new Date().toISOString(),
    });

    const crossTenant = await getGoogleCalendarConnectionForUser(db, tenantBId, userAId);
    expect(crossTenant).toBeNull();
  });

  it("desconectar elimina la conexión", async () => {
    await saveGoogleCalendarConnectionForUser(db, tenantAId, userAId, {
      accessTokenEnc: "enc-access",
      refreshTokenEnc: "enc-refresh",
      expiresAt: new Date().toISOString(),
    });
    await deleteGoogleCalendarConnectionForUser(db, tenantAId, userAId);

    const connection = await getGoogleCalendarConnectionForUser(db, tenantAId, userAId);
    expect(connection).toBeNull();
  });
});
