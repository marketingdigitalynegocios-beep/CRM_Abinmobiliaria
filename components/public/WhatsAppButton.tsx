interface WhatsAppButtonProps {
  whatsappNumber: string | null;
  message: string;
}

/**
 * MVP (Fase 1): el botón abre WhatsApp directo con el número de la
 * inmobiliaria. La integración con el agente de IA (Meta Cloud API,
 * Embedded Signup) es Fase 3 — ver blueprint §11 y plan-implementacion.md.
 */
export function WhatsAppButton({ whatsappNumber, message }: WhatsAppButtonProps) {
  if (!whatsappNumber) return null;

  const digitsOnly = whatsappNumber.replace(/[^0-9]/g, "");
  const href = `https://wa.me/${digitsOnly}?text=${encodeURIComponent(message)}`;

  return (
    <a
      className="inline-flex items-center justify-center gap-2 rounded-md bg-success px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
      href={href}
      rel="noreferrer"
      target="_blank"
    >
      Contactar por WhatsApp
    </a>
  );
}
