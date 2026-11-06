"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { TurnstileWidget } from "./TurnstileWidget";

interface ContactFormInput {
  fullName: string;
  email: string;
  phone: string;
}

export function ContactForm({ tenantSlug, propertyId }: { tenantSlug: string; propertyId?: string }) {
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "submitting" | "sent" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { register, handleSubmit, reset } = useForm<ContactFormInput>();

  async function onSubmit(data: ContactFormInput) {
    if (!token) {
      setErrorMessage("Completa la verificación anti-spam antes de enviar");
      return;
    }
    setStatus("submitting");
    setErrorMessage(null);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantSlug,
          fullName: data.fullName,
          email: data.email || undefined,
          phone: data.phone || undefined,
          source: "website",
          propertyId,
          turnstileToken: token,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setErrorMessage(body.error ?? "No se pudo enviar tu mensaje");
        setStatus("error");
        return;
      }
      setStatus("sent");
      reset();
    } catch {
      setStatus("error");
      setErrorMessage("No se pudo enviar tu mensaje");
    }
  }

  if (status === "sent") {
    return (
      <div className="rounded-md border border-success/30 bg-success/10 p-4 text-sm text-dark">
        ¡Gracias! Un asesor te va a contactar pronto.
      </div>
    );
  }

  return (
    <form className="flex flex-col gap-3 rounded-md border border-border bg-white p-4" onSubmit={handleSubmit(onSubmit)}>
      <h3 className="font-display text-base font-semibold text-dark">¿Te interesa? Escríbenos</h3>

      <input
        className="rounded-md border border-border px-3 py-2 text-sm"
        placeholder="Tu nombre"
        required
        {...register("fullName")}
      />
      <input
        className="rounded-md border border-border px-3 py-2 text-sm"
        placeholder="Email"
        type="email"
        {...register("email")}
      />
      <input
        className="rounded-md border border-border px-3 py-2 text-sm"
        placeholder="Teléfono"
        {...register("phone")}
      />

      <TurnstileWidget onToken={setToken} />

      {errorMessage && <p className="text-xs text-danger">{errorMessage}</p>}

      <button
        className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-light disabled:opacity-60"
        disabled={status === "submitting"}
        type="submit"
      >
        {status === "submitting" ? "Enviando..." : "Enviar"}
      </button>
    </form>
  );
}
