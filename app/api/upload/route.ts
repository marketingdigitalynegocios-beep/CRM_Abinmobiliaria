import { env } from "cloudflare:workers";
import { z } from "zod";
import { requireSession, unauthorized } from "../../../lib/auth/session";
import { createDirectUploadUrl } from "../../../lib/images/cloudflare-images";
import { jsonError, validationError } from "../../../lib/http";

const uploadRequestSchema = z.object({
  context: z.enum(["property", "agency_logo"]),
});

export async function POST(request: Request) {
  const session = await requireSession(request);
  if (!session) return unauthorized();

  const body = await request.json();
  const parsed = uploadRequestSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  try {
    const { imageId, uploadUrl } = await createDirectUploadUrl(
      env.CLOUDFLARE_ACCOUNT_ID,
      env.CLOUDFLARE_IMAGES_API_TOKEN,
      { tenant_id: session.tenantId, context: parsed.data.context }
    );
    return Response.json({ upload_url: uploadUrl, image_id: imageId });
  } catch (error) {
    return jsonError("No se pudo iniciar la subida de imagen", 502, String(error));
  }
}
