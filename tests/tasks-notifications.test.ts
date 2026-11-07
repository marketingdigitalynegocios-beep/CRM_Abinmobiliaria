import { beforeEach, describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "../lib/db/schema";
import type { Db } from "../lib/db/client";
import {
  countUnreadNotificationsForUser,
  createLeadForTenant,
  createNotificationForTenant,
  createTaskForTenant,
  createVisitForTenant,
  createPropertyForTenant,
  deleteTaskForTenant,
  hasNotificationForLink,
  listNotificationsForUser,
  listOverdueTasksForTenant,
  listTasksForTenant,
  markAllNotificationsReadForUser,
  markNotificationReadForUser,
  notifyTenantTeam,
  updateTaskForTenant,
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

describe("lib/db/tenant-scope.ts — tareas y notificaciones (Fase 7)", () => {
  let db: Db;
  let tenantAId: string;
  let tenantBId: string;
  let userAId: string;
  let userBId: string;

  beforeEach(() => {
    const sqlite = new Database(":memory:");
    sqlite.pragma("foreign_keys = ON");
    applyMigrations(sqlite);
    db = drizzle(sqlite, { schema }) as unknown as Db;

    tenantAId = crypto.randomUUID();
    tenantBId = crypto.randomUUID();
    userAId = crypto.randomUUID();
    userBId = crypto.randomUUID();

    db.insert(schema.tenants)
      .values([
        { id: tenantAId, slug: "inmobiliaria-a", name: "Inmobiliaria A" },
        { id: tenantBId, slug: "inmobiliaria-b", name: "Inmobiliaria B" },
      ])
      .run();

    db.insert(schema.user)
      .values([
        {
          id: userAId,
          name: "Asesor A",
          email: "a@test.com",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          tenantId: tenantAId,
        },
        {
          id: userBId,
          name: "Asesor B",
          email: "b@test.com",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          tenantId: tenantBId,
        },
      ])
      .run();
  });

  it("crea y lista tareas pendientes del tenant", async () => {
    await createTaskForTenant(db, tenantAId, { title: "Llamar a cliente" });
    const pending = await listTasksForTenant(db, tenantAId, { status: "pending" });
    expect(pending).toHaveLength(1);
  });

  it("no permite actualizar una tarea de otro tenant", async () => {
    const task = await createTaskForTenant(db, tenantAId, { title: "Tarea A" });
    const crossUpdate = await updateTaskForTenant(db, tenantBId, task.id, { status: "done" });
    expect(crossUpdate).toBeNull();
  });

  it("no permite borrar una tarea de otro tenant", async () => {
    const task = await createTaskForTenant(db, tenantAId, { title: "Tarea A" });
    const deleted = await deleteTaskForTenant(db, tenantBId, task.id);
    expect(deleted).toBe(false);

    const stillThere = await listTasksForTenant(db, tenantAId);
    expect(stillThere).toHaveLength(1);
  });

  it("listOverdueTasksForTenant solo devuelve tareas pendientes con dueAt en el pasado", async () => {
    await createTaskForTenant(db, tenantAId, {
      title: "Vencida",
      dueAt: "2020-01-01T00:00:00.000Z",
    });
    await createTaskForTenant(db, tenantAId, {
      title: "Futura",
      dueAt: "2099-01-01T00:00:00.000Z",
    });
    await createTaskForTenant(db, tenantAId, { title: "Sin fecha" });

    const overdue = await listOverdueTasksForTenant(db, tenantAId);
    expect(overdue).toHaveLength(1);
    expect(overdue[0].title).toBe("Vencida");
  });

  it("crear un lead por un canal público notifica a todo el equipo del tenant", async () => {
    await createLeadForTenant(db, tenantAId, { fullName: "Lead Público", source: "website" });

    const unread = await countUnreadNotificationsForUser(db, tenantAId, userAId);
    expect(unread).toBe(1);
  });

  it("un alta manual de lead no genera notificación", async () => {
    await createLeadForTenant(db, tenantAId, { fullName: "Lead Manual", source: "manual" });
    const unread = await countUnreadNotificationsForUser(db, tenantAId, userAId);
    expect(unread).toBe(0);
  });

  it("agendar una visita sin asesor notifica a todo el equipo", async () => {
    const property = await createPropertyForTenant(db, tenantAId, baseProperty());
    const lead = await createLeadForTenant(db, tenantAId, { fullName: "Lead A", source: "manual" });

    await createVisitForTenant(db, tenantAId, {
      leadId: lead.id,
      propertyId: property.id,
      scheduledAt: "2026-12-01T15:00:00.000Z",
    });

    const unread = await countUnreadNotificationsForUser(db, tenantAId, userAId);
    expect(unread).toBe(1);
  });

  it("no expone las notificaciones de un usuario a otro tenant", async () => {
    await notifyTenantTeam(db, tenantAId, "new_lead", "Lead nuevo", "detalle", "/dashboard/crm");
    const crossTenant = await listNotificationsForUser(db, tenantBId, userAId);
    expect(crossTenant).toHaveLength(0);
  });

  it("marcar una notificación como leída no afecta las de otro usuario", async () => {
    const n1 = await createNotificationForTenant(db, tenantAId, userAId, "new_lead", "Para A");
    await createNotificationForTenant(db, tenantAId, userAId, "new_lead", "Otra para A");

    await markNotificationReadForUser(db, tenantAId, userAId, n1!.id);

    const unread = await countUnreadNotificationsForUser(db, tenantAId, userAId);
    expect(unread).toBe(1);
  });

  it("marcar todas como leídas deja el conteo en cero", async () => {
    await createNotificationForTenant(db, tenantAId, userAId, "new_lead", "1");
    await createNotificationForTenant(db, tenantAId, userAId, "new_lead", "2");

    await markAllNotificationsReadForUser(db, tenantAId, userAId);

    const unread = await countUnreadNotificationsForUser(db, tenantAId, userAId);
    expect(unread).toBe(0);
  });

  it("hasNotificationForLink detecta una notificación ya creada para ese link", async () => {
    await createNotificationForTenant(
      db,
      tenantAId,
      userAId,
      "task_due",
      "Tarea vencida",
      undefined,
      "/dashboard/crm/lead-1"
    );
    const exists = await hasNotificationForLink(db, tenantAId, userAId, "/dashboard/crm/lead-1");
    const notExists = await hasNotificationForLink(db, tenantAId, userAId, "/dashboard/crm/lead-2");
    expect(exists).toBe(true);
    expect(notExists).toBe(false);
  });
});
