/**
 * Build the browser bundle (client.js) from the shared engine sources.
 *
 * The Web plugin loader loads `client.js` as a classic script that registers a
 * lazy factory; it has no module graph of its own, so the engine modules are
 * inlined here with their `export` keywords stripped. The same source files are
 * imported normally by the host half, so both halves stay in sync.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

const SOURCES = [
  'src/presets.mjs',
  'src/parser.mjs',
  'src/layout.mjs',
  'src/docx.mjs',
  'src/engine.mjs',
  'src/ui.mjs',
];

function stripModuleSyntax(source) {
  return source
    .split('\n')
    .filter((line) => !/^\s*import\s/.test(line) && !/^\s*export\s*\{/.test(line))
    .map((line) => line.replace(/^export\s+/, ''))
    .join('\n');
}

const parts = SOURCES.map((relative) => {
  const source = readFileSync(join(root, relative), 'utf8');
  return `    // ---- ${relative} ----\n${stripModuleSyntax(source)
    .split('\n')
    .map((line) => (line.length > 0 ? `    ${line}` : line))
    .join('\n')}`;
});

const bundle = [
  `window.__ModuleLoader__.load({`,
  `  id: ${JSON.stringify(pkg.name)},`,
  `  factory(require) {`,
  `    const React = require('react');`,
  ...parts,
  `    return createClientApp(React);`,
  `  },`,
  `});`,
  '',
].join('\n');

writeFileSync(join(root, 'client.js'), bundle, 'utf8');
process.stdout.write(`client.js written: ${bundle.length} bytes from ${SOURCES.length} modules\n`);
