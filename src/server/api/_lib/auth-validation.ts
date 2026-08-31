import { z } from 'zod';

const localeSchema = z.enum(['fr', 'en']);

const emailSchema = z.string().trim().toLowerCase().email().max(320);
const passwordSchema = z.string().min(12).max(128);
const displayNameSchema = z.string().trim().min(1).max(80);

export const loginInputSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const registerInputSchema = loginInputSchema.extend({
  displayName: displayNameSchema,
  locale: localeSchema.default('fr'),
});

export const accessRequestInputSchema = z
  .object({
    email: emailSchema,
    locale: localeSchema.default('fr'),
  })
  .strict();

export const emailVerificationInputSchema = z
  .object({
    token: z
      .string()
      .min(32)
      .max(512)
      .regex(/^[A-Za-z0-9_-]+$/),
  })
  .strict();

export const accessInvitationActivationInputSchema = z
  .object({
    displayName: displayNameSchema,
    password: passwordSchema,
    token: z
      .string()
      .min(32)
      .max(512)
      .regex(/^[A-Za-z0-9_-]+$/),
  })
  .strict();

export const localePreferenceInputSchema = z
  .object({ locale: localeSchema })
  .strict();

/**
 * Le consentement est un booléen explicite, jamais un champ qu'on peut omettre
 * (V4.5-168). Une absence serait lue comme « laisse tel quel » par le serveur
 * et comme « j'ai choisi » par l'apprenant.
 */
export const correctionReuseConsentInputSchema = z
  .object({ consent: z.boolean() })
  .strict();
