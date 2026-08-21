import { chromium } from 'playwright';
import path from 'node:path';

const docs = path.resolve('docs');

async function continuousPdf(page, htmlFile, outFile, widthPx) {
  const filePath = 'file:///' + path.join(docs, htmlFile).replace(/\\/g, '/');
  await page.setViewportSize({ width: widthPx, height: 800 });
  await page.goto(filePath, { waitUntil: 'load' });
  await page.waitForTimeout(300); // let webfonts settle
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.pdf({
    path: path.join(docs, outFile),
    width: `${widthPx}px`,
    height: `${height}px`,
    printBackground: true,
    pageRanges: '1',
    margin: { top: '0', bottom: '0', left: '0', right: '0' },
  });
  console.log('wrote', outFile, `${widthPx}x${height}`);
}

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

// Team handbook — phone-width continuous scroll (how the team will actually read it)
await continuousPdf(page, 'team-handbook.html', 'team-handbook-mobile.pdf', 420);
// Team handbook — a paginated desktop/print version too
await paginatedPdf(page, 'team-handbook.html', 'team-handbook-desktop.pdf');
// Build reference — paginated, desktop/print oriented (this one's for the owner, not the team)
await paginatedPdf(page, 'build-reference.html', 'build-reference.pdf');

await browser.close();
