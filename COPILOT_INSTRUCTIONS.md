You are my lead software architect and senior full-stack engineer.

Build the foundation of a production-ready project called **SellingMyItems**.

## Product mission
SellingMyItems is a responsive cross-device application optimized for:
- web
- smartphone
- tablet
- desktop

The application is for a **single seller use case in v1**, but the architecture must be designed to support later:
- multiple sellers
- co-sellers/admins
- multi-project platform mode
- optional public SEO/indexing
- future broader marketplace capabilities

This is NOT an online payment platform.
Transactions happen offline/in person.
The app is for:
- publishing items for sale
- allowing signed-in buyers to unlock details
- building a wishlist/cart-like selection
- sending purchase intent
- enabling buyer/seller messaging at project level
- letting the seller manage projects and items

## Required stack
Use this stack unless there is a strong technical reason not to:
- Next.js latest stable with App Router
- TypeScript
- Tailwind CSS
- shadcn/ui
- Supabase:
  - Auth
  - Postgres database
  - Storage
- Drizzle ORM
- next-intl for i18n
- Zod for validation
- React Hook Form where forms are needed

## Core product rules

### Access model
- V1 is single seller oriented.
- One primary seller account owns one or more projects.
- Architecture must anticipate future co-sellers/admin roles but do not implement full co-seller UI yet.

### Authentication
Support:
- Google sign-in
- Apple sign-in
- magic link fallback

### Anonymous vs authenticated behavior
Guest users can:
- browse project landing page
- see item list/grid
- see only:
  - cover photo
  - title

Guest users cannot see:
- price
- description
- condition/state
- age
- brand
- extra notes
- attached files
- wishlist/cart
- messaging
- purchase intent

Authenticated users can:
- see full item details
- see price
- add/remove items to a wishlist/cart-like selection
- send a purchase intent for selected items
- message seller inside a project-level thread

### Project model
Each project:
- belongs to one primary seller
- has a project name
- has a city area
- has a unique public slug URL such as `/project/[slug]`
- has custom categories defined by the seller
- is not SEO-indexed in v1
- should allow future option to become indexable later

### Item model
Each item belongs to a project and may include:
- category (custom per project)
- name/title
- brand
- description
- condition/state
- approximate age
- multiple pictures
- fixed price only for now
- additional notes
- attached files
- links to external references/manuals/videos/etc.

Each item has status support for:
- available
- pending
- sold

However, when a buyer expresses interest, the item remains **available** by default.
Seller manually changes status later.

### Buyer purchase flow
Authenticated buyer can:
- add multiple items into a wishlist/cart-like selection
- review selected items
- submit purchase intent
- provide:
  - profile info
  - phone number
  - preferred contact method
  - optional pickup notes / availability

This creates a buyer intent record linked to:
- buyer
- project
- selected items

### Messaging
Messaging is:
- a simple thread per buyer/project
- not per item
- not live chat dependent
- asynchronous stored messaging inside the app

### Seller dashboard v1
Initial seller dashboard sections:
- Projects
- Items

Design data model and routing so that these can be added later without refactor:
- Buyer Intents
- Messages
- Profile / Settings
- Team members / co-sellers
- Analytics
- Export tools

## Product architecture goals
I want a clean architecture that is:
- scalable
- secure
- mobile-first
- accessible
- easy to maintain
- easy to extend later

The codebase must be organized for long-term growth, not just MVP hacking.

## Build requirements

### 1. Project setup
Create the project skeleton with:
- clear folder structure
- environment variable strategy
- linting
- formatting
- type safety
- reusable UI primitives
- server/client boundary discipline
- modular domain organization

### 2. Suggested folder structure
Prefer a structure like:
- `src/app`
- `src/components`
- `src/features`
- `src/lib`
- `src/db`
- `src/i18n`
- `src/types`
- `src/config`

Organize by domain where helpful:
- auth
- projects
- items
- wishlist
- intents
- messages
- seller-dashboard

### 3. Routing
Design route structure including:
Public:
- `/`
- `/login`
- `/project/[slug]`
- `/project/[slug]/item/[itemId]`

Authenticated buyer:
- `/account`
- `/wishlist`
- `/messages`

Seller:
- `/seller`
- `/seller/projects`
- `/seller/projects/new`
- `/seller/projects/[projectId]`
- `/seller/projects/[projectId]/edit`
- `/seller/projects/[projectId]/items`
- `/seller/projects/[projectId]/items/new`
- `/seller/projects/[projectId]/items/[itemId]/edit`

Reserve room for future:
- `/seller/intents`
- `/seller/messages`
- `/seller/settings`

### 4. Internationalization
Support English and French from day one.
Requirements:
- locale-aware routing or locale handling strategy
- translation dictionaries
- no hard-coded UI text
- all form labels/messages translatable
- easy addition of more languages later

### 5. Database design
Design normalized schema using Supabase Postgres + Drizzle.

Include at minimum these entities:
- users
- profiles
- seller_accounts
- projects
- project_categories
- items
- item_images
- item_files
- item_links
- buyer_wishlists or saved selections
- buyer_intents
- buyer_intent_items
- conversation_threads
- conversation_messages

Include relevant fields for:
- created_at
- updated_at
- ownership
- visibility
- status
- soft-delete where useful

Design for future extensibility:
- co-sellers/admins
- project membership
- item audit trail
- project privacy modes
- SEO visibility flags

### 6. Permissions and security
Implement secure role-aware access logic.

Minimum rules:
- guest: public teaser only
- authenticated buyer: full project item details + own wishlist + own project thread
- seller: full CRUD only on owned projects/items and related data

Use:
- server-side authorization checks
- Supabase auth integration
- Row Level Security mindset
- secure file access strategy
- private vs public storage policy

Be explicit about which assets can be public:
- item cover images for teaser browsing may be public if needed
- detailed attachments/files should require authentication or signed URLs

### 7. UX requirements
Design must be:
- mobile first
- responsive
- touch friendly
- clean and simple
- fast to scan
- seller-friendly for data entry

Public project page:
- project header
- city area
- item cards/grid/list
- each item card shows only cover image + title for guest
- signed-in user sees more detail once entering item page or expanded card

Authenticated buyer experience:
- unlock item details
- add/remove selection
- review selected items
- submit purchase intent
- send/read messages in project thread

Seller experience:
- manage projects
- create/edit/delete items
- upload multiple images/files
- add external links
- assign custom categories
- mark item available/pending/sold manually

### 8. Forms and validation
All forms must use:
- shared Zod schemas
- strong typing end to end
- client + server validation
- clear error messages
- localized validation messages if possible

### 9. Storage
Use Supabase Storage for:
- item photos
- attachments
- optional documents/manuals

Support many file types.
Design storage buckets and naming conventions carefully.
Use safe upload handling, metadata, and cleanup on deletion.

### 10. MVP implementation scope
Build the MVP foundation first.

Phase 1:
- auth
- public homepage
- project public page
- item teaser cards
- seller dashboard shell
- project CRUD
- item CRUD
- image/file upload
- category management
- item status
- EN/FR setup

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