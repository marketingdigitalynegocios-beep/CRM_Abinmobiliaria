import type { ZodError } from "zod";

export function jsonError(message: string, status: number, details?: unknown) {
  return Response.json({ error: message, details }, { status });
}

export function validationError(error: ZodError) {
  return jsonError("Datos inválidos", 400, error.flatten());
}
