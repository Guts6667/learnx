import { useQuery } from '@tanstack/react-query';
import * as z from 'zod/mini';

// Import relatif, pas d'alias : `src/lib` est aussi parcouru par le runtime
// serveur de Vercel, qui ne résout pas `@/` (src/server/integration-runtime-import).
import { apiRequest } from './api-client';

/**
 * Lit une surface serveur en VÉRIFIANT sa forme au lieu de l'affirmer.
 *
 * Une réponse hors schéma devient une erreur de requête, donc un état d'erreur
 * visible — jamais un rendu partiel. Introduit en V4.5-182, où le type client
 * de `/monitoring` avait dérivé de celui du serveur : le typecheck passait, la
 * page rendait sept `undefined`, et les fixtures des tests portaient la même
 * forme périmée, si bien que rien nulle part ne comparait la page à l'API.
 *
 * Extrait ici en V4.5-162 : les surfaces de paiement en ont le même besoin, et
 * deux copies de cette règle seraient deux copies à tenir alignées.
 */
export function useObservedQuery<Schema extends z.ZodMiniType>(
  path: string,
  queryKey: readonly unknown[],
  schema: Schema,
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    enabled: options.enabled ?? true,
    queryFn: async (): Promise<z.infer<Schema>> => {
      const payload = await apiRequest<unknown>(path);
      const parsed = z.safeParse(schema, payload);
      if (!parsed.success) {
        throw new Error(
          `La réponse de ${path} ne correspond pas au contrat attendu. ` +
            'Le serveur a probablement changé de forme sans que le client ' +
            'suive : ' +
            parsed.error.issues
              .slice(0, 3)
              .map(
                (issue) =>
                  `${issue.path.join('.') || '(racine)'} ${issue.message}`,
              )
              .join(' · '),
        );
      }
      return parsed.data;
    },
    queryKey,
    staleTime: 10_000,
  });
}
