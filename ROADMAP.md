# SellingMyItems — Roadmap

What's planned next. The detailed history of what shipped lives in the git log and
in `src/db/migrations/` — this file stays short on purpose.

---

## Up next

The three items that were in reserve — **admin i18n**, **more countries**, and
**storage scaling** — all shipped (July 2026), so the backlog is currently clear.

Concrete follow-ups:

- [ ] **Activate object storage in production** — the `StorageProvider` abstraction
  and the S3/R2 provider are in place but inactive. To switch prod off the local
  filesystem: create an R2 (or S3) bucket, set the `STORAGE_*` env vars, add the
  public host to `next.config.ts` `images.remotePatterns`, and migrate existing
  files from the `uploads` volume to the bucket.
- [ ] **Spot-check geocoding for the new countries** — Nominatim is country-agnostic,
  but GB/NL alphanumeric postcodes (`SW1A 1AA`, `1011 AB`) should be verified live.

Open backlog (unscheduled):

- [ ] Widen countries further (e.g. PT, IE, AT, CH) — the currency defaults already
  cover the euro zone; only `src/lib/countries.ts` + phone prefixes need entries.
- [ ] Image storage housekeeping — background sweep for any legacy orphaned files
  predating the delete-on-edit fix.

---

## Shipped (summary)

Condensed — see the git history and migrations for details.

| Area | Notes |
|---|---|
| **Admin i18n** | Admin dashboard translated EN+FR (`admin` namespace); locale-aware dates & plurals. |
| **Countries + GBP** | GB/DE/ES/IT/BE/NL supported (phone + geo); GBP added end to end (migration `0029`); `src/lib/countries.ts` as the single source of truth. |
| **Storage abstraction** | `StorageProvider` — local FS by default, S3/R2 opt-in via env; fixed two orphaned-file bugs. |
| **Automated tests** | Vitest (unit) + Playwright (E2E golden path). |
| **Co-sellers** | Per-project collaborators (migration `0028`). |
| **Multi-capability accounts** | buyer / seller / admin derived from data, no static role enum. |
| **Purchase intents** | `/my-intents` hub, status lifecycle, in-app messaging deep-links. |
| **Multi-currency + geo + prefs** | `currency_code` enum, Nominatim geocoding + radius, per-user locale/distance/currency. |
| **Share links** | Short-lived per-item links for invitation-only projects (migration `0023`). |
| **Progressive HD images** | Dual-resolution WebP (migration `0027`). |
| **Accent-insensitive search** | PostgreSQL `unaccent`. |
| **Security & GDPR** | HTTP security headers, account deletion, data export (Art. 20), deletion audit log (Art. 17), 90-day email-log retention. |
| **Distributed rate limiting** | Redis with graceful in-memory fallback. |
| **Seller UX** | analytics (views/wishlists/intents), browser-GPS location, per-project SEO toggle, pagination, CSV export, E.164 phone normalization, FX-rate display hints. |
