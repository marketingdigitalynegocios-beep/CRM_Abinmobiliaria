import { env } from "cloudflare:workers";
import { forbidden, requireSession, unauthorized } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import {
  createNotificationForTenant,
  hasNotificationForLink,
  listOverdueTasksForTenant,
  listTeamMembersForTenant,
} from "@/lib/db/tenant-scope";

/**
 * Genera notificaciones de "tarea vencida" para el tenant de la sesión (ver
 * plan-implementacion.md Fase 7). Pensado para invocarse manualmente mientras
 * no hay un Cloudflare Cron Trigger real conectado — `vinext` controla el
 * entrypoint del Worker (`cloudflare.config.ts`), así que agregar un handler
 * `scheduled()` de verdad requiere un entrypoint propio; queda documentado
 * como pendiente en vez de improvisarlo acá (ver bitacora-desarrollo.md).
 * Admin-only, igual que el resto de endpoints de configuración.
 */
export async function POST(request: Request) {
  const session = await requireSession(request.headers);
  if (!session) return unauthorized();
  if (session.role !== "admin") return forbidden();

  const db = getDb(env.DB);
  const [overdueTasks, team] = await Promise.all([
    listOverdueTasksForTenant(db, session.tenantId),
    listTeamMembersForTenant(db, session.tenantId),
  ]);

  let notified = 0;
  for (const task of overdueTasks) {
    const link = `/dashboard/crm${task.leadId ? `/${task.leadId}` : ""}`;
    const title = `Tarea vencida: ${task.title}`;
    const body = `Vencía el ${new Date(task.dueAt!).toLocaleString("es-CO")}`;
    const recipients = task.assigneeId ? [task.assigneeId] : team.map((m) => m.id);

    for (const userId of recipients) {
      const alreadyNotified = await hasNotificationForLink(db, session.tenantId, userId, link);
      if (alreadyNotified) continue;
      await createNotificationForTenant(db, session.tenantId, userId, "task_due", title, body, link);
      notified += 1;
    }
  }

  return Response.json({ overdueTasks: overdueTasks.length, notified });
}
