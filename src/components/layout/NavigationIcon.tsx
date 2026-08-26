export type NavigationIconName =
  'home' | 'journey' | 'notes' | 'profile' | 'review';

export function NavigationIcon({ name }: { name: NavigationIconName }) {
  const paths = {
    home: (
      <>
        <path d="m3 10 9-7 9 7" />
        <path d="M5 9v11h14V9" />
        <path d="M9 20v-6h6v6" />
      </>
    ),
    journey: (
      <>
        <path d="M4 5.5 9 3l6 2.5L20 3v15.5L15 21l-6-2.5L4 21Z" />
        <path d="M9 3v15.5M15 5.5V21" />
      </>
    ),
    notes: (
      <>
        <path d="M6 3h9l4 4v14H6Z" />
        <path d="M15 3v5h4M9 12h6M9 16h6" />
      </>
    ),
    profile: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4.5 21a7.5 7.5 0 0 1 15 0" />
      </>
    ),
    review: (
      <>
        <path d="M4 12a8 8 0 1 0 2.3-5.7L4 8.5" />
        <path d="M4 4v4.5h4.5M9 12l2 2 4-5" />
      </>
    ),
  } satisfies Record<NavigationIconName, ReactNode>;

  return (
    <svg
      aria-hidden="true"
      className="size-5 shrink-0"
      fill="none"
      focusable="false"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      {paths[name]}
    </svg>
  );
}
import type { ReactNode } from 'react';
