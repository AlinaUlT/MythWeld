import { readFileSync, writeFileSync } from 'node:fs';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { type PdfPage, rulesOfPdf } from './srd-pdf.ts';

// CONT-73: `node srd-pdf-cli.ts <pdf> <out.json>` reads the SRD 5.2.1 PDF and writes its rules, in
// the shape of 5e-database's `5e-SRD-Rules.json`. The fetch runs it (`fetch-source.ts`).

const [pdf, out] = process.argv.slice(2);
if (pdf === undefined || out === undefined)
  throw new Error('usage: srd-pdf-cli.ts <pdf> <out.json>');
const document = await getDocument({ data: new Uint8Array(readFileSync(pdf)), verbosity: 0 })
  .promise;
const pages: PdfPage[] = [];
for (let page = 1; page <= document.numPages; page += 1) {
  const content = await (await document.getPage(page)).getTextContent();
  pages.push({
    page,
    items: content.items.flatMap((item) =>
      'str' in item
        ? [
            {
              str: item.str,
              x: item.transform[4] ?? 0,
              y: item.transform[5] ?? 0,
              width: item.width,
              height: item.height,
            },
          ]
        : [],
    ),
  });
}
writeFileSync(out, `${JSON.stringify(rulesOfPdf(pages), null, 2)}\n`);
