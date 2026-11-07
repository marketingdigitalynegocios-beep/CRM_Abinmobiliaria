"use client";

import { useEffect, useState } from "react";

export function GoogleCalendarConnectButton() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    fetch("/api/integrations/google-calendar")
      .then((res) => res.json() as Promise<{ connected: boolean }>)
      .then((data) => setConnected(data.connected))
      .catch(() => setConnected(false));
  }, []);

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      await fetch("/api/integrations/google-calendar", { method: "DELETE" });
      setConnected(false);
    } finally {
      setDisconnecting(false);
    }
  }

  if (connected === null) return null;

  if (connected) {
    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Google Calendar conectado
        </span>
        <button
          type="button"
          onClick={handleDisconnect}
          disabled={disconnecting}
          className="text-xs font-medium text-gray hover:text-danger disabled:opacity-50"
        >
          Desconectar
        </button>
      </div>
    );
  }

  return (
    <a
      href="/api/integrations/google-calendar/connect"
      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-white px-3 py-1.5 text-xs font-semibold text-dark shadow-xs hover:bg-light-gray transition-colors"
    >
      <span className="material-symbols-outlined text-[16px] text-gray">event</span>
      <span>Conectar mi Google Calendar</span>
    </a>
  );
}
