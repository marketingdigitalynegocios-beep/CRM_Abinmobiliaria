import { z } from "zod";

export const dealStageSchema = z.enum([
  "new",
  "meeting_scheduled",
  "qualified",
  "proposal_sent",
  "negotiation",
  "closed_won",
  "closed_lost",
]);

/** Ver blueprint §7, `POST /api/deals` — abre una oportunidad lead+propiedad concreta. */
export const createDealSchema = z.object({
  leadId: z.string().min(1),
  propertyId: z.string().min(1),
  title: z.string().max(200).optional(),
  dealValueCents: z.number().int().nonnegative().optional(),
  advisorId: z.string().optional(),
  nextAction: z.string().max(200).optional(),
  expectedCloseDate: z.string().datetime().optional(),
});

export const updateDealSchema = z.object({
  stage: dealStageSchema.optional(),
  dealValueCents: z.number().int().nonnegative().optional(),
  advisorId: z.string().optional(),
  nextAction: z.string().max(200).optional(),
  expectedCloseDate: z.string().datetime().optional(),
});

export type CreateDealInput = z.infer<typeof createDealSchema>;
export type UpdateDealInput = z.infer<typeof updateDealSchema>;
