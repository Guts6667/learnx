/**
 * Politique de confidentialité (V4.5-167).
 *
 * Texte repris tel quel de `docs/V4_5_PRIVACY_POLICY.md`, qui en est
 * l'autorité : aucune phrase n'est ajoutée, reformulée ni raccourcie ici. Le
 * fichier de test compare chaque phrase au document ; une divergence fait
 * échouer la suite plutôt que de publier une page juridique inexacte.
 *
 * Le corps d'une section est une suite de segments plutôt qu'une chaîne : le
 * document met en gras des mots juridiquement porteurs — « empreinte non
 * réversible » — et perdre cette emphase changerait la lecture d'un texte dont
 * chaque nuance a été arbitrée. Un titre de section est un gras EN DÉBUT DE
 * LIGNE ; un gras au milieu d'une phrase est de l'insistance, pas un titre.
 *
 * Ce contenu ne passe pas par les catalogues i18n : ce ne sont pas des libellés
 * d'interface mais un texte de référence versionné, relu et daté, dont les deux
 * versions linguistiques doivent rester lisibles côte à côte au moment de la
 * revue.
 */

interface PrivacyPolicyFragment {
  strong?: boolean;
  text: string;
}

interface PrivacyPolicySection {
  body?: PrivacyPolicyFragment[];
  bullets?: PrivacyPolicyFragment[][];
  heading: string;
}

export interface PrivacyPolicyContent {
  sections: PrivacyPolicySection[];
  title: string;
  updated: string;
}

export const privacyPolicy: Record<'en' | 'fr', PrivacyPolicyContent> = {
  en: {
    title: 'Privacy policy',
    updated: 'Last updated: 29 August 2026.',
    sections: [
      {
        heading: 'Who is responsible.',
        body: [
          {
            text: 'LearnX is published by Rayan Chambet, sole trader (SIREN 820 401 990), 59 rue de Ponthieu, 75008 Paris, France. For any question or request about your data: support@learn-x.app.',
          },
        ],
      },
      {
        bullets: [
          [
            {
              text: 'Your e-mail address and, if you provide it, your name, to create and secure your account.',
            },
          ],
          [
            {
              text: 'Your learning activity: paths followed, lessons completed, answers to exercises and assessments, personal notes.',
            },
          ],
          [
            {
              text: 'If you use AI-assisted correction: the text you submit, the feedback produced, your "helpful / wrong" votes on each criterion, and the credits used.',
            },
          ],
          [
            {
              text: 'If you request early access or launch updates: your first name, your e-mail address, what you want to learn, and — if you choose to say so — what usually slows you down. Every e-mail carries a link to unsubscribe and a link to delete those answers.',
            },
          ],
          [
            {
              text: 'The technical logs needed to run the service (errors, rate limiting). To limit abuse, we keep a ',
            },
            { strong: true, text: 'non-reversible fingerprint' },
            {
              text: ' of your IP address for 24 hours, and an anti-abuse marker tied to the free trial for 12 months; we do not store your IP address in clear or your browser.',
            },
          ],
        ],
        heading: 'What we collect.',
      },
      {
        heading: 'Why.',
        body: [
          {
            text: 'To run your learning path, suggest the next useful action, give formative feedback on your answers, secure your account, and improve the correction system.',
          },
        ],
      },
      {
        heading: 'AI-assisted correction.',
        body: [
          {
            text: 'When you start a correction, your text is sent, without your name or e-mail, to an Anthropic model via OpenRouter; the quoted excerpts are then checked by a Mistral model hosted in the European Union. These services keep your data for at most 30 days (Anthropic, Mistral) and do not use it to train their models; OpenRouter does not publish a retention period. The feedback is produced by an AI, is reviewed by no one, is not a validation, and has no effect on your progression.',
          },
        ],
      },
      {
        heading: 'Where your data is.',
        body: [
          {
            text: 'Database: Neon, Frankfurt (Germany). Application: Vercel, Frankfurt. E-mails: Resend, Ireland. Only OpenRouter and Anthropic process data outside the European Union, solely for AI correction, under the conditions above.',
          },
        ],
      },
      {
        heading: 'For how long.',
        body: [
          {
            text: 'As long as your account exists. Sessions expire and are purged within 7 days, login links within 30 days. After 180 days, an AI correction is detached from your account: your texts are removed from it in every case. Without your permission — the default setting — they are deleted. If you have given it, they are kept under an irreversible pseudonym to improve the system: this is pseudonymisation, not anonymity, and if you wrote things about yourself in them, they may remain personal data under the GDPR.',
          },
        ],
      },
      {
        heading: 'Your rights.',
        body: [
          {
            text: 'You can request access to, rectification or deletion of your data at support@learn-x.app. Deleting your account erases your e-mail, name, notes and sessions. Your answers and the feedback produced are kept under an irreversible pseudonym: they are no longer linked to your account, but if you wrote things about yourself in them, they may remain personal data under the GDPR. The credit history is kept without identifiers, as accounting law requires, and the free-trial anti-abuse marker survives deletion for 12 months so that deleting an account does not grant a new trial. You may lodge a complaint with the CNIL (cnil.fr) or your local supervisory authority.',
          },
        ],
      },
      {
        heading: 'Cookies.',
        body: [
          {
            text: 'LearnX uses only a session cookie, required to sign in. No analytics or advertising cookies.',
          },
        ],
      },
    ],
  },
  fr: {
    title: 'Politique de confidentialité',
    updated: 'Dernière mise à jour : 29 août 2026.',
    sections: [
      {
        heading: 'Qui est responsable.',
        body: [
          {
            text: 'LearnX est édité par Rayan Chambet, entrepreneur individuel (SIREN 820 401 990), 59 rue de Ponthieu, 75008 Paris. Pour toute question ou demande concernant vos données : support@learn-x.app.',
          },
        ],
      },
      {
        bullets: [
          [
            {
              text: 'Votre adresse e-mail et, si vous le renseignez, votre nom, pour créer et sécuriser votre compte.',
            },
          ],
          [
            {
              text: "Votre activité d'apprentissage : parcours suivis, leçons terminées, réponses aux exercices et aux évaluations, notes personnelles.",
            },
          ],
          [
            {
              text: 'Si vous utilisez la correction assistée par IA : le texte que vous soumettez, le retour produit, vos votes « utile / faux » sur chaque critère, et les crédits utilisés.',
            },
          ],
          [
            {
              text: "Si vous demandez un accès anticipé ou les nouvelles du lancement : votre prénom, votre adresse e-mail, ce que vous voulez apprendre et — si vous choisissez de le dire — ce qui vous ralentit d'habitude. Chaque courriel porte un lien pour vous désinscrire et un lien pour supprimer ces réponses.",
            },
          ],
          [
            {
              text: 'Les journaux techniques nécessaires au fonctionnement du service (erreurs, limitation des tentatives). Pour limiter les abus, nous conservons une ',
            },
            { strong: true, text: 'empreinte non réversible' },
            {
              text: " de votre adresse IP pendant 24 heures, et un marqueur anti-abus lié à l'essai gratuit pendant 12 mois ; nous n'enregistrons pas votre adresse IP en clair ni votre navigateur.",
            },
          ],
        ],
        heading: 'Ce que nous collectons.',
      },
      {
        heading: 'Pourquoi.',
        body: [
          {
            text: 'Faire fonctionner votre parcours, vous proposer la prochaine action utile, produire un retour formatif sur vos réponses, sécuriser votre compte, et améliorer le système de correction.',
          },
        ],
      },
      {
        heading: 'La correction assistée par IA.',
        body: [
          {
            text: "Quand vous lancez une correction, votre texte est envoyé, sans votre nom ni votre e-mail, à un modèle d'Anthropic via OpenRouter ; les extraits cités sont ensuite vérifiés par un modèle de Mistral hébergé dans l'Union européenne. Ces services conservent vos données au plus 30 jours (Anthropic, Mistral) et ne les utilisent pas pour entraîner leurs modèles ; OpenRouter ne publie pas de durée de conservation. Le retour est produit par une IA, n'est relu par personne, ne vaut pas validation et n'a aucun effet sur votre progression.",
          },
        ],
      },
      {
        heading: 'Où sont vos données.',
        body: [
          {
            text: "Base de données : Neon, Francfort (Allemagne). Application : Vercel, Francfort. E-mails : Resend, Irlande. Seuls OpenRouter et Anthropic traitent des données hors de l'Union européenne, uniquement pour la correction IA, dans les conditions ci-dessus.",
          },
        ],
      },
      {
        heading: 'Combien de temps.',
        body: [
          {
            text: "Tant que votre compte existe. Les sessions expirent et sont purgées sous 7 jours, les liens de connexion sous 30 jours. Après 180 jours, une correction IA est détachée de votre compte : vos textes en sont retirés dans tous les cas. Sans votre autorisation — le réglage par défaut — ils sont supprimés. Si vous l'avez donnée, ils sont conservés sous un pseudonyme irréversible pour améliorer le système : c'est une pseudonymisation et non un anonymat, et si vous y avez écrit des éléments vous concernant, ils peuvent rester des données personnelles au sens du RGPD.",
          },
        ],
      },
      {
        heading: 'Vos droits.',
        body: [
          {
            text: "Vous pouvez demander l'accès, la rectification ou la suppression de vos données à support@learn-x.app. La suppression de compte efface votre e-mail, votre nom, vos notes et vos sessions. Vos réponses et les retours produits sont conservés sous un pseudonyme irréversible : ils ne sont plus rattachés à votre compte, mais si vous y avez écrit des éléments vous concernant, ils peuvent rester des données personnelles au sens du RGPD. L'historique des crédits est conservé sans identifiant, comme la loi comptable l'exige, et le marqueur anti-abus de l'essai gratuit survit à la suppression pendant 12 mois, afin qu'un compte supprimé ne redonne pas droit à un nouvel essai. Vous pouvez introduire une réclamation auprès de la CNIL (cnil.fr).",
          },
        ],
      },
      {
        heading: 'Cookies.',
        body: [
          {
            text: "LearnX utilise uniquement un cookie de session, nécessaire à la connexion. Aucun cookie de mesure d'audience ni de publicité.",
          },
        ],
      },
    ],
  },
};
