/**
 * Zero-cost dummy run over the pair manifest (V4.5-210).
 *
 * Proves the machinery before any key is exported: every pair materialises,
 * every pair scores exactly once per member, no duplicate identity, aggregation
 * resolves to clusters, AMBIGUOUS earns no primary credit. Contacts nobody —
 * the verifier is a stub.
 *
 * Real gold labels are still PENDING. So the run injects fixture adjudications
 * IN MEMORY ONLY; nothing is written back to the manifest. Without them every
 * check would pass vacuously over zero materialised pairs, which is exactly the
 * kind of green this project has been removing.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const REG = 'benchmarks/ai-correction/regression';
const MANIFEST = process.env.PAIR_MANIFEST
  ? path.resolve(process.env.PAIR_MANIFEST)
  : path.resolve(REG, 'atom-pair-manifest.v2.json');

type Verdict = 'AMBIGUOUS' | 'CONTRADICTED' | 'DIRECT' | 'PARTIAL' | 'UNSUPPORTED';
type Decision = 'ABSTAIN' | 'ACCEPT' | 'REJECT';

type Pair = {
  adjudication: { positiveSpan: string | null; status: string };
  atomId: string;
  authoredAnswerId: string;
  criterionKey: string;
  inPrimaryEndpoint: boolean;
  negativeSpans: string[];
  stratum: string;
};

type Manifest = {
  atomTaxonomyHash: string;
  contentHash: string;
  deterministicallyCatchable: { failures: unknown[] };
  pairs: Pair[];
  verdictMapping: Record<string, { decision: Decision; note: string }>;
};

/**
 * The inputs one verifier call needs, decided by the stratum alone.
 *
 * Enumerated, not inferred from the name. Substring matching let an unknown
 * stratum fall through to the weakest input set — fewer inputs, silently.
 */
const STRATUM_INPUTS: Record<string, string[]> = {
  S1_span_local: ['atomText', 'span'],
  S2_span_frame: ['atomText', 'span', 'taskFrame'],
  S3_span_dossier: ['atomText', 'span', 'referencePacket'],
  S4_multi_local: ['atomText', 'span', 'secondSpan'],
  S5_multi_frame: ['atomText', 'span', 'secondSpan', 'taskFrame'],
  S6_multi_dossier: ['atomText', 'span', 'secondSpan', 'referencePacket'],
  S7_full_dossier: ['atomText', 'span', 'fullResponse', 'referencePacket'],
};

/** Stub verifier. Deterministic, contacts nobody, costs nothing. */
function stubVerifier(member: 'negative' | 'positive', index: number): Verdict {
  if (index % 17 === 0) return 'AMBIGUOUS';
  return member === 'positive' ? 'DIRECT' : 'UNSUPPORTED';
}

function main(): void {
  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8')) as Manifest;
  const useFixtures = process.argv.includes('--fixture-adjudication');

  const identities = new Set<string>();
  const calls = new Map<string, number>();
  const blocked = new Map<string, number>();
  const decisions: {
    cluster: string;
    member: 'negative' | 'positive';
    primary: boolean;
    verdict: Verdict;
  }[] = [];
  let materialised = 0;
  let missingInput = 0;
  const unknownStrata = new Set<string>();

  manifest.pairs.forEach((pair, index) => {
    const identity = createHash('sha256')
      .update(
        [
          pair.authoredAnswerId,
          pair.criterionKey,
          pair.atomId,
          pair.negativeSpans.map((s) => s.trim().toLowerCase()).sort().join('|'),
        ].join('::'),
      )
      .digest('hex')
      .slice(0, 20);
    if (identities.has(identity)) {
      blocked.set('IDENTITÉ EN DOUBLE', (blocked.get('IDENTITÉ EN DOUBLE') ?? 0) + 1);
      return;
    }
    identities.add(identity);

    if (pair.negativeSpans.length === 0) {
      blocked.set('aucun span négatif', (blocked.get('aucun span négatif') ?? 0) + 1);
      return;
    }

    const positiveSpan =
      pair.adjudication.positiveSpan ??
      (useFixtures ? `FIXTURE::${identity}` : null);
    const adjudicated = pair.adjudication.status === 'ADJUDICATED' || useFixtures;
    if (!adjudicated || positiveSpan === null) {
      blocked.set('adjudication en attente', (blocked.get('adjudication en attente') ?? 0) + 1);
      return;
    }

    // Members are submitted independently and paired only at analysis.
    for (const member of ['negative', 'positive'] as const) {
      const available: Record<string, unknown> = {
        atomText: pair.atomId,
        fullResponse: 'FIXTURE',
        referencePacket: 'FIXTURE',
        secondSpan: 'FIXTURE',
        span: member === 'positive' ? positiveSpan : pair.negativeSpans[0],
        taskFrame: 'FIXTURE',
      };
      const required = STRATUM_INPUTS[pair.stratum];
      if (required === undefined) {
        unknownStrata.add(pair.stratum);
      } else {
        for (const input of required) {
          if (available[input] === undefined) missingInput += 1;
        }
      }
      const key = `${identity}::${member}`;
      calls.set(key, (calls.get(key) ?? 0) + 1);
      decisions.push({
        cluster: pair.authoredAnswerId,
        member,
        primary: pair.inPrimaryEndpoint,
        verdict: stubVerifier(member, index),
      });
    }
    materialised += 1;
  });

  const map = manifest.verdictMapping;
  const decide = (verdict: Verdict): Decision => map[verdict]?.decision ?? 'ABSTAIN';
  const ambiguousPrimaryCredit = decisions.filter(
    (d) => d.verdict === 'AMBIGUOUS' && decide(d.verdict) !== 'ABSTAIN',
  ).length;
  const duplicated = [...calls.values()].filter((n) => n !== 1).length;
  const clusters = new Set(decisions.map((d) => d.cluster));

  console.log(`manifeste       : ${path.basename(MANIFEST)}`);
  console.log(`hash manifeste  : ${manifest.contentHash}`);
  console.log(`hash taxonomie  : ${manifest.atomTaxonomyHash}`);
  console.log(`mode            : ${useFixtures ? 'ADJUDICATION FICTIVE (mémoire seule)' : 'réel'}`);
  console.log('');
  console.log(`paires du manifeste : ${manifest.pairs.length}`);
  console.log(`identités uniques   : ${identities.size}`);
  console.log(`matérialisées       : ${materialised}`);
  console.log(`appels vérificateur : ${calls.size} (${decisions.length} soumissions)`);
  console.log(`grappes couvertes   : ${clusters.size}`);
  console.log(`échecs à règle déterministe (hors paires) : ${manifest.deterministicallyCatchable.failures.length}`);
  for (const [reason, count] of [...blocked].sort()) {
    console.log(`bloquées — ${reason.padEnd(24)} ${count}`);
  }
  console.log('');
  console.log(`chaque membre scoré exactement une fois : ${duplicated === 0 ? 'oui' : `NON — ${duplicated}`}`);
  console.log(`entrées manquantes par strate           : ${missingInput}`);
  console.log(`AMBIGUOUS créditant le principal        : ${ambiguousPrimaryCredit}`);
  console.log(`coût                                    : 0.00 USD`);

  // Guards. A dummy run that passes over nothing proves nothing.
  const failures: string[] = [];
  if (materialised === 0) failures.push('VACUITÉ — aucune paire matérialisée, les contrôles ne prouvent rien');
  if (useFixtures && materialised !== manifest.pairs.length) {
    failures.push(`COUVERTURE — ${manifest.pairs.length - materialised} paires non matérialisées sous fixtures`);
  }
  if (duplicated !== 0) failures.push('DOUBLON — un membre scoré plus d’une fois');
  const duplicateIdentities = blocked.get('IDENTITÉ EN DOUBLE') ?? 0;
  if (duplicateIdentities !== 0) {
    failures.push(`IDENTITÉ EN DOUBLE — ${duplicateIdentities} paires partagent une identité`);
  }
  if (unknownStrata.size > 0) {
    failures.push(`STRATE INCONNUE — ${[...unknownStrata].sort().join(', ')} : aucun jeu d’entrées déclaré`);
  }
  if (missingInput !== 0) failures.push('ENTRÉE MANQUANTE — une strate exige une entrée absente');
  if (ambiguousPrimaryCredit !== 0) failures.push('AMBIGUOUS crédite l’endpoint principal');
  if (useFixtures && clusters.size !== 14) failures.push(`GRAPPES — ${clusters.size} au lieu de 14`);
  if (failures.length > 0) {
    console.log('');
    for (const failure of failures) console.log(`ÉCHEC : ${failure}`);
    process.exitCode = 1;
    return;
  }
  console.log('');
  console.log('Tous les contrôles passent sur des paires réellement matérialisées.');
}

main();
