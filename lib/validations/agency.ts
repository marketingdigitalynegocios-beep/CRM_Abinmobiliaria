import { z } from "zod";

/**
 * Registro combinado: cuenta de usuario (Better Auth) + tenant, en un solo
 * paso — ver blueprint-saas-inmobiliario.md §2, flujo del admin de inmobiliaria.
 */
export const registerSchema = z.object({
  fullName: z.string().min(1).max(200),
  email: z.string().email(),
  password: z.string().min(8).max(100),
  agencyName: z.string().min(1).max(200),
  slug: z
    .string()
    .min(3)
    .max(60)
    .regex(/^[a-z0-9-]+$/, "Solo minúsculas, números y guiones"),
});

export const updateAgencySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  logoImageId: z.string().optional(),
  phone: z.string().max(30).optional(),
  email: z.string().email().optional(),
  city: z.string().max(100).optional(),
  address: z.string().max(300).optional(),
  website: z.string().url().optional(),
  primaryColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  template: z.enum(["modern", "classic", "minimal"]).optional(),
  whatsappNumber: z.string().max(30).optional(),
  description: z.string().max(2000).optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type UpdateAgencyInput = z.infer<typeof updateAgencySchema>;
