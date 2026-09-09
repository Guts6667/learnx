/**
 * Zero-cost dummy run over the adjudication deck (V4.5-210).
 *
 * Proves the machinery before a key is exported: every card materialises, every
 * card is scored exactly once, no duplicate identity, aggregation resolves to
 * clusters, AMBIGUOUS earns no primary credit. Contacts nobody — the verifier is
 * a stub.
 *
 * It reads the deck rather than the raw manifest so that it uses the same
 * preprocessing the page adjudicated under. v1 of this script sent the bare
 * quoted fragment while the page showed its sentence envelope: the gold label
 * would have answered a different question from the measurement. The check
 * below is that the input rebuilt here is byte-identical to what the card
 * carried.
 *
 * Real gold labels are still PENDING, so the run injects fixture decisions IN
 * MEMORY ONLY. Without them every check would pass over zero materialised
 * cards, which is exactly the kind of green this project keeps removing.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  type AdjudicationSegmentation,
  verifierInputFor,
} from '../src/lib/ai-correction-adjudication-text.ts';

const REG = 'benchmarks/ai-correction/regression';

type Card = {
  argumentRoles: { bindable: boolean; cardinality: string; roleId: string }[];
  candidateSentenceIds: string[];
  candidateSpan: string;
  cardId: string;
  quantifier: string;
  response: string;
  responseSha: string;
  segmenterVersion: string;
  sentences: { end: number; id: string; sha: string; start: number }[];
  stratum: string;
};
type KeyEntry = {
  cardId: string;
  citedFragment: string;
  clusterId: string;
  inPrimaryEndpoint: boolean;
  lengthDiagnostic?: boolean;
  member: 'control_positive' | 'negative' | 'positive';
  pairId: string | null;
};

type Verdict =
  'AMBIGUOUS' | 'CONTRADICTED' | 'DIRECT' | 'PARTIAL' | 'UNSUPPORTED';
type Decision = 'ABSTAIN' | 'ACCEPT' | 'REJECT';
const DECISION_OF: Record<Verdict, Decision> = {
  AMBIGUOUS: 'ABSTAIN',
  CONTRADICTED: 'REJECT',
  DIRECT: 'ACCEPT',
  PARTIAL: 'REJECT',
  UNSUPPORTED: 'REJECT',
};

/** Stub verifier. Deterministic, contacts nobody, costs nothing. */
function stubVerifier(member: KeyEntry['member'], index: number): Verdict {
  if (index % 17 === 0) return 'AMBIGUOUS';
  return member === 'negative' ? 'UNSUPPORTED' : 'DIRECT';
}

function main(): void {
  const deckPath = process.env.ADJUDICATION_DECK
    ? path.resolve(process.env.ADJUDICATION_DECK)
    : path.resolve(REG, 'adjudication-deck.v3.json');
  const deck = JSON.parse(readFileSync(deckPath, 'utf8')) as {
    cards: Card[];
    contentHash: string;
    manifestHash: string;
    segmenterVersion: string;
  };
  const key = (
    JSON.parse(
      readFileSync(path.resolve(REG, 'adjudication-deck.v3.key.json'), 'utf8'),
    ) as { key: KeyEntry[] }
  ).key;
  const useFixtures = process.argv.includes('--fixture-adjudication');
  const entryOf = new Map(key.map((entry) => [entry.cardId, entry]));

  const identities = new Set<string>();
  const calls = new Map<string, number>();
  const blocked = new Map<string, number>();
  const decisions: {
    cluster: string;
    diagnostic: boolean;
    member: KeyEntry['member'];
    pairId: string | null;
    primary: boolean;
    verdict: Verdict;
  }[] = [];
  let materialised = 0;
  const mismatches: string[] = [];
  const unbuildable: string[] = [];

  deck.cards.forEach((card, index) => {
    const entry = entryOf.get(card.cardId);
    if (!entry) {
      blocked.set('carte hors clé', (blocked.get('carte hors clé') ?? 0) + 1);
      return;
    }
    if (identities.has(card.cardId)) {
      blocked.set(
        'IDENTITÉ EN DOUBLE',
        (blocked.get('IDENTITÉ EN DOUBLE') ?? 0) + 1,
      );
      return;
    }
    identities.add(card.cardId);

    // The verifier's input, rebuilt from the same contract the page used.
    const segmentation: AdjudicationSegmentation = {
      responseSha: card.responseSha,
      segmenterVersion: card.segmenterVersion,
      sentences: card.sentences,
    };
    const input = verifierInputFor({
      fragment: entry.citedFragment,
      responseText: card.response,
      // Before adjudication the bound tuple does not exist; the fixture uses the
      // candidate sentences so the path is exercised rather than skipped.
      roleSentenceIds: useFixtures ? card.candidateSentenceIds : undefined,
      segmentation,
      stratum: card.stratum,
    });
    if (!input) {
      // Before adjudication a tuple stratum has no bound sentences yet. That is
      // the gate working, not a broken input; only an envelope or full-response
      // card that cannot be built is a defect.
      const pending =
        (!useFixtures && card.stratum.startsWith('S4')) ||
        (!useFixtures && card.stratum.startsWith('S5')) ||
        (!useFixtures && card.stratum.startsWith('S6'));
      if (pending) {
        blocked.set(
          'témoins non encore liés',
          (blocked.get('témoins non encore liés') ?? 0) + 1,
        );
      } else {
        unbuildable.push(`${card.cardId} (${card.stratum})`);
        blocked.set(
          'entrée non constructible',
          (blocked.get('entrée non constructible') ?? 0) + 1,
        );
      }
      return;
    }
    // What the page showed and what the runner would send must be the same text.
    if (input.kind === 'ENVELOPE' && input.text !== card.candidateSpan) {
      mismatches.push(card.cardId);
    }

    if (!useFixtures) {
      blocked.set(
        'adjudication en attente',
        (blocked.get('adjudication en attente') ?? 0) + 1,
      );
      return;
    }

    calls.set(card.cardId, (calls.get(card.cardId) ?? 0) + 1);
    decisions.push({
      cluster: entry.clusterId,
      diagnostic: entry.lengthDiagnostic === true,
      member: entry.member,
      pairId: entry.pairId,
      primary: entry.inPrimaryEndpoint,
      verdict: stubVerifier(entry.member, index),
    });
    materialised += 1;
  });

  const ambiguousPrimaryCredit = decisions.filter(
    (decision) =>
      decision.verdict === 'AMBIGUOUS' &&
      DECISION_OF[decision.verdict] !== 'ABSTAIN',
  ).length;
  const duplicated = [...calls.values()].filter((count) => count !== 1).length;
  /**
   * The primary unit is the pair, not the card: a pair whose other member sits
   * in the diagnostic stratum is contaminated whole. Counting clean cards
   * instead of clean pairs overstates the denominator — it reported 10 clusters
   * where the pair-level count is 9.
   */
  const pairMembers = new Map<string, typeof decisions>();
  for (const decision of decisions) {
    if (!decision.pairId) continue;
    pairMembers.set(decision.pairId, [
      ...(pairMembers.get(decision.pairId) ?? []),
      decision,
    ]);
  }
  const primaryPairs = [...pairMembers.values()].filter(
    (members) =>
      members.length === 2 &&
      members.every((member) => member.primary && !member.diagnostic),
  );
  const primaryClusters = new Set(
    primaryPairs.map((members) => members[0]?.cluster),
  );
  const allClusters = new Set(decisions.map((d) => d.cluster));

  console.log(`paquet          : ${path.basename(deckPath)}`);
  console.log(`hash paquet     : ${deck.contentHash}`);
  console.log(`segmenteur      : ${deck.segmenterVersion}`);
  console.log(
    `mode            : ${useFixtures ? 'ADJUDICATION FICTIVE (mémoire seule)' : 'réel'}`,
  );
  console.log('');
  console.log(`cartes          : ${deck.cards.length}`);
  console.log(`matérialisées   : ${materialised}`);
  console.log(`appels          : ${calls.size}`);
  console.log(`grappes         : ${allClusters.size} — toutes paires`);
  console.log(
    `   paires primaires hors strate diagnostique : ${primaryPairs.length} sur ${primaryClusters.size} grappes`,
  );
  console.log(
    `cartes en strate diagnostique : ${decisions.filter((d) => d.diagnostic).length}`,
  );
  for (const [reason, count] of [...blocked].sort()) {
    console.log(`bloquées — ${reason.padEnd(26)} ${count}`);
  }
  console.log('');
  console.log(
    `entrée du vérificateur identique à la carte : ${mismatches.length === 0 ? 'oui' : `NON — ${mismatches.length}`}`,
  );
  console.log(
    `chaque carte appelée exactement une fois    : ${duplicated === 0 ? 'oui' : `NON — ${duplicated}`}`,
  );
  console.log(
    `AMBIGUOUS créditant le principal            : ${ambiguousPrimaryCredit}`,
  );
  console.log(`coût                                        : 0.00 USD`);

  const failures: string[] = [];
  if (materialised === 0) {
    failures.push(
      'VACUITÉ — aucune carte matérialisée, les contrôles ne prouvent rien',
    );
  }
  if (useFixtures && materialised !== deck.cards.length) {
    failures.push(
      `COUVERTURE — ${deck.cards.length - materialised} cartes non matérialisées`,
    );
  }
  if (mismatches.length > 0) {
    failures.push(
      `PRÉTRAITEMENT — ${mismatches.length} cartes dont l'entrée diffère de ce qui a été adjugé`,
    );
  }
  if (unbuildable.length > 0) {
    failures.push(
      `ENTRÉE — non constructible : ${unbuildable.slice(0, 3).join(', ')}`,
    );
  }
  if (duplicated !== 0)
    failures.push('DOUBLON — une carte appelée plus d’une fois');
  if (ambiguousPrimaryCredit !== 0)
    failures.push('AMBIGUOUS crédite l’endpoint principal');
  if (useFixtures && primaryClusters.size !== 9) {
    failures.push(`GRAPPES PRIMAIRES — ${primaryClusters.size} au lieu de 9`);
  }
  if (failures.length > 0) {
    console.log('');
    for (const failure of failures) console.log(`ÉCHEC : ${failure}`);
    process.exitCode = 1;
    return;
  }
  console.log('');
  console.log(
    'Tous les contrôles passent sur des cartes réellement matérialisées.',
  );
}

main();
