import { z } from "zod";

export const createPropertyOwnerSchema = z.object({
  fullName: z.string().min(1).max(200),
  documentId: z.string().max(30).optional(),
  phone: z.string().max(30).optional(),
  email: z.string().email().optional(),
  notes: z.string().max(2000).optional(),
});

export const updatePropertyOwnerSchema = createPropertyOwnerSchema.partial();

export type CreatePropertyOwnerInput = z.infer<typeof createPropertyOwnerSchema>;
export type UpdatePropertyOwnerInput = z.infer<typeof updatePropertyOwnerSchema>;
