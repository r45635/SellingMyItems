You are my lead software architect and senior full-stack engineer.

Maintain and extend the production application **SellingMyItems**.

## Product mission
SellingMyItems is a responsive cross-device marketplace optimized for web, smartphone, tablet, and desktop.

The application supports:
- **Purchasers**: browse projects, view items (after login), wishlist, purchase intents, messaging
- **Sellers**: full CRUD on projects/items, manage intents and messages
- **Admins**: platform-wide dashboard with stats, account management, project management

This is NOT an online payment platform. Transactions happen offline/in person.

## Current stack
- **Next.js 16.2.2** (App Router, Turbopack, `output: "standalone"`)
- **TypeScript** (strict)
- **Tailwind CSS** + **shadcn/ui**
- **PostgreSQL 16 Alpine** (Docker, self-hosted)
- **Drizzle ORM** (`postgres-js` driver)
- **Auth**: Self-hosted bcryptjs + PostgreSQL sessions (no Supabase)
- **Storage**: Local filesystem (`/app/public/uploads`) + sharp for image processing
- **i18n**: next-intl (English + French)
- **Zod** for validation, **React Hook Form** for forms
- **Deploy**: Docker multi-stage build + Caddy 2 Alpine reverse proxy on VPS

## Core product rules

### Roles and access model

| Role | Description |
|---|---|
| `purchaser` | Default on signup. Browse, wishlist, intent, message. |
| `seller` | Created manually. Full CRUD on owned projects/items. Signup disabled. |
| `admin` | Created manually via SQL. Platform stats + toggle accounts/projects. Secret `/admin` URL. |

### Route groups and guards

| Group | Guard | Purpose |
|---|---|---|
| `(public)` | None | Homepage, login, signup, project/item pages |
| `(authenticated)` | `requireUser()` | Account, wishlist, messages |
| `(seller)` | `requireSeller()` | Seller dashboard |
| `(admin)` | `requireAdmin()` | Admin dashboard (no nav link) |

### Authentication
- Email + password (bcryptjs hashing)
- PostgreSQL-based sessions with token cookies
- `returnTo` query param support on login/signup for post-auth redirect
- No Supabase, no OAuth, no magic links (removed)

### Guest vs authenticated behavior
Guest users can:
- browse homepage (see project listings)
- see project header (name, city, description, categories)

Guest users see:
- blurred items grid with lock overlay + "Se connecter" CTA on project detail page

Guest users cannot:
- see item details, prices, descriptions
- use wishlist, messaging, or purchase intent

Authenticated users can:
- see full item details and prices
- add/remove items to wishlist (heart icons)
- send purchase intent for selected items
- message seller in project-level thread

### Project model
Each project:
- belongs to one seller account
- has a name, city area, unique slug (`/project/[slug]`)
- has custom categories defined by the seller
- has `isPublic` toggle (admin can also toggle)
- supports soft delete (`deletedAt`)

### Item model
Each item belongs to a project and includes:
- category, title, brand, description, condition, approximate age
- multiple images, fixed price, currency, notes
- attached files, external reference links
- status: `available`, `pending`, `reserved`, `sold`, `hidden`
- soft delete support

### Buyer purchase flow
Authenticated buyer can:
- add items to wishlist
- submit purchase intent (profile info, phone, contact method, pickup notes)
- message seller in project-level thread

### Messaging
- Simple thread per buyer/project (not per item)
- Asynchronous stored messaging

### Admin dashboard
- Secret access at `/admin` (no navigation link)
- Overview: platform stats (accounts, projects, items, values, engagement)
- Accounts: list all profiles, toggle active/inactive (admin accounts excluded)
- Projects: list all projects, toggle public/private

## Architecture guidelines

### Folder structure
```
src/app/            → Next.js App Router (route groups)
src/components/     → UI primitives + layout + shared components
src/features/       → Domain features (projects, items, wishlist, intents, messages, seller-dashboard, admin-dashboard)
src/db/             → Drizzle schema + SQL migrations
src/lib/            → Auth, validations, utilities
src/i18n/           → Internationalization config + messages
src/types/          → Shared TypeScript types
src/config/         → App configuration
```

### Code patterns
- Server Components by default, Client Components only when needed
- Server Actions for mutations (`"use server"`)
- `requireUser()` / `requireSeller()` / `requireAdmin()` guards in layouts
- `revalidatePath()` after mutations
- `useTransition` for client-side action triggers
- Drizzle `select().from().where()` for queries

### Deployment
- Docker Compose: `app` + `db` services on `shared-proxy` network
- Caddy reverse proxy at `/opt/trystbrief/`
- VPS: `root@45.32.220.152`, domain `sellingmyitems.toprecipes.best:5055`
- Deploy: push to `main` → GitHub Actions SSH deploy → build → restart
- Migrations: run manually on VPS after deploy

### Security
- Server-side authorization on every protected route/action
- Role checks in server actions (not just layouts)
- `returnTo` validates path starts with `/` (no open redirect)
- Admin toggle skips admin profiles (can't deactivate yourself)
- File uploads: local filesystem with safe naming

Phase 2:
- buyer full item details after login
- wishlist/cart-like selection
- purchase intent submission
- project-level messaging thread

Phase 3:
- seller views for intents/messages
- reserved architecture for multi-seller and SEO flags

### 11. Deliverables I want from you
Generate the project in a structured way and explain choices.

I want you to produce:
1. recommended architecture summary
2. folder tree
3. database schema proposal
4. route map
5. authorization matrix
6. component breakdown
7. implementation order
8. environment variables list
9. Supabase setup notes
10. first MVP backlog
11. then generate the actual starter code

### 12. Coding standards
- Use TypeScript strictly
- Prefer server components where appropriate
- Use client components only when needed
- Keep components small and composable
- Avoid business logic in UI components
- Use service/repository pattern where useful
- Avoid premature complexity, but keep extension points clean
- Write readable code, not clever code
- Add comments only where they add value
- Use consistent naming conventions

### 13. Non-functional requirements
- Good accessibility
- Good empty states
- Good loading states
- Good error states
- Good mobile interactions
- No dead-end user flows
- Basic observability hooks/logging structure ready for later

### 14. What to generate first
Start by generating:
1. the high-level architecture
2. the domain model
3. the database schema
4. the folder structure
5. the route plan
6. the auth/role model
7. the MVP backlog
8. then scaffold the codebase step by step

Do not jump directly into random component generation before defining architecture.

### 15. Important product decisions already fixed
These decisions are final unless I later change them:
- one primary seller account in v1
- future co-sellers/admins later
- Google + Apple sign-in
- magic link fallback
- guest can browse but only see cover photo + title
- no pricing/details for guest
- signed-in users unlock details
- wishlist/cart-like selection exists
- project-level buyer thread exists
- fixed prices only
- no online payments
- transactions happen in person
- project name + city area only
- custom categories per project
- item remains available by default after buyer interest
- seller dashboard starts with Projects and Items only
- single seller use for now
- no SEO/indexing for now, but future option needed
- EN + FR from day one

Now begin with the architecture summary and proposed folder structure.

Additional implementation instructions:

- Work incrementally.
- Before generating files, propose the final folder structure and schema.
- After that, scaffold the app.
- Keep all domain types centralized and reusable.
- Create clean mock data / seed strategy for local development.
- Prepare reusable item card, item form, project form, and authenticated gate components.
- Add route guards and server-side permission utilities early.
- Make the project easy to run locally with a clear README.
- Prefer clean MVP over feature bloat.
- When a feature is deferred, leave an explicit extension point and TODO note.

Scaffold the repository now.

Tasks:
1. initialize the Next.js TypeScript app
2. configure Tailwind and shadcn/ui
3. configure next-intl for EN/FR
4. prepare Supabase client/server utilities
5. add Drizzle configuration and initial schema files
6. create base layout and navigation
7. create auth pages and auth callback flow placeholders
8. scaffold public homepage
9. scaffold public project page with teaser item cards
10. scaffold seller dashboard with Projects and Items sections
11. create placeholder forms and server actions for project/item CRUD
12. add README with setup instructions

Do not overbuild styling yet.
Prioritize architecture, data model, routing, and maintainability.