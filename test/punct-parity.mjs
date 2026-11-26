/**
 * 标点规范化的双实现一致性检查（JS 侧）。
 *
 *   node test/punct-parity.mjs            # 生成 test/out-messy/js-gov.docx
 */

import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatDocument } from '../src/engine.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const outDir = join(root, 'test', 'out-messy');
mkdirSync(outDir, { recursive: true });

const text = readFileSync(join(root, 'test', 'cli-sample-messy.txt'), 'utf8');

for (const [preset, enabled] of [['gov', true], ['gov', false]]) {
  const result = formatDocument({ text, preset, options: { punctuation: enabled } });
  const name = enabled ? 'js-gov.docx' : 'js-gov-raw.docx';
  writeFileSync(join(outDir, name), result.bytes);
  console.log(`${name}: preset=${result.presetName} changes=${result.punctuationChanges} paragraphs=${result.stats.paragraphs}`);
}

const normalized = formatDocument({ text, preset: 'gov' });
console.log('--- 规范化后的前 6 段：');
for (const block of normalized.blocks.slice(0, 6)) {
  console.log('  [' + block.kind + '] ' + block.text);
}
