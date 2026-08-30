import {
  planNeonCapacity,
  type NeonBranch,
} from '../src/server/maintenance/neon-capacity.js';

/**
 * Waits, inside the running Integration job, until the Neon project has room
 * for this run's branch. See `neon-capacity.ts` for why the waiting happens
 * here and not in a GitHub concurrency group.
 *
 * Loud on every outcome. A pipeline that stops testing must never look like a
 * pipeline that is testing and passing.
 */

const API = 'https://console.neon.tech/api/v2';

const apiKey = requireEnv('NEON_API_KEY');
const projectId = requireEnv('NEON_PROJECT_ID');
const ceiling = numberFromEnv('LEARNX_NEON_BRANCH_CEILING', 10);
const maxAgeMinutes = numberFromEnv('LEARNX_NEON_SWEEP_AGE_MINUTES', 120);
const deadlineMinutes = numberFromEnv('LEARNX_NEON_WAIT_MINUTES', 20);
const pollSeconds = numberFromEnv('LEARNX_NEON_POLL_SECONDS', 30);

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Refus : ${name} est absent.`);
    process.exit(1);
  }
  return value;
}

function numberFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

async function neon(path: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${apiKey}`,
      ...init?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(
      `Neon ${init?.method ?? 'GET'} ${path} → ${response.status}`,
    );
  }

  return response;
}

async function listBranches(): Promise<NeonBranch[]> {
  const response = await neon(`/projects/${projectId}/branches`);
  const body = (await response.json()) as {
    branches: { created_at: string; id: string; name: string }[];
  };

  return body.branches.map((branch) => ({
    createdAt: branch.created_at,
    id: branch.id,
    name: branch.name,
  }));
}

async function deleteBranch(id: string): Promise<void> {
  await neon(`/projects/${projectId}/branches/${id}`, { method: 'DELETE' });
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const giveUpAt = Date.now() + deadlineMinutes * 60_000;

while (true) {
  const branches = await listBranches();
  const plan = planNeonCapacity({
    branches,
    ceiling,
    maxAgeMinutes,
    now: new Date(),
  });

  if (plan.kind === 'PROCEED') {
    console.log(`Capacité Neon disponible : ${plan.used}/${ceiling} branches.`);
    break;
  }

  if (plan.kind === 'SWEEP') {
    console.log(
      `Projet plein (${ceiling}/${ceiling}). Suppression de ${plan.ids.length} branche(s) ci-* orpheline(s) de plus de ${maxAgeMinutes} min : ${plan.ids.join(', ')}`,
    );
    for (const id of plan.ids) await deleteBranch(id);
    continue;
  }

  if (Date.now() >= giveUpAt) {
    console.error(
      [
        `Échec : le projet Neon est resté plein (${plan.used}/${ceiling}) pendant ${deadlineMinutes} min.`,
        'Aucune branche ci-* n’était assez ancienne pour être balayée, donc des',
        'runs sont probablement encore en vol. Ce job échoue plutôt que de',
        'créer une branche qui recevrait un 422, et surtout plutôt que de ne',
        'rien dire.',
      ].join('\n'),
    );
    process.exit(1);
  }

  console.log(
    `Projet plein (${plan.used}/${ceiling}), rien à balayer. Nouvel essai dans ${pollSeconds} s.`,
  );
  await sleep(pollSeconds * 1_000);
}
