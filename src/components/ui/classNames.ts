import { cn } from '@/lib/utils';

export type ClassName = string | false | null | undefined;

export function classNames(...values: ClassName[]): string {
  return cn(values);
}
