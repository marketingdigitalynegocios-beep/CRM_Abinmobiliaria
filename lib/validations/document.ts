import { z } from "zod";

export const documentTypeSchema = z.enum(["contract", "mandate", "id_copy", "other"]);

/** Metadata que acompaña al archivo en el `multipart/form-data` de `POST /api/documents`. */
export const uploadDocumentMetaSchema = z.object({
  type: documentTypeSchema.default("other"),
  leadId: z.string().optional(),
  dealId: z.string().optional(),
  propertyId: z.string().optional(),
});

export type UploadDocumentMetaInput = z.infer<typeof uploadDocumentMetaSchema>;
