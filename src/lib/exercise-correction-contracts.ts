import {
  correctionContractSchema,
  getCorrectionContractRuntimeEligibility,
  type CorrectionContract,
} from './ai-correction-contracts.js';

export const PRODUCTIVE_EXERCISE_ACTIVITY_TYPES = [
  'writing',
  'reflection',
  'practice',
  'project',
] as const;

export type ProductiveExerciseActivityType =
  (typeof PRODUCTIVE_EXERCISE_ACTIVITY_TYPES)[number];

export interface ExerciseCorrectionContractContext {
  activityKey: string;
  activityType: string;
  explicitContract: unknown;
  instructions: string;
  language: string;
  lessonObjectives?: readonly string[];
  lessonSlug: string;
  lessonSummary?: string;
  programSlug: string;
  title: string;
}

export type ResolvedExerciseCorrectionContract =
  | {
      contract: CorrectionContract;
      eligible: true;
      source: 'ARCHETYPE' | 'SPECIALIZED';
    }
  | {
      eligible: false;
      reasons: string[];
      source: 'EXPLICIT_BLOCKED' | 'UNSUPPORTED';
    };

const PUBLISHED_AT = '2026-08-26T09:00:00+02:00';
const ARCHETYPE_VERSION = '1.0.0';

function isProductiveActivityType(
  value: string,
): value is ProductiveExerciseActivityType {
  return PRODUCTIVE_EXERCISE_ACTIVITY_TYPES.some(
    (activityType) => activityType === value.toLowerCase(),
  );
}

function normalizeActivityType(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeStableKey(value: string): string {
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || 'activity';
}

function contentFingerprint(value: string): string {
  let hash = 0xcbf29ce484222325n;
  for (const character of value) {
    hash ^= BigInt(character.codePointAt(0) ?? 0);
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, '0');
}

function commonLevels(input: {
  insufficient: string;
  mastered: string;
  partial: string;
}) {
  return [
    {
      description: input.insufficient,
      key: 'insufficient',
      label: 'À retravailler',
      score: 0,
    },
    {
      description: input.partial,
      key: 'partial',
      label: 'Partiel',
      score: 50,
    },
    {
      description: input.mastered,
      key: 'mastered',
      label: 'Démontré dans la réponse',
      score: 100,
    },
  ];
}

function familySpecificCriterion(activityType: ProductiveExerciseActivityType) {
  switch (activityType) {
    case 'reflection':
      return {
        acceptableVariants: [
          'Une réflexion concise est recevable si l’apprentissage ou le constat personnel est identifiable.',
          'Une expérience, une hésitation ou une limite peut soutenir la réflexion sans plan d’action, sauf si la consigne en demande un.',
        ],
        calibratedExamples: [],
        commonErrors: [
          'Résumer le contenu sans expliciter un apprentissage, un constat ou un lien personnel demandé.',
          'Exiger une profondeur, une émotion ou une longueur que la consigne ne demande pas.',
        ],
        expectedElements: [
          'Un apprentissage, un constat ou un lien personnel demandé par la consigne est identifiable.',
          'La réflexion est reliée à au moins un élément concret de la réponse.',
        ],
        key: 'reflection-link',
        label: 'Lien réflexif explicite',
        objective:
          'Établir ce que la réponse permet réellement d’observer dans la réflexion demandée, sans inférer l’état psychologique de l’apprenant.',
        performanceLevels: commonLevels({
          insufficient:
            'La réponse ne démontre pas encore le lien réflexif demandé, ou elle reste trop ambiguë pour l’établir.',
          partial:
            'Un constat personnel est identifiable, mais son lien avec l’objet de la réflexion reste incomplet.',
          mastered:
            'Le lien réflexif demandé est explicite et appuyé sur un élément concret de la réponse.',
        }),
        weight: 33,
      };
    case 'practice':
      return {
        acceptableVariants: [
          'Une preuve d’exécution peut être une commande, une sortie, une observation, un calcul ou une description vérifiable adaptée à la consigne.',
          'Une méthode équivalente est recevable si elle satisfait les contraintes explicites et produit une preuve interprétable.',
        ],
        calibratedExamples: [],
        commonErrors: [
          'Décrire une intention sans montrer l’exécution ou le résultat demandé.',
          'Présenter une sortie sans expliquer ce qu’elle démontre et ce qu’elle ne démontre pas.',
        ],
        expectedElements: [
          'La réponse montre une exécution, une démarche ou un résultat vérifiable adapté à la consigne.',
          'La preuve fournie est interprétée sans lui attribuer une portée qu’elle ne démontre pas.',
        ],
        key: 'practice-evidence',
        label: 'Preuve de pratique',
        objective:
          'Vérifier que la réponse montre et interprète une pratique observable plutôt qu’une simple intention.',
        performanceLevels: commonLevels({
          insufficient:
            'Aucune preuve vérifiable de la pratique demandée n’est identifiable, ou la preuve contredit le résultat annoncé.',
          partial:
            'Une exécution ou un résultat est visible, mais la preuve ou son interprétation reste incomplète.',
          mastered:
            'La pratique demandée est démontrée par une preuve vérifiable et correctement interprétée.',
        }),
        weight: 33,
      };
    case 'project':
      return {
        acceptableVariants: [
          'La forme du livrable peut varier si les choix importants, leurs raisons et leurs effets restent traçables.',
          'Une solution partielle peut être recevable au niveau Partiel lorsqu’elle distingue clairement ce qui est réalisé de ce qui reste à faire.',
        ],
        calibratedExamples: [],
        commonErrors: [
          'Lister des composants sans expliquer comment ils répondent au besoin du projet.',
          'Masquer une partie non réalisée derrière une affirmation générale de réussite.',
        ],
        expectedElements: [
          'Les choix principaux du projet et leur contribution au résultat demandé sont identifiables.',
          'Les dépendances, limites ou parties non réalisées qui affectent le résultat sont explicitées.',
        ],
        key: 'project-coherence',
        label: 'Cohérence du projet',
        objective:
          'Établir la cohérence entre les choix décrits, les preuves fournies et le résultat annoncé.',
        performanceLevels: commonLevels({
          insufficient:
            'Les choix et preuves ne permettent pas encore d’établir la cohérence du projet demandé.',
          partial:
            'Le projet est traçable sur une partie du besoin, mais un lien important ou une limite reste implicite.',
          mastered:
            'Les choix, preuves, limites et résultat forment une réponse cohérente au projet demandé.',
        }),
        weight: 33,
      };
    case 'writing':
      return {
        acceptableVariants: [
          'Une formulation concise est recevable si la thèse, la proposition ou la réponse centrale est identifiable.',
          'L’ordre et le style peuvent varier tant que les liens utiles à la consigne restent explicites.',
        ],
        calibratedExamples: [],
        commonErrors: [
          'Juxtaposer des informations sans lien explicite avec la réponse centrale.',
          'Pénaliser le style, la longueur ou l’orthographe lorsqu’ils ne sont pas authorés comme exigences.',
        ],
        expectedElements: [
          'La réponse centrale attendue par la consigne est identifiable.',
          'Au moins un lien explicite relie les éléments avancés à cette réponse centrale.',
        ],
        key: 'written-reasoning',
        label: 'Construction de la réponse',
        objective:
          'Établir si la production écrite formule une réponse centrale et relie explicitement ses éléments utiles.',
        performanceLevels: commonLevels({
          insufficient:
            'La réponse centrale ou le lien entre les éléments avancés n’est pas encore démontré.',
          partial:
            'Une réponse centrale est identifiable, mais son développement ou ses liens restent incomplets.',
          mastered:
            'La réponse centrale est explicite et soutenue par des liens compréhensibles entre les éléments utiles.',
        }),
        weight: 33,
      };
  }
}

export function buildExerciseCorrectionArchetype(
  input: Omit<ExerciseCorrectionContractContext, 'explicitContract'> & {
    activityType: ProductiveExerciseActivityType;
  },
): CorrectionContract {
  const instruction = input.instructions.trim();
  const contextSummary = input.lessonSummary?.trim();
  const objectives = input.lessonObjectives?.filter((objective) =>
    objective.trim(),
  );
  const archetypeFingerprint = contentFingerprint(
    JSON.stringify({
      activityKey: normalizeStableKey(input.activityKey),
      activityType: input.activityType,
      archetypeVersion: ARCHETYPE_VERSION,
      instructions: instruction,
      lessonObjectives: objectives ?? [],
      lessonSlug: normalizeStableKey(input.lessonSlug),
      lessonSummary: contextSummary ?? '',
      programSlug: normalizeStableKey(input.programSlug),
      title: input.title.trim(),
    }),
  );
  const contract = {
    authorizedReferences: [],
    contractKey: `${normalizeStableKey(
      `v4-${input.programSlug}-${input.lessonSlug}-${input.activityKey}-${input.activityType}`,
    )}-${archetypeFingerprint}`,
    criteria: [
      {
        acceptableVariants: [
          'Toute forme de réponse qui satisfait les demandes explicites est recevable.',
          'Le style, la longueur et l’orthographe restent hors évaluation sauf exigence explicite de la consigne.',
          'Une réponse partielle est évaluée sur ce qu’elle démontre sans compensation entre exigences distinctes.',
        ],
        calibratedExamples: [],
        commonErrors: [
          'Omettre une demande explicite de la consigne.',
          'Répondre à une autre tâche ou remplacer la consigne par une interprétation plus exigeante.',
        ],
        expectedElements: [
          `La réponse traite explicitement la tâche suivante : « ${instruction} »`,
          'Les contraintes expressément demandées dans la consigne sont observables dans la réponse.',
        ],
        key: 'instruction-coverage',
        label: 'Réponse à la consigne',
        objective:
          'Vérifier la couverture de la demande explicite sans ajouter de critère implicite.',
        performanceLevels: commonLevels({
          insufficient:
            'La tâche centrale demandée n’est pas démontrée ou une contrainte explicite déterminante est absente.',
          partial:
            'La tâche centrale est engagée, mais une partie explicite de la demande reste incomplète.',
          mastered:
            'La réponse couvre la tâche et les contraintes explicitement demandées par la consigne.',
        }),
        weight: 34,
      },
      {
        acceptableVariants: [
          'Une paraphrase fidèle est recevable ; les mots exacts de la consigne ou du contexte ne sont pas exigés.',
          'Une information personnelle explicitement donnée par l’apprenant n’est pas une invention du seul fait qu’elle ne figure pas dans le contexte de cours.',
          'Une limite ou une incertitude correctement signalée est préférable à une précision inventée.',
        ],
        calibratedExamples: [],
        commonErrors: [
          'Inventer un fait, un résultat, une source ou une contrainte et l’utiliser comme preuve.',
          'Contredire matériellement une information fournie sans le signaler ni le justifier.',
        ],
        expectedElements: [
          'Les affirmations utilisées pour répondre sont compatibles avec la consigne et le contexte fourni.',
          'Aucun élément inventé ou contradiction matérielle ne sert de preuve au résultat annoncé.',
        ],
        key: 'context-fidelity',
        label: 'Fidélité et limites',
        objective:
          'Distinguer ce qui est démontré, incertain ou absent sans introduire d’information étrangère comme preuve.',
        performanceLevels: commonLevels({
          insufficient:
            'Une invention ou une contradiction matérielle affecte la réponse, ou aucune base fiable n’est identifiable.',
          partial:
            'La réponse reste globalement fidèle, mais une affirmation importante manque de délimitation ou de preuve.',
          mastered:
            'Les affirmations utiles sont fidèles au contexte et leurs limites sont correctement délimitées.',
        }),
        weight: 33,
      },
      familySpecificCriterion(input.activityType),
    ],
    evidence: { acceptedKinds: ['TEXT'], primaryKind: 'TEXT' },
    lifecycle: { publishedAt: PUBLISHED_AT, status: 'PUBLISHED' },
    objectives: [
      `Fournir un feedback formatif critériel sur « ${input.title.trim()} » sans effet sur la progression ni prétention de validation de maîtrise.`,
      ...(contextSummary ? [`Contexte de leçon : ${contextSummary}`] : []),
      ...(objectives && objectives.length > 0
        ? [`Objectifs de leçon : ${objectives.join(' ; ')}`]
        : []),
    ],
    passingScore: 70,
    schemaVersion: 1,
    secondPass: {
      confidenceThreshold: 0.65,
      enabled: true,
      maxPasses: 2,
      triggers: [
        'LOW_CONFIDENCE',
        'CRITERION_DISAGREEMENT',
        'OUTPUT_VALIDATION_WARNING',
      ],
    },
    target: {
      activityKey: normalizeStableKey(input.activityKey),
      activityType: input.activityType,
      kind: 'EXERCISE',
    },
    version: ARCHETYPE_VERSION,
  } as const;

  return correctionContractSchema.parse(contract);
}

function isContractBoundToExercise(
  contract: CorrectionContract,
  input: ExerciseCorrectionContractContext,
): boolean {
  return (
    contract.target.kind === 'EXERCISE' &&
    contract.target.activityKey === normalizeStableKey(input.activityKey) &&
    contract.target.activityType === normalizeActivityType(input.activityType)
  );
}

export function resolveExerciseCorrectionContract(
  input: ExerciseCorrectionContractContext,
): ResolvedExerciseCorrectionContract {
  if (input.explicitContract !== null && input.explicitContract !== undefined) {
    const eligibility = getCorrectionContractRuntimeEligibility(
      input.explicitContract,
    );
    if (!eligibility.eligible) {
      return {
        eligible: false,
        reasons: eligibility.reasons,
        source: 'EXPLICIT_BLOCKED',
      };
    }
    if (!isContractBoundToExercise(eligibility.contract, input)) {
      return {
        eligible: false,
        reasons: ['CONTRACT_TARGET_MISMATCH'],
        source: 'EXPLICIT_BLOCKED',
      };
    }
    return {
      contract: eligibility.contract,
      eligible: true,
      source: 'SPECIALIZED',
    };
  }

  const activityType = normalizeActivityType(input.activityType);
  if (input.language !== 'fr-FR' || !isProductiveActivityType(activityType)) {
    return {
      eligible: false,
      reasons: [
        input.language !== 'fr-FR'
          ? 'LANGUAGE_NOT_SUPPORTED'
          : 'ACTIVITY_TYPE_NOT_SUPPORTED',
      ],
      source: 'UNSUPPORTED',
    };
  }

  return {
    contract: buildExerciseCorrectionArchetype({
      ...input,
      activityType,
    }),
    eligible: true,
    source: 'ARCHETYPE',
  };
}
