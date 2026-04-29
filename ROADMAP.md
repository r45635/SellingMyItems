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

## Améliorations futures (à prioriser)

- [ ] SEO : activer `isSeoIndexable` par projet pour le référencement public
- [ ] Analytics seller : vues, wishlists, intents par projet/item
- [ ] Export : CSV/PDF des items, intents, conversations (PDF déjà partiel)
- [ ] Co-sellers : inviter d'autres utilisateurs à gérer un projet
- [ ] Notifications in-app : table dédiée pour acceptance / decline / nouveau message (aujourd'hui uniquement par messages thread + email)
- [ ] Pagination : admin tables + listes de projets/items
- [ ] i18n admin : traduire le dashboard admin (actuellement EN uniquement)
- [ ] Élargir la liste des pays supportés (US/CA/FR aujourd'hui) — ajouter UK, DE, ES, IT, BE, NL minima
- [ ] FX rates pour comparaison cross-devise (UI seulement, pas de conversion stockée)
- [ ] Image storage scaling : passer du local FS à un object store (S3/R2) pour mieux scaler
- [ ] Phone international : E.164 strict avec libphonenumber pour validations plus robustes
- [ ] Browser Geolocation API en option pour auto-fill du postal code (avec consent explicite)
