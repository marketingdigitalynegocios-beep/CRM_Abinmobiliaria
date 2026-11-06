import { z } from "zod";

export const propertyTypeSchema = z.enum(["apartment", "house", "commercial", "land"]);
export const propertyOperationSchema = z.enum(["sale", "rent", "sale_rent"]);
export const propertyStatusSchema = z.enum(["active", "inactive", "sold", "rented"]);
export const propertyVisibilitySchema = z.enum(["draft", "published", "archived"]);
export const propertyListingTypeSchema = z.enum(["exclusive", "shared", "open"]);

/**
 * Body de POST /api/properties — ver blueprint-saas-inmobiliario.md §7.
 * `tenant_id` nunca forma parte de este schema: se resuelve server-side desde
 * la sesión, nunca se acepta del cliente (ver §6, aislamiento multitenant).
 */
export const createPropertySchema = z.object({
  title: z.string().min(1).max(200),
  type: propertyTypeSchema,
  operation: propertyOperationSchema,
  priceCents: z.number().int().nonnegative(),
  currency: z.string().length(3).default("COP"),
  areaM2: z.number().positive().optional(),
  bedrooms: z.number().int().nonnegative().optional(),
  bathrooms: z.number().int().nonnegative().optional(),
  parkingSpots: z.number().int().nonnegative().default(0),
  stratum: z.number().int().min(1).max(6).optional(),
  city: z.string().max(100).optional(),
  neighborhood: z.string().max(100).optional(),
  address: z.string().max(300).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  description: z.string().max(5000).optional(),
  amenities: z.array(z.string()).default([]),
  coverImageId: z.string().optional(),
  isFeatured: z.boolean().default(false),
  advisorId: z.string().optional(),

  // Módulo de Inventario (ver blueprint §6/§7)
  ownerId: z.string().optional(),
  internalCode: z.string().max(50).optional(),
  visibility: propertyVisibilitySchema.default("published"),
  listingType: propertyListingTypeSchema.default("exclusive"),
  mandateStartDate: z.string().datetime().optional(),
  mandateEndDate: z.string().datetime().optional(),
  commissionPercentage: z.number().min(0).max(100).optional(),
});

export const updatePropertySchema = createPropertySchema.partial().extend({
  status: propertyStatusSchema.optional(),
});

export const bulkStatusSchema = z.object({
  propertyIds: z.array(z.string()).min(1).max(200),
  status: propertyStatusSchema.optional(),
  visibility: propertyVisibilitySchema.optional(),
});

export type CreatePropertyInput = z.infer<typeof createPropertySchema>;
export type UpdatePropertyInput = z.infer<typeof updatePropertySchema>;
export type BulkStatusInput = z.infer<typeof bulkStatusSchema>;
