import type { Metadata } from "next";
import { env } from "cloudflare:workers";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { listTeamMembersForTenant } from "@/lib/db/tenant-scope";
import { InviteTeamMemberForm } from "@/components/dashboard/InviteTeamMemberForm";

export const metadata: Metadata = { title: "Equipo" };

const roleLabels: Record<string, string> = { admin: "Admin", advisor: "Asesor" };

export default async function TeamSettingsPage() {
  const session = await requireSession(await headers());
  if (!session) redirect("/login");

  const db = getDb(env.DB);
  const members = await listTeamMembersForTenant(db, session.tenantId);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-dark">Equipo</h1>
      <p className="mt-1 text-sm text-gray">
        Invita asesores a tu inmobiliaria. Entran con un enlace por email, sin necesitar contraseña.
      </p>

      <div className="mt-4">
        <InviteTeamMemberForm />
      </div>

      <div className="mt-6 overflow-x-auto rounded-md border border-border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-light-gray text-xs uppercase text-gray">
            <tr>
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Rol</th>
              <th className="px-4 py-3">Estado</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr className="border-b border-border last:border-0" key={member.id}>
                <td className="px-4 py-3 font-medium text-dark">{member.name}</td>
                <td className="px-4 py-3 text-gray">{member.email}</td>
                <td className="px-4 py-3 text-gray">{roleLabels[member.role] ?? member.role}</td>
                <td className="px-4 py-3 text-gray">{member.isActive ? "Activo" : "Inactivo"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
