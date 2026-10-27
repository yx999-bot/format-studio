/**
 * Host-half smoke test.
 *
 * Loads index.js with a stub Cordis context, then exercises the registered
 * `format_document` tool end to end: it must produce a real .docx on disk with
 * the documented output value.
 *
 *   node test/host-smoke.mjs
 */

import { existsSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const outputDir = join(root, 'test', 'out');
const target = join(outputDir, 'host-smoke.docx');

const plugin = await import('../index.js');

const registrations = [];
const ctx = {
  get(name) {
    if (name === 'tools') return tools;
    if (name === 'workingDirectory') return undefined;
    return undefined;
  },
  effect(callback, label) {
    void label;
    return callback();
  },
  tools: {
    register(definition) {
      registrations.push(definition);
      return () => {};
    },
  },
};
const tools = ctx.tools;

if (typeof plugin.apply !== 'function') {
  console.error('index.js does not export apply()');
  process.exit(1);
}

plugin.apply(ctx);

if (registrations.length !== 1) {
  console.error(`expected one tool registration, got ${registrations.length}`);
  process.exit(1);
}

const tool = registrations[0];
const problems = [];
if (tool.name !== 'format_document') problems.push(`tool name is ${tool.name}`);
if (typeof tool.execute !== 'function') problems.push('tool has no execute');
if (!tool.output || typeof tool.output.render !== 'function') problems.push('tool output.render missing');
if (!tool.parameters || tool.parameters.type !== 'object') problems.push('tool parameters are not a JSON Schema object');
if (!Array.isArray(tool.parameters.required) || !tool.parameters.required.includes('text')) {
  problems.push('tool parameters do not require text');
}
if (!tool.parameters.properties || tool.parameters.properties.text.type !== 'string') {
  problems.push('tool parameters.properties.text is not a string schema');
}
const enumValues = (tool.parameters.properties.preset || {}).enum || [];
if (!enumValues.includes('gov') || !enumValues.includes('auto')) problems.push('preset enum is incomplete');
const outputRequired = (tool.output && tool.output.schema && tool.output.schema.required) || [];
if (!outputRequired.includes('path')) problems.push('output schema does not mark path as required');
if (!tool.output.schema.properties || tool.output.schema.properties.path.type !== 'string') {
  problems.push('output schema path is not a string');
}
if (JSON.stringify(tool.output.schema).includes('"required":true')) {
  problems.push('output schema still contains compact required:true nodes');
}

const text = [
  '关于申请专项资金支持的请示',
  '',
  '市财政局：',
  '',
  '为推动我市安全生产信息化建设，现申请专项资金支持，用于升级监管平台。',
  '',
  '一、项目背景',
  '',
  '现有平台建设年代较早，已不能满足实际需要。',
  '',
  '二、资金用途',
  '',
  '主要用于软件升级、设备采购和人员培训三个方面。',
  '',
  'XX市应急管理局',
  '',
  '2025年12月20日',
].join('\n');

let value = null;
try {
  value = await tool.execute(
    { text, preset: 'auto', scenario: '写给市政府的请示', output_path: target },
    { agent: null, signal: new AbortController().signal },
  );
} catch (error) {
  problems.push(`execute threw: ${(error && error.stack) || error}`);
}

if (value) {
  if (!existsSync(value.path)) problems.push(`output file missing: ${value.path}`);
  else {
    const bytes = readFileSync(value.path);
    if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) problems.push('output is not a ZIP-based .docx');
    if (bytes.length < 4000) problems.push(`output is suspiciously small (${bytes.length} bytes)`);
  }
  if (value.preset !== 'gov') problems.push(`auto scenario matched ${value.preset}, expected gov`);
  if (!value.title) problems.push('output is missing the document title');
  if (!Array.isArray(value.structure) || value.structure.length === 0) problems.push('output is missing the structure list');
  const rendered = tool.output.render({}, value);
  if (!Array.isArray(rendered) || rendered[0].type !== 'text' || !rendered[0].text.includes('.docx')) {
    problems.push('output.render did not produce a text block');
  }
  console.log(`generated: ${value.path} (${value.presetName}, ${value.pages} pages)`);
  console.log(rendered[0].text.split('\n')[0]);
}

rmSync(target, { force: true });

if (problems.length > 0) {
  console.error(`\nFAILED (${problems.length}):`);
  for (const problem of problems) console.error(` - ${problem}`);
  process.exit(1);
}
console.log('\nindex.js smoke test passed');
