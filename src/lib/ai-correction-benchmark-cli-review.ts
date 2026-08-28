import path from 'node:path';

import type {
  CorrectionBenchmarkConfiguration,
  CorrectionBenchmarkCorpus,
} from './ai-correction-benchmark.js';
import {
  applyAutonomousReviewedResult,
  applyReviewedResult,
  type LoadedBenchmarkInputs,
} from './ai-correction-benchmark-runner.js';

export async function applyBenchmarkReviewArguments(input: {
  arguments: string[];
  configuration: CorrectionBenchmarkConfiguration;
  corpus: CorrectionBenchmarkCorpus;
  loaded: LoadedBenchmarkInputs;
}): Promise<boolean> {
  const reviewArgument = input.arguments.find((argument) =>
    argument.startsWith('--apply-review='),
  );
  const autonomousReviewArgument = input.arguments.find((argument) =>
    argument.startsWith('--apply-autonomous-review='),
  );
  const blindReviewPacketArgument = input.arguments.find((argument) =>
    argument.startsWith('--blind-review-packet='),
  );
  const attemptsArgument = input.arguments.find((argument) =>
    argument.startsWith('--attempts='),
  );
  if (
    !reviewArgument &&
    !autonomousReviewArgument &&
    !blindReviewPacketArgument &&
    !attemptsArgument
  ) {
    return false;
  }
  if (reviewArgument && autonomousReviewArgument) {
    throw new Error('BENCHMARK_REVIEW_AUTHORITY_AMBIGUOUS');
  }
  if (autonomousReviewArgument) {
    if (
      !attemptsArgument ||
      !blindReviewPacketArgument ||
      input.loaded.corpusReviewAuthority !== 'AUTONOMOUS_AI_NOT_HUMAN' ||
      !input.loaded.corpusReview ||
      input.loaded.supplierCostCapUsd === undefined
    ) {
      throw new Error(
        'BENCHMARK_AUTONOMOUS_REVIEW_REQUIRES_COMPLETE_AUTHORITY_CHAIN',
      );
    }
    await applyAutonomousReviewedResult({
      attemptsPath: path.resolve(attemptsArgument.slice('--attempts='.length)),
      blindReviewPacketPath: path.resolve(
        blindReviewPacketArgument.slice('--blind-review-packet='.length),
      ),
      configuration: input.configuration,
      configurationSha256: input.loaded.configurationSha256,
      corpus: input.corpus,
      corpusSha256: input.loaded.corpusSha256,
      ownerAuthorizationReference:
        input.loaded.corpusReview.ownerAuthorizationReference,
      ownerAuthorizationSha256:
        input.loaded.corpusReview.ownerAuthorizationSha256,
      reviewPath: path.resolve(
        autonomousReviewArgument.slice('--apply-autonomous-review='.length),
      ),
      supplierCostCapUsd: input.loaded.supplierCostCapUsd,
    });
    return true;
  }
  if (!reviewArgument || !attemptsArgument || blindReviewPacketArgument) {
    throw new Error('BENCHMARK_REVIEW_REQUIRES_REVIEW_AND_ATTEMPTS_PATHS');
  }
  await applyReviewedResult({
    attemptsPath: path.resolve(attemptsArgument.slice('--attempts='.length)),
    configuration: input.configuration,
    corpus: input.corpus,
    reviewPath: path.resolve(reviewArgument.slice('--apply-review='.length)),
  });
  return true;
}
