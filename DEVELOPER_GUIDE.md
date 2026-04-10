# SellingMyItems — Developer & Architecture Guide

Complete technical documentation for developers who need to maintain, extend, or fork this project.

> **Copyright © 2026 [Vincent Cruvellier (r45635)](https://github.com/r45635)** — MIT License

---

## Table of Contents

- [Local Development Setup](#local-development-setup)
- [Architecture Overview](#architecture-overview)
- [App Router & Route Groups](#app-router--route-groups)
- [Authentication System](#authentication-system)
- [Database & ORM](#database--orm)
- [Server Actions Pattern](#server-actions-pattern)
- [Image Upload Pipeline](#image-upload-pipeline)
- [Email System](#email-system)
- [Internationalization (i18n)](#internationalization-i18n)
- [Security](#security)
- [Component Architecture](#component-architecture)
- [Feature Module Pattern](#feature-module-pattern)
- [Configuration](#configuration)
- [Testing & Type-checking](#testing--type-checking)
- [Docker & Deployment](#docker--deployment)
- [Extending the Application](#extending-the-application)
- [Troubleshooting](#troubleshooting)
- [Code Conventions](#code-conventions)

---

## Local Development Setup

### Prerequisites

| Requirement | Version |
|---|---|
| Node.js | 22+ |
| npm | 10+ |
| Docker & Docker Compose | Latest |
| PostgreSQL | 16 (via Docker) |

### Quick Start

```bash
# 1. Clone
git clone https://github.com/r45635/SellingMyItems.git
cd SellingMyItems

# 2. Install
npm install

# 3. Start database
docker compose up db -d

# 4. Configure
cp .env.example .env.local  # or create manually:
# DATABASE_URL=postgresql://sellingmyitems:yourpassword@localhost:5432/sellingmyitems

# 5. Push schema to database
npx drizzle-kit push

# 6. Start dev server
npm run dev
```

The dev server uses **Turbopack** for fast rebuilds. Open [http://localhost:3000](http://localhost:3000).

### Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | Yes | — | Full PostgreSQL connection string |
| `POSTGRES_USER` | Docker | — | PostgreSQL user (for Docker Compose) |
| `POSTGRES_PASSWORD` | Docker | — | PostgreSQL password (for Docker Compose) |
| `POSTGRES_DB` | Docker | — | PostgreSQL database name |
| `APP_PORT` | No | `5050` | Host port for the app container |
| `NEXT_PUBLIC_APP_URL` | No | `http://localhost:3000` | Public URL (used in emails and metadata) |
| `RESEND_API_KEY` | No | — | Resend.com API key for email sending |
| `RESEND_FROM_EMAIL` | No | `SellingMyItems <onboarding@resend.dev>` | Sender email address — **must use a verified domain** on Resend to send to all recipients |
| `NODE_ENV` | No | `development` | `production` in Docker |

---

## Architecture Overview

### Technology Choices

```
Next.js 16 (App Router)          ← Server components by default, Server Actions for mutations
  ├── React 19 Server Components ← Zero client JS for data-fetching pages  
  ├── React 19 Client Components ← Interactive forms, carousels, real-time features
  ├── Server Actions             ← All mutations go through "use server" actions
  ├── Drizzle ORM                ← Type-safe SQL queries via postgres-js driver
  ├── bcryptjs                   ← Password hashing (no external auth provider)
  ├── next-intl                  ← Locale routing + message-based translations
  ├── sharp                      ← Image processing (resize, format, EXIF strip)
  ├── Resend                     ← Transactional email with DB logging
  └── Tailwind + shadcn/ui      ← Utility-first CSS with accessible components
```

### Request Flow

```
Browser → Caddy (HTTPS termination) → Next.js standalone server (:3000)
                                           ├── Static assets (/_next/static)
                                           ├── Server Components (RSC payload)
                                           ├── Server Actions (POST to action endpoint)
                                           └── API routes (/api/upload, /api/uploads/*)
                                                    │
                                                    ▼
                                              PostgreSQL 16
```

### Key Principles

1. **Server-first**: pages are Server Components by default. Client Components are used only for interactivity (forms, carousels, real-time updates).
2. **Feature modules**: domain logic lives in `src/features/`, not scattered in page files.
3. **Server Actions for mutations**: all data writes go through `"use server"` functions in `actions.ts` files.
4. **No external auth**: authentication is fully self-hosted with bcrypt + PostgreSQL sessions.
5. **Local storage**: uploaded files are stored on the server filesystem, not cloud storage.

---

## App Router & Route Groups

### Layout Hierarchy

```
src/app/
├── layout.tsx                  # Root: <html>, <body>, fonts
├── globals.css                 # Tailwind imports + custom styles
└── [locale]/                   # Dynamic locale segment (en/fr)
    ├── layout.tsx              # Locale provider (NextIntlClientProvider), Header, Footer
    ├── (public)/               # No auth required
    │   ├── page.tsx            # Homepage
    │   ├── login/page.tsx
    │   ├── signup/page.tsx
    │   ├── forgot-password/page.tsx
    │   ├── reset-password/page.tsx
    │   └── project/[slug]/
    │       ├── page.tsx        # Project detail
    │       └── item/[itemId]/page.tsx
    ├── (authenticated)/        # requireUser() guard
    │   ├── account/page.tsx
    │   ├── wishlist/page.tsx
    │   ├── reservations/page.tsx
    │   ├── purchases/page.tsx
    │   └── messages/
    │       ├── page.tsx
    │       └── [threadId]/page.tsx
    ├── (seller)/               # requireSeller() guard
    │   ├── seller/
    │   │   ├── page.tsx        # Dashboard
    │   │   ├── projects/
    │   │   ├── intents/page.tsx
    │   │   ├── messages/
    │   │   └── settings/page.tsx
    └── (admin)/                # requireAdmin() guard
        └── admin/
            ├── page.tsx        # Overview
            ├── accounts/page.tsx
            ├── projects/page.tsx
            └── emails/page.tsx
```

### Route Group Guards

Each route group (except `public`) applies an auth guard in its pages:

```typescript
// (authenticated) pages call:
const user = await requireUser();  // Redirects to /login if not authenticated

// (seller) pages call:
const user = await requireSeller(); // Requires seller or admin role

// (admin) pages call:
const user = await requireAdmin();  // Requires admin role
```

These guards are called at the **top of each page component** (not in layouts or middleware), ensuring server-side redirect before any rendering.

### Middleware

`src/middleware.ts` handles next-intl locale detection and routing. It runs on every request and:
1. Detects the user's preferred locale
2. Rewrites/redirects to include the locale prefix (`/en/`, `/fr/`)

---

## Authentication System

### Session Architecture

```
Sign Up/In → bcrypt hash/compare → Create session in DB → Set httpOnly cookie
                                          │
                                    sessions table
                                    (token, userId, expiresAt)
                                          │
                                    Cookie: session_token
                                    (httpOnly, sameSite: lax, secure in prod)
```

### Key Files

| File | Responsibility |
|---|---|
| `src/lib/auth/index.ts` | `getUser()`, `requireUser()`, `requireSeller()`, `requireAdmin()`, session CRUD |
| `src/lib/auth/actions.ts` | `signUpAction()`, `signInAction()`, `signOutAction()`, `forgotPasswordAction()`, `resetPasswordAction()` |

### Session Management

```typescript
// getUser() — returns null if not authenticated
export async function getUser(): Promise<{id: string; email: string; role: string} | null> {
  // 1. Read session_token cookie
  // 2. Query sessions table (JOIN profiles)
  // 3. Check session not expired
  // 4. Return user data or null
}

// requireUser() — redirects if not authenticated
export async function requireUser() {
  const user = await getUser();
  if (!user) redirect('/login');
  return user;
}
```

Sessions expire after **30 days**. A new session token is generated with `crypto.randomBytes(32).toString('hex')`.

### Password Hashing

- **Algorithm**: bcrypt via `bcryptjs` (pure JS implementation)
- **Salt rounds**: 12
- **No plaintext storage**: passwords are only ever stored as bcrypt hashes

### Password Reset Flow

1. `forgotPasswordAction()` → rate limit check → find user → create token (`crypto.randomBytes(32)`, 1h TTL) → send email
2. User clicks link → `resetPasswordAction()` → validate token → hash new password → update profile → mark token used

---

## Database & ORM

### Connection

```typescript
// src/db/index.ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const client = postgres(process.env.DATABASE_URL!);
export const db = drizzle(client, { schema });
```

### Schema Location

All schema definitions are in `src/db/schema/index.ts`. This is a single large file containing:
- 6 enum definitions (pgEnum)
- 17 table definitions (pgTable)
- Full relation definitions (for Drizzle relational queries)

### Schema Conventions

```typescript
// Every table uses UUID primary keys
id: uuid('id').defaultRandom().primaryKey(),

// Timestamps
createdAt: timestamp('created_at').defaultNow().notNull(),
updatedAt: timestamp('updated_at').defaultNow().notNull(),

// Soft deletes where applicable
deletedAt: timestamp('deleted_at'),

// Foreign keys with onDelete behavior
userId: uuid('user_id').references(() => profiles.id, { onDelete: 'cascade' }).notNull(),
```

### Migrations

Migrations are SQL files in `src/db/migrations/` and are **applied manually** on the production database.

**Creating a migration:**

```bash
# 1. Modify the schema in src/db/schema/index.ts
# 2. Generate the SQL migration
npx drizzle-kit generate

# 3. Review the generated SQL
cat src/db/migrations/XXXX_name.sql

# 4. Apply to production
docker exec -i sellingmyitems-db-1 psql -U sellingmyitems -d sellingmyitems < src/db/migrations/XXXX_name.sql
```

**For local development**, you can skip migrations and push schema directly:

```bash
npx drizzle-kit push
```

### Query Patterns

```typescript
// Simple query with Drizzle query builder
const items = await db.query.items.findMany({
  where: and(
    eq(items.projectId, projectId),
    isNull(items.deletedAt)
  ),
  with: {
    images: true,
    links: true,
  },
  orderBy: [desc(items.createdAt)],
});

// Aggregation with raw SQL builder
const stats = await db
  .select({
    status: items.status,
    count: count(),
  })
  .from(items)
  .where(isNull(items.deletedAt))
  .groupBy(items.status);

// LEFT JOIN for buyer email lookup
const itemsWithBuyer = await db
  .select({
    ...getTableColumns(items),
    reservedForEmail: reservedProfile.email,
    soldToEmail: soldProfile.email,
  })
  .from(items)
  .leftJoin(reservedProfile, eq(items.reservedForUserId, reservedProfile.id))
  .leftJoin(soldProfile, eq(items.soldToUserId, soldProfile.id));
```

---

## Server Actions Pattern

All mutations follow a consistent pattern:

```typescript
// src/features/items/actions.ts
"use server";

import { requireSeller } from "@/lib/auth";
import { db } from "@/db";
import { items } from "@/db/schema";
import { revalidatePath } from "next/cache";

export async function createItemAction(formData: FormData) {
  // 1. Auth check
  const user = await requireSeller();

  // 2. Parse & validate input
  const title = formData.get("title") as string;
  // ... Zod validation ...

  // 3. Authorization (verify ownership)
  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.sellerId, user.id)),
  });
  if (!project) throw new Error("Unauthorized");

  // 4. Database operation
  const [newItem] = await db.insert(items).values({ ... }).returning();

  // 5. Revalidate affected paths
  revalidatePath(`/seller/projects/${projectId}/items`);

  // 6. Return result or redirect
  redirect(`/seller/projects/${projectId}/items`);
}
```

### Key Action Files

| File | Actions |
|---|---|
| `src/lib/auth/actions.ts` | signUp, signIn, signOut, forgotPassword, resetPassword |
| `src/features/items/actions.ts` | createItem, updateItem, updateItemStatus, deleteItem, linkReservationToBuyer, markItemSold, searchBuyers |
| `src/features/projects/actions.ts` | createProject, updateProject, deleteProject |
| `src/features/wishlist/actions.ts` | addWishlistItem, removeWishlistItem |
| `src/features/intents/actions.ts` | submitIntent, updateIntentStatus, reserveItemsFromIntent |
| `src/features/messages/actions.ts` | sendMessage, notifyRecipient, sendCopyToSender |
| `src/features/admin-dashboard/actions.ts` | toggleProfileActive, toggleProjectPublic, updateResendApiKey |

---

## Image Upload Pipeline

### Flow

```
Client (ImageUpload component)
  ├── Drag & drop or file picker
  ├── Client-side preview (FileReader)
  └── POST /api/upload (multipart/form-data)
        │
        ▼
API Route (src/app/api/upload/route.ts)
  ├── Auth check (requireUser)
  ├── Rate limit (20/5min per user)
  ├── File type validation (JPEG, PNG, WebP, GIF, AVIF)
  ├── File size check (max 20MB per file, 8 files per request)
  ├── Process each file with sharp:
  │   ├── Auto-rotate (EXIF orientation)
  │   ├── Resize to max 1920px (preserving aspect ratio)
  │   ├── Convert to WebP (quality 75)
  │   └── Strip all EXIF metadata
  ├── Generate unique filename (UUID + .webp)
  ├── Save to /app/public/uploads/
  └── Return JSON { urls: ["/uploads/xxx.webp", ...] }
```

### File Serving

```
GET /api/uploads/[...path]
  ├── Path traversal protection (reject ../)
  ├── Resolve to /app/public/uploads/{path}
  ├── Check file exists
  ├── Set headers:
  │   ├── Content-Type (from file extension)
  │   ├── Cache-Control: public, max-age=31536000, immutable
  │   └── Content-Length
  └── Stream file response
```

### Docker Volume

In production, uploads persist across container recreations via a Docker named volume:

```yaml
# docker-compose.yml
volumes:
  - uploads:/app/public/uploads
```

---

## Email System

### Architecture

```typescript
// src/lib/email.ts
import { Resend } from 'resend';

// FROM_EMAIL resolution:
// 1. Check app_settings key "resend_from_email" (cached 5 minutes in-memory)
// 2. Fall back to RESEND_FROM_EMAIL env var
// 3. Fall back to "SellingMyItems <onboarding@resend.dev>"
// IMPORTANT: The sandbox address only sends to the Resend account owner.
// A verified domain (resend.com/domains) is required for production use.

// API key resolution:
// 1. Check app_settings table (cached 5 minutes in-memory)
// 2. Fall back to RESEND_API_KEY environment variable
async function getResendClient(): Promise<Resend | null> { ... }

// All emails go through a central send function that:
// 1. Gets the Resend client
// 2. Sends the email
// 3. Logs to email_logs table (success or failure)
```

### Email Types

| Function | Email Type | When Sent |
|---|---|---|
| `sendWelcomeEmail()` | `welcome` | After successful signup |
| `notifyRecipient()` | `message_notification` | New message received (throttled 1/5min per recipient) |
| `sendCopyToSender()` | `message_copy` | Sender requests a copy |
| `sendIntentReceivedEmail()` | `intent_received` | Buyer submits purchase intent → seller |
| `sendIntentStatusEmail()` | `intent_status` | Seller changes intent status → buyer |
| `sendPasswordResetEmail()` | `password_reset` | Forgot password request |

### Localization

All email templates check the current locale and render content in the appropriate language (English/French). HTML templates are inline in `src/lib/email.ts` with branded styling.

### Throttling

Message notifications use an in-memory `Map<email, timestamp>` to prevent flooding. Only 1 notification email per 5 minutes per recipient, regardless of how many messages are sent.

---

## Internationalization (i18n)

### Setup

```
src/i18n/
├── routing.ts          # Defines locales: ['en', 'fr'], defaultLocale: 'en'
├── request.ts          # Server-side getRequestConfig() for next-intl
├── navigation.ts       # Typed Link, redirect, usePathname, useRouter
└── messages/
    ├── en.json         # ~500+ keys, nested by feature
    └── fr.json         # Complete French translations
```

### Usage in Server Components

```typescript
import { getTranslations } from 'next-intl/server';

export default async function Page() {
  const t = await getTranslations('item');
  return <h1>{t('title')}</h1>;
}
```

### Usage in Client Components

```typescript
'use client';
import { useTranslations } from 'next-intl';

export function ItemCard() {
  const t = useTranslations('item');
  return <span>{t('status.reserved')}</span>;
}
```

### Message Structure

```json
{
  "common": { "loading": "...", "save": "...", "cancel": "..." },
  "nav": { "home": "...", "wishlist": "...", "messages": "..." },
  "auth": { "signIn": "...", "signUp": "..." },
  "project": { "title": "...", "create": "..." },
  "item": { "status": { "available": "...", "reserved": "..." } },
  "seller": { "dashboard": "...", "items": "..." },
  "intent": { "submit": "...", "status": "..." },
  "messages": { "send": "...", "unread": "..." },
  "reservations": { "title": "...", "reservedOn": "..." },
  "purchases": { "title": "...", "soldOn": "..." },
  "validation": { "required": "...", "minLength": "..." }
}
```

---

## Security

### Rate Limiting

```typescript
// src/lib/security/rate-limit.ts
// In-memory Map-based rate limiter (single-node only)

class RateLimiter {
  private attempts: Map<string, { count: number; resetAt: number }>;
  
  check(key: string, limit: number, windowMs: number): boolean { ... }
}
```

**Important**: This rate limiter uses an in-memory `Map`. It resets on server restart and doesn't work across multiple instances. For production scaling, replace with Redis-based rate limiting.

### Input Validation

All form inputs are validated server-side with **Zod** schemas defined in `src/lib/validations.ts`:

```typescript
export const signUpSchema = z.object({
  email: z.email(),
  password: z.string().min(6),
  confirmPassword: z.string().min(6),
}).refine(data => data.password === data.confirmPassword);

export const createItemSchema = z.object({
  title: z.string().min(1).max(200),
  price: z.number().min(0),
  // ...
});
```

### Upload Security

- **MIME type validation**: only image/* types
- **Extension whitelist**: `.jpg`, `.jpeg`, `.png`, `.webp`, `.gif`, `.avif`
- **Size limits**: 20MB per file, 8 files per request
- **Path traversal**: file serving rejects paths containing `..`
- **EXIF stripping**: sharp removes all metadata (prevents location data leaks)

### Cookie Security

```typescript
cookies().set('session_token', token, {
  httpOnly: true,       // Not accessible via JavaScript
  sameSite: 'lax',      // CSRF protection
  secure: process.env.NODE_ENV === 'production',
  maxAge: 30 * 24 * 60 * 60, // 30 days
  path: '/',
});
```

### Authorization

Every server action validates:
1. **Authentication**: user is logged in
2. **Role**: user has the required role (purchaser/seller/admin)
3. **Ownership**: user owns the resource they're modifying (e.g., seller owns the project)

---

## Component Architecture

### Layer Structure

```
src/components/
├── ui/           # shadcn/ui primitives — button, card, dialog, input, etc.
│                 # Generated by shadcn CLI, rarely modified manually
├── layout/       # App-level layout components
│   ├── header.tsx           # Top nav with logo, links, user menu, language switcher
│   ├── footer.tsx           # Build info, copyright
│   ├── user-nav.tsx         # Authenticated user dropdown menu
│   └── language-switcher.tsx # EN/FR toggle
└── shared/       # Reusable domain components
    ├── item-teaser-card.tsx        # Item card for grids (thumbnail, title, price, badge)
    ├── item-detail-card.tsx        # Full item view with gallery, details, actions
    ├── image-carousel.tsx          # Image gallery with navigation
    ├── image-upload.tsx            # Multi-image upload with drag-to-reorder
    ├── wishlist-heart-button.tsx   # Toggle wishlist button (client component)
    ├── smi-logo.tsx                # Brand logo SVG
    ├── build-info.tsx              # Build hash + timestamp badge
    └── localized-date-time.tsx     # Locale-aware date/time formatting
```

### Feature Components

Feature-specific components live in `src/features/*/components/`:

```
src/features/
├── items/components/
│   ├── item-form.tsx               # Create/edit item form (client component)
│   ├── item-status-select.tsx      # Inline status dropdown
│   ├── link-buyer-form.tsx         # Search + link buyer to reserved item
│   └── ...
├── projects/components/
│   ├── project-form.tsx            # Create/edit project form
│   └── ...
├── intents/components/
│   ├── intent-list.tsx             # Intent cards with accept/decline
│   ├── reserve-items-form.tsx      # Select items to reserve from intent
│   └── ...
├── seller-dashboard/components/
│   └── seller-sidebar.tsx          # Navigation sidebar for seller routes
└── admin-dashboard/components/
    └── admin-sidebar.tsx           # Navigation sidebar for admin routes
```

---

## Feature Module Pattern

Each feature follows this structure:

```
src/features/{feature}/
├── actions.ts         # Server Actions ("use server")
└── components/        # React components used by pages in this feature
```

Pages import from features:

```typescript
// src/app/[locale]/(seller)/seller/projects/[id]/items/page.tsx
import { getItemsForProject } from "@/features/items/actions";
import { ItemStatusSelect } from "@/features/items/components/item-status-select";
```

---

## Configuration

### App Config

```typescript
// src/config/index.ts
export const siteConfig = {
  name: "SellingMyItems",
  // ... other config
};
```

### Next.js Config

```typescript
// next.config.ts
const nextConfig = {
  output: "standalone",  // For Docker deployment
  // Build-time environment injection for build info
  env: {
    BUILD_ID: process.env.BUILD_ID || 'dev',
    BUILD_TIME: new Date().toISOString(),
  },
};
```

### Drizzle Config

```typescript
// drizzle.config.ts
export default defineConfig({
  schema: './src/db/schema/index.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

---

## Testing & Type-checking

### Type-checking

```bash
npx tsc --noEmit  # Full type-check without emitting files
```

### Linting

```bash
npm run lint  # ESLint with next.js recommended rules
```

### No Test Framework (Yet)

The project does not currently include a test framework. Adding one is tracked in the roadmap. Recommended: **Vitest** + **React Testing Library** for unit/integration tests, **Playwright** for E2E.

---

## Docker & Deployment

### Dockerfile (3-stage build)

```dockerfile
# Stage 1: Dependencies
FROM node:22-alpine AS deps
COPY package*.json ./
RUN npm ci

# Stage 2: Build
FROM node:22-alpine AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Stage 3: Runner (minimal)
FROM node:22-alpine AS runner
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
```

### Docker Compose

```yaml
services:
  app:
    build: .
    container_name: sellingmyitems-app
    ports:
      - "${APP_PORT:-5050}:3000"
    environment:
      - DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}
    volumes:
      - uploads:/app/public/uploads
    depends_on:
      - db
    networks:
      - default
      - shared-proxy

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  uploads:
  pgdata:

networks:
  shared-proxy:
    external: true
```

### GitHub Actions Deploy

On push to `main`, `.github/workflows/deploy.yml` runs:

1. SSH into VPS
2. Prune old Docker images (disk hygiene)
3. Check disk space (abort if < 1GB)
4. Ensure `shared-proxy` network exists
5. `git pull origin main`
6. `docker compose build --no-cache`
7. `docker compose up -d --force-recreate --remove-orphans`
8. Health check (`curl localhost:5050`)
9. Post-deploy cleanup

### Caddy Reverse Proxy

Caddy runs in a separate Docker Compose at `/opt/trystbrief/` and shares the `shared-proxy` network. It terminates HTTPS and proxies to `sellingmyitems-app:3000`.

---

## Extending the Application

### Adding a New Feature

1. **Schema**: Add tables/columns in `src/db/schema/index.ts`
2. **Migration**: `npx drizzle-kit generate` → review SQL → apply on VPS
3. **Actions**: Create `src/features/{feature}/actions.ts` with `"use server"` functions
4. **Components**: Create `src/features/{feature}/components/` for UI
5. **Pages**: Add pages in the appropriate route group under `src/app/[locale]/`
6. **i18n**: Add translation keys to both `en.json` and `fr.json`
7. **Navigation**: Update header/sidebar if needed

### Adding a New Role

1. Add value to `user_role` enum in schema: `ALTER TYPE "user_role" ADD VALUE 'newrole';`
2. Create a guard function in `src/lib/auth/index.ts` (follow `requireSeller` pattern)
3. Create a route group `(newrole)` under `src/app/[locale]/`
4. Update middleware and navigation as needed

### Adding a New Email Type

1. Add value to `email_type` enum in schema
2. Create a send function in `src/lib/email.ts` following existing patterns
3. Add HTML template (inline, with locale support)
4. Call from the appropriate server action
5. The email is automatically logged to `email_logs`

### Adding a New Locale

1. Add locale code to `src/i18n/routing.ts`
2. Create message file `src/i18n/messages/{locale}.json` (copy `en.json` as template)
3. Translate all keys
4. Update email templates in `src/lib/email.ts` to handle the new locale

---

## Troubleshooting

### Common Issues

| Issue | Solution |
|---|---|
| App can't connect to DB | Check `DATABASE_URL` env var. In Docker, use `db` as hostname. |
| Uploads not persisting | Ensure Docker volume `uploads` is mounted at `/app/public/uploads` |
| 502 after deploy | Check `shared-proxy` network exists and Caddy config references `sellingmyitems-app:3000` |
| Emails not sending | Check Resend API key in admin dashboard or env var. Check `/admin/emails` for failures. Verify `RESEND_FROM_EMAIL` uses a verified domain — the sandbox `onboarding@resend.dev` only delivers to the account owner. |
| Rate limit errors | In-memory rate limiter resets on restart. Wait for the window to expire. |
| Migrations fail | Check order-sensitive enum additions. Use `IF NOT EXISTS` for safety. |
| Auth cookie not set | Check `secure` flag — only set in production. Use `http://localhost:3000` for dev. |

### Useful Commands

```bash
# Check container logs
docker logs sellingmyitems-app --tail 100

# Connect to database
docker exec -it sellingmyitems-db-1 psql -U sellingmyitems -d sellingmyitems

# List all sessions
docker exec sellingmyitems-db-1 psql -U sellingmyitems -d sellingmyitems \
  -c "SELECT token, user_id, expires_at FROM sessions ORDER BY expires_at DESC LIMIT 10;"

# Count items by status
docker exec sellingmyitems-db-1 psql -U sellingmyitems -d sellingmyitems \
  -c "SELECT status, COUNT(*) FROM items WHERE deleted_at IS NULL GROUP BY status;"

# Check disk usage
docker system df

# Full cleanup (CAUTION: removes unused images)
docker system prune -af
```

---

## Code Conventions

| Convention | Detail |
|---|---|
| **File naming** | kebab-case for files (`item-form.tsx`), PascalCase for components |
| **Exports** | Named exports preferred over defaults |
| **Server Actions** | `"use server"` at top of file, function name ends with `Action` |
| **Validation** | Zod schemas in `src/lib/validations.ts`, validated in actions |
| **Error handling** | Actions return `{ error: string }` for client-handled errors, throw for auth failures |
| **i18n keys** | Dot-notation nested by feature: `item.status.reserved` |
| **Database** | snake_case columns, UUID primary keys, soft deletes via `deletedAt` |
| **Imports** | `@/` alias for `src/` directory |
| **Styling** | Tailwind utilities + `cn()` helper for conditional classes |
| **Components** | `"use client"` only when needed (forms, event handlers, hooks) |