// Renders mockups side by side into a PNG for a quick look: node shot.cjs <dir> <out.png> <file>...
// The PNG is for the chat only; images stay out of the repository.
const path = require('node:path');
const { chromium } = require(require.resolve('@playwright/test', { paths: [path.resolve(__dirname, '../../../../apps/web')] }));
const fs = require('fs');
const dir = process.argv[2], out = process.argv[3], names = process.argv.slice(4);
(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const clipH = parseInt(process.env.CLIP_H || '800'); const page = await browser.newPage({ deviceScaleFactor: parseFloat(process.env.SCALE || '1'), viewport: { width: 360 * names.length + 20 * (names.length - 1), height: 800 } });
  let html = '<html><body style="margin:0;display:flex;gap:20px;background:#999">';
  for (const n of names) {
    let s = fs.readFileSync(path.join(dir, n), 'utf8');
    s = s.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<link[^>]*fonts.googleapis[^>]*>/g, '');
    const body = s.split('<body>')[1].split('</body>')[0];
    html += `<div style="width:360px;height:800px;overflow:hidden;flex-shrink:0">${body}</div>`;
  }
  html += '</body></html>';
  await page.setContent(html);
  await page.screenshot({ path: out, clip: { x: 0, y: 0, width: 360 * names.length + 20 * (names.length - 1), height: clipH } });
  await browser.close();
})();
