import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  pgEnum,
  jsonb,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ─── Enums ──────────────────────────────────────────────────────────────────

export const itemStatusEnum = pgEnum("item_status", [
  "available",
  "pending",
  "reserved",
  "sold",
  "hidden",
]);

export const contactMethodEnum = pgEnum("contact_method", [
  "email",
  "phone",
  "app_message",
]);

export const intentStatusEnum = pgEnum("intent_status", [
  "submitted",
  "reviewed",
  "accepted",
  "declined",
]);

export const userRoleEnum = pgEnum("user_role", ["purchaser", "seller", "admin"]);

// ─── Users / Profiles ───────────────────────────────────────────────────────

export const profiles = pgTable("profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: userRoleEnum("role").default("purchaser").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
  phone: text("phone"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ─── Sessions ───────────────────────────────────────────────────────────────

export const sessions = pgTable("sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ─── Seller Accounts ────────────────────────────────────────────────────────

export const sellerAccounts = pgTable("seller_accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  // TODO: future fields for business info, verification, etc.
});

// ─── Projects ───────────────────────────────────────────────────────────────

export const projects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  sellerId: uuid("seller_id")
    .notNull()
    .references(() => sellerAccounts.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  cityArea: text("city_area").notNull(),
  description: text("description"),
  isPublic: boolean("is_public").default(true).notNull(),
  isSeoIndexable: boolean("is_seo_indexable").default(false).notNull(), // future
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

// ─── Project Categories ─────────────────────────────────────────────────────

export const projectCategories = pgTable("project_categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ─── Items ──────────────────────────────────────────────────────────────────

export const items = pgTable("items", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  categoryId: uuid("category_id").references(() => projectCategories.id, {
    onDelete: "set null",
  }),
  title: text("title").notNull(),
  brand: text("brand"),
  description: text("description"),
  condition: text("condition"),
  approximateAge: text("approximate_age"),
  price: integer("price"),
  originalPrice: integer("original_price"),
  currency: text("currency").default("USD").notNull(),
  notes: text("notes"),
  status: itemStatusEnum("status").default("available").notNull(),
  coverImageUrl: text("cover_image_url"),
  sortOrder: integer("sort_order").default(0).notNull(),
  viewCount: integer("view_count").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

// ─── Item Images ────────────────────────────────────────────────────────────

export const itemImages = pgTable("item_images", {
  id: uuid("id").defaultRandom().primaryKey(),
  itemId: uuid("item_id")
    .notNull()
    .references(() => items.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  altText: text("alt_text"),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ─── Item Files ─────────────────────────────────────────────────────────────

export const itemFiles = pgTable("item_files", {
  id: uuid("id").defaultRandom().primaryKey(),
  itemId: uuid("item_id")
    .notNull()
    .references(() => items.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type"),
  sizeBytes: integer("size_bytes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ─── Item Links ─────────────────────────────────────────────────────────────

export const itemLinks = pgTable("item_links", {
  id: uuid("id").defaultRandom().primaryKey(),
  itemId: uuid("item_id")
    .notNull()
    .references(() => items.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  label: text("label"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ─── Buyer Wishlists ────────────────────────────────────────────────────────

export const buyerWishlists = pgTable("buyer_wishlists", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const buyerWishlistItems = pgTable("buyer_wishlist_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  wishlistId: uuid("wishlist_id")
    .notNull()
    .references(() => buyerWishlists.id, { onDelete: "cascade" }),
  itemId: uuid("item_id")
    .notNull()
    .references(() => items.id, { onDelete: "cascade" }),
  addedAt: timestamp("added_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ─── Buyer Intents ──────────────────────────────────────────────────────────

export const buyerIntents = pgTable("buyer_intents", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  phone: text("phone"),
  contactMethod: contactMethodEnum("contact_method")
    .default("email")
    .notNull(),
  pickupNotes: text("pickup_notes"),
  status: intentStatusEnum("status").default("submitted").notNull(),
  metadata: jsonb("metadata"), // future extension point
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const buyerIntentItems = pgTable("buyer_intent_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  intentId: uuid("intent_id")
    .notNull()
    .references(() => buyerIntents.id, { onDelete: "cascade" }),
  itemId: uuid("item_id")
    .notNull()
    .references(() => items.id, { onDelete: "cascade" }),
});

// ─── Conversation Threads ───────────────────────────────────────────────────

export const conversationThreads = pgTable("conversation_threads", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  buyerId: uuid("buyer_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  buyerLastReadAt: timestamp("buyer_last_read_at", { withTimezone: true }),
  sellerLastReadAt: timestamp("seller_last_read_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const conversationMessages = pgTable("conversation_messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  threadId: uuid("thread_id")
    .notNull()
    .references(() => conversationThreads.id, { onDelete: "cascade" }),
  senderId: uuid("sender_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ─── Email Logs ─────────────────────────────────────────────────────────────

export const emailTypeEnum = pgEnum("email_type", [
  "welcome",
  "message_notification",
  "message_copy",
  "intent_received",
  "intent_status",
  "password_reset",
]);

export const emailStatusEnum = pgEnum("email_status", ["sent", "failed"]);

export const emailLogs = pgTable("email_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  toEmail: text("to_email").notNull(),
  fromEmail: text("from_email").notNull(),
  subject: text("subject").notNull(),
  type: emailTypeEnum("type").notNull(),
  status: emailStatusEnum("status").notNull(),
  errorMessage: text("error_message"),
  resendId: text("resend_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ─── App Settings ───────────────────────────────────────────────────────────

export const appSettings = pgTable("app_settings", {
  id: uuid("id").defaultRandom().primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull().default(""),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedBy: uuid("updated_by").references(() => profiles.id, {
    onDelete: "set null",
  }),
});

// ─── Password Reset Tokens ──────────────────────────────────────────────────

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ─── Relations ──────────────────────────────────────────────────────────────

export const profilesRelations = relations(profiles, ({ many }) => ({
  sellerAccounts: many(sellerAccounts),
  sessions: many(sessions),
  wishlists: many(buyerWishlists),
  intents: many(buyerIntents),
  threads: many(conversationThreads),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(profiles, {
    fields: [sessions.userId],
    references: [profiles.id],
  }),
}));

export const sellerAccountsRelations = relations(
  sellerAccounts,
  ({ one, many }) => ({
    user: one(profiles, {
      fields: [sellerAccounts.userId],
      references: [profiles.id],
    }),
    projects: many(projects),
  })
);

export const projectsRelations = relations(projects, ({ one, many }) => ({
  seller: one(sellerAccounts, {
    fields: [projects.sellerId],
    references: [sellerAccounts.id],
  }),
  categories: many(projectCategories),
  items: many(items),
  wishlists: many(buyerWishlists),
  intents: many(buyerIntents),
  threads: many(conversationThreads),
}));

export const projectCategoriesRelations = relations(
  projectCategories,
  ({ one, many }) => ({
    project: one(projects, {
      fields: [projectCategories.projectId],
      references: [projects.id],
    }),
    items: many(items),
  })
);

export const itemsRelations = relations(items, ({ one, many }) => ({
  project: one(projects, {
    fields: [items.projectId],
    references: [projects.id],
  }),
  category: one(projectCategories, {
    fields: [items.categoryId],
    references: [projectCategories.id],
  }),
  images: many(itemImages),
  files: many(itemFiles),
  links: many(itemLinks),
}));

export const itemImagesRelations = relations(itemImages, ({ one }) => ({
  item: one(items, { fields: [itemImages.itemId], references: [items.id] }),
}));

export const itemFilesRelations = relations(itemFiles, ({ one }) => ({
  item: one(items, { fields: [itemFiles.itemId], references: [items.id] }),
}));

export const itemLinksRelations = relations(itemLinks, ({ one }) => ({
  item: one(items, { fields: [itemLinks.itemId], references: [items.id] }),
}));

export const buyerWishlistsRelations = relations(
  buyerWishlists,
  ({ one, many }) => ({
    user: one(profiles, {
      fields: [buyerWishlists.userId],
      references: [profiles.id],
    }),
    project: one(projects, {
      fields: [buyerWishlists.projectId],
      references: [projects.id],
    }),
    items: many(buyerWishlistItems),
  })
);

export const buyerWishlistItemsRelations = relations(
  buyerWishlistItems,
  ({ one }) => ({
    wishlist: one(buyerWishlists, {
      fields: [buyerWishlistItems.wishlistId],
      references: [buyerWishlists.id],
    }),
    item: one(items, {
      fields: [buyerWishlistItems.itemId],
      references: [items.id],
    }),
  })
);

export const buyerIntentsRelations = relations(
  buyerIntents,
  ({ one, many }) => ({
    user: one(profiles, {
      fields: [buyerIntents.userId],
      references: [profiles.id],
    }),
    project: one(projects, {
      fields: [buyerIntents.projectId],
      references: [projects.id],
    }),
    items: many(buyerIntentItems),
  })
);

export const buyerIntentItemsRelations = relations(
  buyerIntentItems,
  ({ one }) => ({
    intent: one(buyerIntents, {
      fields: [buyerIntentItems.intentId],
      references: [buyerIntents.id],
    }),
    item: one(items, {
      fields: [buyerIntentItems.itemId],
      references: [items.id],
    }),
  })
);

export const conversationThreadsRelations = relations(
  conversationThreads,
  ({ one, many }) => ({
    project: one(projects, {
      fields: [conversationThreads.projectId],
      references: [projects.id],
    }),
    buyer: one(profiles, {
      fields: [conversationThreads.buyerId],
      references: [profiles.id],
    }),
    messages: many(conversationMessages),
  })
);

export const conversationMessagesRelations = relations(
  conversationMessages,
  ({ one }) => ({
    thread: one(conversationThreads, {
      fields: [conversationMessages.threadId],
      references: [conversationThreads.id],
    }),
    sender: one(profiles, {
      fields: [conversationMessages.senderId],
      references: [profiles.id],
    }),
  })
);
