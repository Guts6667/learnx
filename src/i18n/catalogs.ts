export const frenchMessages = {
  'app.name': 'LearnX',
  'app.tagline': 'Parcours personnel',
  'navigation.skipToContent': 'Aller au contenu principal',
  'navigation.back.ariaLabel': 'Revenir à la page précédente',
  'navigation.back.label': 'Retour',
  'navigation.main.ariaLabel': 'Navigation principale',
  'navigation.home': 'Accueil',
  'navigation.programs': 'Parcours',
  'navigation.reviews': 'Réviser',
  'navigation.notes': 'Notes',
  'navigation.profile': 'Profil',
  'auth.email.label': 'Adresse e-mail',
  'auth.password.label': 'Mot de passe',
  'auth.login.sessionCheck': 'Vérification de la session',
  'auth.login.eyebrow': 'LearnX',
  'auth.login.title': 'Connexion',
  'auth.login.description':
    'Connecte-toi pour retrouver tes parcours d’apprentissage.',
  'auth.login.offline':
    'Reconnectez-vous pour vérifier votre session et vous connecter.',
  'auth.login.error': 'La connexion a échoué. Réessaie dans quelques instants.',
  'auth.login.submit': 'Se connecter',
  'auth.login.requestAccess': 'Demander un accès',
  'auth.access.eyebrow': 'LearnX',
  'auth.access.title': 'Demander un accès',
  'auth.access.description':
    'Indique ton adresse e-mail pour demander l’accès à LearnX. Aucun mot de passe n’est nécessaire à cette étape.',
  'auth.access.offline': 'Reconnectez-vous pour envoyer votre demande d’accès.',
  'auth.access.error':
    'La demande n’a pas pu être enregistrée. Réessaie dans quelques instants.',
  'auth.access.successTitle': 'Demande enregistrée',
  'auth.access.successDescription':
    'Ta demande a été prise en compte. Les prochaines étapes te seront communiquées par e-mail.',
  'auth.access.emailDescription':
    'Nous utiliserons cette adresse uniquement pour le suivi de ta demande.',
  'auth.access.submit': 'Envoyer ma demande',
  'auth.access.existingAccount': 'J’ai déjà un compte',
  'auth.backToLogin': 'Revenir à la connexion',
  'auth.verify.eyebrow': 'Demande d’accès',
  'auth.verify.title': 'Vérifier mon adresse e-mail',
  'auth.verify.description':
    'Confirme ton adresse pour transmettre ta demande à l’administrateur LearnX.',
  'auth.verify.offline': 'Reconnectez-vous pour vérifier votre adresse e-mail.',
  'auth.verify.error':
    'La vérification a échoué. Demande un nouveau lien puis réessaie.',
  'auth.verify.successTitle': 'Adresse vérifiée',
  'auth.verify.successDescription':
    'Ton adresse e-mail est vérifiée. Ta demande est maintenant en attente d’approbation.',
  'auth.verify.explanation':
    'Cette confirmation ne crée pas encore de compte. Après validation, ta demande devra être approuvée par un administrateur.',
  'auth.verify.invalidLink':
    'Ce lien de vérification est invalide ou incomplet.',
  'auth.verify.submit': 'Vérifier mon adresse',
  'auth.verify.requestNewLink': 'Demander un nouveau lien',
  'auth.activate.eyebrow': 'Invitation acceptée',
  'auth.activate.title': 'Activer mon compte',
  'auth.activate.description':
    'Choisis tes informations de connexion pour finaliser ton accès à LearnX.',
  'auth.activate.offline': 'Reconnectez-vous pour activer votre compte.',
  'auth.activate.error':
    'L’activation a échoué. Réessaie dans quelques instants.',
  'auth.activate.invalidInvitation':
    'Cette invitation est invalide ou incomplète.',
  'auth.activate.passwordMismatch':
    'Les deux mots de passe doivent être identiques.',
  'auth.activate.displayName': 'Nom affiché',
  'auth.activate.passwordDescription': 'Utilise entre 12 et 128 caractères.',
  'auth.activate.passwordConfirmation': 'Confirmer le mot de passe',
  'auth.activate.submit': 'Activer mon compte',
  'i18n.example.itemCount': {
    one: '{count} élément',
    other: '{count} éléments',
  },
} as const;

export type MessageKey = keyof typeof frenchMessages;
export type MessageValue = string | Readonly<{ one: string; other: string }>;
export type MessageCatalog = Readonly<Record<MessageKey, MessageValue>>;

export const englishMessages = {
  'app.name': 'LearnX',
  'app.tagline': 'Personal learning journey',
  'navigation.skipToContent': 'Skip to main content',
  'navigation.back.ariaLabel': 'Go back to the previous page',
  'navigation.back.label': 'Back',
  'navigation.main.ariaLabel': 'Main navigation',
  'navigation.home': 'Home',
  'navigation.programs': 'Learning paths',
  'navigation.reviews': 'Review',
  'navigation.notes': 'Notes',
  'navigation.profile': 'Profile',
  'auth.email.label': 'Email address',
  'auth.password.label': 'Password',
  'auth.login.sessionCheck': 'Checking your session',
  'auth.login.eyebrow': 'LearnX',
  'auth.login.title': 'Sign in',
  'auth.login.description': 'Sign in to continue your learning journeys.',
  'auth.login.offline': 'Reconnect to check your session and sign in.',
  'auth.login.error': 'Sign-in failed. Please try again in a moment.',
  'auth.login.submit': 'Sign in',
  'auth.login.requestAccess': 'Request access',
  'auth.access.eyebrow': 'LearnX',
  'auth.access.title': 'Request access',
  'auth.access.description':
    'Enter your email address to request access to LearnX. You do not need a password at this stage.',
  'auth.access.offline': 'Reconnect to send your access request.',
  'auth.access.error':
    'Your request could not be saved. Please try again in a moment.',
  'auth.access.successTitle': 'Request submitted',
  'auth.access.successDescription':
    'Your request has been received. The next steps will be sent to you by email.',
  'auth.access.emailDescription':
    'We will only use this address to follow up on your request.',
  'auth.access.submit': 'Send my request',
  'auth.access.existingAccount': 'I already have an account',
  'auth.backToLogin': 'Back to sign in',
  'auth.verify.eyebrow': 'Access request',
  'auth.verify.title': 'Verify my email address',
  'auth.verify.description':
    'Confirm your address to send your request to the LearnX administrator.',
  'auth.verify.offline': 'Reconnect to verify your email address.',
  'auth.verify.error': 'Verification failed. Request a new link and try again.',
  'auth.verify.successTitle': 'Address verified',
  'auth.verify.successDescription':
    'Your email address is verified. Your request is now awaiting approval.',
  'auth.verify.explanation':
    'This confirmation does not create an account yet. Your request must then be approved by an administrator.',
  'auth.verify.invalidLink': 'This verification link is invalid or incomplete.',
  'auth.verify.submit': 'Verify my address',
  'auth.verify.requestNewLink': 'Request a new link',
  'auth.activate.eyebrow': 'Invitation accepted',
  'auth.activate.title': 'Activate my account',
  'auth.activate.description':
    'Choose your sign-in details to complete your LearnX access.',
  'auth.activate.offline': 'Reconnect to activate your account.',
  'auth.activate.error': 'Activation failed. Please try again in a moment.',
  'auth.activate.invalidInvitation':
    'This invitation is invalid or incomplete.',
  'auth.activate.passwordMismatch': 'Both passwords must match.',
  'auth.activate.displayName': 'Display name',
  'auth.activate.passwordDescription': 'Use between 12 and 128 characters.',
  'auth.activate.passwordConfirmation': 'Confirm password',
  'auth.activate.submit': 'Activate my account',
  'i18n.example.itemCount': {
    one: '{count} item',
    other: '{count} items',
  },
} as const satisfies MessageCatalog;

export const messageCatalogs = {
  en: englishMessages,
  fr: frenchMessages,
} as const satisfies Readonly<Record<'en' | 'fr', MessageCatalog>>;
