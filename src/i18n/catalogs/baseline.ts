/**
 * L'empreinte de référence des catalogues (V4.1-404).
 *
 * Elle ne se met à jour qu'avec la raison du changement, pour qu'une clé
 * ajoutée reste une décision lisible et non un chiffre qu'on réaligne.
 *
 * Piège à connaître : le message d'échec de `pnpm i18n:check` interpole
 * l'empreinte qu'il vient de CALCULER, pas celle qui est stockée ici. Le
 * chiffre qu'il affiche est donc la nouvelle valeur, pas la référence.
 *
 * 31 août 2026 (V4.5-168) — cinq clés ajoutées, `profile.reuseConsent*`.
 * Seconde moitié du consentement de réutilisation : le schéma et la règle de
 * détachement existaient déjà, mais rien ne permettait à l'apprenant de donner
 * ou de retirer le consentement qu'ils lisent. La description dit aussi ce que
 * le REFUS entraîne — les textes supprimés plutôt que conservés sous
 * pseudonyme — parce qu'un défaut silencieux se lirait comme une absence de
 * décision. 1156 → 1161 clés.
 */
export const messageCatalogBaseline = {
  keyCount: 1161,
  sha256: {
    en: 'b520b751ac973986f80914e26f950bbba078c74f4f7e2cad971137a5b6ab5cb4',
    fr: '10d70a250f817d58a0ad8edcb30791691ddaf6b394ab84fa61ef08dad51d8fad',
  },
} as const;
