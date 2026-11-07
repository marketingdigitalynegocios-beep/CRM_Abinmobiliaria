"use client";

import { useEffect, useState } from "react";

export function PortalFeedCard() {
  const [feedUrl, setFeedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/agency/portal-feed")
      .then((res) => res.json() as Promise<{ feedUrl: string | null }>)
      .then((data) => setFeedUrl(data.feedUrl))
      .catch(() => setFeedUrl(null));
  }, []);

  async function handleCopy() {
    if (!feedUrl) return;
    await navigator.clipboard.writeText(feedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-xl border border-border bg-white p-4 shadow-xs space-y-2">
      <div className="flex items-center gap-2 text-xs font-bold text-dark">
        <span className="material-symbols-outlined text-[18px] text-primary">rss_feed</span>
        <span>Feed para Portales Externos</span>
      </div>
      <p className="text-[11px] text-gray leading-relaxed">
        Fincaraíz y Metrocuadrado exigen credenciales propias de integrador (solicítalas
        directamente con cada portal). Una vez las tengas, registra esta URL de feed en su panel de
        integrador — contiene tu inventario real y publicado, actualizado en cada visita.
      </p>
      {feedUrl ? (
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={feedUrl}
            className="flex-1 h-8 rounded-md border border-border bg-light-gray px-2 text-[11px] font-mono text-dark"
            onFocus={(e) => e.target.select()}
          />
          <button
            type="button"
            onClick={handleCopy}
            className="h-8 shrink-0 rounded-md border border-border px-2.5 text-[11px] font-semibold text-dark hover:bg-light-gray transition-colors"
          >
            {copied ? "Copiado" : "Copiar"}
          </button>
        </div>
      ) : (
        <p className="text-[11px] text-gray">Generando...</p>
      )}
    </div>
  );
}
