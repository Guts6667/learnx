export type ClassName = string | false | null | undefined;

export function classNames(...values: ClassName[]): string {
  return values.filter(Boolean).join(' ');
}
