import {
  classifyReviewDate,
  selectDailyRecommendation,
  type RecommendationCandidate,
  type RecommendationKind,
} from '@/lib/recommendation';

function candidate(
  kind: RecommendationKind,
  order: number,
): RecommendationCandidate {
  return {
    estimatedMinutes: 10,
    href: '/action',
    kind,
    lessonTitle: null,
    moduleTitle: null,
    order,
    programId: 'program-1',
    programSlug: 'program',
    programTitle: 'Programme',
    stageTitle: null,
    title: kind,
  };
}

describe('daily recommendation', () => {
  it('respecte strictement les huit priorités du PRD', () => {
    const orderedKinds: RecommendationKind[] = [
      'OVERDUE_REVIEW',
      'DUE_TODAY_REVIEW',
      'INCOMPLETE_TASK',
      'REQUIRED_QUIZ',
      'REQUIRED_EXERCISE',
      'NEXT_LESSON',
      'NEXT_MODULE',
      'NEXT_STAGE',
    ];

    for (let index = 0; index < orderedKinds.length; index += 1) {
      expect(
        selectDailyRecommendation(
          orderedKinds
            .slice(index)
            .reverse()
            .map((kind) => candidate(kind, 1)),
        )?.kind,
      ).toBe(orderedKinds[index]);
    }
  });

  it('départage une même priorité avec l’ordre pédagogique', () => {
    expect(
      selectDailyRecommendation([
        candidate('NEXT_LESSON', 2),
        candidate('NEXT_LESSON', 1),
      ])?.order,
    ).toBe(1);
    expect(selectDailyRecommendation([])).toBeNull();
  });

  it('classe une révision selon la journée locale, y compris près de minuit', () => {
    const now = new Date('2026-08-02T22:30:00.000Z');

    expect(
      classifyReviewDate(
        new Date('2026-08-02T08:00:00.000Z'),
        now,
        'Europe/Paris',
      ),
    ).toBe('OVERDUE_REVIEW');
    expect(
      classifyReviewDate(
        new Date('2026-08-03T08:00:00.000Z'),
        now,
        'Europe/Paris',
      ),
    ).toBe('DUE_TODAY_REVIEW');
  });
});
