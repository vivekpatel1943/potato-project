import { z } from "zod";

export const phoneSchema = z.object({
  phone: z
    .string()
    .min(1, "Phone number is required")
    .regex(/^\+\d{10,15}$/, "Phone number must be in E.164 format (e.g. +918103614609)"),
});

export const phoneCodeSchema = z.object({
  code: z
    .string()
    .length(6, "Code must be exactly 6 digits")
    .regex(/^\d{6}$/, "Code must contain only numbers"),
});

export type PhoneFormData = z.infer<typeof phoneSchema>;
export type PhoneCodeFormData = z.infer<typeof phoneCodeSchema>;
