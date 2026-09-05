import type { TranslationOf } from '@/i18n/catalogs/types';

export const frenchAdminAccessMessages = {
  'admin.access.checking': 'Vérification des droits administrateur',
  'admin.access.deniedTitle': 'Accès refusé',
  'admin.access.deniedDescription':
    'Cette zone est réservée aux administrateurs.',
  'admin.role.admin': 'Administrateur',
  'admin.role.creator': 'Créateur',
  'admin.role.user': 'Apprenant',
  'admin.accounts.title': 'Comptes utilisateurs',
  'admin.accounts.description':
    'Suspendez ou réactivez les comptes sans supprimer leurs données personnelles d’apprentissage.',
  'admin.accounts.search': 'Rechercher un compte',
  'admin.accounts.status': 'Statut du compte',
  'admin.accounts.all': 'Tous les comptes',
  'admin.accounts.activePlural': 'Actifs',
  'admin.accounts.suspendedPlural': 'Suspendus',
  'admin.accounts.active': 'Actif',
  'admin.accounts.suspended': 'Suspendu',
  'admin.accounts.loading': 'Chargement des comptes…',
  'admin.accounts.loadError': 'Les comptes n’ont pas pu être chargés.',
  'admin.accounts.empty.title': 'Aucun compte',
  'admin.accounts.empty.description':
    'Aucun compte ne correspond à ces filtres.',
  'admin.accounts.role': 'Rôle : {role}',
  'admin.accounts.current': 'Compte administrateur courant',
  'admin.accounts.suspend': 'Suspendre le compte',
  'admin.accounts.reactivate': 'Réactiver le compte',
  'admin.accounts.confirm': 'Confirmer',
  'admin.accounts.cancel': 'Annuler',
  'admin.accounts.previous': 'Précédent',
  'admin.accounts.next': 'Suivant',
  'admin.accounts.page': 'Page {page} sur {total}',
  'admin.accounts.pagination': 'Pagination des comptes',
  'admin.accounts.count': {
    one: '{count} compte',
    other: '{count} comptes',
  },
  'admin.accounts.changed':
    'Le compte a changé. Rechargez la liste avant de réessayer.',
  'admin.accounts.selfSuspend':
    'Vous ne pouvez pas suspendre votre propre compte.',
  'admin.accounts.mutationError': 'Le compte n’a pas pu être modifié.',
  'admin.accounts.creator.assign': 'Attribuer le rôle Créateur',
  'admin.accounts.creator.remove': 'Rétrograder en Apprenant',
  'admin.accounts.creator.confirm': 'Confirmer le rôle Créateur',
  'admin.accounts.learner.confirm': 'Confirmer le rôle Apprenant',
  'admin.accounts.creator.description':
    'Le compte conservera les fonctions Apprenant. Le rôle Créateur ne donne aucun accès à l’administration et ne permet ni création, ni édition, ni prévisualisation, ni publication avant V5.',
  'admin.accounts.learner.description':
    'Les notes, progressions, tentatives et soumissions seront conservées. Le compte gardera uniquement les fonctions Apprenant.',
  'admin.accounts.creator.success':
    'Le rôle Créateur est attribué. Il reste sans accès à l’administration et aux outils éditoriaux.',
  'admin.accounts.learner.success':
    'Le compte est désormais Apprenant. Ses données personnelles sont conservées.',
  'admin.accounts.reactivateConfirm': 'Confirmer la réactivation',
  'admin.accounts.suspendConfirm': 'Confirmer la suspension',
  'admin.accounts.reactivateDescription':
    'Le compte pourra de nouveau se connecter. Aucune ancienne session ne sera restaurée.',
  'admin.accounts.suspendDescription':
    'Toutes les sessions seront immédiatement révoquées. Les notes, progressions, tentatives et soumissions seront conservées.',
  'admin.accounts.reactivateSuccess':
    'Compte réactivé. Une nouvelle connexion sera nécessaire.',
  'admin.accounts.suspendSuccess':
    'Compte suspendu et toutes ses sessions ont été révoquées.',
  'admin.accounts.suspendedAt': 'Suspendu le {date}',
  'admin.requests.title': 'Demandes d’accès',
  'admin.requests.description':
    'Examinez les adresses vérifiées, attribuez un rôle et conservez une décision auditée.',
  'admin.requests.search': 'Rechercher par e-mail',
  'admin.requests.status': 'État des demandes',
  'admin.requests.approved': 'Acceptées',
  'admin.requests.pending': 'À examiner',
  'admin.requests.rejected': 'Refusées',
  'admin.requests.loading': 'Chargement des demandes…',
  'admin.requests.loadError':
    'Les demandes d’accès n’ont pas pu être chargées.',
  'admin.requests.empty.title': 'Aucune demande',
  'admin.requests.empty.description':
    'Aucune demande vérifiée ne correspond à ces filtres.',
  'admin.requests.accept': 'Accepter',
  'admin.requests.reject': 'Refuser',
  'admin.requests.assignedRole': 'Rôle attribué : {role}',
  'admin.requests.role': 'Rôle à attribuer',
  'admin.requests.resend': 'Renvoyer l’invitation',
  'admin.requests.verifiedAt': 'Vérifiée le {date}',
  'admin.requests.pagination': 'Pagination des demandes',
  'admin.requests.count': {
    one: '{count} demande',
    other: '{count} demandes',
  },
  'admin.requests.conflict':
    'Cette demande a été modifiée ou traitée. Rechargez la liste avant de recommencer.',
  'admin.requests.mutationError': 'La décision n’a pas pu être enregistrée.',
  'admin.requests.resendSuccess': 'Une nouvelle invitation a été envoyée.',
  'admin.requests.approveSuccess': 'Demande acceptée et invitation préparée.',
  'admin.requests.rejectSuccess': 'Demande refusée.',
  'admin.requests.internalReason': 'Motif interne : {reason}',
  'admin.requests.reason': 'Motif du refus',
  'admin.requests.reasonHelp':
    'Ce motif reste interne et n’est jamais affiché publiquement.',
  'admin.requests.previewDecision': 'Prévisualiser la décision',
  'admin.requests.confirmDecision': 'Confirmer la décision',
  'admin.requests.approvePreview':
    'La demande sera acceptée avec le rôle « {role} ». Une invitation sera préparée, sans créer de compte.',
  'admin.requests.rejectPreview':
    'La demande sera refusée avec le motif interne « {reason} ».',
  'admin.requests.edit': 'Modifier',
  'admin.contacts.title': 'Contacts de la landing',
  'admin.contacts.description':
    'Consultez séparément les consentements au suivi du lancement et les candidatures early adopter.',
  'admin.contacts.open': 'Gérer les contacts',
  'admin.contacts.metric.launch': 'Adresses informées du lancement',
  'admin.contacts.metric.early': 'Candidatures Early adopter',
  'admin.contacts.search': 'Rechercher par e-mail',
  'admin.contacts.filter': 'Finalité',
  'admin.contacts.filter.all': 'Toutes',
  'admin.contacts.purpose.launch': 'Lancement',
  'admin.contacts.purpose.early': 'Early adopter',
  'admin.contacts.status.confirmed': 'Confirmé',
  'admin.contacts.status.pending': 'À confirmer',
  'admin.contacts.status.unsubscribed': 'Désinscrit',
  'admin.contacts.status.deleted': 'Supprimé',
  'admin.contacts.date': 'Reçue le {date}',
  'admin.contacts.firstName': 'Prénom : {firstName}',
  'admin.contacts.friction': 'Ce qui la ralentit : {friction}',
  'admin.contacts.locale': 'Langue : {locale}',
  'admin.contacts.loading': 'Chargement des contacts…',
  'admin.contacts.loadError':
    'Les contacts n’ont pas pu être chargés. Aucune donnée n’a été modifiée.',
  'admin.contacts.empty.title': 'Aucun contact',
  'admin.contacts.empty.description':
    'Aucun contact ne correspond à ces critères.',
  'admin.contacts.count': {
    one: '{count} contact',
    other: '{count} contacts',
  },
  'admin.contacts.pagination': 'Pagination des contacts',
} as const;

export const englishAdminAccessMessages = {
  'admin.access.checking': 'Checking administrator permissions',
  'admin.access.deniedTitle': 'Access denied',
  'admin.access.deniedDescription': 'This area is for administrators only.',
  'admin.role.admin': 'Administrator',
  'admin.role.creator': 'Creator',
  'admin.role.user': 'Learner',
  'admin.accounts.title': 'User accounts',
  'admin.accounts.description':
    'Suspend or reactivate accounts without deleting personal learning data.',
  'admin.accounts.search': 'Search accounts',
  'admin.accounts.status': 'Account status',
  'admin.accounts.all': 'All accounts',
  'admin.accounts.activePlural': 'Active',
  'admin.accounts.suspendedPlural': 'Suspended',
  'admin.accounts.active': 'Active',
  'admin.accounts.suspended': 'Suspended',
  'admin.accounts.loading': 'Loading accounts…',
  'admin.accounts.loadError': 'Accounts could not be loaded.',
  'admin.accounts.empty.title': 'No accounts',
  'admin.accounts.empty.description': 'No account matches these filters.',
  'admin.accounts.role': 'Role: {role}',
  'admin.accounts.current': 'Current administrator account',
  'admin.accounts.suspend': 'Suspend account',
  'admin.accounts.reactivate': 'Reactivate account',
  'admin.accounts.confirm': 'Confirm',
  'admin.accounts.cancel': 'Cancel',
  'admin.accounts.previous': 'Previous',
  'admin.accounts.next': 'Next',
  'admin.accounts.page': 'Page {page} of {total}',
  'admin.accounts.pagination': 'Account pagination',
  'admin.accounts.count': {
    one: '{count} account',
    other: '{count} accounts',
  },
  'admin.accounts.changed':
    'The account changed. Reload the list before trying again.',
  'admin.accounts.selfSuspend': 'You cannot suspend your own account.',
  'admin.accounts.mutationError': 'The account could not be changed.',
  'admin.accounts.creator.assign': 'Assign Creator role',
  'admin.accounts.creator.remove': 'Change to Learner',
  'admin.accounts.creator.confirm': 'Confirm Creator role',
  'admin.accounts.learner.confirm': 'Confirm Learner role',
  'admin.accounts.creator.description':
    'The account retains Learner capabilities. The Creator role grants no administration access and cannot create, edit, preview or publish before V5.',
  'admin.accounts.learner.description':
    'Notes, progress, attempts and submissions will be preserved. The account will retain Learner capabilities only.',
  'admin.accounts.creator.success':
    'Creator role assigned. Administration and editorial tools remain unavailable.',
  'admin.accounts.learner.success':
    'The account is now a Learner. Personal data is preserved.',
  'admin.accounts.reactivateConfirm': 'Confirm reactivation',
  'admin.accounts.suspendConfirm': 'Confirm suspension',
  'admin.accounts.reactivateDescription':
    'The account can sign in again. No previous session will be restored.',
  'admin.accounts.suspendDescription':
    'All sessions will be revoked immediately. Notes, progress, attempts and submissions will be preserved.',
  'admin.accounts.reactivateSuccess':
    'Account reactivated. A new sign-in will be required.',
  'admin.accounts.suspendSuccess':
    'Account suspended and all sessions have been revoked.',
  'admin.accounts.suspendedAt': 'Suspended on {date}',
  'admin.requests.title': 'Access requests',
  'admin.requests.description':
    'Review verified addresses, assign a role and retain an audited decision.',
  'admin.requests.search': 'Search by email',
  'admin.requests.status': 'Request status',
  'admin.requests.approved': 'Approved',
  'admin.requests.pending': 'To review',
  'admin.requests.rejected': 'Rejected',
  'admin.requests.loading': 'Loading requests…',
  'admin.requests.loadError': 'Access requests could not be loaded.',
  'admin.requests.empty.title': 'No requests',
  'admin.requests.empty.description':
    'No verified request matches these filters.',
  'admin.requests.accept': 'Approve',
  'admin.requests.reject': 'Reject',
  'admin.requests.assignedRole': 'Assigned role: {role}',
  'admin.requests.role': 'Role to assign',
  'admin.requests.resend': 'Resend invitation',
  'admin.requests.verifiedAt': 'Verified on {date}',
  'admin.requests.pagination': 'Request pagination',
  'admin.requests.count': {
    one: '{count} request',
    other: '{count} requests',
  },
  'admin.requests.conflict':
    'This request changed or was already reviewed. Reload the list before trying again.',
  'admin.requests.mutationError': 'The decision could not be saved.',
  'admin.requests.resendSuccess': 'A new invitation was sent.',
  'admin.requests.approveSuccess': 'Request approved and invitation prepared.',
  'admin.requests.rejectSuccess': 'Request rejected.',
  'admin.requests.internalReason': 'Internal reason: {reason}',
  'admin.requests.reason': 'Rejection reason',
  'admin.requests.reasonHelp':
    'This reason remains internal and is never displayed publicly.',
  'admin.requests.previewDecision': 'Preview decision',
  'admin.requests.confirmDecision': 'Confirm decision',
  'admin.requests.approvePreview':
    'The request will be approved with the “{role}” role. An invitation will be prepared without creating an account.',
  'admin.requests.rejectPreview':
    'The request will be rejected with the internal reason “{reason}”.',
  'admin.requests.edit': 'Edit',
  'admin.contacts.title': 'Landing contacts',
  'admin.contacts.description':
    'Review launch-update consent and early-adopter applications as separate purposes.',
  'admin.contacts.open': 'Manage contacts',
  'admin.contacts.metric.launch': 'Addresses subscribed to launch updates',
  'admin.contacts.metric.early': 'Early-adopter applications',
  'admin.contacts.search': 'Search by email',
  'admin.contacts.filter': 'Purpose',
  'admin.contacts.filter.all': 'All',
  'admin.contacts.purpose.launch': 'Launch updates',
  'admin.contacts.purpose.early': 'Early adopter',
  'admin.contacts.status.confirmed': 'Confirmed',
  'admin.contacts.status.pending': 'To confirm',
  'admin.contacts.status.unsubscribed': 'Unsubscribed',
  'admin.contacts.status.deleted': 'Deleted',
  'admin.contacts.date': 'Received on {date}',
  'admin.contacts.firstName': 'First name: {firstName}',
  'admin.contacts.friction': 'What slows them down: {friction}',
  'admin.contacts.locale': 'Language: {locale}',
  'admin.contacts.loading': 'Loading contacts…',
  'admin.contacts.loadError':
    'Contacts could not be loaded. No data was changed.',
  'admin.contacts.empty.title': 'No contacts',
  'admin.contacts.empty.description': 'No contact matches these criteria.',
  'admin.contacts.count': {
    one: '{count} contact',
    other: '{count} contacts',
  },
  'admin.contacts.pagination': 'Contact pagination',
} as const satisfies TranslationOf<typeof frenchAdminAccessMessages>;
