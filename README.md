# SellingMyItems

A responsive cross-device marketplace for publishing items for sale, connecting buyers and sellers through project-based listings. Transactions happen offline/in person — the app handles publishing, discovery, wishlists, purchase intents, reservations, and messaging.

**Live**: [https://sellingmyitems.toprecipes.best:5055](https://sellingmyitems.toprecipes.best:5055)

> **Copyright © 2026 [Vincent Cruvellier (r45635)](https://github.com/r45635)** — Licensed under [MIT](LICENSE)

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Features](#features)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Route Map](#route-map)
- [Database Schema](#database-schema)
- [Authentication & Security](#authentication--security)
- [Email System](#email-system)
- [Internationalization](#internationalization)
- [Deployment](#deployment)
- [Scripts](#scripts)
- [Key Design Decisions](#key-design-decisions)
- [Further Documentation](#further-documentation)
- [License](#license)

---

## Overview

SellingMyItems is a marketplace platform where users publish items organized into **projects** (e.g. "Moving Sale — Harrison") and others browse, wishlist, express purchase intents, and communicate with sellers. The actual transaction (payment, pickup) happens offline.

There is no static role enum — capabilities are derived from data:

| Capability | Access | How it's granted |
|---|---|---|
| **Buyer** | Browse, wishlist, intents, messaging, reservations, purchases | Any signed-in user |
| **Seller** | Buyer capabilities + full CRUD on owned projects/items, manage intents | Existence of an active row in `seller_accounts` — lazily minted on first project creation. Public visibility is gated by admin approval of the project's `publish_status`. |
| **Admin** | All of the above + platform statistics, account management, project review, email monitoring | `profiles.is_admin = true` set manually via SQL |

A user can hold multiple capabilities simultaneously (e.g. a seller is also a buyer on someone else's project). The header **context switcher** lets multi-capability users hop between environments.

---

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| **Framework** | Next.js (App Router, Turbopack, `output: "standalone"`) | 16.2.2 |
| **Runtime** | Node.js | 22 |
| **Language** | TypeScript (strict) | 5.x |
| **UI** | React + Tailwind CSS + shadcn/ui | React 19.2.4 |
| **Database** | PostgreSQL Alpine (Docker) | 16 |
| **ORM** | Drizzle ORM (`postgres-js` driver) | 0.45.2 |
| **Auth** | Self-hosted bcryptjs + PostgreSQL sessions | bcryptjs 3.0.3 |
| **Image processing** | sharp (WebP conversion, resize, EXIF strip) | 0.34.5 |
| **Storage** | Local filesystem (`/app/public/uploads`) | — |
| **i18n** | next-intl (English + French) | 4.9.0 |
| **Validation** | Zod + React Hook Form | Zod 4.3.6 |
| **Email** | Resend (transactional, API key managed via admin UI) | 6.10.0 |
| **Deploy** | Docker multi-stage build + Caddy 2 reverse proxy on VPS | — |
| **CI/CD** | GitHub Actions (SSH-based auto-deploy on push to main) | — |

---

## Features

### Buyer

- **Browse projects** — public homepage with search, project cards (price range, available/total counts, location, distance away)
- **Radius search** — chip row "5 / 10 / 25 / 50 / 100 / Anywhere" above the project grid for users with a saved location; each card shows "X km away" or "X mi away" depending on the user's distance unit preference
- **View items** — authenticated users see full item details, photos (4:3 carousel), prices, links; mobile floating "Send a message" FAB on project pages
- **Guest preview** — unauthenticated users see blurred item grids with sign-in CTA
- **Wishlist** — save items across projects, view selection summary with pricing/savings, remove items, optimistic toggle from item detail page
- **Purchase intents** — submit a purchase intent for wishlisted items in a project (phone, contact method, pickup notes)
- **My intents (`/my-intents`)** — dedicated buyer hub showing all sent intents with status, reviewer notes, cancel-pending, archive-finalized, and re-send-from-project actions
- **Intent limits** — max 1 active intent per buyer per project; once cancelled / declined, buyer can re-submit
- **Reservations** — view items reserved for you (auto-linked from accepted intents); per-project "Contact seller" CTA
- **Purchases** — view purchase history (items sold to you), grouped by project
- **Messaging** — unified `/messages` inbox showing both buyer-side and seller-side threads with side pills, status filter tabs, and a global unread badge; modern chat UI with avatars and emerald send button
- **Account** — edit display name + phone (validated against the country's E.164 dial-in prefix), change password (with optional sign-out of other devices), email visibility toggle, and **communication preferences** (preferred locale for emails, distance unit, default selling currency) and **location** (country + postal code resolved to city centroid via Nominatim — no precise GPS stored)
- **Password management** — forgot password (1h token), reset, change-from-account; password reset invalidates all sessions

### Seller (now open to every signed-in user)

> Selling isn't gated by a separate role anymore. Any signed-in account can hit `/seller` and create a project; the `seller_accounts` row is lazily minted on first project creation. Public visibility is gated by an admin approval workflow instead.

- **Project management** — create/edit/soft-delete projects (name, slug, city/area, description, visibility public/invitation-only, country + postal code for radius matching, optional `radius_km` to restrict visibility to nearby buyers)
- **Publication workflow** — every project starts as `draft`; user submits for review → `pending` → admin **Approve** / **Reject (with reason)** → `approved` (live) or `rejected` (with reviewer note shown back to the seller)
- **Category management** — custom categories per project with sort order; chip-row filter on the public project page
- **Item management** — full CRUD: title, brand, description, condition (6 levels), age, price, original price, currency (`USD/EUR/CAD` enum, defaulted from the seller's profile preference), notes, status, cover image
- **Purchase intent inbox** — `/seller/intents` with Active / Archived tabs, status filter chips, per-thread "Message buyer" deep-link, "Decline with note" inline composer, item-level reserve subset
- **Multi-image upload** — up to 10 images per item, drag-reorder, auto-convert to WebP
- **External links** — reference URLs per item (rendered in the PDF recap too)
- **Status management** — inline status select: available → pending → reserved → sold → hidden
- **Purchase intents** — view, accept/decline buyer intents with item-level detail
- **Reserve from intents** — select specific items to reserve for a buyer from their intent
- **Manual buyer linking** — search buyers by email to link reservation or mark item as sold with buyer traceability
- **Sold with traceability** — when marking a reserved item as sold, the reserved buyer is auto-carried to sold-to
- **Reservation recap** — send a recap email to a specific buyer; the recap is also posted as a regular seller message into the in-app conversation thread; optional PDF attachment
- **PDF export** — checkbox-select items on the items page (or quick "All / Reserved only" filters), then **Download** or **Email PDF** to any address. Cover page + per-item page (image, gallery 2-up, attributes, description, links). Uses `@react-pdf/renderer` server-side; WebP uploads are normalized to PNG via sharp before embedding.
- **Messaging** — reply to buyer threads, email notifications (throttled 5 min)
- **Dashboard** — listed-value stat with **per-currency breakdown** (USD/EUR/CAD totals shown side-by-side instead of an arbitrary single currency), 6 stat cards (listed value / items / views / wishlisted / intents / conversations), per-project health bar (proportional segments for available/pending/reserved/sold)
- **View tracking** — see how many views each item has received

### Admin

- **Platform overview** — stats cards: total users, projects, items by status, total value by currency, intents, conversation threads
- **Account management** — list all profiles, toggle active/inactive (admin accounts protected)
- **Project moderation** — `/admin/projects` re-sorted with pending → rejected → draft → approved (newest first within group); pending count chip; **Approve** / **Reject (with reviewer note ≤ 500 chars)** controls; emergency Unpublish/Republish for already-approved projects
- **Email dashboard** — today's email stats by type, failure monitoring, 30-day daily breakdown chart, last 50 email logs, Resend API key management
- **Secret access** — admin pages at `/admin` with no navigation link

### Cross-cutting

- **Responsive design** — optimized for phone, tablet, and desktop; mobile bottom nav with 5 colour-coded tabs (Home / Wishlist / Messages / My listings / Account); shared `NavIconBadge` system across menus, dropdown, sidebars
- **Visual identity** — Syne (display) + DM Sans (body) Google Fonts via next/font; oklch-based color tokens; subtle dotted backdrop pattern; per-section colour palette (orange / rose / emerald / sky / violet / amber / indigo / red)
- **Email privacy** — per-user `email_visibility` (hidden default / direct) masks real addresses across public + seller surfaces; "Contact seller" routes through in-app messaging
- **i18n** — full English and French translations. Outgoing emails are sent in the **recipient's** preferred locale (`profiles.preferred_locale`) — not the sender's URL locale — so a French buyer always gets French emails even when an English-speaking seller triggers them.
- **Multi-currency** — USD, EUR, CAD as a proper DB enum. Each item is priced in the seller's chosen currency; buyers see prices unchanged (no conversion). Aggregations (seller dashboard, PDF recap) group by currency rather than picking arbitrarily.
- **Geographic matching** — buyers and sellers store an approximate location (country + postal code resolved to city centroid via Nominatim/OSM, cached in `geocoded_locations`). Powers the homepage "Near me" radius filter and the optional seller-side `radius_km` restriction. `cube` + `earthdistance` postgres extensions handle the haversine queries with a GiST index on project coords.
- **Dark mode** — system-preference-based theming, orange accent preserved in dark
- **Image optimization** — auto-resize to 1920px max, WebP conversion, quality 75, EXIF stripping
- **Rate limiting** — in-memory rate limiting on auth actions (sign up/in/forgot/reset/change), uploads, messages, intents; Nominatim geocoding gated to 1 req/s globally per Node process
- **Email notifications** — welcome, message notification (throttled 1/5min), intent received, intent status change, message copy, password reset, reservation recap, project invitation/access events
- **Auto migrations on deploy** — `scripts/run-migrations.sh` applies any new `src/db/migrations/*.sql` between `docker compose up` and the `/api/health` curl, with a `_applied_migrations` tracking table so re-runs are no-ops

---

## Architecture

### High-level

```
┌─────────────┐    HTTPS    ┌─────────────┐    HTTP     ┌──────────────────────┐
│   Browser   │ ──────────► │  Caddy 2    │ ──────────► │  Next.js App (:3000) │
│  (any device)│            │  (reverse   │             │  (Docker container)  │
└─────────────┘             │   proxy)    │             └──────────┬───────────┘
                            └─────────────┘                        │
                                                                   │ postgres-js
                                                                   ▼
                                                          ┌────────────────────┐
                                                          │  PostgreSQL 16     │
                                                          │  (Docker container)│
                                                          └────────────────────┘
```

All services run in Docker on a single VPS, connected via the `shared-proxy` Docker network.

### Route Groups & Guards

| Group | Guard middleware | Purpose |
|---|---|---|
| `(public)` | None | Homepage, login, signup, project/item pages, password reset |
| `(authenticated)` | `requireUser()` | Account, wishlist, messages, reservations, purchases |
| `(seller)` | `requireSeller()` (alias of `requireUser()`) | Listings area — open to every signed-in user; `seller_accounts` row is auto-created on first project creation |
| `(admin)` | `requireAdmin()` | Admin dashboard (secret — no nav link) |

### Data Flow: Purchase Lifecycle

```
1. Buyer browses projects → views items (must be logged in)
2. Buyer wishlists items → builds selection per project
3. Buyer submits purchase intent (phone, pickup notes, contact method)
4. Seller receives intent (in-app + email notification)
5. Seller accepts → reserves items for buyer (auto or selective)
6. Items show "Reserved for you" to the linked buyer
7. Seller marks items as sold → buyer auto-linked, appears in purchase history
8. Throughout: buyer ↔ seller can exchange messages per project
```

---

## Getting Started

### Prerequisites

- **Node.js** 22+ and **npm**
- **Docker** & **Docker Compose** (for database and production)

### 1. Clone and install

```bash
git clone https://github.com/r45635/SellingMyItems.git
cd SellingMyItems
npm install
```

### 2. Configure environment

**For local development** — create `.env.local`:

```env
DATABASE_URL=postgresql://sellingmyitems:yourpassword@localhost:5432/sellingmyitems
```

**For Docker production** — create `.env`:

```env
POSTGRES_USER=sellingmyitems
POSTGRES_PASSWORD=<strong-password>
POSTGRES_DB=sellingmyitems
APP_PORT=5050
NEXT_PUBLIC_APP_URL=https://yourdomain.com
RESEND_API_KEY=re_your_key_here              # Required: for email sending
RESEND_FROM_EMAIL=YourApp <noreply@yourdomain.com>  # Required: verified domain sender
```

### 3. Database setup

**Local development** — start PostgreSQL via Docker, then push schema:

```bash
docker compose up db -d
npx drizzle-kit push
```

**Production** — migrations in `src/db/migrations/` are applied manually:

```bash
# Copy migration SQL into the running container and execute
docker exec -i sellingmyitems-db-1 psql -U sellingmyitems -d sellingmyitems < src/db/migrations/0013_add-item-reservation-sold-tracking.sql
```

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 5. Grant admin

Buying and selling are both available to any signed-in user — selling unlocks automatically the first time they submit a project. The only capability you grant manually is **admin**:

```bash
docker exec sellingmyitems-db-1 psql -U sellingmyitems -d sellingmyitems \
  -c "UPDATE profiles SET is_admin = true WHERE email = 'admin@example.com';"
```

### 6. Production deployment

```bash
docker compose up -d --build
```

The app runs on port 5050 (configurable via `APP_PORT`). Use a reverse proxy (Caddy/Nginx) for HTTPS.

---

## Project Structure

```
SellingMyItems/
├── .github/workflows/
│   └── deploy.yml              # GitHub Actions: auto-deploy on push to main
├── public/uploads/             # User-uploaded images (Docker volume)
├── scripts/
│   └── vps-setup.sh            # Initial VPS provisioning script
├── src/
│   ├── app/                    # Next.js App Router Pages
│   │   ├── globals.css         # Global styles
│   │   ├── layout.tsx          # Root layout
│   │   ├── [locale]/           # Locale-based routing (en/fr)
│   │   │   ├── layout.tsx      # Locale layout with providers
│   │   │   ├── (public)/       # Public: home, login, signup, project, item, password reset
│   │   │   ├── (authenticated)/ # Buyer: account, wishlist, messages, reservations, purchases
│   │   │   ├── (seller)/       # Seller: dashboard, projects, items, intents, messages, settings
│   │   │   └── (admin)/        # Admin: overview, accounts, projects, emails
│   │   └── api/                # API routes
│   │       ├── upload/         # Image upload endpoint
│   │       ├── uploads/        # File serving endpoint
│   │       ├── messages/       # Unread count endpoint
│   │       ├── auth/           # Auth callbacks
│   │       ├── dev-session/    # Debug session endpoint
│   │       └── dev-login/      # Debug login
│   ├── components/
│   │   ├── ui/                 # shadcn/ui primitives (button, card, dialog, etc.)
│   │   ├── layout/             # Header, Footer, UserNav, LanguageSwitcher
│   │   └── shared/             # Reusable: ItemTeaserCard, ItemDetailCard, ImageCarousel, etc.
│   ├── features/               # Domain-driven feature modules
│   │   ├── projects/           # Project CRUD (actions + components)
│   │   ├── items/              # Item CRUD, status, buyer linking (actions + components)
│   │   ├── wishlist/           # Wishlist add/remove (actions)
│   │   ├── intents/            # Purchase intents, reserve from intent (actions + components)
│   │   ├── messages/           # Messaging (actions)
│   │   ├── seller-dashboard/   # Seller sidebar (components)
│   │   └── admin-dashboard/    # Admin actions + sidebar (actions + components)
│   ├── db/
│   │   ├── index.ts            # Drizzle client initialization
│   │   ├── schema/index.ts     # Complete Drizzle schema (22 tables, 13 enums)
│   │   └── migrations/         # SQL migrations (0000–0018)
│   ├── lib/
│   │   ├── auth/               # Authentication
│   │   │   ├── index.ts        # Session management, role guards
│   │   │   └── actions.ts      # Sign up, sign in, sign out, password reset
│   │   ├── email.ts            # Resend email service (~13 email types, localized)
│   │   ├── pdf/                # @react-pdf/renderer recap document + sharp normalization
│   │   ├── seller-accounts.ts  # Seller account helper
│   │   ├── validations.ts      # Zod schemas for all forms
│   │   ├── utils.ts            # Tailwind merge utility
│   │   ├── image/              # Image placeholders
│   │   └── security/
│   │       └── rate-limit.ts   # In-memory rate limiter
│   ├── i18n/
│   │   ├── messages/           # en.json, fr.json (complete translations)
│   │   ├── routing.ts          # Locale routing config
│   │   ├── request.ts          # Server-side i18n config
│   │   └── navigation.ts       # Typed navigation helpers
│   ├── types/index.ts          # Shared TypeScript types
│   └── config/index.ts         # Site configuration
├── docker-compose.yml          # Docker services (app + db)
├── Dockerfile                  # 3-stage build (deps → builder → runner)
├── drizzle.config.ts           # Drizzle Kit configuration
├── next.config.ts              # Next.js config (standalone, i18n, build info)
├── package.json                # Dependencies and scripts
├── tsconfig.json               # TypeScript configuration
└── ROADMAP.md                  # Planned features
```

---

## Route Map

### Public Routes

| Route | Description |
|---|---|
| `/` | Homepage — public project listings with item counts |
| `/login` | Sign in (email + password), supports `?returnTo=` redirect |
| `/signup` | Sign up — every account can buy; selling unlocks on first listing. Supports `?returnTo=` redirect |
| `/forgot-password` | Request password reset email |
| `/reset-password?token=...` | Reset password with valid token |
| `/project/[slug]` | Project page — guests see blurred items with sign-in CTA; auth users see full grid |
| `/project/[slug]/item/[itemId]` | Item detail — full gallery, prices, condition, status alerts |

### Authenticated (Buyer) Routes

| Route | Description |
|---|---|
| `/account` | Edit profile (display name, phone with country-prefix validation), email visibility, communication preferences (locale / distance unit / default currency), and location (country + postal code) |
| `/wishlist` | Saved items grouped by project, with pricing summary and intent submission |
| `/my-intents` | Buyer purchase-intent hub — Active / Archived tabs, status pills, cancel-pending, archive-finalized, re-send-from-project; reviewer note from declined intents shown inline |
| `/reservations` | Items reserved for you, grouped by project |
| `/purchases` | Purchase history (items sold to you), grouped by project |
| `/messages` | Unified inbox — buyer + seller threads with side pills, status filter tabs, global unread badge |
| `/messages/[threadId]` | Thread detail — read and reply (buyer side) |

### Seller Routes

| Route | Description |
|---|---|
| `/seller` | Seller dashboard overview |
| `/seller/projects` | List owned projects |
| `/seller/projects/new` | Create new project |
| `/seller/projects/[id]/edit` | Edit project (name, slug, city, description, country + postal code, optional radius restriction) |
| `/seller/projects/[id]/items` | List items in project, with inline status changes and buyer linking |
| `/seller/projects/[id]/items/new` | Create item |
| `/seller/projects/[id]/items/[itemId]/edit` | Edit item (all fields, images, links) |
| `/seller/intents` | Buyer purchase intents — Active / Archived tabs, status filter chips, accept / decline-with-note / partial-reserve, "Message buyer" deep-link |
| `/seller/messages` | Seller message inbox |
| `/seller/messages/[threadId]` | Seller thread detail |
| `/seller/settings` | Seller settings |

### Admin Routes (Secret — no nav link)

| Route | Description |
|---|---|
| `/admin` | Platform overview — user/project/item/value/engagement stats |
| `/admin/accounts` | All user profiles — toggle active/inactive |
| `/admin/projects` | All projects — toggle public/private, item counts |
| `/admin/emails` | Email dashboard — stats, failures, 30-day breakdown, last 50 logs, API key management |

---

## Database Schema

### Enums

| Enum | Values |
|---|---|
| `item_status` | `available`, `pending`, `reserved`, `sold`, `hidden` |
| `contact_method` | `email`, `phone`, `app_message` |
| `intent_status` | `submitted`, `reviewed`, `accepted`, `declined`, `cancelled` |
| `project_visibility` | `public`, `invitation_only` |
| `project_publish_status` | `draft`, `pending`, `approved`, `rejected` |
| `invitation_status` | `active`, `used`, `expired`, `revoked` |
| `access_request_status` | `pending`, `approved`, `declined`, `cancelled` |
| `access_grant_source` | `targeted_invitation`, `generic_request`, `seller_manual` |
| `notification_type` | `invitation_received`, `access_granted`, `access_declined`, `access_revoked`, `access_requested` |
| `email_visibility` | `hidden`, `direct` |
| `currency_code` | `USD`, `EUR`, `CAD` |
| `email_type` | `welcome`, `message_notification`, `message_copy`, `intent_received`, `intent_status`, `password_reset`, `reservation_recap`, `invitation_sent`, `access_granted`, `access_declined`, `access_revoked`, `access_requested`, `inbound_relay` (kept, unused) |
| `email_status` | `sent`, `failed` |

### Tables (25)

Core domain:

| Table | Key Columns | Description |
|---|---|---|
| `profiles` | email (unique), passwordHash, **isAdmin**, isActive, displayName, phone, emailVisibility, **preferredLocale**, **distanceUnit**, **defaultCurrency**, **countryCode**, **postalCode**, **latitude**, **longitude**, locationUpdatedAt | User accounts. Communication prefs drive outgoing email locale, distance unit on UI, and the default currency in the item form. Country + postal resolve to a city centroid via Nominatim — no precise GPS stored. |
| `sessions` | token (unique), userId, expiresAt | Auth sessions (30-day TTL) |
| `password_reset_tokens` | token (unique), userId, expiresAt, usedAt | Password reset tokens (1h TTL) |
| `seller_accounts` | userId, isActive | Lazy-minted on first project creation |
| `projects` | sellerId, name, slug (unique), cityArea, description, isPublic, visibility, publishStatus, reviewerNote, submittedAt, reviewedAt, **countryCode**, **postalCode**, **latitude**, **longitude**, **radiusKm**, deletedAt | Seller projects. `radiusKm` (nullable) restricts visibility to buyers within that distance from the project's centroid; NULL means unrestricted. |
| `project_categories` | projectId, name, sortOrder | Custom categories per project |
| `items` | projectId, title, price, originalPrice, currency, status, coverImageUrl, reservedForUserId, soldToUserId, reservedAt, soldAt, viewCount, deletedAt | Items for sale |
| `item_images` | itemId, url, altText, sortOrder | Additional item images |
| `item_files` | itemId, url, fileName, mimeType, sizeBytes | Attached files |
| `item_links` | itemId, url, label | External reference links |

Buyer flow:

| Table | Key Columns | Description |
|---|---|---|
| `buyer_wishlists` | userId, projectId | Wishlist per user per project |
| `buyer_wishlist_items` | wishlistId, itemId | Items in wishlists |
| `buyer_intents` | userId, projectId, phone, contactMethod, pickupNotes, status, **reviewerNote**, **archivedAt**, **archivedBy** | Purchase intents. `archivedAt` is shared between buyer and seller — either side hiding it from both lists. `reviewerNote` is the optional seller message shown back to the buyer on a decline. `cancelled` status lets the buyer withdraw a still-pending intent and unblock the one-active-per-project lock. |
| `buyer_intent_items` | intentId, itemId | Items in purchase intents |

Geo + messaging + invitations + admin:

| Table | Key Columns | Description |
|---|---|---|
| `geocoded_locations` | (countryCode, postalCode) PK, latitude, longitude, city, resolvedAt | Cache of Nominatim/OSM postal-code lookups. Negative results (NULL coords) kept with a 24h TTL so we don't re-hammer the upstream. |
| `conversation_threads` | projectId, buyerId, **intentId**, buyerLastReadAt, sellerLastReadAt | Message threads (1 per buyer, project). `intentId` back-references the intent that auto-created the thread, so each intent card deep-links to its conversation. |
| `conversation_messages` | threadId, senderId, body | Individual messages |
| `project_invitations` | projectId, code, email, status, expiresAt, usedByUserId, usedAt | Generic + targeted invitation codes |
| `project_access_grants` | projectId, userId, source, invitationId | Granted access to invitation-only projects |
| `project_access_requests` | projectId, userId, status, codeUsed, message, invitationId | Pending requests to join an invitation-only project |
| `notifications` | userId, type, title, body, linkUrl, projectId, readAt | In-app notifications (access events) |
| `email_logs` | toEmail, subject, type, status, errorMessage, resendId | Email sending logs |
| `app_settings` | key (unique), value, updatedBy | Admin-managed settings (e.g. Resend API key) |

### Migrations (23 files)

Migrations are auto-applied on deploy by [`scripts/run-migrations.sh`](scripts/run-migrations.sh) — drop a new `*.sql` file in `src/db/migrations/`, push, and the workflow runner picks it up. Tracking lives in the `_applied_migrations` table.

Numbered SQL files in `src/db/migrations/`. Notable steps:

| Range | Description |
|---|---|
| `0000` – `0002` | Initial schema and early adjustments |
| `0003` | Add `user_role` enum to profiles |
| `0004` | Local auth with PostgreSQL sessions |
| `0005` | Demo account disable support |
| `0006` | Add `admin` to user role enum |
| `0007` | Item view count tracking |
| `0008` | Conversation read tracking timestamps |
| `0009` | Password reset tokens table |
| `0010` | Email logging table |
| `0011` | App settings table |
| `0012` | Add `message_copy` email type |
| `0013` | Item reservation + sold tracking (reservedForUserId, soldToUserId, reservedAt, soldAt); reservation recap email type |
| `0014` | Project invitations + access grants + access requests + notifications |
| `0015` | Add invitation-related email types |
| `0016` | Add `email_visibility` enum + `profiles.email_visibility`; thread aliases (later dropped) + `inbound_relay` email type |
| `0017` | Drop `thread_aliases` (inbound relay rolled back in favor of in-app messaging) |
| `0018` | Unify roles: drop `seller`-role gating; add `project_publish_status` enum + `publish_status`/`reviewer_note`/`submitted_at`/`reviewed_at` columns; grandfather public projects → `approved` |
| `0019` | Drop legacy `user_role` enum + `profiles.role` column; replace with `profiles.is_admin` boolean. Buyer/seller capabilities now derived from data (signed-in = buyer; row in `seller_accounts` = seller). |
| `0020` | Intents redesign: `archived_at` + `archived_by` + `reviewer_note` on `buyer_intents`, `intent_id` FK on `conversation_threads`, hot-path indexes, `cancelled` value added to `intent_status` enum. |
| `0021` | Promote `items.currency` from text to a `currency_code` enum (USD/EUR/CAD). Add per-user communication prefs on `profiles`: `preferred_locale`, `distance_unit`, `default_currency`. |
| `0022` | Enable `cube` + `earthdistance` extensions. Location columns (`country_code`, `postal_code`, `latitude`, `longitude`) on `profiles` and `projects`, plus `radius_km` on `projects`. New `geocoded_locations` cache table. GiST index on project coords for fast radius queries. |

---

## Authentication & Security

### Auth Flow

1. **Sign up**: Email + password (min 6 chars) + confirm password → bcrypt (12 rounds) → profile created with `is_admin = false` (selling unlocks later, on first project creation); "email already in use" surfaces inline CTAs to sign in or reset
2. **Sign in**: Email + password → bcrypt compare → create session (30-day, `crypto.randomBytes(32)` token); login + signup share a split-screen layout (brand panel + form)
3. **Session**: `session_token` httpOnly cookie, sameSite: lax, secure in production
4. **Sign out**: Delete session from DB + clear cookie
5. **Password reset**: Forgot password → email with 1h token → validate + hash new password → mark token used → **delete every session for that user** (compromised cookies stop working immediately)
6. **Change password (signed-in)**: From `/account`, requires the current password (bcrypt-compared); rate-limited 5/15min per user; optional "Sign out of other devices" wipes every session row except the current cookie

### Auth Guards

| Guard | Behavior |
|---|---|
| `getUser()` | Returns `{id, email, isAdmin}` or `null` |
| `getUserCapabilities(user)` | Returns `{buyer, seller, admin, sellerAccountId}` derived from data |
| `requireUser()` | Redirects to `/login` if not authenticated |
| `requireSeller()` | Thin alias of `requireUser()` — selling is open to every signed-in user; the function name is kept for back-compat with existing call sites |
| `requireAdmin()` | Requires `is_admin = true`, redirects to `/` otherwise |

### Rate Limiting

In-memory rate limiter (`Map`-based, single-node) applied to:

| Action | Limit |
|---|---|
| Sign up | 10/10min per IP, 5/10min per email |
| Sign in | 20/10min per IP, 8/10min per email |
| Forgot password | 5/15min per IP, 3/15min per email |
| Reset password | 10/15min per IP |
| Image upload | 20/5min per user |
| Send message | 20/min per user |
| Submit intent | 8/10min per user |

### Upload Security

- File type validation (JPEG, PNG, WebP, GIF, AVIF only)
- Max 20MB per file, max 8 files per request
- Images auto-processed: resize to max 1920px, convert to WebP (quality 75), strip EXIF metadata
- Path traversal protection on file serving
- 1-year immutable cache headers on served uploads

---

## Email System

Emails are sent via [Resend](https://resend.com) from a **verified domain** sender address.

### Configuration

| Variable | Description |
|---|---|
| `RESEND_API_KEY` | Resend API key — also configurable via Admin UI (`/admin/emails`), stored in `app_settings` with 5-min cache |
| `RESEND_FROM_EMAIL` | Sender address — configurable via Admin UI (`/admin/emails`) or env var fallback. **Must use a domain verified on [resend.com/domains](https://resend.com/domains)**. Without a verified domain, emails can only be sent to the Resend account owner's email. |

> **Important**: The default sandbox address (`onboarding@resend.dev`) only works for the account owner. To send emails to all users, you **must** verify a domain on Resend and set `RESEND_FROM_EMAIL` accordingly (e.g. `YourApp <noreply@yourdomain.com>`).

All emails are logged to the `email_logs` table with status (sent/failed), error message, and Resend ID.

### Email Types

| Email | Trigger | Content |
|---|---|---|
| **Welcome** | User registration | Branded welcome with login link |
| **Message notification** | New message received | Sender, project, message excerpt (throttled: max 1/5min per recipient) |
| **Message copy** | Sender opts in | Copy of own sent message |
| **Intent received** | Buyer submits intent | Item list, buyer contact info → seller |
| **Intent status** | Seller accepts/declines | Status update → buyer |
| **Password reset** | Forgot password request | Reset link with 1h token |

All emails support English and French based on detected locale.

### Email privacy

No inbound email infrastructure. Real addresses are masked in the UI; the app is the only reply surface.

- Each user has `profiles.email_visibility` (`hidden` by default, togglable via `/account`).
- Public project & item pages never render `mailto:<seller-email>`. Instead a **"Send a message"** CTA deep-links to `/messages/new?projectId=…` which opens an in-app composer.
- Seller dashboards (`/seller/messages`, `/seller/intents`, `/seller/projects/[id]/reservations`) only render a buyer's real email when the **buyer** chose `direct`.
- Public pages only render a seller's real email when the **seller** chose `direct`.
- The admin dashboard is exempt (trust boundary — admins always see real emails).

Outbound notifications fire as usual (new message, intent received, reservation recap, etc.). The notification body contains a **"Reply in the app"** button and a line asking the recipient not to reply by email. We intentionally do **not** run an inbound mail parser; replies sent directly to a notification email go to the configured Resend `From:` address (which doesn't process them). Users go through the app to continue the conversation.

---

## Internationalization

- **Framework**: next-intl with locale-based routing (`/en/...`, `/fr/...`)
- **Supported locales**: English (`en`), French (`fr`)
- **Default locale**: English
- **Translation files**: `src/i18n/messages/en.json`, `src/i18n/messages/fr.json`
- **Coverage**: All UI labels, form fields, status labels, error messages, email templates
- **Sections**: `common`, `nav`, `home`, `auth`, `account`, `project`, `item`, `wishlist`, `intent`, `messages`, `seller`, `reservations`, `purchases`, `invitations`, `myProjects`, `validation`

---

## Deployment

### Infrastructure

| Component | Detail |
|---|---|
| **VPS** | Vultr (45.32.220.152) |
| **Domain** | `sellingmyitems.toprecipes.best:5055` |
| **Reverse proxy** | Caddy 2 Alpine at `/opt/trystbrief/` |
| **Docker network** | `shared-proxy` (external, cross-compose connectivity) |
| **App container** | `sellingmyitems-app` on port 3000 (exposed as 5050) |
| **DB container** | `sellingmyitems-db-1` (PostgreSQL 16) |
| **Uploads** | Docker named volume `uploads` → `/app/public/uploads` |

### CI/CD Pipeline

```
Developer pushes to main
       │
       ▼
GitHub Actions (deploy.yml)
       │
       ├── SSH into VPS
       ├── Pre-deploy: prune images + build cache
       ├── Disk space check (abort if < 1GB free)
       ├── Ensure shared-proxy network exists
       ├── git pull origin main
       ├── docker compose build --no-cache
       ├── docker compose up -d --force-recreate --remove-orphans
       ├── Health check (curl localhost:5050)
       └── Post-deploy: prune unused images
```

### Manual Operations

```bash
# Run a migration on VPS
docker exec -i sellingmyitems-db-1 psql -U sellingmyitems -d sellingmyitems < migration.sql

# Promote user to admin (the only role flip that still requires SQL —
# selling is open to every signed-in user, no seller flip needed)
docker exec sellingmyitems-db-1 psql -U sellingmyitems -d sellingmyitems \
  -c "UPDATE profiles SET role = 'admin' WHERE email = 'admin@example.com';"

# Check app health
ssh root@VPS_IP "curl -sf http://localhost:5050 && echo OK"

# Database backup
docker exec sellingmyitems-db-1 pg_dump -U sellingmyitems sellingmyitems > backup.sql
```

### Admin operations

#### Apply a new schema change

The deploy workflow runs [`scripts/run-migrations.sh`](scripts/run-migrations.sh) automatically between `docker compose up` and the `/api/health` curl. To add a new schema change:

1. Edit `src/db/schema/index.ts`.
2. Add a hand-rolled SQL file in `src/db/migrations/` (next sequential prefix, e.g. `0020_add_X.sql`).
3. Use `IF NOT EXISTS` / `IF EXISTS` guards so a second run is a no-op.
4. Push to `main`. The next deploy applies it inside a single transaction (`psql -1 -v ON_ERROR_STOP=1`); a failure rolls back and fails the deploy.

Tracking lives in a `_applied_migrations` table inside the same DB. The first run on an existing DB bootstraps the table by marking all current migration files as already applied (since the schema is already up to date) — no SQL is re-run on bootstrap.

To run migrations manually outside a deploy:
```bash
ssh root@VPS_IP "cd /root/sellingmyitems && ./scripts/run-migrations.sh"
```

### Deploy On Another VPS / Another Account

Use this checklist when transferring the project to a different VPS or GitHub account.

1. Provision VPS prerequisites
  - Install Docker and Docker Compose
  - Create Docker network: `docker network create shared-proxy`
  - Install Caddy (or equivalent reverse proxy) and route domain to `sellingmyitems-app:3000`

2. Prepare repository access from the new account
  - Add deploy SSH key on VPS (`~/.ssh/id_ed25519_github`)
  - Add the public key as a deploy key on the new repository
  - Confirm `git clone` works from VPS

3. Configure GitHub Actions secrets on the new repository
  - `VPS_HOST`
  - `VPS_USER`
  - `VPS_SSH_KEY`
  - `VPS_PORT` (optional, default 22)
  - `VPS_APP_DIR` (optional, default `$HOME/sellingmyitems`)

4. Configure production `.env` on the new VPS
  - `POSTGRES_USER`
  - `POSTGRES_PASSWORD`
  - `POSTGRES_DB`
  - `APP_PORT`
  - `NEXT_PUBLIC_APP_URL`
  - `RESEND_API_KEY`
  - `RESEND_FROM_EMAIL` (must use a verified Resend domain)

5. Bootstrap and deploy
  - Run: `bash scripts/vps-setup.sh`
  - Push to `main` to trigger GitHub Actions deploy
  - Verify health: `curl -sf http://localhost:5050`

6. Admin handoff checks (in-app)
  - Create or promote one admin user (`/admin` access)
  - In `/admin/emails`, set/update:
    - Resend API key
    - Sender address (From)
  - Confirm email logs show `sent` status in `/admin/emails`

7. Optional data migration from old VPS
  - Backup old DB: `pg_dump`
  - Restore on new VPS DB container before go-live
  - Copy uploads volume/files from old VPS to new VPS

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server (Turbopack) |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | ESLint |
| `npx drizzle-kit push` | Push schema changes to database (dev) |
| `npx drizzle-kit generate` | Generate SQL migration from schema diff |
| `npx tsc --noEmit` | TypeScript type-check without emitting |

---

## Key Design Decisions

| Decision | Rationale |
|---|---|
| **No Supabase** | Migrated to self-hosted PostgreSQL + bcryptjs for full control and no vendor lock-in |
| **No separate seller signup** | Every account can buy and sell. Selling unlocks the moment a user submits their first project — at which point a `seller_accounts` row is lazily minted. Quality control happens at the project level via the `publish_status` admin review (draft → pending → approved/rejected), not via a role gate. |
| **Auth gate on item details** | Guests see project headers but items grid is blurred — must log in to see details and prices |
| **`returnTo` flow** | Login/signup preserve the intended destination URL for seamless redirect after authentication |
| **Secret admin** | No visible admin link in navigation — access only by typing `/admin` directly |
| **Admin protected** | The toggle active/inactive action skips admin profiles to prevent self-lockout |
| **Local file uploads** | Images stored on disk via Docker volume mount, not cloud storage — simple and self-hosted |
| **Soft deletes** | Projects and items use `deletedAt` instead of hard deletes for data safety |
| **1 intent per buyer/project** | Prevents spam — a buyer can have only 1 active (submitted/reviewed) intent per project |
| **Reservation → sold traceability** | When marking a reserved item as sold, the reserved buyer automatically becomes the sold-to buyer |
| **Email throttling** | Message notifications limited to 1 per 5 minutes globally to avoid flooding inboxes |

---

## Further Documentation

| Document | Description |
|---|---|
| [USER_GUIDE.md](USER_GUIDE.md) | Complete guide for buyers, sellers, and admins |
| [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md) | Architecture deep-dive, code conventions, extending the app |
| [ROADMAP.md](ROADMAP.md) | Planned features and improvements |
| [COPILOT_INSTRUCTIONS.md](COPILOT_INSTRUCTIONS.md) | AI assistant coding conventions for this project |

---

## License

MIT License — Copyright © 2026 [Vincent Cruvellier (r45635)](https://github.com/r45635)

See [LICENSE](LICENSE) for full text.
