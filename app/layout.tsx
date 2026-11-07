import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "SaaS Inmobiliario",
    template: "%s · SaaS Inmobiliario",
  },
  description:
    "Plataforma para inmobiliarias: catálogo de propiedades, CRM de leads y agente de IA por WhatsApp.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <head>
        {/* Tipografías del blueprint §12 (Inter: dashboard, Urbanist: páginas
            públicas) — antes declaradas en globals.css pero nunca cargadas. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Urbanist:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
