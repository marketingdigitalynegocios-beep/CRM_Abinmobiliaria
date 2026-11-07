"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function QuickDealButton({ leadId, propertyId }: { leadId: string; propertyId: string }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  async function handleClick() {
    setSubmitting(true);
    try {
      const res = await fetch("/api/deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId, propertyId }),
      });
      if (res.ok) router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={submitting}
      className="rounded border border-primary px-2 py-1 text-[11px] font-semibold text-primary hover:bg-primary/5 disabled:opacity-50 transition-colors"
    >
      {submitting ? "Abriendo..." : "Abrir oportunidad"}
    </button>
  );
}
