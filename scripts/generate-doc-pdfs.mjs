import { chromium } from 'playwright';
import path from 'node:path';

const docs = path.resolve('docs');

async function paginatedPdf(page, htmlFile, outFile) {
  const filePath = 'file:///' + path.join(docs, htmlFile).replace(/\\/g, '/');
  await page.setViewportSize({ width: 900, height: 1100 });
  await page.goto(filePath, { waitUntil: 'load' });
  await page.waitForTimeout(300);
  await page.pdf({
    path: path.join(docs, outFile),
    format: 'Letter',
    printBackground: true,
    margin: { top: '0.4in', bottom: '0.4in', left: '0.4in', right: '0.4in' },
  });
  console.log('wrote', outFile);
}

const browser = await chromium.launch();
const page = await browser.newPage();

// One PDF per doc — reads fine on phone or desktop, no separate variants to keep in sync.
await paginatedPdf(page, 'team-handbook.html', 'team-handbook.pdf');
await paginatedPdf(page, 'build-reference.html', 'build-reference.pdf');

await browser.close();
