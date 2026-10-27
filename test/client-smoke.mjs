/**
 * Browser-half smoke test.
 *
 * Loads the built client.js with a minimal React/DOM stub, mounts the panel in
 * both collapsed and expanded states, then drives the "generate" and "copy"
 * actions to prove the bundled engine produces a .docx from a click.
 *
 *   node test/client-smoke.mjs
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

let mounted = null;
const errors = [];

/* -------------------------------- stubs --------------------------------- */

const stored = new Map();
globalThis.window = {
  __ModuleLoader__: {
    load(definition) {
      mounted = definition;
    },
  },
  localStorage: {
    getItem: (key) => (stored.has(key) ? stored.get(key) : null),
    setItem: (key, value) => stored.set(key, String(value)),
    removeItem: (key) => stored.delete(key),
  },
  setTimeout: (fn) => {
    void fn;
    return 0;
  },
};

const downloads = [];
globalThis.URL = {
  createObjectURL: () => 'blob:stub',
  revokeObjectURL: () => {},
};
globalThis.Blob = class Blob {
  constructor(parts, options) {
    this.parts = parts;
    this.type = options && options.type;
    this.size = parts.reduce((sum, part) => sum + (part && part.length ? part.length : 0), 0);
  }
};
Object.defineProperty(globalThis, 'navigator', {
  value: { clipboard: { writeText: async () => {} } },
  configurable: true,
});
Object.defineProperty(globalThis, 'document', {
  value: {
    createElement: () => ({
      href: '',
      download: '',
      rel: '',
      click() {
        downloads.push({ name: this.download, type: this.type });
      },
      remove() {},
    }),
    body: { appendChild() {} },
  },
  configurable: true,
});

const hookOverrides = [];
function hookValue(index, initial) {
  return Object.prototype.hasOwnProperty.call(hookOverrides, index) ? hookOverrides[index] : initial;
}
let statuses = [];
let hookCursor = 0;

function resetHooks(values) {
  hookCursor = 0;
  hookOverrides.length = 0;
  for (const [index, value] of Object.entries(values || {})) hookOverrides[Number(index)] = value;
}

const React = {
  createElement(type, props, ...children) {
    return { type, props: props || {}, children: children.flat(Infinity) };
  },
  useState(initial) {
    const index = hookCursor;
    hookCursor += 1;
    const value = hookValue(index, typeof initial === 'function' ? initial() : initial);
    return [value, (next) => { if (index === 5) statuses.push(next); }];
  },
  useMemo(factory) {
    return factory();
  },
  useCallback(factory) {
    return factory;
  },
};

function textOf(node) {
  if (node === null || node === undefined || node === false) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (node.children) return node.children.map(textOf).join('');
  return '';
}

function findButtons(node, out = []) {
  if (!node || typeof node !== 'object') return out;
  if (Array.isArray(node)) {
    for (const child of node) findButtons(child, out);
    return out;
  }
  if (node.type === 'button') out.push(node);
  if (node.children) for (const child of node.children) findButtons(child, out);
  return out;
}

/* --------------------------------- load --------------------------------- */

const code = readFileSync(join(root, 'client.js'), 'utf8');
const moduleUrl = `data:text/javascript;base64,${Buffer.from(code, 'utf8').toString('base64')}`;
await import(moduleUrl);

if (!mounted) {
  console.error('client.js did not call window.__ModuleLoader__.load');
  process.exit(1);
}
if (mounted.id !== '@local/format-studio') {
  console.error(`unexpected module id: ${mounted.id}`);
  process.exit(1);
}

const app = mounted.factory((name) => {
  if (name !== 'react') throw new Error(`unexpected require: ${name}`);
  return React;
});
if (!app || !Array.isArray(app.inject) || app.inject[0] !== 'slots') {
  console.error('factory did not return a slots plugin');
  process.exit(1);
}

const registrations = [];
const fakeCtx = {
  slots: {
    inject(key, callback) {
      const dispose = callback();
      return dispose;
    },
    register(options, component) {
      registrations.push({ options, component });
      return () => {};
    },
  },
};

app.apply(fakeCtx);

if (registrations.length !== 1) {
  console.error(`expected 1 slot registration, got ${registrations.length}`);
  process.exit(1);
}
const registration = registrations[0].options;
const Component = registrations[0].component;
if (registration.name !== 'conversation.input.dock') {
  console.error(`unexpected slot: ${registration.name}`);
  process.exit(1);
}

/* ------------------------------ collapsed ------------------------------- */

resetHooks({ 0: false, 5: null });
const collapsed = Component({ inputActions: null });
const collapsedText = textOf(collapsed);
if (!collapsedText.includes('排版工作台')) {
  errors.push('collapsed bar is missing the 排版工作台 title');
}
if (!collapsedText.includes('粘贴全文')) {
  errors.push('collapsed bar is missing its hint');
}
const collapsedCss = collapsed.children.find((child) => child && child.type === 'style');
if (!collapsedCss || !collapsedCss.props.dangerouslySetInnerHTML.__html.includes('--dsw-alias-brand-primary')) {
  errors.push('component styles were not rendered');
}

/* ------------------------------- expanded ------------------------------- */

const sample = [
  '关于申请专项资金支持的请示',
  '',
  '市财政局：',
  '',
  '为推动我市安全生产信息化建设，现申请专项资金支持。',
  '',
  '一、项目背景',
  '',
  '现有监管平台建设年代较早，已不能满足实际需要。',
  '',
  'XX市应急管理局',
  '',
  '2025年12月20日',
].join('\n');
resetHooks({ 0: true, 1: 'gov', 2: '写给市政府的请示', 4: sample, 5: null });

const expanded = Component({ inputActions: null });
const expandedText = textOf(expanded);
for (const expected of ['目标格式', '学术论文', '党政机关公文', '生成 Word 文档', '复制排版文本', '交给 AI 整理']) {
  if (!expandedText.includes(expected)) errors.push(`expanded panel is missing "${expected}"`);
}

/* --------------------------- generate a document ------------------------ */

const buttons = findButtons(expanded);
const generate = buttons.find((button) => textOf(button).includes('生成 Word 文档'));
if (!generate) {
  errors.push('generate button not found');
} else {
  statuses = [];
  await generate.props.onClick();
  const message = statuses.length > 0 ? String(statuses[statuses.length - 1].message) : '';
  if (!message.includes('已生成')) errors.push(`generate did not report success: ${message || '(no status)'}`);
  if (!message.includes('党政机关公文')) errors.push('generate did not use the selected preset');
  if (downloads.length === 0) errors.push('generate did not trigger a download');
  else if (!downloads[downloads.length - 1].name.endsWith('.docx')) errors.push('download file name is not .docx');
  console.log(`generate status: ${message.split('\n')[0]}`);
  console.log(`download: ${downloads[downloads.length - 1] && downloads[downloads.length - 1].name}`);
}

/* ------------------------------ copy to text ---------------------------- */

const copy = buttons.find((button) => textOf(button).includes('复制排版文本'));
if (!copy) {
  errors.push('copy button not found');
} else {
  statuses = [];
  await copy.props.onClick();
  const message = statuses.length > 0 ? String(statuses[statuses.length - 1].message) : '';
  if (!message.includes('已复制')) errors.push(`copy did not report success: ${message || '(no status)'}`);
}

/* ------------------------- hand-off to the agent ------------------------ */

const handoff = buttons.find((button) => textOf(button).includes('交给 AI 整理'));
if (!handoff) {
  errors.push('hand-off button not found');
} else {
  const calls = [];
  const inputActions = { setText: (value) => calls.push(value) };
  resetHooks({ 0: true, 1: 'auto', 2: '学位论文', 4: sample, 5: null });
  const panel = Component({ inputActions });
  const handoffButton = findButtons(panel).find((button) => textOf(button).includes('交给 AI 整理'));
  statuses = [];
  await handoffButton.props.onClick();
  if (calls.length !== 1) errors.push('hand-off did not fill the composer');
  else if (!calls[0].includes('format_document')) errors.push('hand-off prompt does not mention the tool');
  const message = statuses.length > 0 ? String(statuses[statuses.length - 1].message) : '';
  if (!message.includes('已把排版指令填入输入框')) errors.push(`hand-off did not report success: ${message}`);
}

/* -------------------------------- result -------------------------------- */

if (errors.length > 0) {
  console.error(`\nFAILED (${errors.length}):`);
  for (const error of errors) console.error(` - ${error}`);
  process.exit(1);
}
console.log('\nclient.js smoke test passed');
