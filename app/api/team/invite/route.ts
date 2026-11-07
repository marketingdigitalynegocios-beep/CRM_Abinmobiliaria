import { env } from "cloudflare:workers";
import { forbidden, requireSession, unauthorized } from "@/lib/auth/session";
import { getAuth } from "@/lib/auth/auth";
import { getDb } from "@/lib/db/client";
import { isEmailAlreadyRegistered } from "@/lib/db/tenant-scope";
import { jsonError, validationError } from "@/lib/http";
import { inviteTeamMemberSchema } from "@/lib/validations/team";

/**
 * Invitación de asesores (ver blueprint §9, `/dashboard/settings/team`, solo
 * admin). No usamos un plugin de "organización" de Better Auth — el modelo de
 * este proyecto es `tenantId` como additionalField de `user` (ver blueprint
 * §6), así que la invitación es: crear la cuenta directo dentro del tenant
 * con una contraseña aleatoria que el invitado nunca usa, y mandarle un
 * magic link (mismo mecanismo de `lib/auth/auth.ts`) para que entre sin
 * necesitar esa contraseña.
 */
export async function POST(request: Request) {
  const session = await requireSession(request.headers);
  if (!session) return unauthorized();
  if (session.role !== "admin") return forbidden();

  const body = await request.json();
  const parsed = inviteTeamMemberSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const db = getDb(env.DB);
  const { fullName, email, role } = parsed.data;

  if (await isEmailAlreadyRegistered(db, email)) {
    return jsonError("Ese email ya tiene una cuenta", 409);
  }

  const auth = getAuth();
  try {
    await auth.api.signUpEmail({
      body: {
        email,
        password: crypto.randomUUID(), // el invitado nunca la ve ni la usa; entra por magic link
        name: fullName,
        tenantId: session.tenantId,
        role,
      },
    });
  } catch (error) {
    return jsonError("No se pudo crear la cuenta del asesor", 400, String(error));
  }

  try {
    await auth.api.signInMagicLink({
      body: { email, callbackURL: "/dashboard" },
      headers: request.headers,
    });
  } catch (error) {
    // La cuenta ya quedó creada; que falle el envío del email no debería
    // reportarse como si la invitación completa hubiera fallado.
    return Response.json({
      success: true,
      warning: "La cuenta se creó pero no se pudo enviar el email de invitación: " + String(error),
    });
  }

  return Response.json({ success: true });
}
