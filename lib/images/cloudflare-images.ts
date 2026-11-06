/**
 * Cloudflare Images — reemplaza Supabase Storage + `sharp` (que no corre en el
 * runtime de Workers). El cliente sube el archivo directo a la URL que esto
 * devuelve; el Worker nunca ve el binario. Ver blueprint-saas-inmobiliario.md §11.
 */

interface CloudflareImagesDirectUploadResponse {
  success: boolean;
  result?: { id: string; uploadURL: string };
  errors?: unknown[];
}

export interface DirectUploadResult {
  imageId: string;
  uploadUrl: string;
}

export async function createDirectUploadUrl(
  accountId: string,
  apiToken: string,
  metadata: Record<string, string>
): Promise<DirectUploadResult> {
  const form = new FormData();
  form.set("metadata", JSON.stringify(metadata));
  form.set("requireSignedURLs", "false");

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v2/direct_upload`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${apiToken}` },
      body: form,
    }
  );

  const json = (await res.json()) as CloudflareImagesDirectUploadResponse;

  if (!json.success || !json.result) {
    throw new Error(`Cloudflare Images direct_upload falló: ${JSON.stringify(json.errors)}`);
  }

  return { imageId: json.result.id, uploadUrl: json.result.uploadURL };
}

/**
 * Construye la URL de entrega de una imagen ya subida. `deliveryBaseUrl` es
 * `NEXT_PUBLIC_CLOUDFLARE_IMAGES_DELIVERY_URL` (ej. `https://imagedelivery.net/<hash>`).
 * Variantes esperadas (configuradas en el dashboard, ver blueprint §11): `public`, `thumbnail`.
 */
export function buildImageDeliveryUrl(
  deliveryBaseUrl: string,
  imageId: string,
  variant: "public" | "thumbnail" = "public"
) {
  return `${deliveryBaseUrl}/${imageId}/${variant}`;
}
