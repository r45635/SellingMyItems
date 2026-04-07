# SellingMyItems

A responsive cross-device marketplace for publishing items for sale, connecting buyers and sellers through project-based listings. Transactions happen offline/in person — the app handles publishing, discovery, wishlists, purchase intents, and messaging.

**Live**: https://sellingmyitems.toprecipes.best:5055

## Stack

| Layer | Technology |
|---|---|
| **Framework** | Next.js 16.2.2 (App Router, Turbopack, `output: "standalone"`) |
| **Language** | TypeScript (strict) |
| **Styling** | Tailwind CSS + shadcn/ui |
| **Database** | PostgreSQL 16 Alpine (Docker) |
| **ORM** | Drizzle ORM (`postgres-js` driver) |
| **Auth** | Self-hosted bcryptjs + PostgreSQL sessions (no Supabase) |
| **Storage** | Local filesystem (`/app/public/uploads`) via sharp |
| **i18n** | next-intl (English + French) |
| **Validation** | Zod + React Hook Form |
| **Deploy** | Docker multi-stage build + Caddy 2 reverse proxy on VPS |

## Architecture

### Roles

| Role | Description |
|---|---|
| `purchaser` | Default role on signup. Can browse, wishlist, intent, message. |
| `seller` | Created manually (signup disabled). Full CRUD on owned projects/items. |
| `admin` | Created manually via SQL. Platform-wide stats + toggle accounts/projects. |

### Route Groups

| Group | Guard | Description |
|---|---|
| `(public)` | None | Homepage, login, signup, project/item pages |
| `(authenticated)` | `requireUser()` | Account, wishlist, messages |
| `(seller)` | `requireSeller()` | Seller dashboard + project/item management |
| `(admin)` | `requireAdmin()` | Admin dashboard (secret URL, no nav link) |

## Getting Started

### Prerequisites

- Node.js 22+
- npm
- Docker & Docker Compose (for production)

### 1. Clone and install

```bash
git clone https://github.com/r45635/SellingMyItems.git
cd SellingMyItems
npm install
```

### 2. Configure environment

Create `.env.local`:

```env
DATABASE_URL=postgresql://sellingmyitems:yourpassword@localhost:5432/sellingmyitems
```

For Docker production, create `.env`:

```env
POSTGRES_USER=sellingmyitems
POSTGRES_PASSWORD=yourpassword
POSTGRES_DB=sellingmyitems
APP_PORT=5050
```

### 3. Database setup

**Local development** — run PostgreSQL locally or via Docker:

```bash
docker compose up db -d
npx drizzle-kit push
```

**Production** — migrations are in `src/db/migrations/` and must be run manually:

```bash
docker exec sellingmyitems-db-1 psql -U sellingmyitems -d sellingmyitems -f /path/to/migration.sql
```

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 5. Production deployment

```bash
docker compose up -d --build
```

The app runs on port 5050 behind Caddy reverse proxy with HTTPS.

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── [locale]/           # Locale-based routing (en/fr)
│   │   ├── (public)/       # Public pages (home, project, items, login, signup)
│   │   ├── (authenticated)/ # Buyer pages (account, wishlist, messages)
│   │   ├── (seller)/       # Seller dashboard
│   │   └── (admin)/        # Admin dashboard (secret)
│   └── api/                # API routes (session, upload, file serving)
├── components/
│   ├── ui/                 # shadcn/ui primitives
│   ├── layout/             # Header, Footer, Nav, Language switcher
│   └── shared/             # Reusable composites (item cards, logo)
├── features/               # Domain features
│   ├── projects/           # Project CRUD + forms
│   ├── items/              # Item CRUD + forms
│   ├── wishlist/           # Buyer wishlists
│   ├── intents/            # Purchase intents
│   ├── messages/           # Conversation threads
│   ├── seller-dashboard/   # Seller sidebar + components
│   └── admin-dashboard/    # Admin sidebar, actions, components
├── db/
│   ├── schema/             # Drizzle schema (all entities)
│   └── migrations/         # SQL migrations (0000–0006)
├── lib/
│   ├── auth/               # Auth helpers (getUser, requireUser, requireSeller, requireAdmin)
│   │   ├── index.ts        # Session management + role guards
│   │   └── actions.ts      # Server actions (signUp, signIn, signOut)
│   ├── validations.ts      # Shared Zod schemas
│   └── utils.ts            # Tailwind merge utility
├── i18n/
│   ├── messages/           # en.json, fr.json
│   ├── routing.ts          # Locale routing config
│   ├── request.ts          # Server-side i18n config
│   └── navigation.ts       # Typed navigation helpers
├── types/                  # Shared TypeScript types
└── config/                 # App configuration
```

## Route Map

### Public

| Route | Description |
|---|---|
| `/` | Homepage — public project listings |
| `/login` | Sign in (email + password) with `returnTo` redirect support |
| `/signup` | Sign up (purchaser role only) with `returnTo` redirect support |
| `/project/[slug]` | Project page — guests see blurred items grid with login CTA |
| `/project/[slug]/item/[itemId]` | Item detail — guests see login CTA with `returnTo` |

### Authenticated Buyer

| Route | Description |
|---|---|
| `/account` | Profile settings |
| `/wishlist` | Saved item selection (heart icons) |
| `/messages` | Conversation threads |

### Seller Dashboard

| Route | Description |
|---|---|
| `/seller` | Dashboard overview |
| `/seller/projects` | List projects |
| `/seller/projects/new` | Create project |
| `/seller/projects/[id]` | Project detail |
| `/seller/projects/[id]/edit` | Edit project |
| `/seller/projects/[id]/items` | List items in project |
| `/seller/projects/[id]/items/new` | Create item |
| `/seller/projects/[id]/items/[itemId]/edit` | Edit item |
| `/seller/intents` | Buyer purchase intents |
| `/seller/messages` | Seller messages |
| `/seller/settings` | Seller settings |

### Admin Dashboard (Secret)

| Route | Description |
|---|---|
| `/admin` | Platform overview — stats cards (accounts, projects, items, value, engagement) |
| `/admin/accounts` | All profiles — toggle active/inactive |
| `/admin/projects` | All projects — toggle public/private |

> Admin is accessed by typing `/admin` directly. No link in the navigation.

## Database Schema

### Tables

| Table | Description |
|---|---|
| `profiles` | Users (email, passwordHash, role, isActive, displayName) |
| `sessions` | Auth sessions (token, expiresAt) |
| `seller_accounts` | Seller profiles (userId, isActive) |
| `projects` | Seller projects (name, slug, cityArea, isPublic, deletedAt) |
| `project_categories` | Custom categories per project |
| `items` | Items for sale (title, price, status, condition, brand, etc.) |
| `item_images` | Additional item images |
| `item_files` | Attached files (private) |
| `item_links` | External reference links |
| `buyer_wishlists` | Wishlist per user/project |
| `buyer_wishlist_items` | Items in wishlists |
| `buyer_intents` | Purchase intent submissions |
| `buyer_intent_items` | Items in purchase intents |
| `conversation_threads` | Message threads per buyer/project |
| `conversation_messages` | Individual messages in threads |

### Enums

| Enum | Values |
|---|---|
| `user_role` | `purchaser`, `seller`, `admin` |
| `item_status` | `available`, `pending`, `reserved`, `sold`, `hidden` |
| `contact_method` | `email`, `phone`, `app_message` |
| `intent_status` | `submitted`, `reviewed`, `accepted`, `declined` |

### Migrations

| File | Description |
|---|---|
| `0000_light_goliath.sql` | Initial schema |
| `0001_futuristic_blockbuster.sql` | Schema updates |
| `0002_talented_vanisher.sql` | Schema updates |
| `0003_add-user-role.sql` | Add user_role enum to profiles |
| `0004_local-auth-sessions.sql` | Local auth + sessions table |
| `0005_disable-demo-accounts.sql` | Disable demo accounts |
| `0006_add-admin-role.sql` | Add `admin` to user_role enum |

## Deployment

### Infrastructure

- **VPS**: Vultr (45.32.220.152)
- **Domain**: `sellingmyitems.toprecipes.best:5055`
- **Proxy**: Caddy 2 Alpine at `/opt/trystbrief/` on `shared-proxy` Docker network
- **App**: Docker Compose (`docker-compose.yml`) with `app` + `db` services
- **Repo**: `/root/sellingmyitems` on VPS

### Deploy workflow

1. Build and commit locally
2. `git push origin main`
3. GitHub Actions deploys via SSH (`appleboy/ssh-action@v1`):
   - Prune images + builder cache
   - `git fetch && git reset --hard origin/main`
   - `docker compose build --no-cache`
   - `docker compose up -d --force-recreate`
   - Reconnect Caddy to app network
   - Health check
4. Run any new migrations manually on VPS

### Manual VPS operations

```bash
# Run a migration
docker exec sellingmyitems-db-1 psql -U sellingmyitems -d sellingmyitems \
  -c "ALTER TYPE \"user_role\" ADD VALUE IF NOT EXISTS 'admin';"

# Create admin account
docker exec sellingmyitems-db-1 psql -U sellingmyitems -d sellingmyitems \
  -c "UPDATE profiles SET role = 'admin' WHERE email = 'your-email@example.com';"

# Check app health
curl -sf http://localhost:5050 -o /dev/null && echo 'OK' || echo 'DOWN'

# Restore Caddy if destroyed
cd /opt/trystbrief && docker compose up -d
```

## Scripts

```bash
npm run dev       # Start dev server (Turbopack)
npm run build     # Production build
npm run start     # Start production server
npm run lint      # ESLint
```

## Key Design Decisions

- **No Supabase**: Migrated to self-hosted PostgreSQL + bcryptjs auth for full control
- **Seller signup disabled**: New accounts are always `purchaser`. Sellers are created manually.
- **Auth gate on details**: Guests see project headers but items grid is blurred — must log in to see details
- **`returnTo` flow**: Login/signup pages preserve the intended destination URL
- **Secret admin**: No visible link — access by navigating to `/admin` directly
- **Admin can't be deactivated**: Toggle active/inactive skips admin profiles
- **Local file uploads**: Images stored on disk (`/app/public/uploads`) via volume mount, not cloud storage

## License

See [LICENSE](LICENSE).
