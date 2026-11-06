export interface DealCardData {
  id: string;
  title: string | null;
  dealValueCents: number | null;
  nextAction: string | null;
  leadName: string;
  propertyTitle: string;
}

export function DealCard({ deal }: { deal: DealCardData }) {
  return (
    <div className="rounded-md border border-border bg-white p-3 shadow-sm">
      <p className="truncate text-sm font-semibold text-dark">
        {deal.title || `${deal.leadName} — ${deal.propertyTitle}`}
      </p>
      <p className="mt-1 truncate text-xs text-gray">{deal.propertyTitle}</p>
      {deal.dealValueCents != null && (
        <p className="mt-1 text-sm font-medium text-dark">
          ${(deal.dealValueCents / 100).toLocaleString("es-CO")}
        </p>
      )}
      {deal.nextAction && (
        <p className="mt-1 text-xs text-primary">Próximo: {deal.nextAction}</p>
      )}
    </div>
  );
}
