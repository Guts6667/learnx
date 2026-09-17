/** Source-answer bootstrap, not a binomial test over correlated atom pairs. */
export function summariseSourceClusters(
  pairs: { pairId: string; clusterId: string }[],
  outcomes: { pairId: string; outcome: string }[],
) {
  const byPair = new Map(outcomes.map((p) => [p.pairId, p.outcome]));
  const clusters = new Map<string, number[]>();
  for (const pair of pairs) {
    if (!pair.clusterId) throw new Error('ATOM_VERIFIER_CLUSTER_MISSING');
    const group = clusters.get(pair.clusterId) ?? [];
    group.push(byPair.get(pair.pairId) === 'original' ? 1 : 0);
    clusters.set(pair.clusterId, group);
  }
  const rates = [...clusters.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => v.reduce((a, b) => a + b, 0) / v.length);
  const mean = rates.length
    ? rates.reduce((a, b) => a + b, 0) / rates.length
    : null;
  let state = 210;
  const samples: number[] = [];
  if (rates.length > 1)
    for (let i = 0; i < 2_000; i += 1) {
      let total = 0;
      for (let j = 0; j < rates.length; j += 1) {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        total += rates[Math.floor((state / 2 ** 32) * rates.length)];
      }
      samples.push(total / rates.length);
    }
  samples.sort((a, b) => a - b);
  return {
    unit: 'SOURCE_ANSWER' as const,
    clusters: rates.length,
    clusterWeightedWinRate: mean,
    bootstrap95: samples.length ? [samples[49], samples[1949]] : null,
    limitation:
      'Exploratory source-cluster bootstrap; few selected sources and single-rater labels do not establish population reliability.',
  };
}
