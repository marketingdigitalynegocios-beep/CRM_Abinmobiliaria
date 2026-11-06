import { env } from "cloudflare:workers";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { getPropertyOwnerForTenant } from "@/lib/db/tenant-scope";
import { PropertyOwnerForm } from "@/components/properties/PropertyOwnerForm";

export default async function EditPropertyOwnerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession(await headers());
  if (!session) redirect("/login");

  const { id } = await params;
  const db = getDb(env.DB);
  const owner = await getPropertyOwnerForTenant(db, session.tenantId, id);
  if (!owner) notFound();

  return (
    <div>
      <h1 className="text-2xl font-semibold text-dark">Editar propietario</h1>
      <div className="mt-6">
        <PropertyOwnerForm
          initialValues={{
            fullName: owner.fullName,
            documentId: owner.documentId ?? undefined,
            phone: owner.phone ?? undefined,
            email: owner.email ?? undefined,
            notes: owner.notes ?? undefined,
          }}
          ownerId={owner.id}
        />
      </div>
    </div>
  );
}
