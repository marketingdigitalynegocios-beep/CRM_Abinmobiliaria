"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

declare global {
  interface Window {
    FB?: {
      init: (options: { appId: string; version: string; xfbml?: boolean }) => void;
      login: (
        callback: (response: { authResponse?: { code?: string } }) => void,
        options: {
          config_id: string;
          response_type: "code";
          override_default_response_type: true;
        }
      ) => void;
    };
    fbAsyncInit?: () => void;
  }
}

const SDK_SCRIPT_ID = "facebook-jssdk";

/**
 * Flujo de Embedded Signup de Meta (ver blueprint §11): el SDK de Facebook
 * da el `code` en el callback de `FB.login`, y por separado manda un evento
 * `postMessage` (`WA_EMBEDDED_SIGNUP`) con `waba_id`/`phone_number_id` — son
 * dos piezas de información distintas que hay que juntar antes de llamar a
 * `POST /api/whatsapp/connect`. No se puede probar en vivo sin una app Meta
 * real configurada (ver bitacora-desarrollo.md).
 */
export function WhatsAppConnectButton() {
  const router = useRouter();
  const [sdkReady, setSdkReady] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionInfoRef = useRef<{ wabaId?: string; phoneNumberId?: string; displayPhoneNumber?: string }>(
    {}
  );

  const appId = process.env.NEXT_PUBLIC_META_APP_ID;
  const configId = process.env.NEXT_PUBLIC_META_CONFIG_ID;

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.origin !== "https://www.facebook.com" && event.origin !== "https://web.facebook.com") {
        return;
      }
      try {
        const data = JSON.parse(event.data);
        if (data.type === "WA_EMBEDDED_SIGNUP" && data.event === "FINISH") {
          sessionInfoRef.current = {
            wabaId: data.data?.waba_id,
            phoneNumberId: data.data?.phone_number_id,
            displayPhoneNumber: data.data?.display_phone_number,
          };
        }
      } catch {
        // No era un mensaje de Embedded Signup — se ignora.
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  useEffect(() => {
    if (!appId) return;
    if (window.FB) {
      setSdkReady(true);
      return;
    }
    window.fbAsyncInit = () => {
      window.FB?.init({ appId, version: "v21.0" });
      setSdkReady(true);
    };
    if (document.getElementById(SDK_SCRIPT_ID)) return;
    const script = document.createElement("script");
    script.id = SDK_SCRIPT_ID;
    script.src = "https://connect.facebook.net/en_US/sdk.js";
    script.async = true;
    document.body.appendChild(script);
  }, [appId]);

  if (!appId || !configId) {
    return (
      <p className="text-sm text-danger">
        Faltan `NEXT_PUBLIC_META_APP_ID`/`NEXT_PUBLIC_META_CONFIG_ID` — configúralos antes de conectar WhatsApp.
      </p>
    );
  }

  function handleConnect() {
    if (!window.FB) return;
    setError(null);
    setConnecting(true);
    window.FB.login(
      async (response) => {
        const code = response.authResponse?.code;
        const { wabaId, phoneNumberId, displayPhoneNumber } = sessionInfoRef.current;

        if (!code || !wabaId || !phoneNumberId) {
          setError("No se completó la conexión con Meta. Intenta de nuevo.");
          setConnecting(false);
          return;
        }

        try {
          const res = await fetch("/api/whatsapp/connect", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code, wabaId, phoneNumberId, displayPhoneNumber }),
          });
          if (!res.ok) {
            const body = (await res.json().catch(() => ({}))) as { error?: string };
            setError(body.error ?? "No se pudo conectar WhatsApp");
            return;
          }
          router.refresh();
        } finally {
          setConnecting(false);
        }
      },
      { config_id: configId!, response_type: "code", override_default_response_type: true }
    );
  }

  return (
    <div>
      <button
        className="rounded-md bg-success px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
        disabled={!sdkReady || connecting}
        onClick={handleConnect}
        type="button"
      >
        {connecting ? "Conectando..." : "Conectar WhatsApp"}
      </button>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}
