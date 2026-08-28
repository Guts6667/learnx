import { readFile } from 'node:fs/promises';

type AirtableContract = {
  version: string;
  baseId: string;
  tableId: string;
  interfaceId: string;
  identityField: string;
  writableFieldIds: string[];
  statuses: string[];
  roles: string[];
  natures: string[];
  releaseValues: string[];
  pages: Array<{
    id: string;
    name: string;
    visualization: 'kanban' | 'list';
    filter: string;
    focusField?: string;
    groupBy?: string;
    published: boolean;
  }>;
  publicationRequiresOwnerConfirmation: boolean;
  statusAuthority: string;
  definitionAuthority: string;
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

const requiredReleaseValues = ['V4.1', 'V4.5', 'V5', 'Archive V4'];

const requiredWritableFieldIds = [
  'fldOcnwOA7SIgevgS',
  'fldaxsjnqkqoWjC63',
  'fldnVONeSoSJ7qDAR',
  'fldH5hxP6oblAPKrV',
  'fld0z76ObQNmZSl6b',
  'fldedfw94bRRQZZOj',
  'fldrhf83OmSJROCsn',
  'fldTFIA2xII50E1ir',
  'fld4lGYLnC4hwTVse',
  'fldk2B3SBT2zWZzUS',
  'fldDwchSuKf0TgZLk',
  'fldL8w7Tx4pRDETqn',
  'fldxX5HZ44FyhEJrX',
  'fldHTpFmYm4J63mwo',
  'fldXsaSfpD2TFMSKS',
  'fldBfduOzWbsZvlF0',
  'fld2Dz1bD665cb6AU',
  'fldAN6bhZDsCc4Yig',
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
assertExact('release values', contract.releaseValues, requiredReleaseValues);
assertExact(
  'pages',
  contract.pages.map(({ name }) => name),
  requiredPages,
);
assertExact(
  'writable fields',
  contract.writableFieldIds,
  requiredWritableFieldIds,
);
if (!/^fld[A-Za-z0-9]{14}$/.test(contract.identityField)) {
  throw new Error('The Airtable identity field must be a stable field ID');
}
if (contract.writableFieldIds.includes(contract.identityField)) {
  throw new Error('The stable ticket identity field must not be writable');
}
for (const [label, id, prefix] of [
  ['base', contract.baseId, 'app'],
  ['table', contract.tableId, 'tbl'],
  ['interface', contract.interfaceId, 'pbd'],
] as const) {
  if (!new RegExp(`^${prefix}[A-Za-z0-9]{14}$`).test(id)) {
    throw new Error(`The Airtable ${label} ID is invalid`);
  }
}
for (const page of contract.pages) {
  if (!/^pag[A-Za-z0-9]{14}$/.test(page.id)) {
    throw new Error(`${page.name}: invalid Airtable page ID`);
  }
  if (!page.filter.trim()) throw new Error(`${page.name}: missing filter`);
  const releaseFilter = page.filter.match(/Release = ([^ ]+(?: [^ ]+)*)/);
  if (
    releaseFilter &&
    !contract.releaseValues.some((release) =>
      releaseFilter[1].startsWith(release),
    )
  ) {
    throw new Error(`${page.name}: filter uses an unknown release value`);
  }
}
const nowPage = contract.pages.find(({ name }) => name === 'V4.1 — Maintenant');
if (nowPage?.visualization !== 'kanban' || nowPage.groupBy !== 'Statut') {
  throw new Error('V4.1 — Maintenant must be a Kanban grouped by Statut');
}
const arbitrationPage = contract.pages.find(
  ({ name }) => name === 'Arbitrages Rayan',
);
if (
  arbitrationPage?.filter !== 'none' ||
  arbitrationPage.focusField !== 'Arbitrage Rayan'
) {
  throw new Error(
    'The historical arbitration page must expose Arbitrage Rayan without claiming a status filter',
  );
}
const archivePage = contract.pages.find(({ name }) => name === 'Archive V4');
if (!archivePage?.filter.includes('Release = Archive V4')) {
  throw new Error('Archive V4 must use the existing Archive V4 release choice');
}
const unpublishedDrafts = contract.pages.filter(({ published }) => !published);
if (unpublishedDrafts.length !== 9) {
  throw new Error('Exactly nine new Airtable pages must remain unpublished');
}
if (
  contract.statusAuthority !== 'Airtable' ||
  contract.definitionAuthority !== 'V4_1_BACKLOG.md'
) {
  throw new Error('Airtable and Git authorities must remain explicit');
}

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
