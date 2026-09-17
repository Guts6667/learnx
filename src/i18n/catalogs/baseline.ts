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
 * 31 août 2026 (V4.5-177) — une clé ajoutée, `aiCorrection.toCheckEvidenceOutsideAnswer`.
 * Un critère dont l'extrait cité ne provenait pas de la copie de l'apprenant
 * est désormais livré en « à vérifier » au lieu d'être retiré en silence, et
 * il lui faut sa propre phrase : la formulation existante
 * (`toCheckExplanation`) parle d'une vérification indépendante non
 * concluante, ce qui n'est pas ce qui s'est passé. Deux causes distinctes,
 * deux phrases, jamais les deux ensemble sur un même critère.
 * 1156 → 1157 clés.
 *
 * 31 août 2026 (V4.5-213) — sept clés ajoutées. Six forment le fragment
 * `creditPack.*` : la carte d'un palier est affichée par deux surfaces,
 * l'écran d'achat et la section tarifs publique, qui n'ont ni la même mise en
 * page ni la même action mais disent les mêmes chiffres sur le même produit.
 * Un seul jeu de phrases, sinon celui qu'on ne relit pas devient faux. La
 * septième, `credits.purchase.refusalEntryTierAlreadyPurchased`, dit le refus
 * 409 du palier limité à un achat par compte.
 * 1157 → 1164 clés.
 *
 * 31 août 2026 (V4.5-168) — cinq clés ajoutées, `profile.reuseConsent*`.
 * Seconde moitié du consentement de réutilisation : le schéma et la règle de
 * détachement existaient déjà, mais rien ne permettait à l'apprenant de donner
 * ou de retirer le consentement qu'ils lisent. La description dit aussi ce que
 * le REFUS entraîne — les textes supprimés plutôt que conservés sous
 * pseudonyme — parce qu'un défaut silencieux se lirait comme une absence de
 * décision. Libellé et description réécrits par le Head of UX/UI avant
 * fusion : l'ancien intitulé nommait la mauvaise chose, le détachement ayant
 * lieu dans les deux cas.
 * 1164 → 1169 clés.
 *
 * 2 septembre 2026 (landing v2) — nombre de clés inchangé, deux empreintes
 * nouvelles. `creditPack.bonus` disparaît et `creditPack.recommended` le
 * remplace : les totaux de crédits incluent désormais le bonus early adopter,
 * donc le surplus au-dessus de la parité n'est plus une ligne de carte, et un
 * palier est mis en avant (arbitrage de Rayan).
 * 1169 clés, inchangé.
 *
 * 17 septembre 2026 (AI recovery) — `aiCorrection.comparisonWithheld`
 * explique pourquoi des niveaux à vérifier ne sont pas comparés, sans
 * affirmer à tort qu'ils sont inchangés. 1169 → 1170 clés.
 */
export const messageCatalogBaseline = {
  keyCount: 1170,
  sha256: {
    en: 'bf8bcc2a58aa4e303a555f521e7d2136a719901d84410c74bd2860e065454e95',
    fr: '6d842f420ff32569eefa28a7913aa3321132411779c9091387e79a76bb240bd9',
  },
} as const;
