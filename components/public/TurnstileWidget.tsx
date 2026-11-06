"use client";

import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        opts: { sitekey: string; callback: (token: string) => void }
      ) => string;
      reset: (widgetId?: string) => void;
    };
  }
}

const SCRIPT_ID = "cf-turnstile-script";

export function TurnstileWidget({ onToken }: { onToken: (token: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  useEffect(() => {
    if (!siteKey) return;
    if (window.turnstile) {
      setScriptLoaded(true);
      return;
    }
    const existing = document.getElementById(SCRIPT_ID);
    if (existing) {
      existing.addEventListener("load", () => setScriptLoaded(true));
      return;
    }
    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
    script.async = true;
    script.defer = true;
    script.onload = () => setScriptLoaded(true);
    document.body.appendChild(script);
  }, [siteKey]);

  useEffect(() => {
    if (!scriptLoaded || !containerRef.current || !window.turnstile || !siteKey) return;
    window.turnstile.render(containerRef.current, { sitekey: siteKey, callback: onToken });
  }, [scriptLoaded, siteKey, onToken]);

  if (!siteKey) {
    // Pendiente de aprovisionar Turnstile (ver plan-implementacion.md §0) —
    // no rompe el formulario, solo avisa en vez de fallar en silencio.
    return (
      <p className="text-xs text-danger">
        Turnstile no está configurado (NEXT_PUBLIC_TURNSTILE_SITE_KEY).
      </p>
    );
  }

  return <div ref={containerRef} />;
}
