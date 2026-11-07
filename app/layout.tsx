import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "SaaS Inmobiliario",
    template: "%s · SaaS Inmobiliario",
  },
  description:
    "Plataforma para inmobiliarias: catálogo de propiedades, CRM de leads y agente de IA por WhatsApp.",
  manifest: "/manifest.json",
  icons: { icon: "/icon.svg" },
  themeColor: "#1B4FBF",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        {/* Anti-flash inline script to apply dark theme before render */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function() {
              try {
                var theme = localStorage.getItem('theme');
                if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                  document.documentElement.classList.add('dark');
                } else {
                  document.documentElement.classList.remove('dark');
                }
              } catch(e) {}
            })()`,
          }}
        />
        {/* Registro del service worker (Fase 13) — solo cachea assets estáticos */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function() {
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').catch(function() {});
                });
              }
            })()`,
          }}
        />
        {/* Tipografías del blueprint §12 (Inter, Urbanist, Space Grotesk) */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Urbanist:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
