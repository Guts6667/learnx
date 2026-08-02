export interface ProgressCategory {
  itemProgress: number[];
  weight: number;
}

function clampPercent(value: number): number {
  return Math.min(Math.max(value, 0), 100);
}

function calculateAverage(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return (
    values.reduce((total, value) => total + clampPercent(value), 0) /
    values.length
  );
}

export function calculateProgress(categories: ProgressCategory[]): number {
  const availableCategories = categories.filter(
    (category) => category.weight > 0 && category.itemProgress.length > 0,
  );
  const totalWeight = availableCategories.reduce(
    (total, category) => total + category.weight,
    0,
  );

  if (totalWeight === 0) {
    return 0;
  }

  const progress = availableCategories.reduce(
    (total, category) =>
      total +
      calculateAverage(category.itemProgress) * (category.weight / totalWeight),
    0,
  );

  return clampPercent(progress);
}
