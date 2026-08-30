import type { TranslationOf } from '@/i18n/catalogs/types';

export const frenchCorrectionMessages = {
  'aiCorrection.assistedLabel': 'Correction assistée par IA',
  'aiCorrection.intro':
    'Recevez un retour formatif critère par critère sur cette production.',
  'aiCorrection.doctrineNotice':
    'Ce retour est indicatif et n’a aucun effet sur votre progression.',
  'aiCorrection.privacyLink':
    'Ce que devient votre texte : politique de confidentialité.',
  'aiCorrection.collectingLabel':
    'Correction en phase de collecte — fiabilité non démontrée',
  'aiCorrection.collectingDescription':
    'La fiabilité de la correction n’est pas encore démontrée pour ce type d’exercice. Ce retour reste indicatif et contribue à mesurer la qualité du système.',
  'aiCorrection.seePrice': 'Corriger',
  'aiCorrection.readyTitle': 'Obtenir une correction formative',
  'aiCorrection.quoteTitle': 'Devis de correction',
  'aiCorrection.errorTitle': 'Correction interrompue',
  'aiCorrection.unavailableTitle': 'Résultat temporairement indisponible',
  'aiCorrection.reworkLabel': 'À retravailler',
  'aiCorrection.toCheck': 'À vérifier',
  'aiCorrection.toCheckLabel': 'À vérifier',
  'aiCorrection.toCheckExplanation':
    'La vérification indépendante ne confirme pas l’analyse de ce critère. Aucun niveau n’est affiché : relisez ce point à partir de l’énoncé de l’exercice.',
  'aiCorrection.scoreWithheld':
    'Aucun score indicatif tant qu’un critère reste à vérifier ou à retravailler.',
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
    'Aucun critère utilisable n’a pu être restitué. Votre réservation de crédits a été libérée : rien ne vous est débité.',
  'aiCorrection.settlementRecap':
    'Plafond réservé : {reserved} · débité : {settled} · libéré : {released} crédits.',
  'aiCorrection.noProgressImpact': 'Sans effet sur la progression',
  'aiCorrection.acquired': 'Acquis',
  'aiCorrection.toReinforce': 'À renforcer',
  'aiCorrection.reworkCriterion':
    'Le critère « {criterion} » est à retravailler avant une nouvelle soumission.',
  'aiCorrection.nextAction': 'Prochaine action',
  'aiCorrection.indicativeScore': 'Score indicatif : {score} %',
  'aiCorrection.criterionFeedbackPrompt': 'Ce retour vous paraît-il juste ?',
  'aiCorrection.criterionFeedbackHelpful': 'Utile',
  'aiCorrection.criterionFeedbackWrong': 'Inexact',
  'aiCorrection.criterionFeedbackRecorded':
    'Votre retour est enregistré. Vous pouvez encore le modifier.',
  'aiCorrection.criterionFeedbackFailed':
    'Votre retour n’a pas pu être enregistré. Réessayez plus tard.',
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
  'credits.purchase.title': 'Acheter des crédits',
  'credits.purchase.description':
    'Choisissez un palier. Le paiement est traité par notre prestataire : LearnX ne voit jamais votre numéro de carte.',
  'credits.purchase.loadError':
    'Les paliers d’achat n’ont pas pu être chargés.',
  'credits.purchase.closedTitle': 'L’achat de crédits n’est pas encore ouvert',
  'credits.purchase.closedDescription':
    'Aucun palier n’est en vente pour le moment. Vous pouvez demander une augmentation exceptionnelle ci-dessous.',
  'credits.purchase.packCredits': {
    one: '{credits} crédit',
    other: '{credits} crédits',
  },
  'credits.purchase.buy': 'Acheter',
  'credits.purchase.buyPack': 'Acheter {label}',
  'credits.purchase.error': 'Le paiement n’a pas pu être démarré.',
  'credits.purchase.refusalPaymentsDisabled':
    'La vente de crédits vient d’être fermée. Aucun montant n’a été prélevé.',
  'credits.purchase.refusalPackUnavailable':
    'Ce palier n’est plus disponible. Aucun montant n’a été prélevé.',
  'credits.purchase.suspendedTitle': 'Corrections IA suspendues',
  'credits.purchase.suspendedDescription':
    'La correction par IA est suspendue en ce moment. Les crédits achetés gardent leur valeur et resteront utilisables à sa reprise.',
  'credits.purchase.suspendedContinue': 'Continuer vers le paiement',
  'credits.purchase.suspendedCancel': 'Ne pas acheter maintenant',
  'credits.checkout.successTitle': 'Paiement reçu',
  'credits.checkout.successDescription':
    'Vos crédits seront attribués dès que notre prestataire aura confirmé le paiement. Cette page l’indiquera à ce moment-là.',
  'credits.checkout.settledTitle': 'Crédits attribués',
  'credits.checkout.settledDescription':
    'Votre commande est réglée et ses crédits figurent sur votre solde.',
  'credits.checkout.refresh': 'Actualiser',
  'credits.checkout.cancelledTitle': 'Achat abandonné',
  'credits.checkout.cancelledDescription':
    'Aucun crédit n’a été ajouté à votre solde.',
  'credits.orders.title': 'Historique de commandes',
  'credits.orders.loadError': 'Vos commandes n’ont pas pu être chargées.',
  'credits.orders.empty': 'Aucune commande',
  'credits.orders.emptyDescription':
    'Vos achats de crédits apparaîtront ici, avec leur état.',
  'credits.orders.status.CREATED': 'Commande créée',
  'credits.orders.status.PENDING': 'Paiement en cours',
  'credits.orders.status.PAID': 'Paiement reçu, attribution en cours',
  'credits.orders.status.FULFILLED': 'Crédits attribués',
  'credits.orders.status.FAILED': 'Paiement refusé',
  'credits.orders.status.EXPIRED': 'Paiement abandonné',
  'credits.orders.status.REFUND_PENDING': 'Remboursement en cours',
  'credits.orders.status.REFUNDED': 'Remboursée',
  'credits.orders.status.DISPUTED': 'Contestation bancaire en cours',
  'credits.orders.status.DISPUTE_WON': 'Contestation rejetée par votre banque',
  'credits.orders.status.DISPUTE_LOST': 'Remboursée par votre banque',
} as const;

export const englishCorrectionMessages = {
  'aiCorrection.assistedLabel': 'AI-assisted correction',
  'aiCorrection.intro':
    'Receive criterion-by-criterion formative feedback on this submission.',
  'aiCorrection.doctrineNotice':
    'This feedback is indicative and does not affect your progress.',
  'aiCorrection.privacyLink': 'What happens to your text: privacy policy.',
  'aiCorrection.collectingLabel':
    'Correction in data-collection phase — reliability not demonstrated',
  'aiCorrection.collectingDescription':
    'Reliability has not yet been demonstrated for this type of exercise. This feedback remains indicative and helps measure the quality of the system.',
  'aiCorrection.seePrice': 'Correct',
  'aiCorrection.readyTitle': 'Get formative feedback',
  'aiCorrection.quoteTitle': 'Correction quote',
  'aiCorrection.errorTitle': 'Correction interrupted',
  'aiCorrection.unavailableTitle': 'Result temporarily unavailable',
  'aiCorrection.reworkLabel': 'Needs rework',
  'aiCorrection.toCheck': 'Needs checking',
  'aiCorrection.toCheckLabel': 'Needs checking',
  'aiCorrection.toCheckExplanation':
    'The independent check does not confirm the analysis of this criterion. No level is shown: review this point against the exercise brief.',
  'aiCorrection.scoreWithheld':
    'No indicative score while a criterion still needs checking or rework.',
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
    'No usable criterion could be returned. Your credit reservation has been released: you are not charged.',
  'aiCorrection.settlementRecap':
    'Reserved ceiling: {reserved} · charged: {settled} · released: {released} credits.',
  'aiCorrection.noProgressImpact': 'No effect on progress',
  'aiCorrection.acquired': 'Acquired',
  'aiCorrection.toReinforce': 'To reinforce',
  'aiCorrection.reworkCriterion':
    'The “{criterion}” criterion needs rework before a new submission.',
  'aiCorrection.nextAction': 'Next action',
  'aiCorrection.indicativeScore': 'Indicative score: {score}%',
  'aiCorrection.criterionFeedbackPrompt': 'Does this feedback look right?',
  'aiCorrection.criterionFeedbackHelpful': 'Helpful',
  'aiCorrection.criterionFeedbackWrong': 'Inaccurate',
  'aiCorrection.criterionFeedbackRecorded':
    'Your feedback is recorded. You can still change it.',
  'aiCorrection.criterionFeedbackFailed':
    'Your feedback could not be recorded. Try again later.',
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
  'credits.purchase.title': 'Buy credits',
  'credits.purchase.description':
    'Pick a tier. Payment is handled by our provider: LearnX never sees your card number.',
  'credits.purchase.loadError': 'The purchase tiers could not be loaded.',
  'credits.purchase.closedTitle': 'Buying credits is not open yet',
  'credits.purchase.closedDescription':
    'No tier is on sale at the moment. You can request an exceptional increase below.',
  'credits.purchase.packCredits': {
    one: '{credits} credit',
    other: '{credits} credits',
  },
  'credits.purchase.buy': 'Buy',
  'credits.purchase.buyPack': 'Buy {label}',
  'credits.purchase.error': 'The payment could not be started.',
  'credits.purchase.refusalPaymentsDisabled':
    'Credit sales have just closed. Nothing was charged.',
  'credits.purchase.refusalPackUnavailable':
    'This tier is no longer available. Nothing was charged.',
  'credits.purchase.suspendedTitle': 'AI corrections are suspended',
  'credits.purchase.suspendedDescription':
    'AI correction is suspended right now. Purchased credits keep their value and will still be usable when it resumes.',
  'credits.purchase.suspendedContinue': 'Continue to payment',
  'credits.purchase.suspendedCancel': 'Do not buy now',
  'credits.checkout.successTitle': 'Payment received',
  'credits.checkout.successDescription':
    'Your credits will be granted as soon as our provider confirms the payment. This page will say so then.',
  'credits.checkout.settledTitle': 'Credits granted',
  'credits.checkout.settledDescription':
    'Your order is settled and its credits are on your balance.',
  'credits.checkout.refresh': 'Refresh',
  'credits.checkout.cancelledTitle': 'Purchase abandoned',
  'credits.checkout.cancelledDescription':
    'No credits were added to your balance.',
  'credits.orders.title': 'Order history',
  'credits.orders.loadError': 'Your orders could not be loaded.',
  'credits.orders.empty': 'No orders',
  'credits.orders.emptyDescription':
    'Your credit purchases will appear here, with their state.',
  'credits.orders.status.CREATED': 'Order created',
  'credits.orders.status.PENDING': 'Payment in progress',
  'credits.orders.status.PAID': 'Payment received, credits being granted',
  'credits.orders.status.FULFILLED': 'Credits granted',
  'credits.orders.status.FAILED': 'Payment declined',
  'credits.orders.status.EXPIRED': 'Payment abandoned',
  'credits.orders.status.REFUND_PENDING': 'Refund in progress',
  'credits.orders.status.REFUNDED': 'Refunded',
  'credits.orders.status.DISPUTED': 'Bank dispute in progress',
  'credits.orders.status.DISPUTE_WON': 'Dispute rejected by your bank',
  'credits.orders.status.DISPUTE_LOST': 'Refunded by your bank',
} as const satisfies TranslationOf<typeof frenchCorrectionMessages>;
