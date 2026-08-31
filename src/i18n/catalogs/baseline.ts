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
 *
 * Libellé et description réécrits par le Head of UX/UI avant fusion : l'ancien
 * intitulé nommait la mauvaise chose. Le détachement a lieu dans les deux cas ;
 * la case ne commande que la survie des textes. Un consentement dont
 * l'intitulé désigne autre chose que ce qu'il autorise est fragile. Aucune clé
 * ajoutée — seules les empreintes bougent.
 */
export const messageCatalogBaseline = {
  keyCount: 1161,
  sha256: {
    en: '37e65a3b4fca1cbe98f83f393a80cb7485a946c9784d0241bc173f57bbcac71d',
    fr: 'e828e2d2c894ea1bd329dad5e9321a01a8ae6970f2ef7935ef31067a4eabe317',
  },
} as const;
