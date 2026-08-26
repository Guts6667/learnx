import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Compose conditional classes and resolve Tailwind utility conflicts.
 * This is the single class-name utility used by owned shadcn primitives.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
