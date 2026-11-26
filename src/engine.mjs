/**
 * Format Studio - engine facade.
 * Shared by the host half (agent tool) and the browser half (panel).
 */

import { resolvePreset, getPreset, PRESETS, PRESET_IDS } from './presets.mjs';
import { formatText, describeBlocks } from './layout.mjs';
import { buildDocx, estimatePages } from './docx.mjs';
import { parseDocument } from './parser.mjs';
import { normalizePunctuation } from './punctuation.mjs';

/** 默认选项：标点规范化开、自动标签开、页码跟随格式。 */
export function normalizeOptions(options) {
  const source = options && typeof options === 'object' ? options : {};
  return {
    punctuation: source.punctuation !== false,
    labels: source.labels !== false,
    pageNumber: source.pageNumber || 'preset',
    quotes: source.quotes !== false,
  };
}

/**
 * Format a document: parse, lay out and render .docx bytes.
 * @param {{ text: string, preset?: string, scenario?: string, title?: string, options?: object }} input
 */
export function formatDocument(input) {
  const options = normalizeOptions(input.options);
  const raw = String(input.text || '');
  if (raw.trim().length === 0) throw new Error('正文为空：请先粘贴需要整理格式的文字');

  let text = raw;
  let punctuationChanges = 0;
  if (options.punctuation) {
    const normalized = normalizePunctuation(raw, { quotes: options.quotes });
    text = normalized.text;
    punctuationChanges = normalized.changes;
  }

  const resolved = resolvePreset(input.preset, input.scenario);
  const preset = resolved.preset;
  const { blocks, stats, layout } = formatText(text, preset, {
    title: input.title,
    labels: options.labels,
    pageNumber: options.pageNumber,
  });
  const bytes = buildDocx(layout);
  return {
    presetId: preset.id,
    presetName: preset.name,
    presetSummary: preset.summary,
    matched: resolved.matched,
    reason: resolved.reason,
    blocks,
    stats,
    layout,
    bytes,
    pages: estimatePages(layout),
    punctuationChanges,
    finalText: text,
    options,
  };
}

/** Preview-only pass (no bytes), used for the live panel readout. */
export function previewDocument(input) {
  const options = normalizeOptions(input.options);
  const raw = String(input.text || '');
  let text = raw;
  let punctuationChanges = 0;
  if (options.punctuation && raw.length > 0) {
    const normalized = normalizePunctuation(raw, { quotes: options.quotes });
    text = normalized.text;
    punctuationChanges = normalized.changes;
  }
  const resolved = resolvePreset(input.preset, input.scenario);
  const { blocks, stats } = parseDocument(text, { family: resolved.preset.family });
  return {
    presetId: resolved.preset.id,
    presetName: resolved.preset.name,
    presetSummary: resolved.preset.summary,
    matched: resolved.matched,
    reason: resolved.reason,
    blocks,
    stats,
    outline: describeBlocks(blocks),
    punctuationChanges,
    finalText: text,
    options,
  };
}

/** Suggested file name for a formatted document. */
export function suggestedFileName(presetName, title) {
  const stamp = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const date = `${stamp.getFullYear()}${pad(stamp.getMonth() + 1)}${pad(stamp.getDate())}-${pad(stamp.getHours())}${pad(stamp.getMinutes())}`;
  const safe = String(title || '')
    .replace(/[\\/:*?"<>|\r\n\t]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40);
  return `${safe || `排版-${presetName}`}_${date}.docx`;
}

export { PRESETS, PRESET_IDS, getPreset, resolvePreset, describeBlocks, normalizePunctuation };
