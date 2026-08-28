import { readFile } from 'node:fs/promises';

type AirtableContract = {
  statuses: string[];
  roles: string[];
  natures: string[];
  pages: string[];
  publicationRequiresOwnerConfirmation: boolean;
};

const expectedTickets = [
  ...Array.from({ length: 7 }, (_, index) => `V4.1-00${index + 1}`),
  ...Array.from({ length: 4 }, (_, index) => `V4.1-10${index + 1}`),
  ...Array.from({ length: 3 }, (_, index) => `V4.1-20${index + 1}`),
  ...Array.from({ length: 5 }, (_, index) => `V4.1-30${index + 1}`),
  ...Array.from({ length: 4 }, (_, index) => `V4.1-40${index + 1}`),
  ...Array.from({ length: 4 }, (_, index) => `V4.1-50${index + 1}`),
];

const requiredStatuses = [
  'DRAFT',
  'NEEDS_ARBITRATION',
  'READY',
  'IN_PROGRESS',
  'REVIEW',
  'QA',
  'READY_FOR_OWNER_GO',
  'DONE',
];

const requiredPages = [
  'V4.1 — Maintenant',
  'Ready',
  'En cours par owner',
  'Review',
  'QA',
  'Arbitrages Rayan',
  'Gate de release',
  'V4.5 — Préparation',
  'V5 — Candidats',
  'Archive V4',
];

function assertExact(label: string, actual: string[], expected: string[]) {
  const normalizedActual = [...new Set(actual)].sort();
  const normalizedExpected = [...new Set(expected)].sort();
  if (JSON.stringify(normalizedActual) !== JSON.stringify(normalizedExpected)) {
    throw new Error(
      `${label} mismatch:\nactual=${normalizedActual.join(',')}\nexpected=${normalizedExpected.join(',')}`,
    );
  }
}

const [backlog, contractText] = await Promise.all([
  readFile(new URL('../V4_1_BACKLOG.md', import.meta.url), 'utf8'),
  readFile(
    new URL('../docs/V4_1_AIRTABLE_CONTRACT.json', import.meta.url),
    'utf8',
  ),
]);
const contract = JSON.parse(contractText) as AirtableContract;
const sections = backlog.split(/^### /m).slice(1);
const tickets = sections
  .map((section) => {
    const id = section.match(/^(V4\.1-\d{3})\b/)?.[1];
    if (!id) return null;
    const owner = section.match(/^- Owner : (.+)$/m)?.[1]?.trim();
    const reviewer = section.match(/^- Reviewer : (.+)$/m)?.[1]?.trim();
    return { id, owner, reviewer };
  })
  .filter((ticket): ticket is { id: string; owner: string; reviewer: string } =>
    Boolean(ticket?.owner && ticket.reviewer),
  );

assertExact(
  'ticket ids',
  tickets.map(({ id }) => id),
  expectedTickets,
);
assertExact('statuses', contract.statuses, requiredStatuses);
assertExact('pages', contract.pages, requiredPages);

for (const ticket of tickets) {
  if (!contract.roles.includes(ticket.owner))
    throw new Error(`${ticket.id}: unknown owner ${ticket.owner}`);
  if (!contract.roles.includes(ticket.reviewer))
    throw new Error(`${ticket.id}: unknown reviewer ${ticket.reviewer}`);
  if (ticket.owner === ticket.reviewer)
    throw new Error(`${ticket.id}: owner and reviewer must differ`);
}
if (contract.natures.length !== 6)
  throw new Error('The V4.1 nature taxonomy must contain six values');
if (!contract.publicationRequiresOwnerConfirmation)
  throw new Error(
    'Airtable interface publication must require owner confirmation',
  );

console.log(
  `V4.1 Airtable contract valid: ${tickets.length} tickets, ${contract.roles.length} roles, ${contract.pages.length} pages.`,
);
