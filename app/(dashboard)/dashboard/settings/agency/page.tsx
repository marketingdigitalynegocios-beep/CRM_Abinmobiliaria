import type { Metadata } from "next";
import { env } from "cloudflare:workers";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { getTenantForTenant } from "@/lib/db/tenant-scope";
import { AgencySettingsForm } from "@/components/dashboard/AgencySettingsForm";

export const metadata: Metadata = { title: "Mi inmobiliaria" };

export default async function AgencySettingsPage() {
  const session = await requireSession(await headers());
  if (!session) redirect("/login");

  const db = getDb(env.DB);
  const tenant = await getTenantForTenant(db, session.tenantId);
  if (!tenant) redirect("/login");

  return (
    <div>
      <h1 className="text-2xl font-semibold text-dark">Mi inmobiliaria</h1>
      <p className="mt-1 text-sm text-gray">
        Tu página pública: <a className="text-primary" href={`/${tenant.slug}`} target="_blank" rel="noreferrer">tuapp.com/{tenant.slug}</a>
      </p>

      <div className="mt-6">
        <AgencySettingsForm
          initialValues={{
            name: tenant.name,
            phone: tenant.phone ?? undefined,
            whatsappNumber: tenant.whatsappNumber ?? undefined,
            email: tenant.email ?? undefined,
            website: tenant.website ?? undefined,
            city: tenant.city ?? undefined,
            address: tenant.address ?? undefined,
            primaryColor: tenant.primaryColor,
            description: tenant.description ?? undefined,
          }}
          logoImageId={tenant.logoImageId}
        />
      </div>
    </div>
  );
}
