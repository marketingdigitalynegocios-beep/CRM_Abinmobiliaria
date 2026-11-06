import { z } from "zod";

/**
 * Columnas esperadas del CSV de importación masiva (ver blueprint §7,
 * `POST /api/properties/bulk-import`). Los nombres de columna son los mismos
 * campos camelCase que usa `POST /api/properties` — no hay un mapeador de
 * columnas configurable en el MVP (eso sería scope de v2); el admin exporta
 * su portafolio existente a este formato antes de importar.
 *
 * Esta validación solo se encarga de convertir texto plano de CSV a tipos
 * primitivos (`z.coerce`); las reglas de negocio reales (requeridos,
 * defaults) las aplica `createPropertySchema` después — ver
 * app/api/properties/bulk-import/route.ts.
 */
export const csvPropertyRowSchema = z.object({
  title: z.string().min(1),
  type: z.enum(["apartment", "house", "commercial", "land"]),
  operation: z.enum(["sale", "rent", "sale_rent"]),
  priceCents: z.coerce.number().int().nonnegative(),
  currency: z.string().length(3).optional(),
  areaM2: z.coerce.number().positive().optional(),
  bedrooms: z.coerce.number().int().nonnegative().optional(),
  bathrooms: z.coerce.number().int().nonnegative().optional(),
  parkingSpots: z.coerce.number().int().nonnegative().optional(),
  stratum: z.coerce.number().int().min(1).max(6).optional(),
  city: z.string().optional(),
  neighborhood: z.string().optional(),
  address: z.string().optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  description: z.string().optional(),
  internalCode: z.string().optional(),
  listingType: z.enum(["exclusive", "shared", "open"]).optional(),
  visibility: z.enum(["draft", "published", "archived"]).optional(),
  commissionPercentage: z.coerce.number().min(0).max(100).optional(),
  amenities: z
    .string()
    .optional()
    .transform((value) =>
      value
        ? value
            .split(";")
            .map((item) => item.trim())
            .filter(Boolean)
        : []
    ),
});

/** Convierte celdas vacías de CSV ("") a `undefined` antes de validar. */
export function cleanCsvRow(row: Record<string, string>): Record<string, string | undefined> {
  const cleaned: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(row)) {
    cleaned[key] = value === "" ? undefined : value;
  }
  return cleaned;
}
