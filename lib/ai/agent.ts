import { and, eq } from "drizzle-orm";
import type { Db } from "../db/client";
import { properties } from "../db/schema";

const GEMINI_MODEL = "gemini-1.5-flash";

async function buildPropertyContext(db: Db, tenantId: string): Promise<string> {
  const activeProperties = await db
    .select({
      title: properties.title,
      type: properties.type,
      operation: properties.operation,
      priceCents: properties.priceCents,
      city: properties.city,
      areaM2: properties.areaM2,
      bedrooms: properties.bedrooms,
      bathrooms: properties.bathrooms,
    })
    .from(properties)
    .where(and(eq(properties.tenantId, tenantId), eq(properties.status, "active")))
    .limit(15);

  if (activeProperties.length === 0) return "Sin propiedades disponibles";

  return activeProperties
    .map(
      (p) =>
        `- ${p.title}: ${p.type}, ${p.operation}, $${(p.priceCents / 100).toLocaleString("es-CO")} COP, ${p.city ?? "sin ciudad"}`
    )
    .join("\n");
}

/**
 * Arma el contexto de propiedades activas del tenant y llama a Gemini por
 * `fetch` directo al REST API (no el SDK `@google/generative-ai` — ver
 * blueprint §11/§14, evita depender de su compatibilidad con Workers).
 */
export async function generateAgentReply(
  db: Db,
  tenantId: string,
  systemPrompt: string,
  customerMessage: string,
  geminiKey: string
): Promise<string> {
  const propertyContext = await buildPropertyContext(db, tenantId);

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${geminiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: `${systemPrompt}\n\nPropiedades disponibles:\n${propertyContext}` },
              { text: `Cliente: ${customerMessage}` },
            ],
          },
        ],
      }),
    }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini respondió ${res.status}: ${body}`);
  }

  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  return (
    json.candidates?.[0]?.content?.parts?.[0]?.text ??
    "No pude procesar tu mensaje, un asesor te contactará."
  );
}
