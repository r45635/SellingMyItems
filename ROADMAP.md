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

## Améliorations futures (à prioriser)

- [ ] SEO : activer `isSeoIndexable` par projet pour le référencement public
- [ ] Analytics seller : vues, wishlists, intents par projet/item
- [ ] Export : CSV/PDF des items, intents, conversations
- [ ] Co-sellers : inviter d'autres utilisateurs à gérer un projet
- [ ] Notifications : email ou in-app pour nouveaux messages/intents
- [ ] Recherche : barre de recherche globale sur les items publics
- [ ] Pagination : admin tables + listes de projets/items
- [ ] i18n admin : traduire le dashboard admin (actuellement FR uniquement)
