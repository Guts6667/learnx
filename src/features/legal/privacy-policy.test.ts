import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { privacyPolicy } from '@/features/legal/privacy-policy';

/**
 * `docs/V4_5_PRIVACY_POLICY.md` est l'autorité du texte. Ce fichier vérifie que
 * la page n'en dévie pas — dans les deux sens : rien d'ajouté, rien de perdu.
 *
 * Sans ce test, « contenu strictement celui du document » serait une promesse
 * tenue par la vigilance, ce qui n'en est pas une : une reformulation bien
 * intentionnée passerait la revue et publierait une page juridique inexacte.
 */

const document = readFileSync(
  resolve(process.cwd(), 'docs/V4_5_PRIVACY_POLICY.md'),
  'utf8',
);

/**
 * Le markdown coupe les phrases sur plusieurs lignes ; la page non. Et le
 * document met en gras des mots à l'intérieur d'une phrase — « empreinte non
 * réversible » — que la page rend en texte simple : c'est de la mise en forme,
 * pas du contenu, donc les deux côtés sont comparés sans les marqueurs.
 */
function flatten(markdown: string): string {
  return markdown.replace(/\*\*/g, '').replace(/\s+/g, ' ');
}

const flatDocument = flatten(document);

/** Une phrase du document est une suite de segments dans le module. */
function join(fragments: { text: string }[]): string {
  return fragments.map((fragment) => fragment.text).join('');
}

/**
 * Ce que doit faire quelqu'un qui voit ce test rouge.
 *
 * L'échec ne signifie presque jamais que le document est faux : il signifie
 * que le document a changé et que le module n'a pas suivi. La réparation est
 * donc de régénérer le module, jamais de réécrire la page pour la faire
 * correspondre — c'est exactement ce que ce test existe pour empêcher.
 */
const REMEDY =
  'Le document a changé sans que le module suive. Régénérez ' +
  'src/features/legal/privacy-policy.ts depuis ' +
  'docs/V4_5_PRIVACY_POLICY.md (V4.5-169) — ne modifiez pas la page pour ' +
  'la faire correspondre au document.';

describe('privacy policy content', () => {
  it.each(['en', 'fr'] as const)(
    'ne contient aucune phrase absente du document (%s)',
    (locale) => {
      const content = privacyPolicy[locale];
      const fragments = [
        content.title,
        content.updated,
        ...content.sections.flatMap((section) => [
          section.heading,
          ...(section.body ? [join(section.body)] : []),
          ...(section.bullets ?? []).map(join),
        ]),
      ];

      for (const fragment of fragments) {
        expect(
          flatDocument.includes(flatten(fragment)),
          `Absent du document : « ${fragment.slice(0, 80)}… »\n${REMEDY}`,
        ).toBe(true);
      }
    },
  );

  it.each(['en', 'fr'] as const)(
    'ne perd aucune section du document (%s)',
    (locale) => {
      // Les intitulés en gras du document sont les sections de la page. En
      // perdre une passerait inaperçu à la lecture : la page resterait
      // cohérente, simplement incomplète.
      const languageBlock = document
        .split(`\n## ${locale.toUpperCase()}\n`)[1]
        ?.split('\n---\n')[0];
      expect(languageBlock).toBeDefined();
      // Un titre de section est un gras EN DÉBUT DE LIGNE ; le gras
      // d'insistance à l'intérieur d'une puce n'en est pas un.
      const headings = [
        ...(languageBlock ?? '').matchAll(/^\*\*(.+?)\*\*/gm),
      ].map((match) => match[1]);
      expect(
        privacyPolicy[locale].sections.map((s) => s.heading),
        REMEDY,
      ).toEqual(headings);
    },
  );

  it('garde les deux langues symétriques', () => {
    expect(privacyPolicy.fr.sections).toHaveLength(
      privacyPolicy.en.sections.length,
    );
    privacyPolicy.fr.sections.forEach((section, index) => {
      const english = privacyPolicy.en.sections[index];
      expect(Boolean(section.bullets)).toBe(Boolean(english?.bullets));
      expect(section.bullets?.length ?? 0).toBe(english?.bullets?.length ?? 0);
    });
  });

  it('signale les champs que le propriétaire doit encore renseigner', () => {
    // Un crochet restant est délibéré : mieux vaut un champ visiblement vide
    // qu'une page juridique à moitié fausse. Ce test le rend visible en revue
    // plutôt que de le laisser passer en production sans que personne
    // n'en décide.
    const brackets = [privacyPolicy.en, privacyPolicy.fr].flatMap((content) =>
      content.sections.flatMap((section) =>
        [...join(section.body ?? []).matchAll(/\[([^\]]+)\]/g)].map(
          (m) => m[1],
        ),
      ),
    );
    // Liste vide depuis la 1.3.0 : identité de l'éditeur et adresse de
    // contact renseignées. Ce test devient donc la preuve de complétude —
    // pas la lecture de la page, où un crochet oublié se confond avec une
    // tournure. S'il reverdit avec une entrée, c'est qu'une version du
    // document a réintroduit un champ vide.
    expect(
      [...new Set(brackets)].sort(),
      'Un champ entre crochets est réapparu dans le document : il doit être ' +
        'renseigné par le Propriétaire avant publication, ou assumé comme ' +
        'visible. ' +
        REMEDY,
    ).toEqual([]);
  });
});
