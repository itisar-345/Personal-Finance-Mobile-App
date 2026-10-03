/**
 * Renders the Privacy Policy and Terms of Service from lib/legal.ts into standalone HTML pages
 * under docs/, so GitHub Pages can serve a public URL for the Play Store listing (and App Store,
 * if this ever ships there) that can never drift out of sync with what the app shows in-app —
 * there is exactly one place these documents are written: lib/legal.ts.
 *
 * Run after editing lib/legal.ts: npm run build:legal
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BUSINESS, LEGAL_DOCS, type LegalDocId } from '../lib/legal';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const OUT_DIR = join(ROOT, 'docs');

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function pageHtml(id: LegalDocId): string {
  const doc = LEGAL_DOCS[id];
  const sections = doc.sections
    .map((section) => {
      const heading = section.heading ? `<h2>${escapeHtml(section.heading)}</h2>` : '';
      const body = section.body.map((p) => `<p>${escapeHtml(p)}</p>`).join('\n      ');
      return `${heading}\n      ${body}`;
    })
    .join('\n\n    ');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(doc.title)} — ${escapeHtml(BUSINESS.appName)}</title>
<style>
  :root { color-scheme: light dark; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    max-width: 720px;
    margin: 0 auto;
    padding: 40px 20px 80px;
    line-height: 1.6;
    color: #1a1a2e;
    background: #fff;
  }
  @media (prefers-color-scheme: dark) {
    body { color: #e4e4f0; background: #14141f; }
    a { color: #a5b4fc; }
  }
  h1 { font-size: 1.6rem; margin-bottom: 4px; }
  h2 { font-size: 1.1rem; margin-top: 2em; }
  .updated { color: #777; font-size: 0.9rem; margin-bottom: 2em; }
  p { margin: 0.6em 0; }
  nav { margin-bottom: 2em; font-size: 0.9rem; }
  nav a { margin-right: 16px; }
</style>
</head>
<body>
  <nav><a href="./privacy-policy.html">Privacy Policy</a><a href="./terms-of-service.html">Terms of Service</a></nav>
  <h1>${escapeHtml(doc.title)}</h1>
  ${doc.updated ? `<p class="updated">Last updated: ${escapeHtml(doc.updated)}</p>` : ''}
  ${sections}
</body>
</html>
`;
}

mkdirSync(OUT_DIR, { recursive: true });

const files: Record<string, string> = {
  'privacy-policy.html': pageHtml('privacy'),
  'terms-of-service.html': pageHtml('terms'),
};
for (const [name, html] of Object.entries(files)) {
  writeFileSync(join(OUT_DIR, name), html, 'utf8');
  console.log('wrote docs/' + name);
}
