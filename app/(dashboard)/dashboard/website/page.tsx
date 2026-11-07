import type { Metadata } from "next";
import { env } from "cloudflare:workers";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { getTenantForTenant } from "@/lib/db/tenant-scope";
import { TemplatePicker } from "@/components/dashboard/TemplatePicker";

export const metadata: Metadata = { title: "Mi página pública" };

export default async function WebsitePage() {
  const session = await requireSession(await headers());
  if (!session) redirect("/login");

  const db = getDb(env.DB);
  const tenant = await getTenantForTenant(db, session.tenantId);
  if (!tenant) redirect("/login");

  return (
    <div>
      <h1 className="text-2xl font-semibold text-dark">Mi página pública</h1>
      <p className="mt-1 text-sm text-gray">
        Elige cómo se ve tu catálogo público. El cambio aplica de inmediato.
      </p>

      <div className="mt-6">
        <TemplatePicker currentTemplate={tenant.template} slug={tenant.slug} />
      </div>

      <div className="mt-8">
        <p className="mb-2 text-sm font-medium text-dark">Vista previa</p>
        <iframe
          className="h-[600px] w-full rounded-md border border-border"
          src={`/${tenant.slug}`}
          title="Vista previa de la página pública"
        />
      </div>
    </div>
  );
}
