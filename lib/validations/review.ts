import { z } from "zod";

export const createReviewSchema = z.object({
  propertyId: z.string().optional(),
  authorName: z.string().min(1).max(200),
  rating: z.number().int().min(1).max(5),
  comment: z.string().min(1).max(1000),
});

export const updateReviewSchema = z.object({
  isPublished: z.boolean().optional(),
});

export type CreateReviewInput = z.infer<typeof createReviewSchema>;
export type UpdateReviewInput = z.infer<typeof updateReviewSchema>;
