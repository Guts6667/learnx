import { readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

import {
  bilingualGlossarySchema,
  bilingualQaIsComplete,
  translationManifestSchema,
} from '../src/shared/bilingual-editorial.js';

const contentRoot = resolve('content');
const glossaryPath = join(contentRoot, 'i18n', 'GLOSSARY_FR_EN.json');

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8')) as unknown;
}

function findTranslationManifests(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return findTranslationManifests(path);
    return /^TRANSLATION_MANIFEST_.+\.json$/.test(name) ? [path] : [];
  });
}

export function validateBilingualEditorialArtifacts(): {
  glossaryTerms: number;
  manifests: number;
} {
  const glossary = bilingualGlossarySchema.parse(readJson(glossaryPath));
  const glossaryKeys = new Set(glossary.terms.map(({ key }) => key));
  const manifests = findTranslationManifests(contentRoot);

  for (const path of manifests) {
    const manifest = translationManifestSchema.parse(readJson(path));
    if (manifest.glossaryVersion !== glossary.version) {
      throw new Error(
        `${basename(path)} references an unknown glossary version.`,
      );
    }
    if (!bilingualQaIsComplete(manifest.qa)) {
      throw new Error(`${basename(path)} has incomplete bilingual QA.`);
    }
    const missingTerm = manifest.target.glossaryTermKeys.find(
      (key) => !glossaryKeys.has(key),
    );
    if (missingTerm) {
      throw new Error(
        `${basename(path)} references missing glossary term ${missingTerm}.`,
      );
    }
  }

  return { glossaryTerms: glossary.terms.length, manifests: manifests.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = validateBilingualEditorialArtifacts();
  console.log(
    `Bilingual editorial QA passed: ${result.glossaryTerms} glossary terms, ${result.manifests} manifests.`,
  );
}
