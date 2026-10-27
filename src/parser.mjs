/**
 * Text parser for Format Studio.
 *
 * Turns arbitrary pasted plain text into a flat list of semantic blocks
 * ({ kind, text, level }). The parser never rewrites wording; it only decides
 * what each paragraph IS, so the layout layer can attach the right style.
 *
 * Supported explicit markup (optional, for ambiguous documents):
 *   # / ## / ### / ####        heading levels 1-4
 *   > text                     quotation paragraph
 *   [摘要] / 摘要：             abstract
 *   [关键词] / 关键词：         keywords
 *   [参考文献]                  reference heading
 *   ---                        page break
 */

const CJK_RE = /[\u3000-\u303f\u3400-\u4dbf\u4e00-\u9fff\uff00-\uffef]/;

const RE_MD_HEADING = /^(#{1,6})\s+(.*\S)\s*$/;
const RE_PAGEBREAK = /^([-*_]\s*){3,}$/;
const RE_ABSTRACT = /^(?:\[?\s*(?:内容)?摘\s*要\s*\]?\s*[:：]?|abstract\s*[:：]?)\s*(.*)$/i;
const RE_KEYWORDS = /^(?:\[?\s*关\s*键\s*词\s*\]?\s*[:：]?|key\s*words?\s*[:：]?)\s*(.*)$/i;
const RE_REF_HEADING = /^(?:\[?\s*参\s*考\s*文\s*献\s*\]?\s*|references?\s*[:：]?)\s*(.*)$/i;
const RE_DOCNUM = /〔\s*\d{4}\s*〕\s*\d+\s*号/;
const RE_H1 = /^([一二三四五六七八九十百]{1,3})\s*[、.．]\s*(.*)$/;
const RE_H2 = /^[（(]\s*([一二三四五六七八九十百]{1,3})\s*[)）]\s*(.*)$/;
const RE_H3 = /^(\d{1,2})\s*[、.．]\s*(.+)$/;
const RE_H4 = /^[（(]\s*(\d{1,2})\s*[)）]\s*(.+)$/;
const RE_CHAPTER = /^第\s*([一二三四五六七八九十百零〇\d]{1,3})\s*[章节篇部分]\s*(.*)$/;
const RE_REF_ITEM = /^\[\s*(\d{1,3})\s*\]\s*(.*)$/;
const RE_DATE = /^[（(]?\s*(?:[〇零一二三四五六七八九十]{2,4}|\d{4})\s*年\s*(?:[〇零一二三四五六七八九十]{1,2}|\d{1,2})\s*月\s*(?:[〇零一二三四五六七八九十]{1,2}|\d{1,2})\s*日?\s*[）)]?$/;
const RE_ORG = /(?:委员会|人民政府|政府|局|厅|部|委|办公室|公司|集团|学校|学院|大学|研究院|中心|协会|学会|街道|镇|乡|县|市|区)$/;
const RE_AUTHOR_LINE = /^[\u4e00-\u9fff·]{2,4}(?:\s*[，,、]\s*[\u4e00-\u9fff·]{2,4}){0,6}$/;
const RE_ENDING_PUNCT = /[。！？；：!?;:…]$/;
const RE_BULLET = /^[-*•·]\s+(.*)$/;

/** True when the character is CJK (used to join hard-wrapped lines). */
function isCjkBoundary(ch) {
  return typeof ch === 'string' && ch.length > 0 && CJK_RE.test(ch);
}

/** Join two physical lines of one logical paragraph. */
function joinLines(prev, next) {
  if (!prev) return next;
  if (prev.endsWith('-')) return prev.slice(0, -1) + next;
  const a = prev.slice(-1);
  const b = next.slice(0, 1);
  if (isCjkBoundary(a) || isCjkBoundary(b)) return prev + next;
  return prev + ' ' + next;
}

/** Whether a physical line ends a logical paragraph (used for hard wraps). */
function endsSentence(line) {
  return /[。！？；：!?;:”"』」）)】.]$/.test(line) || /^#{1,6}\s/.test(line) || /^[（(]?[一二三四五六七八九十\d]+[、.．)）]/.test(line);
}

/** Strip common garbage: code fences, zero-width characters, trailing spaces. */
function cleanLine(line) {
  return line
    .replace(/\u200b|\u200c|\u200d|\ufeff/g, '')
    .replace(/[ \t]+$/g, '')
    .replace(/^\t+/, '');
}

/** Split the raw text into logical paragraphs. */
function toParagraphs(raw) {
  const text = String(raw || '').replace(/\r\n?/g, '\n').replace(/```[a-zA-Z]*\n?/g, '');
  const lines = text.split('\n').map(cleanLine);
  const out = [];
  let current = '';
  let currentBlank = true;
  const flush = () => {
    if (current.trim().length > 0) out.push(current.trim());
    current = '';
  };
  for (const line of lines) {
    if (line.trim().length === 0) {
      flush();
      currentBlank = true;
      continue;
    }
    const isStructural =
      RE_MD_HEADING.test(line) ||
      RE_PAGEBREAK.test(line) ||
      RE_BULLET.test(line) ||
      RE_ABSTRACT.test(line) ||
      RE_KEYWORDS.test(line) ||
      RE_REF_HEADING.test(line) ||
      RE_REF_ITEM.test(line);
    if (isStructural) {
      flush();
      out.push(line.trim());
      currentBlank = true;
      continue;
    }
    if (current === '') {
      current = line;
      currentBlank = false;
      continue;
    }
    // A hard-wrapped continuation vs a real paragraph break: break when the
    // previous line already finished a sentence AND the current line starts a
    // new sentence-looking unit.
    if (endsSentence(current) && !currentBlank) {
      flush();
      current = line;
    } else {
      current = joinLines(current, line);
    }
    currentBlank = false;
  }
  flush();
  return out;
}

function countCjk(text) {
  let n = 0;
  for (const ch of text) if (CJK_RE.test(ch)) n += 1;
  return n;
}

/** Heuristic: does this paragraph look like an unnumbered section heading? */
function looksLikeHeading(text, next) {
  if (text.length > 14) return false;
  if (/[，。；：、！？“”"'()（）\[\]【】《》0-9]/.test(text)) return false;
  if (!next || !/[。！？]/.test(next)) return false;
  if (/[了的吗呢吧啊]$/.test(text)) return false;
  if (countCjk(text) < 2) return false;
  if (text.length <= 3) return false;
  return true;
}

/**
 * Classify paragraphs into blocks.
 * @param {string[]} paragraphs logical paragraphs from toParagraphs()
 * @param {object} options { hasAddressee, family }
 * @returns {{kind:string, text:string, level?:number}[]}
 */
function classify(paragraphs, options) {
  const blocks = [];
  const total = paragraphs.length;
  let sawTitle = false;
  let sawAbstract = false;
  let sawKeywords = false;
  let refMode = false;

  for (let i = 0; i < total; i += 1) {
    const para = paragraphs[i];
    const next = paragraphs[i + 1] || '';

    if (RE_PAGEBREAK.test(para)) {
      blocks.push({ kind: 'pagebreak', text: '' });
      continue;
    }

    const md = para.match(RE_MD_HEADING);
    if (md) {
      const level = Math.min(md[1].length, 4);
      blocks.push({ kind: level === 1 && !sawTitle ? 'title' : `h${Math.min(level, 4)}`, text: md[2] });
      if (level === 1) sawTitle = true;
      continue;
    }

    if (refMode) {
      const item = para.match(RE_REF_ITEM);
      blocks.push({ kind: 'ref', text: item ? `[${item[1]}] ${item[2]}` : para });
      continue;
    }

    const refHeading = para.match(RE_REF_HEADING);
    if (refHeading && para.replace(/\s/g, '').length <= 12) {
      blocks.push({ kind: 'refHeading', text: '参考文献' });
      refMode = true;
      continue;
    }

    const abs = para.match(RE_ABSTRACT);
    if (abs && !sawAbstract) {
      const rest = abs[1];
      blocks.push({ kind: 'abstract', text: rest || para, label: /abstract/i.test(para) ? 'Abstract:' : '摘要：', empty: rest.length === 0 });
      sawAbstract = true;
      continue;
    }

    const kw = para.match(RE_KEYWORDS);
    if (kw && !sawKeywords && kw[1].length > 0) {
      blocks.push({ kind: 'keywords', text: kw[1], label: /^key/i.test(para) ? 'Key words:' : '关键词：' });
      sawKeywords = true;
      continue;
    }

    if (RE_DOCNUM.test(para) && para.replace(/\s/g, '').length <= 30) {
      blocks.push({ kind: 'docnum', text: para });
      continue;
    }

    // Numbered headings. When the numbered line runs straight into body text
    // ("（一）加强组织领导。各区县……"), the whole paragraph is body text, not a
    // heading; only short numbered lines count as headings.
    const INLINE_HEADING_MAX = 40;
    const numberedKind = (() => {
      if (RE_CHAPTER.test(para)) return 'h1';
      if (RE_H1.test(para)) return 'h1';
      if (RE_H2.test(para)) return 'h2';
      if (RE_H4.test(para)) return 'h4';
      if (RE_H3.test(para) && para.length <= 60) return 'h3';
      return null;
    })();
    if (numberedKind) {
      if (para.length <= INLINE_HEADING_MAX) {
        blocks.push({ kind: numberedKind, text: para });
        if (numberedKind === 'h1' && !sawTitle) sawTitle = true;
        continue;
      }
      blocks.push({ kind: 'body', text: para });
      continue;
    }

    // Trailing signature / date lines.
    const remaining = total - i;
    if (remaining <= 3 && RE_DATE.test(para.trim())) {
      blocks.push({ kind: 'date', text: para.trim() });
      continue;
    }
    if (remaining <= 4 && para.length <= 30 && RE_ORG.test(para.trim()) && !/[，。；：]/.test(para)) {
      blocks.push({ kind: 'signature', text: para.trim() });
      continue;
    }

    // Title: the first content paragraph, short, unpunctuated.
    if (!sawTitle && blocks.every((b) => b.kind === 'docnum' || b.kind === 'pagebreak')) {
      const trimmed = para.trim();
      if (trimmed.length <= 60 && !RE_ENDING_PUNCT.test(trimmed)) {
        blocks.push({ kind: 'title', text: trimmed });
        sawTitle = true;
        continue;
      }
    }

    // Author / affiliation directly after title.
    if (sawTitle && blocks.length > 0) {
      const prev = blocks[blocks.length - 1];
      if ((prev.kind === 'title' || prev.kind === 'subtitle') && RE_AUTHOR_LINE.test(para.trim()) && para.length <= 30) {
        blocks.push({ kind: 'author', text: para.trim() });
        continue;
      }
      if (prev.kind === 'author' && /(大学|学院|学校|研究所|研究院|公司|医院|中心|实验室)/.test(para) && para.length <= 60) {
        blocks.push({ kind: 'affiliation', text: para.trim() });
        continue;
      }
    }

    // 主送机关: ends with a colon and is short.
    if (/[：:]$/.test(para) && para.length <= 40 && !/^[（(]?\d/.test(para)) {
      blocks.push({ kind: 'addressee', text: para });
      continue;
    }

    const bullet = para.match(RE_BULLET);
    if (bullet) {
      blocks.push({ kind: 'list', text: '· ' + bullet[1] });
      continue;
    }

    if (/^[>＞]/.test(para)) {
      blocks.push({ kind: 'quote', text: para.replace(/^[>＞]\s*/, '') });
      continue;
    }

    if (looksLikeHeading(para, next)) {
      blocks.push({ kind: 'h2', text: para });
      continue;
    }

    blocks.push({ kind: 'body', text: para });
  }

  return blocks.filter((b) => b.kind === 'pagebreak' || b.text.trim().length > 0);
}

/**
 * Parse raw text into blocks.
 * @param {string} raw pasted text
 * @param {object} opts { family } for preset-specific tweaks
 */
export function parseDocument(raw, opts = {}) {
  const paragraphs = toParagraphs(raw);
  const blocks = classify(paragraphs, opts);
  const stats = {
    paragraphs: blocks.filter((b) => b.kind !== 'pagebreak').length,
    characters: Array.from(String(raw || '')).length,
    headings: blocks.filter((b) => /^h[1-4]$/.test(b.kind)).length,
    hasTitle: blocks.some((b) => b.kind === 'title'),
  };
  return { blocks, stats };
}
