import { env } from "cloudflare:workers";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { getTenantBySlug, listPublishedPropertiesForTenant } from "@/lib/db/tenant-scope";
import { AgencyHeader } from "@/components/public/AgencyHeader";
import { PropertyFilters } from "@/components/public/PropertyFilters";
import { PropertyGrid } from "@/components/public/PropertyGrid";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ type?: string; operation?: string; page?: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const db = getDb(env.DB);
  const tenant = await getTenantBySlug(db, slug);
  if (!tenant) return {};

  return {
    title: tenant.name,
    description: tenant.description ?? `Propiedades en ${tenant.city ?? "Colombia"} — ${tenant.name}`,
  };
}

export default async function AgencyPublicPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { type, operation, page } = await searchParams;

  const db = getDb(env.DB);
  const tenant = await getTenantBySlug(db, slug);
  if (!tenant) notFound();

  const { properties, total } = await listPublishedPropertiesForTenant(db, tenant.id, {
    type,
    operation,
    page: page ? Number(page) : 1,
  });

  return (
    <div className="min-h-screen bg-light-gray">
      <AgencyHeader tenant={tenant} />

      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6">
          <PropertyFilters defaultOperation={operation} defaultType={type} tenantSlug={slug} />
        </div>

        <p className="mb-4 text-sm text-gray">{total} propiedades</p>

        <PropertyGrid properties={properties} tenantSlug={slug} />
      </main>
    </div>
  );
}
