const features = [
  {
    title: "Catálogo propio",
    description:
      "Tu página pública con tu marca, tus colores y tu slug — publica propiedades con fotos, mapa y filtros en minutos.",
  },
  {
    title: "CRM de leads",
    description:
      "Cada contacto que escribe desde tu página entra solo al pipeline. Califica, abre oportunidades y agenda visitas sin salir del dashboard.",
  },
  {
    title: "Agente de WhatsApp",
    description:
      "Conecta tu número y deja que un agente de IA responda preguntas sobre tus propiedades disponibles, 24/7.",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-light-gray">
      <section className="mx-auto flex max-w-4xl flex-col gap-8 px-6 py-20 text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">
          Para inmobiliarias medianas en Colombia
        </p>
        <h1 className="font-display text-4xl font-semibold leading-tight text-dark sm:text-5xl">
          Tu propia plataforma inmobiliaria, bajo tu marca
        </h1>
        <p className="mx-auto max-w-2xl text-lg leading-8 text-gray">
          Publica tu portafolio, gestiona tus clientes en un CRM y responde por WhatsApp con un
          agente de IA — todo en un solo sistema.
        </p>

        <div className="mx-auto flex flex-wrap items-center justify-center gap-3">
          <a
            className="rounded-md bg-primary px-6 py-3 text-sm font-semibold text-white hover:bg-primary-light"
            href="/register"
          >
            Crear mi cuenta
          </a>
          <a
            className="rounded-md border border-border bg-white px-6 py-3 text-sm font-medium text-dark hover:bg-light-gray"
            href="/login"
          >
            Iniciar sesión
          </a>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-20">
        <div className="grid gap-5 sm:grid-cols-3">
          {features.map((feature) => (
            <div className="rounded-lg border border-border bg-white p-6" key={feature.title}>
              <h2 className="font-display text-lg font-semibold text-dark">{feature.title}</h2>
              <p className="mt-2 text-sm leading-6 text-gray">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
