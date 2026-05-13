import { z } from "zod";
import { ENROLLMENT_STATUSES } from "@/db/schema/enums";

const US_STATE_REGEX = /^[A-Z]{2}$/;

export const emailSchema = z.string().email().toLowerCase().trim();

// ── Organization (tenant practice) ────────────────────────────────────────────

export const createOrganizationSchema = z.object({
  legalName: z.string().min(2).max(200).trim(),
  displayName: z.string().min(2).max(120).trim(),
  primaryContactName: z.string().max(120).trim().optional().or(z.literal("")),
  primaryContactEmail: emailSchema.optional().or(z.literal("")),
  primaryContactPhone: z.string().max(40).trim().optional().or(z.literal("")),
  notes: z.string().max(2000).optional().or(z.literal("")),
});
export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;

export const updateOrganizationSchema = z.object({
  organizationId: z.string().uuid(),
  legalName: z.string().min(2).max(200).trim(),
  displayName: z.string().min(2).max(120).trim(),
  primaryContactName: z.string().max(120).trim().optional().or(z.literal("")),
  primaryContactEmail: emailSchema.optional().or(z.literal("")),
  primaryContactPhone: z.string().max(40).trim().optional().or(z.literal("")),
  notes: z.string().max(2000).optional().or(z.literal("")),
  isActive: z.boolean().default(true),
});
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;

export const createPayerSchema = z.object({
  name: z.string().min(2).max(120).trim(),
  payerType: z.enum(["commercial", "medicare", "medicaid", "tricare", "other"]).default("commercial"),
  statesActive: z.array(z.string().regex(US_STATE_REGEX)).default([]),
});
export type CreatePayerInput = z.infer<typeof createPayerSchema>;

// ── Organization users (portal users) ─────────────────────────────────────────

export const inviteOrganizationUserSchema = z
  .object({
    organizationId: z.string().uuid(),
    email: emailSchema,
    fullName: z.string().min(2).max(120).trim(),
    role: z.enum(["org_admin", "org_viewer"]).default("org_viewer"),
    authMethod: z.enum(["magic_link", "password"]).default("magic_link"),
    password: z
      .string()
      .min(8, "At least 8 characters")
      .max(72, "Max 72 characters (Supabase limit)")
      .optional(),
  })
  .refine((v) => v.authMethod !== "password" || (v.password && v.password.length >= 8), {
    message: "Password is required when auth method is 'password'",
    path: ["password"],
  });
export type InviteOrganizationUserInput = z.infer<typeof inviteOrganizationUserSchema>;

// ── Client (individual clinician) ─────────────────────────────────────────────

export const createClientSchema = z.object({
  organizationId: z.string().uuid(),
  firstName: z.string().min(1).max(80).trim(),
  middleName: z.string().max(80).trim().optional().or(z.literal("")),
  lastName: z.string().min(1).max(80).trim(),
  suffix: z.string().max(20).trim().optional().or(z.literal("")),
  npi: z.string().regex(/^\d{10}$/).optional().or(z.literal("")),
  primarySpecialty: z.string().max(120).trim().optional().or(z.literal("")),
  secondarySpecialty: z.string().max(120).trim().optional().or(z.literal("")),
  email: emailSchema.optional().or(z.literal("")),
  phone: z.string().max(40).trim().optional().or(z.literal("")),
  caqhId: z.string().max(40).trim().optional().or(z.literal("")),
});
export type CreateClientInput = z.infer<typeof createClientSchema>;

export const updateClientSchema = z.object({
  clientId: z.string().uuid(),
  firstName: z.string().min(1).max(80).trim(),
  middleName: z.string().max(80).trim().optional().or(z.literal("")),
  lastName: z.string().min(1).max(80).trim(),
  suffix: z.string().max(20).trim().optional().or(z.literal("")),
  npi: z.string().regex(/^\d{10}$/).optional().or(z.literal("")),
  primarySpecialty: z.string().max(120).trim().optional().or(z.literal("")),
  secondarySpecialty: z.string().max(120).trim().optional().or(z.literal("")),
  email: emailSchema.optional().or(z.literal("")),
  phone: z.string().max(40).trim().optional().or(z.literal("")),
  caqhId: z.string().max(40).trim().optional().or(z.literal("")),
});
export type UpdateClientInput = z.infer<typeof updateClientSchema>;

// ── Enrollment ────────────────────────────────────────────────────────────────

export const createEnrollmentSchema = z
  .object({
    organizationId: z.string().uuid(),
    clientId: z.string().uuid().optional(),
    groupEntityId: z.string().uuid().optional(),
    payerId: z.string().uuid(),
    state: z.string().regex(US_STATE_REGEX, "State must be a 2-letter US state code (e.g. TX)"),
    subStatus: z.string().max(200).optional().or(z.literal("")),
  })
  .refine(
    (val) => Boolean(val.clientId) !== Boolean(val.groupEntityId),
    {
      message: "Exactly one of clientId or groupEntityId must be set",
      path: ["clientId"],
    },
  );
export type CreateEnrollmentInput = z.infer<typeof createEnrollmentSchema>;

export const transitionStatusSchema = z.object({
  enrollmentId: z.string().uuid(),
  toStatus: z.enum(ENROLLMENT_STATUSES),
  subStatus: z.string().max(200).optional().or(z.literal("")),
  reason: z.string().max(500).optional().or(z.literal("")),
});
export type TransitionStatusInput = z.infer<typeof transitionStatusSchema>;

// ── Comments / Notes ──────────────────────────────────────────────────────────

export const postCommentSchema = z.object({
  enrollmentId: z.string().uuid(),
  body: z.string().min(1).max(5000).trim(),
  parentCommentId: z.string().uuid().optional(),
});
export type PostCommentInput = z.infer<typeof postCommentSchema>;

export const postInternalNoteSchema = z.object({
  enrollmentId: z.string().uuid(),
  body: z.string().min(1).max(5000).trim(),
  parentNoteId: z.string().uuid().optional(),
});
export type PostInternalNoteInput = z.infer<typeof postInternalNoteSchema>;

// ── Documents ─────────────────────────────────────────────────────────────────

const DOCUMENT_OWNER_TYPES = ["provider", "enrollment", "group_entity", "client"] as const;

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/heif",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/csv",
] as const;
export const ALLOWED_DOCUMENT_MIME_TYPES = ALLOWED_MIME_TYPES;
export const MAX_DOCUMENT_BYTES = 50 * 1024 * 1024;

export const uploadDocumentMetaSchema = z
  .object({
    organizationId: z.string().uuid(),
    ownerType: z.enum(DOCUMENT_OWNER_TYPES),
    ownerId: z.string().uuid(),
    categoryId: z.string().uuid(),
    fileName: z.string().min(1).max(255),
    mimeType: z
      .string()
      .refine((v) => (ALLOWED_MIME_TYPES as readonly string[]).includes(v), {
        message: "File type not allowed",
      }),
    sizeBytes: z.number().int().positive().max(MAX_DOCUMENT_BYTES),
    expirationDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
      .optional()
      .or(z.literal("")),
    isInternal: z.boolean().default(false),
    description: z.string().max(500).optional().or(z.literal("")),
  })
  .strict();
export type UploadDocumentMetaInput = z.infer<typeof uploadDocumentMetaSchema>;

export const documentIdSchema = z.object({ documentId: z.string().uuid() });

export const createDocumentCategorySchema = z.object({
  label: z.string().min(2).max(60).trim(),
});
export type CreateDocumentCategoryInput = z.infer<typeof createDocumentCategorySchema>;
