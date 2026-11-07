import { beforeEach, describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "../lib/db/schema";
import type { Db } from "../lib/db/client";
import {
  createPropertyForTenant,
  createReviewForTenant,
  deleteReviewForTenant,
  listPublishedReviewsForTenant,
  listReviewsForTenant,
  updateReviewForTenant,
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

describe("lib/db/tenant-scope.ts — reseñas y testimonios (Fase 13)", () => {
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

  it("crea una reseña sin publicar por defecto", async () => {
    const review = await createReviewForTenant(db, tenantAId, {
      authorName: "Cliente Feliz",
      rating: 5,
      comment: "Excelente servicio",
    });
    expect(review?.isPublished).toBe(false);
  });

  it("no crea la reseña si la propiedad referenciada es de otro tenant", async () => {
    const propertyB = await createPropertyForTenant(db, tenantBId, baseProperty());
    const review = await createReviewForTenant(db, tenantAId, {
      propertyId: propertyB.id,
      authorName: "Cliente",
      rating: 5,
      comment: "Comentario",
    });
    expect(review).toBeNull();
  });

  it("una reseña sin publicar no aparece en el listado público", async () => {
    await createReviewForTenant(db, tenantAId, {
      authorName: "Cliente",
      rating: 4,
      comment: "Buena atención",
    });

    const published = await listPublishedReviewsForTenant(db, tenantAId);
    expect(published).toHaveLength(0);

    const all = await listReviewsForTenant(db, tenantAId);
    expect(all).toHaveLength(1);
  });

  it("publicar una reseña la hace aparecer en el listado público", async () => {
    const review = await createReviewForTenant(db, tenantAId, {
      authorName: "Cliente",
      rating: 5,
      comment: "Muy buena",
    });
    await updateReviewForTenant(db, tenantAId, review!.id, { isPublished: true });

    const published = await listPublishedReviewsForTenant(db, tenantAId);
    expect(published).toHaveLength(1);
  });

  it("no permite publicar una reseña de otro tenant", async () => {
    const review = await createReviewForTenant(db, tenantAId, {
      authorName: "Cliente",
      rating: 5,
      comment: "Muy buena",
    });
    const crossTenant = await updateReviewForTenant(db, tenantBId, review!.id, { isPublished: true });
    expect(crossTenant).toBeNull();

    const published = await listPublishedReviewsForTenant(db, tenantAId);
    expect(published).toHaveLength(0);
  });

  it("no permite borrar una reseña de otro tenant", async () => {
    const review = await createReviewForTenant(db, tenantAId, {
      authorName: "Cliente",
      rating: 5,
      comment: "Muy buena",
    });
    const deleted = await deleteReviewForTenant(db, tenantBId, review!.id);
    expect(deleted).toBe(false);

    const all = await listReviewsForTenant(db, tenantAId);
    expect(all).toHaveLength(1);
  });
});
