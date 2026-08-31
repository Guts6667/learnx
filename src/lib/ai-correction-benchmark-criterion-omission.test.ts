import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { canonicalizeProtocol3CorrectionOutput } from './ai-correction-contracts.ts';
import {
  parseCorrectionBenchmarkCorpus,
  salvageProtocol3PartialCorrection,
  validateBenchmarkProtocol3ModelOutputWithEvidence,
} from './ai-correction-benchmark.ts';

/**
 * V4.5-177 — pourquoi une correction à deux critères sur trois a été notée
 * VALID dans le pré-test 2.3.0.
 *
 * Reconstruit depuis la tentative réelle : cellule
 * `regression-0c2b233864fbcce5`, contrat scellé
 * `writing-v1-explanatory-analysis 1.0.0`, run du 31 août
 * (`results/2026-08-31T10-53-58-380Z/attempts.json`).
 *
 * L'hypothèse d'origine — le modèle a OMIS un critère, et
 * `PROTOCOL_3_CRITERION_MISSING` aurait dû lever — est fausse, et ces trois
 * tests la réfutent dans l'ordre. Le modèle a répondu aux trois critères. Il a
 * étayé `mechanism-link` avec deux citations : l'une prise dans la réponse de
 * l'apprenant, l'autre prise dans l'ÉNONCÉ. Seule la réponse est un support
 * recevable, donc la seconde ne résout pas, donc le critère entier tombe.
 *
 * Le cas n'est pas non plus un mutant : c'est la ligne de base
 * `...-complete-clear`, catégorie SUCCESSFUL, attendue à trois `mastered`.
 * Aucune phrase n'avait été supprimée.
 */

/** Les trois quarts de la citation litigieuse vivent ici, pas dans la réponse. */
const taskContext =
  "Contexte fiable et fictif : lors d'un premier tri de 24 étoiles en carton, une légende placée à l'écart a été suivie de 10 erreurs de placement. Lors d'un second tri des mêmes 24 étoiles, la légende a été placée à côté du plateau et 4 erreurs ont été relevées. Le groupe, l'ordre des étoiles et les 20 minutes allouées sont restés identiques. L'observateur a noté moins de regards allant du plateau vers la table distante. Le même groupe a participé aux deux tris, donc un effet d'entraînement reste possible ; aucun nouveau groupe n'a été testé.";

const responseText =
  "Les erreurs passent de 10 sur 24 à 4 sur 24 quand la légende est rapprochée, avec le même groupe, le même ordre et la même durée. Cela soutient une contribution de la proximité sans prouver qu'elle cause seule la baisse, car le second passage peut aussi bénéficier de l'entraînement. Sans essai sur un nouveau groupe, la généralisation reste inconnue.";

/** La citation que le modèle a tirée de l'énoncé au lieu de la réponse. */
const quoteFromTaskContext =
  "l'observateur a noté moins de regards allant du plateau vers la table distante";

/**
 * Le contrat scellé lui-même, relu du corpus — pas une reconstruction. Un
 * contrat écrit à la main ici pourrait diverger de celui que le run a utilisé,
 * et c'est précisément la divergence que ce test doit exclure.
 */
const corpus = parseCorrectionBenchmarkCorpus(
  JSON.parse(
    readFileSync(
      path.resolve(
        import.meta.dirname,
        '../../benchmarks/ai-correction/hybrid/writing-only-fr-v1/corpus.sealed.json',
      ),
      'utf8',
    ) as string,
  ) as unknown,
);

const contract = corpus.contracts.find(
  (candidate) =>
    candidate.contractKey === 'writing-v1-explanatory-analysis' &&
    candidate.version === '1.0.0',
);
if (!contract) throw new Error('SEALED_CONTRACT_NOT_FOUND');

/** La sortie du modèle, telle qu'enregistrée : trois critères, tous formés. */
const modelOutput = {
  criteria: {
    'source-fidelity': {
      confidence: 0.92,
      evidenceQuotes: [
        'Les erreurs passent de 10 sur 24 à 4 sur 24 quand la légende est rapprochée, avec le même groupe, le même ordre et la même durée.',
      ],
      evidenceStatus: 'FOUND',
      feedback: 'Les chiffres clés sont restitués avec exactitude.',
      levelKey: 'mastered',
    },
    'mechanism-link': {
      confidence: 0.9,
      evidenceQuotes: [
        "Cela soutient une contribution de la proximité sans prouver qu'elle cause seule la baisse",
        quoteFromTaskContext,
      ],
      evidenceStatus: 'FOUND',
      feedback: 'La production relie la proximité de la légende à la réduction des erreurs.',
      levelKey: 'mastered',
    },
    'uncertainty-boundary': {
      confidence: 0.9,
      evidenceQuotes: [
        "le second passage peut aussi bénéficier de l'entraînement",
        'Sans essai sur un nouveau groupe, la généralisation reste inconnue.',
      ],
      evidenceStatus: 'FOUND',
      feedback: 'La réponse sépare observation, inférence et généralisation non testée.',
      levelKey: 'mastered',
    },
  },
  overallFeedback: 'Analyse fidèle, mécanisme relié, incertitudes bornées.',
};

describe('V4.5-177 — le critère perdu du pré-test 2.3.0', () => {
  it('la citation litigieuse vient de l’énoncé, pas de la réponse', () => {
    // C'est le fait qui explique tout le reste : le support existe, mais pas
    // là où un support est recevable.
    // Comparé sans la casse : le modèle a recopié la phrase de l'énoncé en
    // minuscule initiale, ce que la résolution tolère — mais elle ne tolère
    // pas la provenance, et c'est le point.
    expect(taskContext.toLowerCase()).toContain(quoteFromTaskContext);
    expect(responseText.toLowerCase()).not.toContain(quoteFromTaskContext);
  });

  it('aucun critère ne manque : PROTOCOL_3_CRITERION_MISSING ne pouvait pas lever', () => {
    // Le contrôle amont soupçonné n'a pas « échoué à déclencher » : il n'était
    // pas applicable. La sortie porte bien les trois critères du contrat.
    const canonical = canonicalizeProtocol3CorrectionOutput({
      contract,
      output: modelOutput,
    });
    expect(canonical.criteria.map((criterion) => criterion.criterionKey)).toEqual([
      'source-fidelity',
      'mechanism-link',
      'uncertainty-boundary',
    ]);
  });

  it('la validation stricte rejette sur la citation, pas sur une absence', () => {
    expect(() =>
      validateBenchmarkProtocol3ModelOutputWithEvidence({
        benchmarkCase: { responseText },
        contract,
        output: modelOutput,
      }),
    ).toThrow('MODEL_EVIDENCE_NOT_IN_RESPONSE');
  });

  it('le rattrapage laisse tomber le critère entier et rend deux notes sur trois', () => {
    // Le comportement d'aujourd'hui, épinglé tel quel. Une seule citation
    // irrecevable sur deux suffit à faire disparaître un critère que le modèle
    // avait pourtant noté `mastered`, et que la ligne de base attend `mastered`.
    const salvaged = salvageProtocol3PartialCorrection({
      benchmarkCase: { responseText },
      contract,
      output: modelOutput,
    });

    expect(salvaged.output.criteria.map((c) => c.criterionKey)).toEqual([
      'source-fidelity',
      'uncertainty-boundary',
    ]);
    expect(salvaged.unsureCriteria).toEqual(['mechanism-link']);
  });

  it('le rattrapage laisse une preuve derrière lui pour un critère non livré', () => {
    // Défaut secondaire : les citations résolues AVANT l'échec sont déjà
    // poussées dans `evidenceMatches` et ne sont pas retirées. L'artefact
    // atteste donc une preuve pour un critère qu'il ne livre pas.
    const salvaged = salvageProtocol3PartialCorrection({
      benchmarkCase: { responseText },
      contract,
      output: modelOutput,
    });

    const orphans = salvaged.evidenceMatches.filter((match) =>
      salvaged.unsureCriteria.includes(match.criterionKey),
    );
    expect(orphans).toHaveLength(1);
    expect(orphans[0]?.criterionKey).toBe('mechanism-link');
  });
});
