import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export const REVIEW_DATE = '2026-08-18';

const passiveTaskTypes = new Set(['reading', 'watching', 'listening', 'checklist']);

function ensure(condition, message) {
  if (!condition) throw new Error(message);
}

function unique(values) {
  return [...new Set(values)];
}

function makeChoiceQuestion({ prompt, explanation, labels, correctIndexes, position, type = 'single_choice' }) {
  return {
    type,
    prompt,
    explanation,
    acceptedAnswers: [],
    position,
    options: labels.map((label, index) => ({
      label,
      isCorrect: correctIndexes.includes(index),
      position: index + 1,
    })),
  };
}

function makeShortQuestion({ prompt, explanation, answers, position }) {
  return {
    type: 'short_answer',
    prompt,
    explanation,
    acceptedAnswers: answers,
    position,
    options: [],
  };
}

function makeConceptQuestions(concept) {
  return [
    makeChoiceQuestion({
      prompt: `Quelle formulation décrit le mieux « ${concept.title} » ?`,
      explanation: concept.description,
      labels: [
        concept.description,
        concept.misconception,
        'Une préférence d’implémentation qui ne dépend ni du problème ni des preuves.',
        'Une étape facultative qui peut être remplacée par un redémarrage du service.',
      ],
      correctIndexes: [0],
      position: 1,
    }),
    makeChoiceQuestion({
      type: 'true_false',
      prompt: concept.trueStatement,
      explanation: concept.trueExplanation ?? concept.decisionRule,
      labels: ['Vrai', 'Faux'],
      correctIndexes: [0],
      position: 2,
    }),
    makeChoiceQuestion({
      prompt: concept.scenarioPrompt,
      explanation: concept.scenarioExplanation ?? concept.decisionRule,
      labels: [concept.scenarioCorrect, ...concept.scenarioDistractors],
      correctIndexes: [0],
      position: 3,
    }),
    makeChoiceQuestion({
      type: 'multiple_choice',
      prompt: concept.multiplePrompt ?? `Quels éléments participent à une mise en œuvre correcte de « ${concept.title} » ?`,
      explanation: concept.decisionRule,
      labels: [...concept.requiredItems, ...concept.badItems],
      correctIndexes: concept.requiredItems.map((_, index) => index),
      position: 4,
    }),
    makeShortQuestion({
      prompt: concept.shortPrompt,
      explanation: concept.shortExplanation ?? concept.decisionRule,
      answers: concept.acceptedAnswers,
      position: 5,
    }),
  ];
}

function makeQuizQuestions(concept) {
  return [
    makeChoiceQuestion({
      prompt: concept.scenarioPrompt,
      explanation: concept.scenarioExplanation ?? concept.decisionRule,
      labels: [concept.scenarioCorrect, ...concept.scenarioDistractors],
      correctIndexes: [0],
      position: 1,
    }),
    makeChoiceQuestion({
      type: 'true_false',
      prompt: concept.falseStatement,
      explanation: concept.falseExplanation ?? concept.decisionRule,
      labels: ['Vrai', 'Faux'],
      correctIndexes: [1],
      position: 2,
    }),
    makeChoiceQuestion({
      type: 'multiple_choice',
      prompt: concept.multiplePrompt ?? `Quels éléments doivent être vérifiés pour appliquer « ${concept.title} » ?`,
      explanation: concept.decisionRule,
      labels: [...concept.requiredItems, ...concept.badItems],
      correctIndexes: concept.requiredItems.map((_, index) => index),
      position: 3,
    }),
    makeShortQuestion({
      prompt: concept.shortPrompt,
      explanation: concept.shortExplanation ?? concept.decisionRule,
      answers: concept.acceptedAnswers,
      position: 4,
    }),
    makeChoiceQuestion({
      prompt: `Quel réflexe est le plus cohérent avec « ${concept.title} » ?`,
      explanation: concept.decisionRule,
      labels: [
        concept.decisionRule,
        concept.misconception,
        'Modifier plusieurs paramètres à la fois puis retenir l’explication la plus plausible.',
        'Choisir l’outil le plus récent avant de définir le résultat attendu.',
      ],
      correctIndexes: [0],
      position: 5,
    }),
  ];
}

function makeResource(resource, position) {
  return {
    key: resource.key,
    type: resource.type ?? 'website',
    title: resource.title,
    author: resource.author,
    url: resource.url,
    citation: resource.citation,
    description: resource.description,
    guidance: {
      objective: resource.objective,
      instructions: resource.instructions,
      scope: resource.scope,
      urlStatus: 'ok',
      accessibilityNotes: resource.accessibilityNotes ?? 'Page HTML officielle en anglais, structurée par titres et consultable sans compte.',
      alternativeResourceKey: null,
    },
    isRequired: resource.isRequired ?? position === 1,
    estimatedMinutes: resource.minutes ?? 15,
    position,
  };
}

function buildLesson({ program, stage, module, lesson, lessonPosition, assessmentBanks }) {
  const resources = lesson.resources.map(makeResource);
  const resourceKeys = resources.map((resource) => resource.key);
  const primarySource = resourceKeys[0];
  const allSources = unique(resourceKeys);
  const contentKeys = {
    definition: `content-definition-${lesson.slug}`,
    explanation: `content-explication-${lesson.slug}`,
    example: `content-exemple-${lesson.slug}`,
    decision: `content-regle-${lesson.slug}`,
  };
  const readingKey = `reading-${lesson.slug}`;
  const exerciseKey = `exercise-${lesson.slug}`;
  const assessmentKey = `assessment-${lesson.concept.slug}`;
  const quizKey = `quiz-${lesson.slug}`;
  const conceptQuestions = makeConceptQuestions(lesson.concept);
  const quizQuestions = makeQuizQuestions(lesson.concept);

  assessmentBanks.push({
    programSlug: program.slug,
    stageSlug: stage.slug,
    moduleSlug: module.slug,
    lessonSlug: lesson.slug,
    assessmentBanks: [
      {
        conceptSlug: lesson.concept.slug,
        assessmentTitle: `Mini-évaluation — ${lesson.concept.title}`,
        questions: conceptQuestions,
      },
    ],
  });

  const productiveType = lesson.exerciseType ?? 'practice';
  ensure(!passiveTaskTypes.has(productiveType), `${lesson.slug}: l’exercice doit produire un livrable.`);

  return {
    title: lesson.title,
    slug: lesson.slug,
    canonicalKey: lesson.slug,
    summary: lesson.summary,
    objectives: lesson.objectives,
    prerequisites: lesson.prerequisites ?? [],
    estimatedMinutes: lesson.minutes,
    position: lessonPosition,
    contentBlocks: [
      {
        key: contentKeys.definition,
        type: 'definition',
        position: 1,
        content: { text: lesson.concept.description, sourceKeys: [primarySource] },
      },
      {
        key: contentKeys.explanation,
        type: 'rich_text',
        position: 2,
        content: { text: lesson.explanation, sourceKeys: allSources },
      },
      {
        key: contentKeys.example,
        type: 'example',
        position: 3,
        content: { text: lesson.example, sourceKeys: allSources },
      },
      {
        key: contentKeys.decision,
        type: 'callout',
        position: 4,
        content: { text: lesson.concept.decisionRule, sourceKeys: allSources },
      },
    ],
    resources,
    concepts: [
      {
        title: lesson.concept.title,
        slug: lesson.concept.slug,
        description: lesson.concept.description,
        position: 1,
        isRequired: true,
        masteryThreshold: lesson.concept.masteryThreshold ?? 75,
        resourceKeys: allSources,
        assessment: {
          key: assessmentKey,
          type: lesson.concept.assessmentType ?? 'quiz',
          title: `Mini-évaluation — ${lesson.concept.title}`,
          questionCount: conceptQuestions.length,
        },
      },
    ],
    tasks: [
      {
        key: readingKey,
        title: lesson.readingTitle ?? 'Consulter les références guidées',
        description: lesson.readingDescription,
        type: 'reading',
        isRequired: true,
        weight: 1,
        position: 1,
        resourceKeys: allSources,
      },
      {
        key: exerciseKey,
        title: lesson.exerciseTitle,
        description: lesson.exerciseDescription,
        type: productiveType,
        isRequired: true,
        weight: 2,
        position: 2,
        resourceKeys: [],
      },
    ],
    quizzes: [
      {
        key: quizKey,
        title: `Quiz — ${lesson.title}`,
        description: lesson.quizDescription ?? 'Vérifier la compréhension et le transfert vers le projet SourceLab.',
        passingScore: 75,
        isRequired: true,
        position: 1,
        questions: quizQuestions,
      },
    ],
    sequence: [
      { kind: 'CONTENT', key: contentKeys.definition },
      { kind: 'CONTENT', key: contentKeys.explanation },
      { kind: 'TASK', key: readingKey },
      { kind: 'CONTENT', key: contentKeys.example },
      { kind: 'EXERCISE', key: exerciseKey },
      { kind: 'CONTENT', key: contentKeys.decision },
      { kind: 'CONCEPT_ASSESSMENT', key: assessmentKey },
      { kind: 'QUIZ', key: quizKey },
    ],
  };
}

export function buildSeed(definition) {
  const assessmentBanks = [];
  const stages = definition.stages.map((stage, stageIndex) => {
    const module = {
      title: stage.moduleTitle,
      slug: stage.moduleSlug,
      canonicalKey: stage.moduleSlug,
      position: 1,
      lessons: [],
    };
    module.lessons = stage.lessons.map((lesson, lessonIndex) => buildLesson({
      program: definition,
      stage,
      module,
      lesson,
      lessonPosition: lessonIndex + 1,
      assessmentBanks,
    }));
    return {
      title: stage.title,
      slug: stage.slug,
      canonicalKey: stage.slug,
      position: stageIndex + 1,
      estimatedDurationDays: stage.days,
      assessment: stage.assessment,
      modules: [module],
    };
  });

  const seed = {
    program: {
      title: definition.title,
      slug: definition.slug,
      canonicalProgramKey: definition.slug,
      locale: 'fr',
      description: definition.description,
      status: 'draft',
      position: definition.position,
      estimatedDurationDays: definition.estimatedDurationDays,
      stages,
    },
    conceptAssessmentBanks: assessmentBanks,
  };
  validateSeed(seed);
  return seed;
}

export function validateSeed(seed) {
  const program = seed.program;
  ensure(program.status === 'draft', `${program.slug}: le programme doit rester en brouillon.`);
  ensure(program.stages.length === 6, `${program.slug}: six étapes attendues.`);
  const lessons = [];
  for (const stage of program.stages) {
    ensure(stage.assessment, `${stage.slug}: évaluation d’étape absente.`);
    const weight = (stage.assessment.rubric ?? []).reduce((sum, item) => sum + item.weight, 0);
    ensure(weight === 100, `${stage.slug}: la rubrique doit totaliser 100.`);
    ensure(stage.modules.length >= 1, `${stage.slug}: module absent.`);
    for (const module of stage.modules) {
      ensure(module.lessons.length === 2, `${module.slug}: deux leçons attendues.`);
      for (const lesson of module.lessons) {
        lessons.push({ stage, module, lesson });
        ensure(lesson.contentBlocks.length === 4, `${lesson.slug}: quatre blocs de contenu attendus.`);
        ensure(lesson.resources.length >= 2, `${lesson.slug}: deux ressources attendues.`);
        ensure(lesson.concepts.length === 1, `${lesson.slug}: une notion obligatoire attendue.`);
        ensure(lesson.tasks.length === 2, `${lesson.slug}: lecture et exercice attendus.`);
        ensure(lesson.quizzes.length === 1, `${lesson.slug}: quiz absent.`);
        ensure(lesson.quizzes[0].questions.length === 5, `${lesson.slug}: cinq questions de quiz attendues.`);
        const resourceKeys = new Set(lesson.resources.map((resource) => resource.key));
        for (const resource of lesson.resources) {
          ensure(resource.url.startsWith('https://'), `${lesson.slug}: URL non HTTPS.`);
          ensure(resource.guidance?.instructions, `${lesson.slug}: consigne de ressource absente.`);
        }
        for (const block of lesson.contentBlocks) {
          ensure(block.content.sourceKeys.length > 0, `${lesson.slug}: bloc non sourcé.`);
          block.content.sourceKeys.forEach((key) => ensure(resourceKeys.has(key), `${lesson.slug}: sourceKey inconnue ${key}.`));
        }
        lesson.concepts[0].resourceKeys.forEach((key) => ensure(resourceKeys.has(key), `${lesson.slug}: ressource de notion inconnue ${key}.`));
        const expected = new Set([
          ...lesson.contentBlocks.map((item) => `CONTENT:${item.key}`),
          ...lesson.tasks.map((item) => `${passiveTaskTypes.has(item.type) ? 'TASK' : 'EXERCISE'}:${item.key}`),
          `CONCEPT_ASSESSMENT:${lesson.concepts[0].assessment.key}`,
          `QUIZ:${lesson.quizzes[0].key}`,
        ]);
        const actual = new Set(lesson.sequence.map((item) => `${item.kind}:${item.key}`));
        ensure(expected.size === actual.size && [...expected].every((item) => actual.has(item)), `${lesson.slug}: séquence incomplète ou incohérente.`);
      }
    }
  }
  ensure(lessons.length === 12, `${program.slug}: douze leçons attendues.`);
  ensure(seed.conceptAssessmentBanks.length === lessons.length, `${program.slug}: une banque par leçon attendue.`);
  for (const group of seed.conceptAssessmentBanks) {
    ensure(group.assessmentBanks.length === 1, `${group.lessonSlug}: banque de notion absente.`);
    ensure(group.assessmentBanks[0].questions.length === 5, `${group.lessonSlug}: cinq questions de mini-évaluation attendues.`);
  }
}

export function buildReadme(definition) {
  return `# ${definition.title}\n\n## Statut\n\n- Version éditoriale : 1.0.0\n- Statut : brouillon personnel\n- Classification : \`CONTENT_ONLY\`\n- Public : ${definition.audience}\n- Durée indicative : ${definition.estimatedDurationDays} jours\n- Projet fil rouge : **SourceLab**, développé dans un dépôt distinct de LearnX\n\n## Promesse produit\n\n${definition.productPromise}\n\n## Frontière avec LearnX\n\nLe programme est suivi dans LearnX, mais le code de SourceLab ne doit jamais être ajouté au dépôt LearnX ni accéder directement à sa base. SourceLab possède son propre dépôt, son propre stockage et son propre cycle de déploiement. Les futurs échanges passent par des exports JSON ou des API versionnées.\n\n## Livrable cumulatif\n\n${definition.cumulativeDeliverable}\n\n## Principes pédagogiques\n\n- chaque étape produit une capacité visible dans SourceLab ;\n- les lectures sont guidées et ne constituent jamais seules une preuve de maîtrise ;\n- chaque leçon contient une production, une mini-évaluation et un quiz ;\n- chaque étape se termine par une évaluation pratique ;\n- les ressources privilégient les documentations officielles, normes ou publications primaires ;\n- les programmes restent en brouillon tant que les liens, versions et contenus n’ont pas été revus humainement.\n\n## Fichiers\n\n- Blueprint : \`CURRICULUM_BLUEPRINT.md\`\n- Registre de sources : \`SOURCE_REGISTER.md\`\n- Bundle LearnX : \`../../seed/${definition.seedFile}\`\n- Générateur et validation : \`../../scripts/generate-sourcelab-programs.mjs\`\n`;
}

export function buildBlueprint(definition) {
  const stages = definition.stages.map((stage, index) => {
    const lessons = stage.lessons.map((lesson) => `- ${lesson.title} (\`${lesson.slug}\`)`).join('\n');
    return `### Étape ${index + 1} — ${stage.title}\n\n- Slug : \`${stage.slug}\`\n- Durée indicative : ${stage.days} jours\n- Résultat produit : ${stage.productOutcome}\n\nModule **${stage.moduleTitle}**\n\n${lessons}\n\nÉvaluation : ${stage.assessment.description}\n`;
  }).join('\n');
  return `# Blueprint pédagogique — ${definition.title}\n\n## Finalité\n\n${definition.finality}\n\n## Profil de départ\n\n${definition.startingProfile}\n\n## Résultats d’apprentissage\n\n${definition.learningOutcomes.map((item, index) => `${index + 1}. ${item}`).join('\n')}\n\n## Projet fil rouge : SourceLab\n\n${definition.cumulativeDeliverable}\n\nSourceLab reste un produit autonome. LearnX sert à suivre le parcours et pourra plus tard consommer des exports ou résultats validés ; aucune base de données n’est partagée et aucune fonctionnalité de production n’est ajoutée implicitement au dépôt LearnX.\n\n## Architecture du programme\n\n${stages}\n## Hors périmètre\n\n${definition.outOfScope.map((item) => `- ${item}`).join('\n')}\n\n## Stratégie de sources et de revue\n\nLes affirmations techniques s’appuient sur les documentations officielles, standards ou publications primaires listés dans \`SOURCE_REGISTER.md\`. Les contenus sont rédigés de manière originale et les exemples SourceLab sont explicitement des mises en situation du projet. Les liens ont été sélectionnés le ${REVIEW_DATE}, mais doivent être rouverts et contrôlés avant publication.\n`;
}

export function buildSourceRegister(definition) {
  const resources = [];
  for (const stage of definition.stages) {
    for (const lesson of stage.lessons) resources.push(...lesson.resources);
  }
  const byUrl = new Map(resources.map((resource) => [resource.url, resource]));
  const rows = [...byUrl.values()].map((resource) => `| ${resource.title.replaceAll('|', '\\|')} | ${resource.author} | ${resource.url} | ${resource.scope ?? 'Page ciblée dans la consigne'} | À revérifier avant publication |`).join('\n');
  return `# Registre de sources — ${definition.title}\n\nDate de sélection initiale : ${REVIEW_DATE}. Ce registre documente les ressources visibles dans le seed. Il ne remplace pas une revue éditoriale finale ni le contrôle manuel de chaque URL.\n\n| Source | Auteur / organisme | URL | Périmètre demandé | Statut |\n| --- | --- | --- | --- | --- |\n${rows}\n`;
}

export function generatedFiles(definitions) {
  const files = new Map();
  for (const definition of definitions) {
    const seed = buildSeed(definition);
    files.set(`seed/${definition.seedFile}`, `${JSON.stringify(seed, null, 2)}\n`);
    files.set(`content/${definition.slug}/README.md`, buildReadme(definition));
    files.set(`content/${definition.slug}/CURRICULUM_BLUEPRINT.md`, buildBlueprint(definition));
    files.set(`content/${definition.slug}/SOURCE_REGISTER.md`, buildSourceRegister(definition));
  }
  return files;
}

export function writeFiles(root, files) {
  for (const [relativePath, content] of files) {
    const absolutePath = join(root, relativePath);
    mkdirSync(dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, content, 'utf8');
  }
}

export function filesMatch(root, files) {
  for (const [relativePath, content] of files) {
    const absolutePath = join(root, relativePath);
    let current;
    try {
      current = readFileSync(absolutePath, 'utf8');
    } catch {
      throw new Error(`Fichier généré absent : ${relativePath}`);
    }
    ensure(current === content, `Fichier généré obsolète : ${relativePath}`);
  }
}
