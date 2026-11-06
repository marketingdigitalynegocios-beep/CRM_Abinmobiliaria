import { env } from "cloudflare:workers";
import Papa from "papaparse";
import { requireSession, unauthorized } from "../../../../lib/auth/session";
import { getDb } from "../../../../lib/db/client";
import { createPropertyForTenant } from "../../../../lib/db/tenant-scope";
import { jsonError } from "../../../../lib/http";
import { createPropertySchema } from "../../../../lib/validations/property";
import { cleanCsvRow, csvPropertyRowSchema } from "../../../../lib/validations/property-import";

export async function POST(request: Request) {
  const session = await requireSession(request.headers);
  if (!session) return unauthorized();

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return jsonError("Falta el archivo CSV (campo 'file')", 400);
  }

  const text = await file.text();
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
  });

  if (parsed.errors.length > 0) {
    return jsonError("CSV mal formado", 400, parsed.errors);
  }

  const db = getDb(env.DB);
  let created = 0;
  let skipped = 0;
  const errors: { row: number; message: string }[] = [];

  for (let i = 0; i < parsed.data.length; i++) {
    const rowNumber = i + 2; // fila 1 del archivo es el header
    const cleaned = cleanCsvRow(parsed.data[i]);

    const rowParsed = csvPropertyRowSchema.safeParse(cleaned);
    if (!rowParsed.success) {
      skipped++;
      errors.push({
        row: rowNumber,
        message: rowParsed.error.issues.map((issue) => issue.message).join("; "),
      });
      continue;
    }

    const propertyParsed = createPropertySchema.safeParse(rowParsed.data);
    if (!propertyParsed.success) {
      skipped++;
      errors.push({
        row: rowNumber,
        message: propertyParsed.error.issues.map((issue) => issue.message).join("; "),
      });
      continue;
    }

    try {
      await createPropertyForTenant(db, session.tenantId, propertyParsed.data);
      created++;
    } catch (error) {
      skipped++;
      errors.push({ row: rowNumber, message: String(error) });
    }
  }

  return Response.json({ created, skipped, errors });
}
