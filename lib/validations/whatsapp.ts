import { z } from "zod";

/**
 * Body de `POST /api/whatsapp/connect` (ver blueprint §7/§11). `wabaId` y
 * `phoneNumberId` vienen del evento `message` (postMessage) que el propio
 * SDK de Embedded Signup de Meta entrega en el cliente al terminar el flujo
 * — no se re-derivan con una llamada extra a la Graph API. `code` se usa
 * server-side solo para suscribir ese WABA a los webhooks de la app.
 */
export const connectWhatsappSchema = z.object({
  code: z.string().min(1),
  wabaId: z.string().min(1),
  phoneNumberId: z.string().min(1),
  displayPhoneNumber: z.string().optional(),
});

export const updateAiAgentConfigSchema = z.object({
  isActive: z.boolean().optional(),
  systemPrompt: z.string().max(4000).optional(),
  welcomeMessage: z.string().max(1000).optional(),
  /** Write-only: se cifra y se guarda; nunca se devuelve en las respuestas. */
  geminiKey: z.string().min(1).optional(),
});

export const testAiAgentSchema = z.object({
  message: z.string().min(1).max(2000),
});

export type ConnectWhatsappInput = z.infer<typeof connectWhatsappSchema>;
export type UpdateAiAgentConfigInput = z.infer<typeof updateAiAgentConfigSchema>;
export type TestAiAgentInput = z.infer<typeof testAiAgentSchema>;
