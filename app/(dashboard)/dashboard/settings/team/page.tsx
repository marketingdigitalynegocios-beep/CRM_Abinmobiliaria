import type { Metadata } from "next";
import { env } from "cloudflare:workers";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { listTeamMembersForTenant } from "@/lib/db/tenant-scope";
import { InviteTeamMemberForm } from "@/components/dashboard/InviteTeamMemberForm";

export const metadata: Metadata = {
  title: "Equipo & Asesores | InmoElite",
};

const roleLabels: Record<string, { label: string; color: string }> = {
  admin: { label: "Super Admin / Broker", color: "bg-primary/10 text-primary" },
  advisor: { label: "Asesor Comercial", color: "bg-slate-100 text-slate-700" },
};

export default async function TeamSettingsPage() {
  const session = await requireSession(await headers());
  if (!session) redirect("/login");

  const db = getDb(env.DB);
  const members = await listTeamMembersForTenant(db, session.tenantId);

  return (
    <div className="space-y-6">
      {/* Executive Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-gray mb-1">
            <span>Configuración</span>
            <span className="material-symbols-outlined text-[14px]">
              chevron_right
            </span>
            <span className="text-primary font-medium">Equipo Comercial</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-dark">
            Equipo Comercial &amp; Permisos
          </h1>
          <p className="mt-1 text-sm text-gray">
            Control granular de agentes, asignación de inventario y accesos al CRM.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 border border-emerald-200">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            {members.length} / 10 Asesores en Plan
          </span>
        </div>
      </div>

      {/* Settings Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-border text-xs font-semibold">
        <Link
          href="/dashboard/settings/agency"
          className="flex items-center gap-2 border-b-2 border-transparent px-4 py-3 text-gray hover:text-dark transition-colors -mb-px"
        >
          <span className="material-symbols-outlined text-[18px]">
            apartment
          </span>
          <span>Mi Inmobiliaria</span>
        </Link>
        <Link
          href="/dashboard/settings/team"
          className="flex items-center gap-2 border-b-2 border-primary px-4 py-3 text-primary -mb-px"
        >
          <span className="material-symbols-outlined text-[18px]">
            group
          </span>
          <span>Equipo &amp; Asesores</span>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
            {members.length} activos
          </span>
        </Link>
      </div>

      {/* Invite Form Accordion / Button */}
      <div>
        <InviteTeamMemberForm />
      </div>

      {/* Team Members Precision Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-gray">
              <tr>
                <th className="py-3 px-4">Asesor / Contacto</th>
                <th className="py-3 px-4">Rol Asignado</th>
                <th className="py-3 px-4">Estado</th>
                <th className="py-3 px-4 text-center">Inmuebles Asignados</th>
                <th className="py-3 px-4 text-right">Canal WhatsApp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {members.map((member) => {
                const initials = member.name
                  ? member.name
                      .split(" ")
                      .map((p) => p[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase()
                  : "AS";
                const roleConfig = roleLabels[member.role] ?? {
                  label: member.role,
                  color: "bg-slate-100 text-slate-700",
                };

                return (
                  <tr key={member.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 font-bold text-xs text-primary font-mono">
                          {initials}
                        </div>
                        <div>
                          <p className="font-semibold text-dark text-xs">
                            {member.name}{" "}
                            {member.id === session.user.id && (
                              <span className="text-[10px] font-normal text-gray">
                                (Tú)
                              </span>
                            )}
                          </p>
                          <p className="text-[11px] text-gray">{member.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${roleConfig.color}`}
                      >
                        {roleConfig.label}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        <span>{member.isActive ? "Activo" : "Inactivo"}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-medium text-dark">
                      {member.role === "admin" ? "Todos (148)" : "42"}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        <span className="material-symbols-outlined text-[13px]">
                          chat
                        </span>
                        Conectado
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
