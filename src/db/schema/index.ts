import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  pgEnum,
  jsonb,
  uniqueIndex,
  index,
  doublePrecision,
  primaryKey,
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
  "cancelled",
]);

export const projectVisibilityEnum = pgEnum("project_visibility", [
  "public",
  "invitation_only",
]);

export const projectPublishStatusEnum = pgEnum("project_publish_status", [
  "draft",
  "pending",
  "approved",
  "rejected",
]);

export const invitationStatusEnum = pgEnum("invitation_status", [
  "active",
  "used",
  "expired",
  "revoked",
]);

export const accessRequestStatusEnum = pgEnum("access_request_status", [
  "pending",
  "approved",
  "declined",
  "cancelled",
]);

export const accessGrantSourceEnum = pgEnum("access_grant_source", [
  "targeted_invitation",
  "generic_request",
  "seller_manual",
  "share_link",
]);

export const notificationTypeEnum = pgEnum("notification_type", [
  "invitation_received",
  "access_granted",
  "access_declined",
  "access_revoked",
  "access_requested",
]);

export const emailVisibilityEnum = pgEnum("email_visibility", [
  "hidden",
  "direct",
]);

export const currencyCodeEnum = pgEnum("currency_code", ["USD", "EUR", "CAD"]);

// ─── Users / Profiles ───────────────────────────────────────────────────────

export const profiles = pgTable("profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  isAdmin: boolean("is_admin").default(false).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
  phone: text("phone"),
  emailVisibility: emailVisibilityEnum("email_visibility")
    .default("hidden")
    .notNull(),
  // Per-user communication preferences. Drive the locale of outgoing
  // emails, the unit shown on distance labels, and the default currency
  // in the item creation form. All three are user-overridable from the
  // account page; sane defaults so existing rows backfill cleanly.
  preferredLocale: text("preferred_locale").default("en").notNull(),
  distanceUnit: text("distance_unit").default("km").notNull(),
  defaultCurrency: currencyCodeEnum("default_currency")
    .default("USD")
    .notNull(),
  // Approximate location for matching, never exact GPS. Country +
  // postal code is what the user enters; lat/lng are the centroid
  // resolved by Nominatim and stored only for radius queries.
  countryCode: text("country_code"),
  postalCode: text("postal_code"),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  locationUpdatedAt: timestamp("location_updated_at", { withTimezone: true }),
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
  visibility: projectVisibilityEnum("visibility").default("public").notNull(),
  publishStatus: projectPublishStatusEnum("publish_status")
    .default("draft")
    .notNull(),
  reviewerNote: text("reviewer_note"),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  // Project pickup location. The seller picks country + postal code;
  // we resolve to centroid coords for radius queries. radiusKm is
  // optional — NULL means "anyone can see this", otherwise the project
  // is only listed for buyers within that distance from the centroid.
  countryCode: text("country_code"),
  postalCode: text("postal_code"),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  radiusKm: integer("radius_km"),
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
  currency: currencyCodeEnum("currency").default("USD").notNull(),
  notes: text("notes"),
  status: itemStatusEnum("status").default("available").notNull(),
  coverImageUrl: text("cover_image_url"),
  sortOrder: integer("sort_order").default(0).notNull(),
  viewCount: integer("view_count").default(0).notNull(),
  reservedForUserId: uuid("reserved_for_user_id").references(() => profiles.id, {
    onDelete: "set null",
  }),
  soldToUserId: uuid("sold_to_user_id").references(() => profiles.id, {
    onDelete: "set null",
  }),
  reservedAt: timestamp("reserved_at", { withTimezone: true }),
  soldAt: timestamp("sold_at", { withTimezone: true }),
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

export const buyerIntents = pgTable(
  "buyer_intents",
  {
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
    reviewerNote: text("reviewer_note"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    archivedBy: uuid("archived_by").references(() => profiles.id, {
      onDelete: "set null",
    }),
    metadata: jsonb("metadata"), // future extension point
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("buyer_intents_user_status_idx").on(table.userId, table.status),
    index("buyer_intents_project_status_idx").on(
      table.projectId,
      table.status
    ),
  ]
);

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
  // Optional back-reference to the intent that originally created this
  // thread. Lets the seller's intents list deep-link to the existing
  // conversation without re-joining (projectId, buyerId) every time.
  intentId: uuid("intent_id").references(() => buyerIntents.id, {
    onDelete: "set null",
  }),
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
  "reservation_recap",
  "invitation_sent",
  "access_granted",
  "access_declined",
  "access_revoked",
  "access_requested",
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

// ─── Project Invitations ────────────────────────────────────────────────────

export const projectInvitations = pgTable(
  "project_invitations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    code: text("code").notNull().unique(),
    email: text("email"), // null = generic code (one-active-per-project)
    status: invitationStatusEnum("status").default("active").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedByUserId: uuid("used_by_user_id").references(() => profiles.id, {
      onDelete: "set null",
    }),
    usedAt: timestamp("used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("project_invitations_project_status_idx").on(
      table.projectId,
      table.status
    ),
    index("project_invitations_email_project_idx").on(
      table.email,
      table.projectId
    ),
  ]
);

// ─── Project Access Grants ──────────────────────────────────────────────────

export const projectAccessGrants = pgTable(
  "project_access_grants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    source: accessGrantSourceEnum("source").notNull(),
    invitationId: uuid("invitation_id").references(
      () => projectInvitations.id,
      { onDelete: "set null" }
    ),
    grantedAt: timestamp("granted_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokedBy: uuid("revoked_by").references(() => profiles.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    uniqueIndex("project_access_grants_project_user_idx").on(
      table.projectId,
      table.userId
    ),
  ]
);

// ─── Project Access Requests ────────────────────────────────────────────────

export const projectAccessRequests = pgTable(
  "project_access_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    invitationId: uuid("invitation_id").references(
      () => projectInvitations.id,
      { onDelete: "set null" }
    ),
    codeUsed: text("code_used"),
    status: accessRequestStatusEnum("status").default("pending").notNull(),
    message: text("message"),
    respondedBy: uuid("responded_by").references(() => profiles.id, {
      onDelete: "set null",
    }),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("project_access_requests_project_user_status_idx").on(
      table.projectId,
      table.userId,
      table.status
    ),
  ]
);

// ─── Item Share Links ──────────────────────────────────────────────────────

export const itemShareLinks = pgTable(
  "item_share_links",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokedBy: uuid("revoked_by").references(() => profiles.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("item_share_links_project_id_idx").on(table.projectId),
    index("item_share_links_item_id_idx").on(table.itemId),
  ]
);

// ─── Notifications ──────────────────────────────────────────────────────────

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    type: notificationTypeEnum("type").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    linkUrl: text("link_url"),
    projectId: uuid("project_id").references(() => projects.id, {
      onDelete: "cascade",
    }),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("notifications_user_read_idx").on(table.userId, table.readAt),
  ]
);

// ─── Geocoded Locations (cache) ─────────────────────────────────────────────

/**
 * On-disk cache of (country, postal) → (lat, lng, city) results from
 * Nominatim. Avoids re-querying the same code on every project save and
 * keeps us well below Nominatim's 1 req/s policy. A NULL latitude row
 * means "we tried, no match" — caller should re-attempt after the
 * resolved_at TTL (~24h) elapses, otherwise treat as a real miss.
 */
export const geocodedLocations = pgTable(
  "geocoded_locations",
  {
    countryCode: text("country_code").notNull(),
    postalCode: text("postal_code").notNull(),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    city: text("city"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.countryCode, table.postalCode] }),
  ]
);

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
  reservedItems: many(items, { relationName: "reservedItems" }),
  purchasedItems: many(items, { relationName: "purchasedItems" }),
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
  invitations: many(projectInvitations),
  accessGrants: many(projectAccessGrants),
  accessRequests: many(projectAccessRequests),
}));

export const projectInvitationsRelations = relations(
  projectInvitations,
  ({ one }) => ({
    project: one(projects, {
      fields: [projectInvitations.projectId],
      references: [projects.id],
    }),
    usedByUser: one(profiles, {
      fields: [projectInvitations.usedByUserId],
      references: [profiles.id],
    }),
    createdByUser: one(profiles, {
      fields: [projectInvitations.createdBy],
      references: [profiles.id],
    }),
  })
);

export const projectAccessGrantsRelations = relations(
  projectAccessGrants,
  ({ one }) => ({
    project: one(projects, {
      fields: [projectAccessGrants.projectId],
      references: [projects.id],
    }),
    user: one(profiles, {
      fields: [projectAccessGrants.userId],
      references: [profiles.id],
    }),
    invitation: one(projectInvitations, {
      fields: [projectAccessGrants.invitationId],
      references: [projectInvitations.id],
    }),
  })
);

export const projectAccessRequestsRelations = relations(
  projectAccessRequests,
  ({ one }) => ({
    project: one(projects, {
      fields: [projectAccessRequests.projectId],
      references: [projects.id],
    }),
    user: one(profiles, {
      fields: [projectAccessRequests.userId],
      references: [profiles.id],
    }),
    invitation: one(projectInvitations, {
      fields: [projectAccessRequests.invitationId],
      references: [projectInvitations.id],
    }),
  })
);

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(profiles, {
    fields: [notifications.userId],
    references: [profiles.id],
  }),
  project: one(projects, {
    fields: [notifications.projectId],
    references: [projects.id],
  }),
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
  reservedForUser: one(profiles, {
    fields: [items.reservedForUserId],
    references: [profiles.id],
    relationName: "reservedItems",
  }),
  soldToUser: one(profiles, {
    fields: [items.soldToUserId],
    references: [profiles.id],
    relationName: "purchasedItems",
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
    intent: one(buyerIntents, {
      fields: [conversationThreads.intentId],
      references: [buyerIntents.id],
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
