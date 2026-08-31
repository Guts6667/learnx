import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { canonicalizeProtocol3CorrectionOutput } from './ai-correction-contracts.ts';
import {
  parseCorrectionBenchmarkCorpus,
  salvageProtocol3PartialCorrection,
  validateBenchmarkProtocol3ModelOutputWithEvidence,
} from './ai-correction-benchmark.ts';
import {
  allowsIndicativeScore,
  deriveCriterionConfidence,
} from './ai-correction-confidence.ts';

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
      feedback:
        'La production relie la proximité de la légende à la réduction des erreurs.',
      levelKey: 'mastered',
    },
    'uncertainty-boundary': {
      confidence: 0.9,
      evidenceQuotes: [
        "le second passage peut aussi bénéficier de l'entraînement",
        'Sans essai sur un nouveau groupe, la généralisation reste inconnue.',
      ],
      evidenceStatus: 'FOUND',
      feedback:
        'La réponse sépare observation, inférence et généralisation non testée.',
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
    expect(
      canonical.criteria.map((criterion) => criterion.criterionKey),
    ).toEqual(['source-fidelity', 'mechanism-link', 'uncertainty-boundary']);
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

  it('le rattrapage livre le critère sans citation ni niveau montré', () => {
    // V4.5-177. Avant le correctif, une seule citation irrecevable sur deux
    // faisait disparaître le critère et la tentative restait VALID à deux
    // notes sur trois : le critère quittait numérateur ET dénominateur, si
    // bien qu'un gabarit qui se tait paraissait meilleur qu'un gabarit qui se
    // trompe. Il est désormais livré, sans extrait, et son retrait est nommé.
    const salvaged = salvageProtocol3PartialCorrection({
      benchmarkCase: { responseText },
      contract,
      output: modelOutput,
    });

    expect(salvaged.output.criteria.map((c) => c.criterionKey)).toEqual([
      'source-fidelity',
      'mechanism-link',
      'uncertainty-boundary',
    ]);
    // Livré ne veut pas dire retenu comme sûr : le critère ne va pas dans
    // `unsureCriteria` — sinon l'écran ne l'afficherait pas — mais son motif
    // de retrait est enregistré.
    expect(salvaged.unsureCriteria).toEqual([]);
    expect(salvaged.withdrawnCriteria).toEqual([
      { criterionKey: 'mechanism-link', reason: 'EVIDENCE_NOT_IN_RESPONSE' },
    ]);

    const withdrawn = salvaged.output.criteria.find(
      (c) => c.criterionKey === 'mechanism-link',
    );
    expect(withdrawn?.evidenceStatus).toBe('EVIDENCE_WITHDRAWN');
    expect(withdrawn?.evidenceQuotes).toEqual([]);
    // Le niveau que le modèle a prononcé est conservé dans l'artefact — c'est
    // la trace de ce qui a été affirmé. L'écran ne le montre pas.
    expect(withdrawn?.levelKey).toBe('mastered');
  });

  it('n’atteste plus de preuve pour le critère dont la citation est retirée', () => {
    // Défaut secondaire de l'enquête : la citation résolue AVANT l'échec
    // restait dans `evidenceMatches`. L'artefact attestait donc une preuve
    // pour un critère qu'il ne justifiait plus.
    const salvaged = salvageProtocol3PartialCorrection({
      benchmarkCase: { responseText },
      contract,
      output: modelOutput,
    });

    expect(
      salvaged.evidenceMatches.filter(
        (match) => match.criterionKey === 'mechanism-link',
      ),
    ).toEqual([]);
    // Les autres critères gardent les leurs.
    expect(salvaged.evidenceMatches.map((match) => match.criterionKey)).toEqual(
      ['source-fidelity', 'uncertainty-boundary', 'uncertainty-boundary'],
    );
  });

  it('fait retomber la confiance du critère retiré, donc supprime le score', () => {
    // La table de V4.5-110 traite déjà « citation non vérifiée + FOUND » comme
    // LOW ; aucune règle de confiance n'a eu à changer. Un LOW suffit à retenir
    // le score indicatif, donc la note d'ensemble ne peut pas être publiée sur
    // une preuve qu'on vient de retirer.
    const withdrawnSignals = {
      citation: 'REJECTED' as const,
      evidenceStatus: 'FOUND' as const,
      hardConstraintMismatch: false,
      isFloorLevel: false,
      isMasteredLevel: true,
      verifier: 'AGREED' as const,
    };

    expect(deriveCriterionConfidence(withdrawnSignals)).toBe('LOW');
    expect(
      allowsIndicativeScore({
        criteria: [withdrawnSignals],
        familyScientificallyValidated: true,
      }),
    ).toBe(false);
  });
});
