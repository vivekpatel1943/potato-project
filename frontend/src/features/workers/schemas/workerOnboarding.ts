import { z } from "zod";

export const avatarStepSchema = z.object({
  avatar_url: z.string().min(1, "Profile picture is required"),
});

export const documentSchema = z.object({
  document_type: z.enum(["aadhaar", "driving_license", "passport", "pan", "other"], {
    required_error: "Document type is required",
  }),
  document_url: z.string().min(1, "Document file is required"),
  document_number: z.string().optional(),
});

export const documentsStepSchema = z.object({
  documents: z.array(documentSchema).min(1, "At least one verification document is required"),
});

export const servicesStepSchema = z.object({
  subcategory_ids: z.array(z.string().uuid()).min(1, "Select at least one service"),
});

export type AvatarStepData = z.infer<typeof avatarStepSchema>;
export type DocumentData = z.infer<typeof documentSchema>;
export type DocumentsStepData = z.infer<typeof documentsStepSchema>;
export type ServicesStepData = z.infer<typeof servicesStepSchema>;
