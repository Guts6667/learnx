import type { TranslationOf } from '@/i18n/catalogs/types';

export const frenchAuthMessages = {
  'auth.email.label': 'Adresse e-mail',
  'auth.password.label': 'Mot de passe',
  'auth.shell.eyebrow': 'Votre chemin commence ici',
  'auth.shell.title': 'Apprendre avec une direction.',
  'auth.shell.description':
    'Votre compte conserve vos parcours, vos notes et vos révisions sur tous vos appareils.',
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
  'auth.verify.step': 'Étape de confiance',
  'auth.verify.shellEyebrow': 'Une étape de confiance',
  'auth.verify.shellTitle': 'Votre progression vous appartient.',
  'auth.verify.shellDescription':
    'La vérification protège l’accès à votre parcours, vos notes et vos futures corrections.',
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
  'auth.activate.step': 'Dernière étape d’activation',
  'auth.activate.shellEyebrow': 'Votre chemin commence ici',
  'auth.activate.shellTitle': 'Apprendre avec une direction.',
  'auth.activate.shellDescription':
    'Un compte suffit pour conserver votre progression, vos notes et vos révisions sur tous vos appareils.',
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
  'auth.firstDirection.step': 'Première direction',
  'auth.firstDirection.title': 'Comment souhaitez-vous commencer ?',
  'auth.firstDirection.description':
    'Ce choix détermine seulement votre premier écran. Vous pourrez toujours changer de parcours ensuite.',
  'auth.firstDirection.legend': 'Choisir une première action',
  'auth.firstDirection.discoverTitle': 'Découvrir les parcours disponibles',
  'auth.firstDirection.discoverDescription':
    'Explorer la sélection LearnX et choisir votre premier programme.',
  'auth.firstDirection.sharedTitle': 'Rejoindre un parcours partagé',
  'auth.firstDirection.sharedDescription':
    'Retrouver les parcours déjà associés à votre compte.',
  'auth.firstDirection.language': 'Langue de l’interface',
  'auth.firstDirection.later': 'Je déciderai plus tard',
  'auth.firstDirection.shellEyebrow': 'Pas d’écran vide',
  'auth.firstDirection.shellTitle': 'Choisir une première direction.',
  'auth.firstDirection.shellDescription':
    'LearnX propose une prochaine action explicite sans prétendre connaître votre objectif à votre place.',
  'session.reconnecting': 'Reconnexion et vérification de la session',
  'session.checking': 'Vérification de la session',
  'session.errorTitle': 'Connexion impossible',
  'session.errorDescription':
    'La session n’a pas pu être vérifiée. Votre destination est conservée.',
} as const;

export const englishAuthMessages = {
  'auth.email.label': 'Email address',
  'auth.password.label': 'Password',
  'auth.shell.eyebrow': 'Your path starts here',
  'auth.shell.title': 'Learn with a clear direction.',
  'auth.shell.description':
    'Your account keeps your learning paths, notes and reviews available across your devices.',
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
  'auth.verify.step': 'Trust step',
  'auth.verify.shellEyebrow': 'A trust step',
  'auth.verify.shellTitle': 'Your progress belongs to you.',
  'auth.verify.shellDescription':
    'Verification protects access to your learning paths, notes and future corrections.',
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
  'auth.activate.step': 'Final activation step',
  'auth.activate.shellEyebrow': 'Your path starts here',
  'auth.activate.shellTitle': 'Learn with a clear direction.',
  'auth.activate.shellDescription':
    'One account keeps your progress, notes and reviews available across your devices.',
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
  'auth.firstDirection.step': 'First direction',
  'auth.firstDirection.title': 'How would you like to begin?',
  'auth.firstDirection.description':
    'This choice only determines your first screen. You can always change learning paths later.',
  'auth.firstDirection.legend': 'Choose a first action',
  'auth.firstDirection.discoverTitle': 'Discover available learning paths',
  'auth.firstDirection.discoverDescription':
    'Explore the LearnX selection and choose your first programme.',
  'auth.firstDirection.sharedTitle': 'Join a shared learning path',
  'auth.firstDirection.sharedDescription':
    'Find learning paths already associated with your account.',
  'auth.firstDirection.language': 'Interface language',
  'auth.firstDirection.later': 'I will decide later',
  'auth.firstDirection.shellEyebrow': 'No empty screen',
  'auth.firstDirection.shellTitle': 'Choose a first direction.',
  'auth.firstDirection.shellDescription':
    'LearnX offers a clear next action without pretending to know your goal for you.',
  'session.reconnecting': 'Reconnecting and checking your session',
  'session.checking': 'Checking your session',
  'session.errorTitle': 'Unable to connect',
  'session.errorDescription':
    'Your session could not be checked. Your destination has been preserved.',
} as const satisfies TranslationOf<typeof frenchAuthMessages>;
