export type ClassName = string | false | null | undefined;

export function classNames(...values: ClassName[]) {
  return values.filter(Boolean).join(' ');
}
