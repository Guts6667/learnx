import { z } from 'zod';

export const emailSchema = z.string().trim().toLowerCase().email().max(320);
const passwordSchema = z.string().min(12).max(128);
const displayNameSchema = z.string().trim().min(1).max(80);

export const loginInputSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const registerInputSchema = loginInputSchema.extend({
  displayName: displayNameSchema,
});

export const accessRequestInputSchema = z
  .object({
    email: emailSchema,
  })
  .strict();

export type LoginInput = z.infer<typeof loginInputSchema>;
export type RegisterInput = z.infer<typeof registerInputSchema>;
export type AccessRequestInput = z.infer<typeof accessRequestInputSchema>;
