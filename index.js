/**
 * Format Studio - host half.
 *
 * Registers one agent tool, `format_document`, that turns pasted plain text
 * into a real .docx laid out for a chosen Chinese document format (academic
 * paper, government document, work report, news release, business proposal,
 * letter, resume) and writes it next to the session working directory.
 *
 * The layout engine is pure JavaScript shared with the browser panel, so the
 * agent path and the one-click panel path always produce the same document.
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { formatDocument, suggestedFileName, PRESET_IDS, PRESETS } from './src/engine.mjs';
import { toJsonSchema, toParameterSchema } from './src/toolspec.mjs';

/** Cordis plugin name used by loader diagnostics. */
export const name = 'format-studio';

/** Optional services; the tool half only needs the tool registry. */
export const inject = ['tools'];

const PRESET_LINES = PRESETS.map((p) => `  - ${p.id}（${p.name}）：${p.summary}`).join('\n');

function p(value) {
  return { type: 'string', required: false, description: `${value}` };
}

const PARAMETERS = {
  text: {
    type: 'string',
    required: true,
    description:
      '需要整理格式的全文原文。直接粘贴用户提供的全部文字，不要改写、删减或摘要；标题、正文、落款都放在这里。',
  },
  preset: {
    type: 'string',
    required: false,
    enum: PRESET_IDS,
    description:
      `目标格式 id。${PRESET_LINES}  - auto（默认）：按 scenario 关键词自动匹配。`,
  },
  scenario: {
    type: 'string',
    required: false,
    description:
      '应用场景或格式要求的中文描述，例如「写给市政府的请示」「课程结课论文」「企业年度工作总结」。当 preset 为 auto 时用它匹配格式；也可以补充个别要求，如「标题用二号黑体」。',
  },
  title: p('文档标题（可选）。省略时使用正文中识别到的标题。'),
  output_path: p('输出 .docx 的路径（可选）。相对路径相对当前会话工作目录；省略时自动命名并写入工作目录。'),
};

const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    path: { type: 'string', required: true, description: '生成文件的绝对路径' },
    preset: { type: 'string', required: true, description: '实际使用的格式 id' },
    presetName: { type: 'string', required: true, description: '格式的中文名称' },
    matched: { type: 'boolean', required: true, description: '是否为自动匹配（而非显式指定）' },
    reason: { type: 'string', required: false, description: '自动匹配的依据' },
    pages: { type: 'integer', required: true, description: '估算页数' },
    paragraphs: { type: 'integer', required: true, description: '段落数' },
    headings: { type: 'integer', required: true, description: '识别到的标题数' },
    characters: { type: 'integer', required: true, description: '原文字符数' },
    title: { type: 'string', required: false, description: '文档标题' },
    structure: {
      type: 'array',
      required: false,
      description: '识别出的文档结构（前若干块）',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          kind: { type: 'string', required: true },
          label: { type: 'string', required: true },
          text: { type: 'string', required: true },
        },
      },
    },
  },
};

const STRUCTURE_LABELS = {
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

function structureOf(blocks) {
  return blocks
    .filter((block) => block.kind !== 'pagebreak')
    .slice(0, 40)
    .map((block) => ({
      kind: block.kind,
      label: STRUCTURE_LABELS[block.kind] || block.kind,
      text: String(block.text || '').slice(0, 80),
    }));
}

function summarize(value) {
  const structure = Array.isArray(value.structure) ? value.structure : [];
  const counts = new Map();
  for (const item of structure) counts.set(item.label, (counts.get(item.label) || 0) + 1);
  const parts = [...counts.entries()].map(([label, n]) => `${label}×${n}`);
  return [
    `已按「${value.presetName}」生成 Word 文档：${value.path}`,
    `标题：${value.title || '（未识别）'}｜段落 ${value.paragraphs} 个｜字符 ${value.characters} 个｜约 ${value.pages} 页`,
    `结构识别：${parts.join('、') || '（纯正文）'}`,
    value.matched ? `格式匹配：${value.reason || '自动匹配'}` : '格式匹配：显式指定',
    '提示：如需调整个别样式（字体、行距、页边距），修改后重新调用即可。',
  ].join('\n');
}

async function resolveWorkdir(ctx, exec) {
  try {
    const wd = ctx.get('workingDirectory');
    if (wd && exec && exec.agent) {
      const dir = await wd.ensure(exec.agent);
      if (dir) return dir;
    }
  } catch {
    // fall through to the process directory
  }
  return process.cwd();
}

function applyTool(ctx) {
  const definition = {
    name: 'format_document',
    description:
      '把一段中文全文整理成标准版式的 Word 文档（.docx）。支持：学术论文、学位论文、党政机关公文（GB/T 9704-2012）、工作总结/汇报、新闻稿、商业报告/方案、申请信函、简历。' +
      '它会识别标题、摘要、关键词、各级标题（一、/（一）/1./（1）/第X章）、主送机关、落款与成文日期，并按目标格式设置页面尺寸、页边距、字体字号、行距、缩进、对齐、页码与落款位置，把生成的 .docx 写入当前会话工作目录。' +
      '用户说「把这段文字改成公文格式」「整理成论文格式」「按总结格式排版」时使用本工具；用户没有明确说格式时，用 scenario 描述其场景并传 preset="auto"。',
    parameters: PARAMETERS,
    output: {
      schema: OUTPUT_SCHEMA,
      render: (_args, value) => [{ type: 'text', text: summarize(value || {}) }],
      presentationMeta: (_args, value) => ({ path: value && value.path }),
    },
    isConcurrencySafe: () => false,
    async execute(args, exec) {
      const text = typeof args.text === 'string' ? args.text : '';
      if (text.trim().length === 0) throw new Error('text 不能为空：请传入需要整理格式的完整原文');
      const result = formatDocument({
        text,
        preset: args.preset,
        scenario: args.scenario,
        title: args.title,
      });
      const workdir = await resolveWorkdir(ctx, exec);
      const target = args.output_path
        ? (isAbsolute(args.output_path) ? args.output_path : resolve(workdir, args.output_path))
        : join(workdir, suggestedFileName(result.presetName, result.layout.title));
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, result.bytes);
      return {
        path: target,
        preset: result.presetId,
        presetName: result.presetName,
        matched: result.matched,
        reason: result.reason,
        pages: result.pages,
        paragraphs: result.stats.paragraphs,
        headings: result.stats.headings,
        characters: result.stats.characters,
        title: result.layout.title,
        structure: structureOf(result.blocks),
      };
    },
    presentCall(args) {
      return {
        card: 'generic',
        title: `排版：${args.title || args.scenario || args.preset || '自动匹配格式'}`,
        kind: 'edit',
        rawInput: { preset: args.preset, scenario: args.scenario, characters: String(args.text || '').length },
      };
    },
  };

  const registered = {
    ...definition,
    parameters: toParameterSchema(PARAMETERS),
    output: {
      ...definition.output,
      schema: toJsonSchema(OUTPUT_SCHEMA),
    },
  };
  return ctx.tools.register(registered);
}

/** Plugin entry point. */
export function apply(ctx) {
  if (!ctx.get('tools')) return;
  ctx.effect(() => applyTool(ctx), 'format-studio: format_document tool');
}
