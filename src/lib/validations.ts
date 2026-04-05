import { z } from "zod";

// ─── Project Schemas ────────────────────────────────────────────────────────

export const projectFormSchema = z.object({
  name: z.string().min(2).max(100),
  slug: z
    .string()
    .min(2)
    .max(100)
    .regex(/^[a-z0-9-]+$/, "Only lowercase letters, numbers, and hyphens"),
  cityArea: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
});

export type ProjectFormValues = z.infer<typeof projectFormSchema>;

// ─── Category Schemas ───────────────────────────────────────────────────────

export const categoryFormSchema = z.object({
  name: z.string().min(1).max(50),
});

export type CategoryFormValues = z.infer<typeof categoryFormSchema>;

// ─── Item Schemas ───────────────────────────────────────────────────────────

export const itemFormSchema = z.object({
  title: z.string().min(2).max(200),
  brand: z.string().max(100).optional(),
  description: z.string().max(2000).optional(),
  condition: z.string().max(100).optional(),
  approximateAge: z.string().max(100).optional(),
  price: z.number().int().min(0).optional(),
  currency: z.enum(["USD", "EUR", "CAD"]),
  notes: z.string().max(2000).optional(),
  categoryId: z.string().uuid().optional(),
  status: z.enum(["available", "pending", "sold"]),
});

export type ItemFormValues = z.infer<typeof itemFormSchema>;

// ─── Item Link Schema ───────────────────────────────────────────────────────

export const itemLinkSchema = z.object({
  url: z.string().url(),
  label: z.string().max(100).optional(),
});

export type ItemLinkValues = z.infer<typeof itemLinkSchema>;

// ─── Purchase Intent Schema ─────────────────────────────────────────────────

export const purchaseIntentSchema = z.object({
  phone: z.string().max(20).optional(),
  contactMethod: z.enum(["email", "phone", "app_message"]),
  pickupNotes: z.string().max(1000).optional(),
  itemIds: z.array(z.string().uuid()).min(1),
});

export type PurchaseIntentValues = z.infer<typeof purchaseIntentSchema>;

// ─── Message Schema ─────────────────────────────────────────────────────────

export const messageSchema = z.object({
  body: z.string().min(1).max(5000),
});

export type MessageValues = z.infer<typeof messageSchema>;

// ─── Auth Schema ────────────────────────────────────────────────────────────

export const magicLinkSchema = z.object({
  email: z.string().email(),
});

export type MagicLinkValues = z.infer<typeof magicLinkSchema>;
