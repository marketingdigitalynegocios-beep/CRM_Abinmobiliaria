import { z } from "zod";

export const leadStageSchema = z.enum(["new", "contacted", "disqualified"]);
export const leadSourceSchema = z.enum(["website", "whatsapp", "referral", "manual"]);
export const leadPreferredTypeSchema = z.enum(["apartment", "house", "commercial", "land"]);
export const leadPreferredOperationSchema = z.enum(["sale", "rent", "sale_rent"]);

/**
 * Body de `POST /api/leads` (ver blueprint §7) — pública, protegida con
 * Turnstile. `tenantSlug` se usa SOLO para resolver el `tenant_id` server-side
 * (nunca se acepta un `tenant_id` directo del cliente, ver §6).
 */
export const createLeadSchema = z.object({
  tenantSlug: z.string().min(1),
  fullName: z.string().min(1).max(200),
  email: z.string().email().optional(),
  phone: z.string().max(30).optional(),
  whatsapp: z.string().max(30).optional(),
  source: leadSourceSchema.default("website"),
  propertyId: z.string().optional(),
  turnstileToken: z.string().min(1),
});

/** Alta manual desde el dashboard (ver blueprint §7, `source: 'manual'`) — autenticada, sin Turnstile. */
export const createManualLeadSchema = z.object({
  fullName: z.string().min(1).max(200),
  email: z.string().email().optional(),
  phone: z.string().max(30).optional(),
  whatsapp: z.string().max(30).optional(),
  notes: z.string().max(2000).optional(),
  budgetMinCents: z.number().int().nonnegative().optional(),
  budgetMaxCents: z.number().int().nonnegative().optional(),
  preferredCity: z.string().max(120).optional(),
  preferredType: leadPreferredTypeSchema.optional(),
  preferredOperation: leadPreferredOperationSchema.optional(),
});

export const updateLeadSchema = z.object({
  stage: leadStageSchema.optional(),
  advisorId: z.string().optional(),
  notes: z.string().max(2000).optional(),
  budgetMinCents: z.number().int().nonnegative().optional(),
  budgetMaxCents: z.number().int().nonnegative().optional(),
  preferredCity: z.string().max(120).optional(),
  preferredType: leadPreferredTypeSchema.optional(),
  preferredOperation: leadPreferredOperationSchema.optional(),
});

export type CreateLeadInput = z.infer<typeof createLeadSchema>;
export type CreateManualLeadInput = z.infer<typeof createManualLeadSchema>;
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>;
