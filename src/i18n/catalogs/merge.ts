import type { MessageFragment, MessageValue } from '@/i18n/catalogs/types';

type UnionToIntersection<Union> = (
  Union extends unknown ? (value: Union) => void : never
) extends (value: infer Intersection) => void
  ? Intersection
  : never;

type MergedCatalog<Fragments extends readonly MessageFragment[]> = Readonly<
  UnionToIntersection<Fragments[number]>
>;

export function mergeCatalogFragments<
  const Fragments extends readonly MessageFragment[],
>(...fragments: Fragments): MergedCatalog<Fragments> {
  const catalog: Record<string, MessageValue> = {};

  for (const fragment of fragments) {
    for (const [key, value] of Object.entries(fragment)) {
      if (Object.hasOwn(catalog, key)) {
        throw new Error(`Duplicate i18n message key: "${key}".`);
      }
      catalog[key] = value;
    }
  }

  return catalog as MergedCatalog<Fragments>;
}
