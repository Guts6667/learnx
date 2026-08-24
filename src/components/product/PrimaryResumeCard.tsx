import type { ComponentChildren } from 'preact';

import { Card } from '@/components/ui/Card';
import { NavigationAction } from '@/components/ui/NavigationAction';
import { ProgressBar } from '@/components/ui/ProgressBar';

interface PrimaryResumeCardProps {
  actionHref: string;
  actionLabel: string;
  children?: ComponentChildren;
  eyebrow: ComponentChildren;
  metadata?: string[];
  progress?: {
    label: string;
    value: number;
  };
  supportingText?: string;
  title: string;
}

/**
 * Dominant next-step surface from the approved Totem product language.
 *
 * The visual signature is intentionally owned here instead of being rebuilt
 * by each product page: paper surface, mist border, rare coral corner and one
 * dominant cobalt action.
 */
export function PrimaryResumeCard({
  actionHref,
  actionLabel,
  children,
  eyebrow,
  metadata = [],
  progress,
  supportingText,
  title,
}: PrimaryResumeCardProps) {
  return (
    <Card class="totem-resume-card" data-totem-component="primary-resume" tone="signature">
      <div class="totem-resume-card__body">
        <p class="totem-kicker">{eyebrow}</p>
        <h2 class="totem-resume-card__title">{title}</h2>
        {supportingText ? (
          <p class="totem-resume-card__copy">{supportingText}</p>
        ) : null}
        {metadata.length > 0 ? (
          <ul class="totem-resume-card__meta" role="list">
            {metadata.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : null}
      </div>

      {progress ? (
        <ProgressBar label={progress.label} value={progress.value} />
      ) : null}

      {children}

      <NavigationAction
        class="totem-resume-card__action"
        href={actionHref}
        size="lg"
      >
        <span>{actionLabel}</span>
        <span aria-hidden="true">→</span>
      </NavigationAction>
    </Card>
  );
}
