# SellingMyItems — User Guide

This guide covers how to use SellingMyItems from each perspective: **buyer**, **seller**, and **admin**.

> The platform is a marketplace where users publish items organized into projects, and others discover, wishlist, and express intent to purchase. The actual transaction (payment, pickup) happens offline.
>
> There is no separate "seller" account type. Every signed-in user is a buyer by default, and **selling unlocks automatically the moment you create your first listing** — your project goes through admin review before becoming public.

---

## Table of Contents

- [For Buyers](#for-buyers)
  - [Getting Started](#getting-started)
  - [Browsing Projects & Items](#browsing-projects--items)
  - [Wishlist](#wishlist)
  - [Purchase Intents](#purchase-intents)
  - [Reservations](#reservations)
  - [Purchase History](#purchase-history)
  - [Messaging](#messaging)
  - [Account Management](#account-management)
  - [Password Reset](#password-reset)
- [For Sellers](#for-sellers)
  - [Becoming a Seller](#becoming-a-seller)
  - [Projects](#projects)
  - [Items](#items)
  - [Item Statuses](#item-statuses)
  - [Managing Purchase Intents](#managing-purchase-intents)
  - [Reserving Items for Buyers](#reserving-items-for-buyers)
  - [Manually Linking a Buyer](#manually-linking-a-buyer)
  - [Marking Items as Sold](#marking-items-as-sold)
  - [Messaging Buyers](#messaging-buyers)
- [For Admins](#for-admins)
  - [Accessing the Admin Dashboard](#accessing-the-admin-dashboard)
  - [Platform Overview](#platform-overview)
  - [Account Management](#admin-account-management)
  - [Project Management](#admin-project-management)
  - [Email Dashboard](#email-dashboard)

---

## For Buyers

### Getting Started

1. **Sign up** at `/signup` — enter your email, choose a password (min 6 characters), and optionally a display name.
2. You can browse, wishlist, and contact sellers right away. If you ever want to sell something yourself, just hit **"Sell"** from the home or the avatar menu — your seller capability unlocks automatically when you submit your first project.
3. After signing up, you receive a **welcome email** (if email sending is configured).

### Browsing Projects & Items

- **Homepage** (`/`) lists all public projects as cards showing the project name, location (city/area), and item count.
- Click a project card to view the project page (`/project/[slug]`).
- **If you're not logged in**: the items grid appears blurred with a "Sign in to see items" prompt. You must log in to see item details and prices.
- **If you're logged in**: you see the full item grid with titles, prices, conditions, and thumbnail images. Each item shows its status badge (Available, Reserved, Sold).
- Click an item to see the **item detail page** with:
  - Full image gallery (carousel)
  - Price and original price (with savings percentage)
  - Brand, condition (6 levels from New to For Parts), age
  - Description, seller notes
  - Status banner — if the item is reserved for you, you see a personalized "Reserved for you" message
  - External reference links
  - Wishlist heart button

### Wishlist

- Click the **heart icon** on any item to add it to your wishlist. Click again to remove.
- View your wishlist at `/wishlist`.
- Items are grouped by project, showing:
  - Item thumbnails, titles, prices
  - **Total value** and **total savings** per project
  - A **Submit Purchase Intent** button per project (if you haven't already submitted one)

### Purchase Intents

A **purchase intent** is your expression of interest in buying one or more items from a project.

1. From the wishlist page, click **"Submit Purchase Intent"** for a project.
2. Fill in the form:
   - **Phone number** (required)
   - **Preferred contact method**: email, phone, or in-app message
   - **Pickup notes** (optional): dates, times, or special instructions
3. Submit — the seller receives an email notification with your intent details.
4. **Limit**: 1 active intent per buyer per project. If you already have a submitted/reviewed intent, you cannot submit another until your current one is resolved.
5. Wait for the seller to accept or decline your intent.

### Reservations

When a seller accepts your intent (fully or partially), items become **reserved for you**.

- View your reservations at `/reservations` (accessible from the navigation menu).
- Items are grouped by project, each showing:
  - Item title, price, condition
  - Reservation date
  - Status badge

You can also see "Reserved for you" banners on individual item detail pages.

### Purchase History

Once a seller marks reserved items as **sold** (to you), they appear in your purchase history.

- View your purchases at `/purchases` (accessible from the navigation menu).
- Items are grouped by project, each showing:
  - Item title, price
  - Sale date

### Messaging

You can exchange messages with sellers about specific projects:

1. From a project page or the item detail page, initiate a conversation.
2. View all threads at `/messages`.
3. Click a thread to read and reply.
4. **Unread indicator**: the navigation badge shows your unread message count.
5. **Email notifications**: when a seller replies, you receive an email (throttled to max 1 every 5 minutes to avoid flooding).

### Account Management

Edit your profile at `/account`:

- **Display name**: shown to sellers in messages and intents
- **Phone number**: used in purchase intents

### Password Reset

1. Go to `/forgot-password` and enter your email.
2. Receive an email with a reset link (valid for 1 hour).
3. Click the link to reach `/reset-password` — enter your new password and confirm.
4. The old token is marked as used and cannot be reused.

---

## For Sellers

### Becoming a Seller

There is no separate seller signup. Any signed-in user can sell:

1. From the home, the avatar menu, or the bottom nav, click **"Sell"** (or **"My listings"** once you have one).
2. The first time you create a project at `/seller/projects/new`, a `seller_accounts` row is minted for you behind the scenes — that's the activation.
3. Your project starts in **draft**. Hit **"Submit for review"** when it's ready; an admin approves it and only then does it appear on the public homepage. You'll be notified by email.
4. Once you have at least one listing, a **context switcher** appears in the header so you can hop between the buyer and seller environments.

### Projects

A **project** groups items under a common theme (e.g. "Moving Sale — Harrison", "Estate Clearance").

- **Create** a project at `/seller/projects/new`:
  - **Name** (required): displayed on the homepage
  - **Slug** (auto-generated from name): URL-friendly identifier, must be unique
  - **City/Area** (required): location shown on project card
  - **Description** (optional): details about the sale
- **Edit** a project at `/seller/projects/[id]/edit` — change name, slug, city, description
- **Delete** a project — soft delete (`deletedAt` is set, project disappears from listings)
- **Visibility**: projects created through the app are public by default. Admin can toggle public/private.

### Items

Each project contains items you want to sell.

- **Create** an item at `/seller/projects/[id]/items/new`:
  - **Title** (required)
  - **Brand** (optional)
  - **Description** (optional): rich text description
  - **Condition** (required): New, Like New, Very Good, Good, Acceptable, For Parts
  - **Age** (optional): how old the item is
  - **Price** and **Original price** (for showing discounts), **Currency** (USD, EUR, CAD)
  - **Category**: select from project categories
  - **Status**: Available (default), Pending, Reserved, Sold, Hidden
  - **Notes**: internal seller notes
  - **Cover image**: main thumbnail
  - **Additional images**: up to 10 images, drag to reorder
  - **External links**: reference URLs (product pages, similar items)
- **Edit** an item at `/seller/projects/[id]/items/[itemId]/edit` — all fields editable
- **Delete** an item — soft delete
- **View count**: each item tracks how many times it has been viewed

### Item Statuses

| Status | Meaning | Visible to buyers? |
|---|---|---|
| **Available** | Item is for sale | Yes, no badge |
| **Pending** | Seller is considering | Yes, yellow badge |
| **Reserved** | Item is held for a specific buyer | Yes, blue "Reserved" badge (buyer sees "Reserved for you") |
| **Sold** | Transaction completed | Yes, "Sold" badge |
| **Hidden** | Item is hidden from public view | No |

You can change status from the **items list page** (`/seller/projects/[id]/items`) using the inline status dropdown on each item row.

### Managing Purchase Intents

When a buyer submits a purchase intent for one of your projects:

1. You receive an **email notification** with the buyer's name, phone, contact method, pickup notes, and the list of items they want.
2. View all intents at `/seller/intents`.
3. For each intent, you can see:
   - Buyer information
   - Requested items
   - Current intent status
4. **Accept** — this triggers `reserveItemsFromIntent`, which marks selected items as reserved for the buyer. You can select which items to reserve (not necessarily all of them).
5. **Decline** — the intent is declined, buyer is notified by email.
6. **Review** — mark as reviewed (intermediate state, no notification).

### Reserving Items for Buyers

Two ways to reserve items:

1. **From an intent**: When accepting a buyer's intent, you select specific items to reserve. These are automatically linked to the buyer (via `reservedForUserId`).
2. **From the items list**: Change an item's status to "Reserved" using the inline dropdown. The item is reserved without a specific buyer linked.

### Manually Linking a Buyer

If an item is reserved without an associated buyer (e.g. you set the status manually), you can link it to a specific buyer:

1. On the items list page (`/seller/projects/[id]/items`), reserved items show a **"Link Buyer"** form.
2. Search for the buyer by email address.
3. Select the buyer from search results.
4. Click "Link" — the buyer's account is linked as the reserved party.

This enables traceability: you know who the item is reserved for, and the buyer sees it in their `/reservations` page.

### Marking Items as Sold

Two ways:

1. **From the items list**: Change status to "Sold" using the inline dropdown. If the item was reserved for a buyer, that buyer is automatically set as the sold-to buyer.
2. **From the buyer link form**: When an item is reserved and linked to a buyer, a **"Mark as Sold"** button appears. Clicking it transitions the item to sold with full buyer traceability.

Once sold, the item appears in the buyer's `/purchases` page.

### Messaging Buyers

- View buyer messages at `/seller/messages`.
- Each thread is associated with a specific project and buyer.
- Reply directly in the thread.
- Read tracking per thread — you can see which messages are new.

---

## For Admins

### Accessing the Admin Dashboard

The admin dashboard is **secret** — there is no link in the navigation. Access it by navigating directly to `/admin`.

Only users with the `admin` role can access these pages. Others are redirected to the homepage.

### Platform Overview

The `/admin` overview displays:

- **Total users**: active profiles count
- **Total projects**: public and private counts
- **Items by status**: breakdown of available, pending, reserved, sold, hidden
- **Total value by currency**: sum of item prices, grouped by USD/EUR/CAD
- **Total intents**: by status (submitted, reviewed, accepted, declined)
- **Total conversation threads**: active messaging count

### Admin Account Management

At `/admin/accounts`:

- View all registered profiles: email, display name, role, active status
- **Toggle active/inactive**: deactivate accounts that violate terms. Deactivated users cannot log in.
- **Protection**: admin accounts cannot be deactivated (to prevent self-lockout).

### Admin Project Management

At `/admin/projects`:

- View all projects with item counts and current visibility
- **Toggle public/private**: hide projects from the homepage without deleting them

### Email Dashboard

At `/admin/emails`:

- **Today's stats** by email type (welcome, message notification, intent received, etc.)
- **Failure count**: identify sending issues
- **30-day trends**: daily email volume breakdown chart
- **Last 50 emails**: log list with recipient, subject, type, status, timestamp
- **Resend API key management**: update the Resend API key directly from the UI (stored in `app_settings` table, not just the environment variable)

---

## Language Support

The platform is fully available in **English** and **French**.

- Use the **language switcher** in the header to change language.
- All pages, forms, emails, status labels, and error messages are translated.
- The URL includes the locale: `/en/project/my-sale` or `/fr/project/my-sale`.

---

## Tips & Best Practices

### For Buyers

- **Wishlist first**, then submit an intent — this groups your desired items for the seller.
- Check `/reservations` regularly after submitting an intent — the seller may reserve items for you.
- Use in-app messaging for quick questions about item condition or pickup logistics.

### For Sellers

- **Organize items into projects** by theme or location for a clean browsing experience.
- Use **categories** within projects to help buyers navigate large inventories.
- Set **accurate conditions and prices** — buyers see the savings percentage from the original price.
- Upload **high-quality photos** — the system auto-optimizes them (WebP, resized to max 1920px).
- When an intent comes in, **reserve items quickly** — buyers appreciate responsiveness.
- Use the **buyer linking** feature to maintain traceability through the full purchase lifecycle.

### For Admins

- Monitor the **email dashboard** regularly — sending failures indicate a misconfigured API key.
- Use account deactivation sparingly — it's a blunt tool (the user cannot log in at all).
- Review new projects for quality and appropriate content.