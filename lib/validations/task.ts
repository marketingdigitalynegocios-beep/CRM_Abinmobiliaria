import { z } from "zod";

export const createTaskSchema = z.object({
  title: z.string().min(1).max(300),
  leadId: z.string().optional(),
  dealId: z.string().optional(),
  dueAt: z.string().datetime().optional(),
  assigneeId: z.string().optional(),
});

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  dueAt: z.string().datetime().nullable().optional(),
  status: z.enum(["pending", "done"]).optional(),
  assigneeId: z.string().nullable().optional(),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
