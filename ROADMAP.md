# SellingMyItems — Roadmap

Fonctionnalités et améliorations prévues pour les futures versions.

---

## Multi-capacités par utilisateur — ✅ Livré

**Statut** : implémenté (migrations 0018 + 0019)

L'ancienne architecture mono-rôle (`profiles.role` enum scalaire) a été
remplacée par un modèle de **capacités dérivées des données** :

- **buyer** : tout utilisateur connecté
- **seller** : présence d'une ligne dans `seller_accounts` (créée automatiquement à la première création de projet)
- **admin** : `profiles.is_admin = true` (positionné manuellement en SQL)

Un même compte cumule désormais buyer + seller + admin sans contrainte.
Un sélecteur de contexte dans le header permet aux utilisateurs multi-capacités
de basculer entre les environnements (buyer / seller / admin), avec routing
automatique des messages vers le bon côté.

Voir `getUserCapabilities()` dans `src/lib/auth/index.ts`.

---

## Refonte purchase intents — ✅ Livré

**Statut** : implémenté (migration 0020)

- Espace buyer dédié `/my-intents` avec tabs Active / Archived, cancel sur les pending, re-send sur les declined / cancelled, archive sur les terminales
- Status `cancelled` ajouté au `intent_status` enum (libère le lock 1-active-par-projet)
- `archived_at` partagé buyer↔seller, `reviewer_note` optionnel sur decline (mirror de la review project)
- Messages système auto dans le thread quand le seller accept / decline / le buyer cancel — l'unread badge global notifie sans dépendre de l'email
- FK `conversation_threads.intent_id` pour deep-link de chaque carte intent vers son thread
- Côté seller : tabs + filtres status + bouton Message buyer + decline-with-note inline

---

## Multi-devise + localisation + préférences user — ✅ Livré

**Statut** : implémenté (migrations 0021 + 0022)

- `currency_code` enum (USD / EUR / CAD) sur `items.currency` et `profiles.default_currency`
- Préférences utilisateur sur `profiles` : `preferred_locale`, `distance_unit`, `default_currency`
- **Tous les emails sortants** lisent désormais `recipient.preferredLocale` au lieu du `"fr"` hardcodé
- Localisation buyer + seller : `country_code`, `postal_code`, `latitude`, `longitude` sur `profiles` et `projects` ; geocoding via Nominatim/OSM avec cache `geocoded_locations` et rate limit 1 req/s
- Restriction seller optionnelle : `projects.radius_km` exclut les buyers hors zone
- Homepage : chip row radius + affichage "X km/mi away" par carte
- Validation phone vs country prefix (FR→+33, US/CA→+1)
- Helper centralisé `formatPrice(amount, currency, locale)` + `formatDistance(km, unit, locale)` dans `src/lib/format.ts`
- Extensions Postgres `cube` + `earthdistance` activées pour les requêtes haversine

---

## Liens de partage (Share Links) — ✅ Livré

**Statut** : implémenté (migration 0023)

Permet aux sellers de partager un item d'un projet invitation-only via une URL courte, sans passer par le flux standard demande d'accès.

- Nouvelle table `item_share_links` : token unique 24 chars (base64url depuis `randomBytes(18)`), expiry 30 jours, révocation individuelle
- Valeur `share_link` ajoutée à l'enum `access_grant_source`
- Page publique `/share/[token]` : teaser (image, titre, prix) pour les visiteurs non authentifiés ; claim automatique + redirection vers l'item pour les utilisateurs connectés
- Page robots `noindex` — les liens restent privés vis-à-vis des moteurs de recherche
- Page de gestion seller `/seller/projects/[id]/share-links` : générer, copier, révoquer par item
- Dialog `ShareItemDialog` (Base UI, pattern `render` prop) directement depuis la fiche item
- Server actions dans `src/features/items/share-actions.ts` : `createItemShareLinkAction`, `revokeItemShareLinkAction`, `claimShareLinkAction`, `getProjectShareLinksAction`

---

## Sécurité & conformité GDPR — ✅ Livré

**Statut** : implémenté (mai 2026)

Audit complet de sécurité et de conformité GDPR, résultat d'un audit interne.

**Sécurité (S)**

- **S1** — Endpoint `/api/dev-session` protégé par un guard `NODE_ENV !== 'development'` ; retourne 404 en production.
- **S2** — Correction de l'escalade de privilèges sur les liens de partage : `userCanShareItem()` ne vérifie plus que `isProjectSeller`, le chemin `userHasProjectAccess` a été supprimé.
- **S3** — `searchBuyersAction` restreint : seuls les acheteurs ayant déjà un intent ou un thread sur un projet du vendeur sont renvoyés ; longueur minimale de requête portée à 3 caractères (contre 2) pour limiter l'énumération d'utilisateurs.
- **S4** — En-têtes de sécurité HTTP ajoutés globalement via `next.config.ts` : `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`.
- **S5** — Pattern `*.supabase.co` supprimé de `images.remotePatterns` (résidu d'une ancienne architecture).
- **S7** — Longueur minimale du mot de passe portée de 6 à **8 caractères** (actions.ts + validations + champs HTML).

**GDPR (G)**

- **G1** — Suppression de compte : bouton dans `/account` avec confirmation par mot de passe. Supprime le profil (cascade DB), retire les fichiers uploadés du disque, efface les logs email, ferme la session et redirige vers `/login`.
- **G2** — Pages **Politique de confidentialité** (`/privacy`) et **Conditions d'utilisation** (`/terms`) créées (EN + FR), avec liens dans le footer.
- **G3** — Rétention des logs email limitée à **90 jours** : migration `0024` crée la fonction `purge_old_email_logs()` et `scripts/run-migrations.sh` l'appelle à chaque déploiement.
- **G5** — Bandeau de consentement cookie affiché sur les pages `/login` et `/signup`, avec lien vers la politique de confidentialité.

---

## Améliorations futures (à prioriser)

### ✅ Export des données personnelles (GDPR Art. 20) — Livré

**Priorité** : Haute — obligation légale (droit à la portabilité)

- [x] Route API `GET /api/account/export` : authentification requise (session cookie), Content-Type `application/json`, header `Content-Disposition: attachment; filename="my-data-<date>.json"` — collecte profil, projets/items/images/fichiers/liens vendeur, intentions acheteur, conversations + messages, wishlist, historique e-mails
- [x] Composant client `ExportDataForm` dans `/account` : bouton **"Télécharger mes données"**, feedback loading/erreur/rate-limit, téléchargement via `fetch` + `URL.createObjectURL`
- [x] Rate-limit : 1 export toutes les 24 h via colonne `last_data_export_at` dans `profiles` (multi-instance safe, sans Redis)
- [x] I18n : clés `account.exportData`, `account.exportDataDesc`, `account.exportDataButton`, `account.exportDataLoading`, `account.exportDataRateLimit`, `account.exportDataError` en EN + FR
- [x] Migration `0025_add-last-data-export-at.sql` : colonne `last_data_export_at timestamptz` sur `profiles`

---

### ✅ Droit à l'effacement renforcé (GDPR Art. 17) — Livré

**Priorité** : Haute — complément de la suppression de compte déjà en place

- [x] Log d'audit de suppression : table `deletion_log (id, email_hash, deleted_at, items_count, images_count, messages_count, intents_count)` — email haché SHA-256, traçabilité sans réidentification
- [x] `deleteAccountAction` mis à jour : compte items/images/messages/intents avant suppression, insère dans `deletion_log` post-suppression
- [x] Migration `0026_deletion-log.sql` : table `deletion_log` avec index sur `deleted_at`

---

### ✅ Rate limiting distribué (Redis) — Livré

**Priorité** : Moyenne — nécessaire avant toute montée en charge ou déploiement multi-instance

- [x] `ioredis ^5.10.1` ajouté aux dépendances
- [x] `docker-compose.yml` : service `redis:7-alpine`, volume persistant `redisdata`, health-check, `REDIS_URL` injecté dans l'app
- [x] Variable d'environnement `REDIS_URL` — fallback gracieux vers `Map` en mémoire si absent (dev sans Redis)
- [x] `src/lib/security/redis-client.ts` : singleton Redis sur `globalThis`, `connectTimeout: 2000`, `commandTimeout: 1000`, `maxRetriesPerRequest: 1`
- [x] `consumeRateLimit` rendu `async` — backend Redis (INCR + EXPIRE, fixed-window) avec fallback in-memory
- [x] Tous les call sites mis à jour avec `await` (upload, messages, intents, auth ×5)

---

- [ ] SEO : activer `isSeoIndexable` par projet pour le référencement public
- [ ] Analytics seller : vues, wishlists, intents par projet/item
- [ ] Export CSV des items, intents, conversations (seller dashboard)
- [ ] Co-sellers : inviter d'autres utilisateurs à gérer un projet
- [ ] Pagination : admin tables + listes de projets/items
- [ ] i18n admin : traduire le dashboard admin (actuellement EN uniquement)
- [ ] Élargir la liste des pays supportés (US/CA/FR aujourd'hui) — ajouter UK, DE, ES, IT, BE, NL minima
- [ ] FX rates pour comparaison cross-devise (UI seulement, pas de conversion stockée)
- [ ] Image storage scaling : passer du local FS à un object store (S3/R2) pour mieux scaler
- [ ] Phone international : E.164 strict avec libphonenumber pour validations plus robustes
- [ ] Browser Geolocation API en option pour auto-fill du postal code (avec consent explicite)
- [ ] Framework de tests : Vitest + React Testing Library (unit/integration) + Playwright (E2E)
