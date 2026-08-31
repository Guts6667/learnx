/**
 * L'empreinte de référence des catalogues (V4.1-404).
 *
 * Elle ne se met à jour qu'avec la raison du changement, pour qu'une clé
 * ajoutée reste une décision lisible et non un chiffre qu'on réaligne.
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
 */
export const messageCatalogBaseline = {
  keyCount: 1164,
  sha256: {
    en: '6920c4eba55a505a8f8b6fe059b762523f4b3ac7a7607498f25ae73b6c3a1ffb',
    fr: '3646bf9fd45bd3d3aa185f1cecf0a43b7ea1b08a7d2b6501e668c385cfeb8b16',
  },
} as const;
