"use client";

import React from "react";
import { useRouter } from "next/navigation";

export interface DealCardData {
  id: string;
  title: string | null;
  dealValueCents: number | null;
  nextAction: string | null;
  leadName: string;
  propertyTitle: string;
  leadId?: string;
  propertyId?: string;
}

export function DealCard({ deal }: { deal: DealCardData }) {
  const router = useRouter();

  function handleClick() {
    if (deal.leadId) {
      router.push(`/dashboard/crm/${deal.leadId}`);
    }
  }

  return (
    <div
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          handleClick();
        }
      }}
      title="Clic para ver y gestionar la ficha del lead"
      className="cursor-pointer group rounded-lg border border-border bg-white dark:bg-slate-900 p-3.5 shadow-xs hover:border-primary/80 hover:shadow-md transition-all space-y-2 select-none"
    >
      {/* Top Header: Tag & WhatsApp Action */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[11px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
            {deal.title ? deal.title.slice(0, 16) : "#OP"}
          </span>
          <span className="material-symbols-outlined text-[14px] text-gray opacity-0 group-hover:opacity-100 transition-opacity">
            arrow_forward
          </span>
        </div>
        <a
          href={`https://wa.me/?text=Hola%20${encodeURIComponent(deal.leadName)}`}
          target="_blank"
          rel="noreferrer"
          className="p-1 rounded text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors"
          title="Contactar por WhatsApp"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="material-symbols-outlined text-[16px]">chat</span>
        </a>
      </div>

      {/* Client Name & Inmueble */}
      <div>
        <h4 className="font-semibold text-xs text-dark dark:text-white group-hover:text-primary transition-colors truncate">
          {deal.leadName}
        </h4>
        <p className="text-[11px] text-gray truncate mt-0.5 flex items-center gap-1">
          <span className="material-symbols-outlined text-[13px] text-primary">apartment</span>
          <span className="truncate">{deal.propertyTitle}</span>
        </p>
      </div>

      {/* Deal Value in COP */}
      {deal.dealValueCents != null && (
        <div className="pt-1.5 border-t border-border/50 flex items-baseline justify-between">
          <span className="text-xs font-bold text-dark dark:text-slate-200 font-mono">
            ${(deal.dealValueCents / 100).toLocaleString("es-CO")}
          </span>
          <span className="text-[10px] text-gray uppercase font-semibold">COP</span>
        </div>
      )}

      {/* Next Action Pill */}
      {deal.nextAction && (
        <div className="flex items-center gap-1 text-[10px] font-medium text-primary bg-light-gray dark:bg-slate-800 px-2 py-1 rounded">
          <span className="material-symbols-outlined text-[13px]">event</span>
          <span className="truncate">{deal.nextAction}</span>
        </div>
      )}
    </div>
  );
}
