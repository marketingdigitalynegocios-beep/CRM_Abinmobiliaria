import type { Metadata } from "next";
import { env } from "cloudflare:workers";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { listPropertiesForTenant } from "@/lib/db/tenant-scope";
import { ReviewsManager } from "@/components/dashboard/ReviewsManager";

export const metadata: Metadata = { title: "Reseñas y Testimonios" };

export default async function ReviewsPage() {
  const session = await requireSession(await headers());
  if (!session) redirect("/login");

  const db = getDb(env.DB);
  const { properties } = await listPropertiesForTenant(db, session.tenantId, { limit: 500 });

  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-4">
        <h1 className="text-2xl font-bold tracking-tight text-dark">Reseñas y Testimonios</h1>
        <p className="mt-1 text-sm text-gray">
          Registra lo que tus clientes te compartieron y decide cuáles mostrar en tu página pública.
        </p>
      </div>

      <ReviewsManager properties={properties.map((p) => ({ id: p.id, title: p.title }))} />
    </div>
  );
}
