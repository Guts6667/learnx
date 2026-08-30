import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { aiDefinition } from './sourcelab-programs/ai.mjs';
import { infraDefinition } from './sourcelab-programs/infra.mjs';
import {
  filesMatch,
  generatedFiles,
  validateSeed,
  writeFiles,
} from './sourcelab-programs/lib.mjs';

const root = process.cwd();
const definitions = [infraDefinition, aiDefinition];
const files = generatedFiles(definitions);
const checkOnly = process.argv.includes('--check');

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), 'utf8');
}

function write(relativePath, content) {
  writeFileSync(resolve(root, relativePath), content, 'utf8');
}

function patchSeedTs() {
  const path = 'prisma/seed.ts';
  let content = read(path);
  if (!content.includes('readSourceLabProductionEngineeringSeed')) {
    const anchor = 'export async function readSampleProgram(): Promise<SampleProgram> {';
    const readers = `export async function readSourceLabProductionEngineeringSeed(): Promise<SampleSeed> {\n  return readSeedFile('seed/sourcelab-production-engineering-program.json');\n}\n\nexport async function readSourceLabAiRagSeed(): Promise<SampleSeed> {\n  return readSeedFile('seed/sourcelab-ai-rag-program.json');\n}\n\n`;
    if (!content.includes(anchor)) throw new Error('Impossible de trouver le point d’insertion des lecteurs SourceLab.');
    content = content.replace(anchor, `${readers}${anchor}`);
  }
  if (!content.includes("slug: 'sourcelab-ingenierie-production'")) {
    const start = content.indexOf('const seedDefinitions = [');
    const end = content.indexOf('] as const;', start);
    if (start < 0 || end < 0) throw new Error('Impossible de trouver seedDefinitions.');
    const entries = `  {\n    read: readSourceLabProductionEngineeringSeed,\n    slug: 'sourcelab-ingenierie-production',\n  },\n  {\n    read: readSourceLabAiRagSeed,\n    slug: 'sourcelab-ia-rag',\n  },\n`;
    content = `${content.slice(0, end)}${entries}${content.slice(end)}`;
  }
  write(path, content);
}

function patchDocsIndex() {
  const path = 'docs/INDEX.md';
  let content = read(path);
  if (content.includes('## Programmes SourceLab')) return;
  const anchor = '## Archives';
  const section = `## Programmes SourceLab\n\nLes deux parcours construisent le même produit autonome dans un dépôt distinct de LearnX. Le premier livre le Source Workspace et son socle de production ; le second ajoute le Program Builder, l’Assessment Reviewer et le RAG évalué. Les deux bundles restent en brouillon jusqu’aux revues humaines.\n\n### SourceLab — Socle d’ingénierie en production\n\n- Présentation : \`content/sourcelab-ingenierie-production/README.md\`\n- Blueprint : \`content/sourcelab-ingenierie-production/CURRICULUM_BLUEPRINT.md\`\n- Registre de sources : \`content/sourcelab-ingenierie-production/SOURCE_REGISTER.md\`\n- Bundle Prisma : \`seed/sourcelab-production-engineering-program.json\`\n\n### SourceLab — RAG, génération et évaluation IA\n\n- Présentation : \`content/sourcelab-ia-rag/README.md\`\n- Blueprint : \`content/sourcelab-ia-rag/CURRICULUM_BLUEPRINT.md\`\n- Registre de sources : \`content/sourcelab-ia-rag/SOURCE_REGISTER.md\`\n- Bundle Prisma : \`seed/sourcelab-ai-rag-program.json\`\n\nLes fichiers sont générés de manière déterministe depuis \`scripts/sourcelab-programs/\`. Utiliser \`pnpm content:sourcelab:check\` pour vérifier structure, sources, quiz, séquences et enregistrement des seeds.\n\n`;
  if (!content.includes(anchor)) throw new Error('Impossible de trouver la section Archives de docs/INDEX.md.');
  content = content.replace(anchor, `${section}${anchor}`);
  write(path, content);
}

function patchPackageJson() {
  const path = 'package.json';
  const packageJson = JSON.parse(read(path));
  packageJson.scripts = {
    ...packageJson.scripts,
    'content:sourcelab:generate': 'node scripts/generate-sourcelab-programs.mjs',
    'content:sourcelab:check': 'node scripts/generate-sourcelab-programs.mjs --check',
  };
  write(path, `${JSON.stringify(packageJson, null, 2)}\n`);
}

function patchIntegrationWorkflow() {
  const path = '.github/workflows/integration.yml';
  let content = read(path);
  if (content.includes('Validate SourceLab program bundles')) return;
  const anchor = `      - name: Validate i18n catalogs\n        run: pnpm i18n:check\n`;
  const step = `      - name: Validate SourceLab program bundles\n        run: pnpm content:sourcelab:check\n`;
  if (!content.includes(anchor)) throw new Error('Impossible de trouver l’étape i18n du workflow Integration.');
  content = content.replace(anchor, `${anchor}${step}`);
  write(path, content);
}

function removeTemporaryPayloads() {
  for (const relativePath of ['.source-packages', 'scripts/.sourcelab-payload']) {
    const absolutePath = resolve(root, relativePath);
    if (existsSync(absolutePath)) rmSync(absolutePath, { recursive: true, force: true });
  }
}

function verifyRegistrations() {
  const seedTs = read('prisma/seed.ts');
  for (const required of [
    'readSourceLabProductionEngineeringSeed',
    'readSourceLabAiRagSeed',
    "slug: 'sourcelab-ingenierie-production'",
    "slug: 'sourcelab-ia-rag'",
  ]) {
    if (!seedTs.includes(required)) throw new Error(`Enregistrement Prisma absent : ${required}`);
  }
  const packageJson = JSON.parse(read('package.json'));
  if (packageJson.scripts?.['content:sourcelab:check'] !== 'node scripts/generate-sourcelab-programs.mjs --check') {
    throw new Error('Commande content:sourcelab:check absente ou incorrecte.');
  }
  const docsIndex = read('docs/INDEX.md');
  if (!docsIndex.includes('## Programmes SourceLab')) throw new Error('Index documentaire SourceLab absent.');
  const workflow = read('.github/workflows/integration.yml');
  if (!workflow.includes('Validate SourceLab program bundles')) throw new Error('Gate CI SourceLab absent.');
}

function validateWrittenSeeds() {
  for (const definition of definitions) {
    const seed = JSON.parse(read(`seed/${definition.seedFile}`));
    validateSeed(seed);
  }
}

if (checkOnly) {
  filesMatch(root, files);
  validateWrittenSeeds();
  verifyRegistrations();
  console.info('SourceLab curricula valid: 2 programs, 12 stages, 24 lessons, 24 quizzes and 24 concept assessment banks.');
} else {
  writeFiles(root, files);
  patchSeedTs();
  patchDocsIndex();
  patchPackageJson();
  patchIntegrationWorkflow();
  removeTemporaryPayloads();
  filesMatch(root, files);
  validateWrittenSeeds();
  verifyRegistrations();
  console.info('SourceLab curricula materialized successfully.');
}
