import { z } from "zod";

export const visitStatusSchema = z.enum(["scheduled", "completed", "cancelled"]);

export const createVisitSchema = z.object({
  leadId: z.string().min(1),
  propertyId: z.string().min(1),
  dealId: z.string().optional(),
  scheduledAt: z.string().datetime(),
  advisorId: z.string().optional(),
  notes: z.string().max(2000).optional(),
});

export const updateVisitSchema = z.object({
  status: visitStatusSchema.optional(),
  scheduledAt: z.string().datetime().optional(),
  notes: z.string().max(2000).optional(),
});

export type CreateVisitInput = z.infer<typeof createVisitSchema>;
export type UpdateVisitInput = z.infer<typeof updateVisitSchema>;
