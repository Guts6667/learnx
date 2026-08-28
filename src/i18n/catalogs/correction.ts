import type { TranslationOf } from '@/i18n/catalogs/types';

export const frenchCorrectionMessages = {
  'aiCorrection.assistedLabel': 'Correction assistée par IA',
  'aiCorrection.intro':
    'Recevez un retour formatif critère par critère sur cette production.',
  'aiCorrection.doctrineNotice':
    'Ce retour est indicatif et n’a aucun effet sur votre progression.',
  'aiCorrection.seePrice': 'Corriger',
  'aiCorrection.readyTitle': 'Obtenir une correction formative',
  'aiCorrection.quoteTitle': 'Devis de correction',
  'aiCorrection.errorTitle': 'Correction interrompue',
  'aiCorrection.unavailableTitle': 'Résultat temporairement indisponible',
  'aiCorrection.reworkLabel': 'À retravailler',
  'aiCorrection.contractCostLabel': 'Coût avant confirmation',
  'aiCorrection.contractCostPending': 'Devis affiché avant tout débit',
  'aiCorrection.contractEstimateLabel': 'Coût estimé en crédits',
  'aiCorrection.contractCeilingLabel': 'Plafond réservé en crédits',
  'aiCorrection.contractFailureLabel': 'Résultat inutilisable',
  'aiCorrection.contractFailureValue': 'Aucun débit supplémentaire',
  'aiCorrection.contractProgressLabel': 'Progression',
  'aiCorrection.processingTitle': 'Analyse en cours',
  'aiCorrection.processingShort': 'Correction en cours',
  'aiCorrection.processingDescription':
    'LearnX analyse votre réponse critère par critère et vérifie les extraits utilisés.',
  'aiCorrection.processingReceived': 'Réponse reçue',
  'aiCorrection.processingCriteria': 'Analyse des critères',
  'aiCorrection.processingEvidence': 'Vérification des extraits',
  'aiCorrection.processingSynthesis': 'Préparation du retour',
  'aiCorrection.quotePending': 'Préparation du devis de correction',
  'aiCorrection.historyPending': 'Recherche de votre dernière correction',
  'aiCorrection.historyTitle': 'Historique des corrections',
  'aiCorrection.historyCount': '{count} corrections conservées',
  'aiCorrection.historyEntry': 'Correction {index} · {date}',
  'aiCorrection.comparisonTitle': 'Évolution depuis la correction précédente',
  'aiCorrection.comparisonChange': '{previous} → {current}',
  'aiCorrection.comparisonStable': 'Aucun niveau critériel n’a changé.',
  'aiCorrection.quoteError': 'Le devis n’a pas pu être préparé.',
  'aiCorrection.quoteSummary':
    'Estimation : {estimated} crédits · plafond réservé : {maximum} crédits.',
  'aiCorrection.quoteAction':
    'Action : correction formative standard, déduite de votre allocation offerte.',
  'aiCorrection.consentNotice':
    'Certains critères peuvent revenir à retravailler sans compensation. Une vérification ciblée éventuelle est incluse dans le plafond.',
  'aiCorrection.confirm': 'Confirmer et lancer la correction',
  'aiCorrection.runError': 'La correction n’a pas pu être exécutée.',
  'aiCorrection.newQuote': 'Demander un nouveau devis',
  'aiCorrection.unavailable':
    'Aucun critère utilisable n’a pu être restitué. Le débit reste celui du devis accepté, conformément au consentement donné avant l’exécution.',
  'aiCorrection.settlementRecap':
    'Plafond réservé : {reserved} · débité : {settled} · libéré : {released} crédits.',
  'aiCorrection.noProgressImpact': 'Sans effet sur la progression',
  'aiCorrection.acquired': 'Acquis',
  'aiCorrection.toReinforce': 'À renforcer',
  'aiCorrection.reworkCriterion':
    'Le critère « {criterion} » est à retravailler avant une nouvelle soumission.',
  'aiCorrection.nextAction': 'Prochaine action',
  'aiCorrection.indicativeScore': 'Score indicatif : {score} %',
  'aiCorrection.evidenceLabel': 'Extrait de votre réponse',
  'aiCorrection.appreciation': 'Appréciation LearnX',
  'aiCorrection.resultTitle': 'Votre retour critériel est prêt',
  'aiCorrection.priority': 'Amélioration prioritaire',
  'aiCorrection.transparency': 'Transparence',
  'aiCorrection.verification': 'Vérification',
  'aiCorrection.verificationIncluded': 'Incluse',
  'aiCorrection.reconsiderationShort': 'Réexamen',
  'aiCorrection.reconsiderationEyebrow': 'Contester ce retour',
  'aiCorrection.reconsiderationTitle': 'Demander un réexamen argumenté',
  'aiCorrection.reconsiderationDescription':
    'Expliquez précisément le point à réexaminer. Votre réponse et la rubrique restent inchangées ; cette demande lance une nouvelle correction facturable, pas une discussion.',
  'aiCorrection.reconsiderationArgumentLabel': 'Votre argument',
  'aiCorrection.reconsiderationArgumentHelp':
    '20 à 500 caractères. N’ajoutez pas de nouveaux éléments à votre réponse.',
  'aiCorrection.reconsiderationQuote': 'Obtenir le devis de réexamen',
  'aiCorrection.reconsiderationQuoteAction':
    'Action : réexamen indépendant de la même réponse et de la même rubrique, déduit de votre allocation offerte.',
  'aiCorrection.reconsiderationConsentNotice':
    'Une seule contestation est possible pour cette correction. L’argument signale le point contesté mais ne devient jamais une preuve de votre réponse.',
  'aiCorrection.reconsiderationConfirm': 'Confirmer et lancer le réexamen',
  'credits.eyebrow': 'Crédits LearnX',
  'credits.title': 'Mes crédits',
  'credits.description':
    'Vos deux soldes restent distincts et sont calculés depuis les écritures du ledger.',
  'credits.loadError': 'Vos crédits n’ont pas pu être chargés.',
  'credits.free': 'Crédits offerts ce mois-ci',
  'credits.freeDescription': 'Allocation offerte, distincte de vos achats.',
  'credits.purchased': 'Crédits achetés',
  'credits.purchasedDescription':
    'Ces crédits ne sont pas modifiés par un changement de rôle ou une suspension.',
  'credits.total': 'Disponible au total',
  'credits.totalDescription': 'Total secondaire des deux origines.',
  'credits.reserved': 'Crédits réservés',
  'credits.reservedDescription': 'Ventilation figée pour les actions en cours.',
  'credits.increase.title': 'Demander une augmentation exceptionnelle',
  'credits.increase.description':
    'Expliquez votre besoin. Une demande n’accorde aucun crédit automatiquement.',
  'credits.increase.pending': 'Une demande est déjà en attente de revue.',
  'credits.increase.reason': 'Motif de la demande',
  'credits.increase.submit': 'Envoyer la demande',
  'credits.increase.success': 'Votre demande a été transmise.',
  'credits.increase.error': 'La demande n’a pas pu être envoyée.',
} as const;

export const englishCorrectionMessages = {
  'aiCorrection.assistedLabel': 'AI-assisted correction',
  'aiCorrection.intro':
    'Receive criterion-by-criterion formative feedback on this submission.',
  'aiCorrection.doctrineNotice':
    'This feedback is indicative and does not affect your progress.',
  'aiCorrection.seePrice': 'Correct',
  'aiCorrection.readyTitle': 'Get formative feedback',
  'aiCorrection.quoteTitle': 'Correction quote',
  'aiCorrection.errorTitle': 'Correction interrupted',
  'aiCorrection.unavailableTitle': 'Result temporarily unavailable',
  'aiCorrection.reworkLabel': 'Needs rework',
  'aiCorrection.contractCostLabel': 'Cost before confirmation',
  'aiCorrection.contractCostPending': 'Quote shown before any charge',
  'aiCorrection.contractEstimateLabel': 'Estimated cost in credits',
  'aiCorrection.contractCeilingLabel': 'Reserved ceiling in credits',
  'aiCorrection.contractFailureLabel': 'Unusable result',
  'aiCorrection.contractFailureValue': 'No additional charge',
  'aiCorrection.contractProgressLabel': 'Progress',
  'aiCorrection.processingTitle': 'Analysis in progress',
  'aiCorrection.processingShort': 'Correction in progress',
  'aiCorrection.processingDescription':
    'LearnX reviews your answer criterion by criterion and verifies every excerpt it uses.',
  'aiCorrection.processingReceived': 'Answer received',
  'aiCorrection.processingCriteria': 'Reviewing criteria',
  'aiCorrection.processingEvidence': 'Verifying excerpts',
  'aiCorrection.processingSynthesis': 'Preparing feedback',
  'aiCorrection.quotePending': 'Preparing the correction quote',
  'aiCorrection.historyPending': 'Loading your latest correction',
  'aiCorrection.historyTitle': 'Correction history',
  'aiCorrection.historyCount': '{count} saved corrections',
  'aiCorrection.historyEntry': 'Correction {index} · {date}',
  'aiCorrection.comparisonTitle': 'Change since the previous correction',
  'aiCorrection.comparisonChange': '{previous} → {current}',
  'aiCorrection.comparisonStable': 'No criterion level has changed.',
  'aiCorrection.quoteError': 'The quote could not be prepared.',
  'aiCorrection.quoteSummary':
    'Estimate: {estimated} credits · reserved ceiling: {maximum} credits.',
  'aiCorrection.quoteAction':
    'Action: standard formative correction, deducted from your complimentary allocation.',
  'aiCorrection.consentNotice':
    'Some criteria may come back for rework without compensation. Any targeted verification is included in the initial ceiling.',
  'aiCorrection.confirm': 'Confirm and start the correction',
  'aiCorrection.runError': 'The correction could not be completed.',
  'aiCorrection.newQuote': 'Request a new quote',
  'aiCorrection.unavailable':
    'No usable criterion could be returned. The charge remains the accepted quote amount, as stated before execution.',
  'aiCorrection.settlementRecap':
    'Reserved ceiling: {reserved} · charged: {settled} · released: {released} credits.',
  'aiCorrection.noProgressImpact': 'No effect on progress',
  'aiCorrection.acquired': 'Acquired',
  'aiCorrection.toReinforce': 'To reinforce',
  'aiCorrection.reworkCriterion':
    'The “{criterion}” criterion needs rework before a new submission.',
  'aiCorrection.nextAction': 'Next action',
  'aiCorrection.indicativeScore': 'Indicative score: {score}%',
  'aiCorrection.evidenceLabel': 'Excerpt from your response',
  'aiCorrection.appreciation': 'LearnX assessment',
  'aiCorrection.resultTitle': 'Your criterion-based feedback is ready',
  'aiCorrection.priority': 'Priority improvement',
  'aiCorrection.transparency': 'Transparency',
  'aiCorrection.verification': 'Verification',
  'aiCorrection.verificationIncluded': 'Included',
  'aiCorrection.reconsiderationShort': 'Reconsideration',
  'aiCorrection.reconsiderationEyebrow': 'Challenge this feedback',
  'aiCorrection.reconsiderationTitle': 'Request an argued reconsideration',
  'aiCorrection.reconsiderationDescription':
    'Explain precisely what should be reconsidered. Your answer and rubric remain unchanged; this starts a new paid correction, not a conversation.',
  'aiCorrection.reconsiderationArgumentLabel': 'Your argument',
  'aiCorrection.reconsiderationArgumentHelp':
    '20 to 500 characters. Do not add new material to your answer.',
  'aiCorrection.reconsiderationQuote': 'Get a reconsideration quote',
  'aiCorrection.reconsiderationQuoteAction':
    'Action: independent reconsideration of the same answer and rubric, deducted from your complimentary allocation.',
  'aiCorrection.reconsiderationConsentNotice':
    'Only one challenge is allowed for this correction. Your argument identifies the disputed point but never becomes evidence for your answer.',
  'aiCorrection.reconsiderationConfirm':
    'Confirm and start the reconsideration',
  'credits.eyebrow': 'LearnX credits',
  'credits.title': 'My credits',
  'credits.description':
    'Your two balances remain distinct and are calculated from ledger entries.',
  'credits.loadError': 'Your credits could not be loaded.',
  'credits.free': 'Complimentary credits this month',
  'credits.freeDescription':
    'A complimentary allocation, separate from purchases.',
  'credits.purchased': 'Purchased credits',
  'credits.purchasedDescription':
    'Role changes and suspensions never alter these credits.',
  'credits.total': 'Total available',
  'credits.totalDescription': 'A secondary total across both origins.',
  'credits.reserved': 'Reserved credits',
  'credits.reservedDescription':
    'The allocation is fixed for actions in progress.',
  'credits.increase.title': 'Request an exceptional increase',
  'credits.increase.description':
    'Explain your need. A request never grants credits automatically.',
  'credits.increase.pending': 'A request is already awaiting review.',
  'credits.increase.reason': 'Reason for the request',
  'credits.increase.submit': 'Send request',
  'credits.increase.success': 'Your request was sent.',
  'credits.increase.error': 'The request could not be sent.',
} as const satisfies TranslationOf<typeof frenchCorrectionMessages>;
