import { buildImageUrl } from "@/lib/images/delivery-url";

interface AgencyHeaderProps {
  tenant: {
    slug: string;
    name: string;
    logoImageId: string | null;
    primaryColor: string;
    city: string | null;
    description: string | null;
  };
}

/**
 * Header de la página pública. Aplica `primaryColor` del tenant como CSS
 * custom property `--color-primary-tenant` (ver blueprint §8) — no pisa el
 * token `--color-primary` del dashboard, que es de la marca del SaaS, no de
 * cada inmobiliaria.
 */
export function AgencyHeader({ tenant }: AgencyHeaderProps) {
  const logoUrl = buildImageUrl(tenant.logoImageId, "thumbnail");

  return (
    <header
      className="border-b border-border bg-white"
      style={{ "--color-primary-tenant": tenant.primaryColor } as React.CSSProperties}
    >
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-6 py-5">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt={tenant.name} className="h-12 w-12 rounded-full object-cover" src={logoUrl} />
        ) : (
          <div
            className="flex h-12 w-12 items-center justify-center rounded-full text-lg font-semibold text-white"
            style={{ backgroundColor: tenant.primaryColor }}
          >
            {tenant.name.charAt(0).toUpperCase()}
          </div>
        )}
        <div>
          <h1 className="font-display text-xl font-semibold text-dark">{tenant.name}</h1>
          {tenant.city && <p className="text-sm text-gray">{tenant.city}</p>}
        </div>
      </div>
    </header>
  );
}
