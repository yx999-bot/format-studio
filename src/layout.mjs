/**
 * Layout for Format Studio: maps parsed blocks onto a preset's styles.
 *
 * Output is a renderer-neutral document model consumed by docx.mjs (and by the
 * in-browser preview). One paragraph = { kind, style, runs }.
 */

import { mergeStyle } from './presets.mjs';
import { parseDocument } from './parser.mjs';

const HEADING_KINDS = ['h1', 'h2', 'h3', 'h4'];
const BODY_ONLY = new Set(['body', 'list', 'quote', 'ref', 'note']);

function styleFor(preset, kind) {
  return preset.styles[kind] || preset.styles.body;
}

function runsFor(block, style) {
  if (block.label) {
    return [
      { text: block.label, bold: true },
      { text: block.text, bold: false },
    ];
  }
  return [{ text: block.text, bold: style.font.bold }];
}

/** Assemble the renderer-neutral model from parsed blocks. */
export function layoutBlocks(blocks, stats, preset, options = {}) {
  const paragraphs = [];
  const hasTitle = blocks.some((b) => b.kind === 'title');

  for (let i = 0; i < blocks.length; i += 1) {
    const block = blocks[i];

    if (block.kind === 'pagebreak') {
      paragraphs.push({
        kind: 'pagebreak',
        style: { ...styleFor(preset, 'body'), pageBreakBefore: true },
        runs: [],
      });
      continue;
    }

    const style = mergeStyle(styleFor(preset, 'body'), styleFor(preset, block.kind));

    // Thesis-style chapter headings start on a new page; the reference list does too.
    if (preset.id === 'thesis' && block.kind === 'h1' && /^第\s*.{1,3}\s*[章篇]/.test(block.text)) {
      style.pageBreakBefore = true;
    }
    if (preset.id === 'thesis' && block.kind === 'refHeading') {
      style.pageBreakBefore = true;
    }
    // A leading heading must not carry leading space.
    if (HEADING_KINDS.includes(block.kind) && i === 0) style.before = 0;

    paragraphs.push({ kind: block.kind, style, runs: runsFor(block, style) });
  }

  // Title fallback: if the preset expects a title and none was detected but the
  // first block is a short unpunctuated line, promote it.
  if (!hasTitle && blocks.length > 0 && BODY_ONLY.has(blocks[0].kind)) {
    const first = blocks[0];
    if (first.text.length <= 60 && !/[。！？；]/.test(first.text)) {
      const style = mergeStyle(styleFor(preset, 'body'), styleFor(preset, 'title'));
      paragraphs[0] = {
        kind: 'title',
        style,
        runs: [{ text: first.text, bold: style.font.bold }],
      };
    }
  }

  const titleBlock = blocks.find((b) => b.kind === 'title');
  const title = String(options.title || (titleBlock ? titleBlock.text : '') || '').trim();

  return {
    preset: { id: preset.id, name: preset.name, summary: preset.summary },
    page: preset.page,
    defaultFont: preset.styles.body.font,
    footer: preset.footer,
    paragraphs,
    title,
    stats,
  };
}

/** Parse text with a preset and lay it out. */
export function formatText(text, preset, options = {}) {
  const { blocks, stats } = parseDocument(text, { family: preset.family });
  return { blocks, stats, layout: layoutBlocks(blocks, stats, preset, options) };
}

/**
 * Human-readable outline of the detected structure, used by the preview panel
 * and by the agent tool's text summary.
 */
export function describeBlocks(blocks) {
  const names = {
    title: '标题',
    subtitle: '副标题',
    author: '作者',
    affiliation: '单位',
    docnum: '发文字号',
    addressee: '主送机关',
    abstract: '摘要',
    keywords: '关键词',
    h1: '一级标题',
    h2: '二级标题',
    h3: '三级标题',
    h4: '四级标题',
    body: '正文',
    list: '条目',
    quote: '引文',
    refHeading: '参考文献标题',
    ref: '参考文献条目',
    signature: '落款',
    date: '成文日期',
    note: '注释',
    pagebreak: '分页',
  };
  return blocks.map((b) => ({ kind: b.kind, label: names[b.kind] || b.kind, text: b.text }));
}
