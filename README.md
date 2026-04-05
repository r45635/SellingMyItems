# SellingMyItems

A responsive cross-device application for publishing items for sale, connecting buyers and sellers through project-based listings.

## Stack

- **Framework**: Next.js 15+ (App Router)
- **Language**: TypeScript (strict)
- **Styling**: Tailwind CSS + shadcn/ui
- **Database**: Supabase Postgres
- **ORM**: Drizzle ORM
- **Auth**: Supabase Auth (Google, Apple, Magic Link)
- **Storage**: Supabase Storage
- **i18n**: next-intl (English + French)
- **Validation**: Zod + React Hook Form

## Getting Started

### Prerequisites

- Node.js 18+
- npm
- A [Supabase](https://supabase.com) project

### 1. Clone and install

```bash
git clone https://github.com/r45635/SellingMyItems.git
cd SellingMyItems
npm install
```

### 2. Configure environment

Copy the example env file and fill in your Supabase credentials:

```bash
cp .env.local.example .env.local
```

Edit `.env.local` with:

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` | Your Supabase publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service role key (server-side only) |
| `DATABASE_URL` | Direct Postgres connection string |
| `NEXT_PUBLIC_APP_URL` | App URL (default: `http://localhost:3000`) |

### 3. Supabase setup

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Enable **Google** and **Apple** auth providers in Authentication > Providers
3. Configure redirect URLs: `http://localhost:3000/api/auth/callback`
4. Create storage buckets:
   - `item-images` (public, for cover images / teaser browsing)
   - `item-files` (private, authenticated access via signed URLs)

### 4. Database migrations

Generate and push the database schema:

```bash
npx drizzle-kit generate
npx drizzle-kit push
```

### 5. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── [locale]/           # Locale-based routing (en/fr)
│   │   ├── (public)/       # Public pages (home, project, items, login)
│   │   ├── (authenticated)/ # Buyer pages (account, wishlist, messages)
│   │   └── (seller)/       # Seller dashboard
│   └── api/                # API routes (auth callback)
├── components/
│   ├── ui/                 # shadcn/ui primitives
│   ├── layout/             # Header, Footer, Nav, Language switcher
│   └── shared/             # Reusable composites (item cards)
├── features/               # Domain features
│   ├── auth/
│   ├── projects/           # Project CRUD + forms
│   ├── items/              # Item CRUD + forms
│   ├── wishlist/           # Phase 2
│   ├── intents/            # Phase 2
│   ├── messages/           # Phase 2
│   └── seller-dashboard/   # Sidebar, dashboard components
├── db/
│   ├── schema/             # Drizzle schema (all entities)
│   └── migrations/         # Generated migrations
├── lib/
│   ├── supabase/           # Client/Server/Middleware Supabase utils
│   ├── auth/               # Auth helpers (getUser, requireUser, requireSeller)
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
| `/` | Homepage |
| `/login` | Sign in (Google, Apple, Magic Link) |
| `/project/[slug]` | Project page with item teasers |
| `/project/[slug]/item/[itemId]` | Item detail (full for auth, teaser for guest) |

### Authenticated Buyer
| Route | Description |
|---|---|
| `/account` | Profile settings |
| `/wishlist` | Saved item selection |
| `/messages` | Conversation threads |

### Seller Dashboard
| Route | Description |
|---|---|
| `/seller` | Dashboard (redirects to projects) |
| `/seller/projects` | List projects |
| `/seller/projects/new` | Create project |
| `/seller/projects/[id]/edit` | Edit project |
| `/seller/projects/[id]/items` | List items in project |
| `/seller/projects/[id]/items/new` | Create item |
| `/seller/projects/[id]/items/[itemId]/edit` | Edit item |
| `/seller/intents` | Buyer intents (future) |
| `/seller/messages` | Seller messages (future) |
| `/seller/settings` | Settings (future) |

## MVP Phases

### Phase 1 (current)
- Auth (Google, Apple, Magic Link)
- Public homepage + project page
- Item teaser cards (cover + title for guests)
- Seller dashboard shell
- Project CRUD
- Item CRUD
- Category management (schema ready)
- Item status (available/pending/sold)
- EN/FR i18n
- Database schema with all entities

### Phase 2
- Full item details after login
- Wishlist/cart-like selection
- Purchase intent submission
- Project-level messaging thread

### Phase 3
- Seller views for intents/messages
- Multi-seller architecture activation
- SEO indexability flags
- Analytics, export tools

## Scripts

```bash
npm run dev       # Start dev server
npm run build     # Production build
npm run start     # Start production server
npm run lint      # ESLint
```

## License

See [LICENSE](LICENSE).
