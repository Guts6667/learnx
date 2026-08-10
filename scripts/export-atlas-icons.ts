import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { chromium } from '@playwright/test';

const projectDirectory = resolve(import.meta.dirname, '..');
const sourcePath = resolve(projectDirectory, 'public/learnx-icon.svg');
const sizes = [1024, 512, 192, 180, 60, 40, 32, 29] as const;

const source = await readFile(sourcePath, 'utf8');
const sourceUrl = `data:image/svg+xml;base64,${Buffer.from(source).toString('base64')}`;
const browser = await chromium.launch({ headless: true });

try {
  for (const size of sizes) {
    const page = await browser.newPage({
      deviceScaleFactor: 1,
      viewport: { height: size, width: size },
    });
    await page.setContent(
      `<style>*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden}img{display:block;width:100%;height:100%}</style><img alt="" src="${sourceUrl}">`,
    );
    const buffer = await page.screenshot({
      animations: 'disabled',
      fullPage: false,
      type: 'png',
    });
    await writeFile(
      resolve(projectDirectory, `public/learnx-icon-${size}.png`),
      buffer,
    );
    await page.close();
  }
} finally {
  await browser.close();
}

console.log('Exported Atlas icons from public/learnx-icon.svg.');
