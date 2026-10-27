/**
 * Format Studio - engine facade.
 * Shared by the host half (agent tool) and the browser half (panel).
 */

import { resolvePreset, getPreset, PRESETS, PRESET_IDS } from './presets.mjs';
import { formatText, describeBlocks } from './layout.mjs';
import { buildDocx, estimatePages } from './docx.mjs';
import { parseDocument } from './parser.mjs';

/**
 * Format a document: parse, lay out and render .docx bytes.
 * @param {{ text: string, preset?: string, scenario?: string, title?: string }} input
 */
export function formatDocument(input) {
  const raw = String(input.text || '');
  if (raw.trim().length === 0) throw new Error('正文为空：请先粘贴需要整理格式的文字');
  const resolved = resolvePreset(input.preset, input.scenario);
  const preset = resolved.preset;
  const { blocks, stats, layout } = formatText(raw, preset, { title: input.title });
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
  };
}

/** Preview-only pass (no bytes), used for the live panel readout. */
export function previewDocument(input) {
  const resolved = resolvePreset(input.preset, input.scenario);
  const { blocks, stats } = parseDocument(String(input.text || ''), { family: resolved.preset.family });
  return {
    presetId: resolved.preset.id,
    presetName: resolved.preset.name,
    presetSummary: resolved.preset.summary,
    matched: resolved.matched,
    reason: resolved.reason,
    blocks,
    stats,
    outline: describeBlocks(blocks),
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

export { PRESETS, PRESET_IDS, getPreset, resolvePreset, describeBlocks };
