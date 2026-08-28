import type { TranslationOf } from '@/i18n/catalogs/types';

export const frenchAdminCreditsMessages = {
  'admin.credits.title': 'Allocations et crédits',
  'admin.credits.description':
    'Consultez les soldes issus du ledger et effectuez des ajustements offerts traçables.',
  'admin.credits.open': 'Administrer les crédits',
  'admin.credits.search': 'Rechercher un membre',
  'admin.credits.adjust': 'Ajuster',
  'admin.credits.adjustTitle': 'Ajuster l’allocation offerte',
  'admin.credits.memberError': 'Le détail des crédits n’a pas pu être chargé.',
  'admin.credits.amount': 'Montant en crédits',
  'admin.credits.amountDescription': 'Saisissez un nombre entier positif.',
  'admin.credits.operation': 'Opération',
  'admin.credits.operationGrant': 'Attribuer des crédits offerts',
  'admin.credits.operationReduce': 'Compenser une attribution offerte',
  'admin.credits.compensates': 'Attribution à compenser',
  'admin.credits.compensatesPlaceholder': 'Sélectionner une attribution',
  'admin.credits.expiration': 'Expiration facultative',
  'admin.credits.expirationDescription':
    'Aucune durée n’est appliquée par défaut. Renseignez une date seulement si elle a été décidée pour cette attribution.',
  'admin.credits.noExpiration': 'Aucune expiration',
  'admin.credits.reason': 'Motif obligatoire',
  'admin.credits.review': 'Vérifier le récapitulatif',
  'admin.credits.summary': 'Récapitulatif avant validation',
  'admin.credits.summaryNotice':
    'Cette opération crée une écriture compensatoire auditée. Elle ne modifie ni ne supprime les écritures existantes et n’affecte jamais les crédits achetés.',
  'admin.credits.edit': 'Modifier',
  'admin.credits.adjustError': 'L’ajustement n’a pas pu être enregistré.',
  'admin.credits.loadError': 'La liste des crédits n’a pas pu être chargée.',
  'admin.credits.emptyTitle': 'Aucun membre',
  'admin.credits.emptyDescription':
    'Aucun compte ne correspond à cette recherche.',
  'admin.credits.policiesTitle': 'Politiques d’allocation et de limites',
  'admin.credits.policiesInactive':
    'Aucune politique active : aucun montant, ordre, renouvellement ou plafond n’est appliqué par défaut.',
  'admin.credits.policiesConfigured':
    'Une politique active est configurée côté serveur.',
  'admin.credits.renewalUnavailable':
    'Le renouvellement reste indisponible tant qu’une politique versionnée n’a pas été calibrée et activée.',
  'admin.credits.monitoringTitle': 'Coûts et incidents de correction',
  'admin.credits.monitoringDescription':
    'Vue opérationnelle des corrections du pilote et des deux signaux de qualité connus. Le signal de contrainte dure est heuristique et doit être lu comme une alerte, pas comme un verdict.',
  'admin.credits.monitoringError':
    'Les mesures de correction n’ont pas pu être chargées.',
  'admin.credits.monitoringCorrections': 'Corrections enregistrées',
  'admin.credits.monitoringProviderCost': 'Coût fournisseur cumulé',
  'admin.credits.monitoringPartial': 'Corrections partielles',
  'admin.credits.monitoringUnavailable': 'Résultats indisponibles',
  'admin.credits.monitoringConstraint':
    'Alertes contrainte dure non reflétée dans le niveau',
  'admin.credits.monitoringGuard': 'Secondes passes déclenchées par la garde',
  'admin.credits.monitoringUnknownCost': 'Tentatives au coût inconnu',
  'admin.credits.preflightError':
    'L’état de préparation de la correction ne peut pas être vérifié.',
  'admin.credits.preflight.DISABLED':
    'Correction désactivée sur cet environnement',
  'admin.credits.preflight.CONFIGURATION_BLOCKED':
    'Configuration de correction incomplète ou non conforme',
  'admin.credits.preflight.CONFIGURED_CLOSED':
    'Correction configurée — coupe-circuit fermé',
  'admin.credits.preflight.READY': 'Correction configurée et ouverte',
  'admin.credits.preflightIdentity':
    'Environnement {environment} · identité {identity}',
} as const;

export const englishAdminCreditsMessages = {
  'admin.credits.title': 'Allocations and credits',
  'admin.credits.description':
    'Review ledger-derived balances and create traceable complimentary adjustments.',
  'admin.credits.open': 'Manage credits',
  'admin.credits.search': 'Search for a member',
  'admin.credits.adjust': 'Adjust',
  'admin.credits.adjustTitle': 'Adjust complimentary allocation',
  'admin.credits.memberError': 'Credit details could not be loaded.',
  'admin.credits.amount': 'Amount in credits',
  'admin.credits.amountDescription': 'Enter a positive whole number.',
  'admin.credits.operation': 'Operation',
  'admin.credits.operationGrant': 'Grant complimentary credits',
  'admin.credits.operationReduce': 'Compensate a complimentary grant',
  'admin.credits.compensates': 'Grant to compensate',
  'admin.credits.compensatesPlaceholder': 'Select a grant',
  'admin.credits.expiration': 'Optional expiration',
  'admin.credits.expirationDescription':
    'No duration is applied by default. Enter a date only when it was decided for this grant.',
  'admin.credits.noExpiration': 'No expiration',
  'admin.credits.reason': 'Required reason',
  'admin.credits.review': 'Review summary',
  'admin.credits.summary': 'Summary before confirmation',
  'admin.credits.summaryNotice':
    'This operation creates an audited compensating entry. It never changes or deletes existing entries and never affects purchased credits.',
  'admin.credits.edit': 'Edit',
  'admin.credits.adjustError': 'The adjustment could not be recorded.',
  'admin.credits.loadError': 'The credit list could not be loaded.',
  'admin.credits.emptyTitle': 'No members',
  'admin.credits.emptyDescription': 'No account matches this search.',
  'admin.credits.policiesTitle': 'Allocation and limit policies',
  'admin.credits.policiesInactive':
    'No active policy: no amount, order, renewal, or ceiling is applied by default.',
  'admin.credits.policiesConfigured':
    'An active policy is configured on the server.',
  'admin.credits.renewalUnavailable':
    'Renewal remains unavailable until a versioned policy has been calibrated and activated.',
  'admin.credits.monitoringTitle': 'Correction costs and incidents',
  'admin.credits.monitoringDescription':
    'Operational view of pilot corrections and the two known quality signals. The hard-constraint signal is heuristic and should be read as an alert, not a verdict.',
  'admin.credits.monitoringError':
    'Correction monitoring data could not be loaded.',
  'admin.credits.monitoringCorrections': 'Recorded corrections',
  'admin.credits.monitoringProviderCost': 'Cumulative provider cost',
  'admin.credits.monitoringPartial': 'Partial corrections',
  'admin.credits.monitoringUnavailable': 'Unavailable results',
  'admin.credits.monitoringConstraint':
    'Hard-constraint alerts not reflected in level',
  'admin.credits.monitoringGuard': 'Second passes triggered by score guard',
  'admin.credits.monitoringUnknownCost': 'Attempts with unknown cost',
  'admin.credits.preflightError':
    'The correction release state could not be verified.',
  'admin.credits.preflight.DISABLED': 'Correction disabled in this environment',
  'admin.credits.preflight.CONFIGURATION_BLOCKED':
    'Correction configuration incomplete or non-compliant',
  'admin.credits.preflight.CONFIGURED_CLOSED':
    'Correction configured — kill switch closed',
  'admin.credits.preflight.READY': 'Correction configured and open',
  'admin.credits.preflightIdentity':
    'Environment {environment} · identity {identity}',
} as const satisfies TranslationOf<typeof frenchAdminCreditsMessages>;
