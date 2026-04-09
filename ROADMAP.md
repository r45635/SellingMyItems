# SellingMyItems — Roadmap

Fonctionnalités et améliorations prévues pour les futures versions.

---

## Multi-rôle par utilisateur

**Priorité** : Moyenne
**Complexité** : Moyenne

### Contexte
L'architecture actuelle ne permet qu'un seul rôle par utilisateur (`profiles.role` = enum scalar). Un utilisateur ne peut pas être à la fois seller et admin, ou purchaser et seller.

### Objectif
Permettre à un même compte (même email) de cumuler plusieurs rôles : `purchaser`, `seller`, `admin`.

### Approche recommandée
Remplacer le champ `role userRoleEnum` par un champ `roles text[]` dans la table `profiles` :

- Migration : `ALTER TABLE profiles ADD COLUMN roles text[] DEFAULT '{purchaser}'; UPDATE profiles SET roles = ARRAY[role::text]; ALTER TABLE profiles DROP COLUMN role;`
- Modifier `AppUser.role` → `AppUser.roles: string[]`
- Guards : `requireSeller()` → `if (!user.roles.includes("seller"))`, idem pour `requireAdmin()`
- `signUpAction` : créer avec `roles: ['purchaser']`
- Nav : afficher les liens seller dashboard et/ou admin selon les rôles présents
- Admin accounts page : afficher/éditer les rôles multiples

### Fichiers impactés
- `src/db/schema/index.ts` — champ `roles` remplace `role`
- `src/db/migrations/` — nouvelle migration
- `src/lib/auth/index.ts` — `AppUser`, `getUser()`, `requireSeller()`, `requireAdmin()`
- `src/lib/auth/actions.ts` — `signUpAction()`
- `src/components/layout/user-nav.tsx` — liens conditionnels multi-rôle
- `src/features/admin-dashboard/actions.ts` — gestion des rôles
- `src/app/[locale]/(admin)/admin/accounts/page.tsx` — affichage multi-rôle

---

## Améliorations futures (à prioriser)

- [ ] SEO : activer `isSeoIndexable` par projet pour le référencement public
- [ ] Analytics seller : vues, wishlists, intents par projet/item
- [ ] Export : CSV/PDF des items, intents, conversations
- [ ] Co-sellers : inviter d'autres utilisateurs à gérer un projet
- [ ] Notifications : email ou in-app pour nouveaux messages/intents
- [ ] Recherche : barre de recherche globale sur les items publics
- [ ] Pagination : admin tables + listes de projets/items
- [ ] i18n admin : traduire le dashboard admin (actuellement FR uniquement)
