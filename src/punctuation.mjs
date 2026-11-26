/**
 * 中文标点规范化。
 *
 * 把从英文输入法、AI 生成、PDF 复制来的半角标点，改成手打中文时会用的全角
 * 标点，同时不破坏英文句子、数字、网址、编号和引用标记。
 *
 * 规则：
 *   1. 只在中文字符（汉字）附近转换，纯英文行里逗号句号保持原样；
 *   2. URL、邮箱、Windows 路径、行内代码、[1] / [2-3] 引用标记整段跳过；
 *   3. 1.2 / 3.5% / 12:30 这类数字上下文不转换；
 *   4. 行首的 1. / 2) / （1）/ 一、 编号不转换（它们是结构，不是标点）；
 *   5. 引号按上下文成对变成 “ ”，省略号 ... → ……，破折号 -- → ——。
 */

const PU_CJK_RE = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;

function puIsCjk(ch) {
  return typeof ch === 'string' && ch.length > 0 && PU_CJK_RE.test(ch);
}

function puIsDigit(ch) {
  return ch >= '0' && ch <= '9';
}

function puIsAsciiLetter(ch) {
  return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z');
}

function puIsBoundary(ch) {
  return ch === '' || ch === '\n' || ch === '\r';
}

/** 左侧最近的字符（跳过空格，遇到换行/开头视为空）。 */
function puPrevChar(text, index) {
  let i = index - 1;
  while (i >= 0 && (text[i] === ' ' || text[i] === '\t')) i -= 1;
  if (i < 0) return '';
  return puIsBoundary(text[i]) ? '' : text[i];
}

/** 右侧最近的字符（跳过空格，遇到换行/结尾视为空）。 */
function puNextChar(text, index) {
  let i = index + 1;
  while (i < text.length && (text[i] === ' ' || text[i] === '\t')) i += 1;
  if (i >= text.length) return '';
  return puIsBoundary(text[i]) ? '' : text[i];
}

/** 每行是否含汉字（纯英文行不做标点替换）。 */
function puBuildLineFlags(text) {
  const flags = new Uint8Array(text.length);
  let start = 0;
  while (start <= text.length) {
    let end = text.indexOf('\n', start);
    if (end === -1) end = text.length;
    let hasCjk = false;
    for (let i = start; i < end; i += 1) {
      if (PU_CJK_RE.test(text[i])) { hasCjk = true; break; }
    }
    for (let i = start; i < end; i += 1) flags[i] = hasCjk ? 1 : 0;
    start = end + 1;
  }
  return flags;
}

const PU_PROTECTED = [
  { pattern: /https?:\/\/[^\s，。；）)]+/g, trim: ',.;:!?' },
  { pattern: /www\.[A-Za-z0-9.-]+/g, trim: ',.;:!?' },
  { pattern: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, trim: ',.;:!?' },
  { pattern: /[A-Za-z]:\\[^\s]+/g, trim: ',.;:!?' },
  { pattern: /`[^`\n]*`/g, trim: '' },
  { pattern: /\[\s*\d{1,3}(?:\s*[-–—,，]\s*\d{1,3})*\s*\]/g, trim: '' },
  { pattern: /^[ \t]*\d{1,2}[.)][ \t]?/gm, trim: '' },
  { pattern: /^[ \t]*[（(]\s*\d{1,2}\s*[)）]/gm, trim: '' },
  { pattern: /^[ \t]*[一二三四五六七八九十]{1,3}[、.．]/gm, trim: '' },
  { pattern: /^[ \t]*#{1,6}[ \t]/gm, trim: '' },
];

/** 标出不能碰的区域。 */
function puBuildProtectedMask(text) {
  const mask = new Uint8Array(text.length);
  for (const item of PU_PROTECTED) {
    const pattern = item.pattern;
    pattern.lastIndex = 0;
    let match = pattern.exec(text);
    while (match) {
      let start = match.index;
      let end = Math.min(text.length, start + match[0].length);
      while (end > start && item.trim.indexOf(text[end - 1]) >= 0) end -= 1;
      for (let i = start; i < end; i += 1) mask[i] = 1;
      match = pattern.exec(text);
    }
  }
  return mask;
}

const PU_OPEN_BEFORE = new Set(['（', '【', '《', '「', '『', '“', '‘', '，', '。', '：', '；', '、']);
const PU_COLON_AFTER = new Set(['"', '\'', '“', '‘', '（', '《', '【', '「']);

/**
 * 规范化标点。
 * @param {string} input 原文
 * @param {{punctuation?: boolean, quotes?: boolean}} options
 * @returns {{text: string, changes: number}}
 */
export function normalizePunctuation(input, options = {}) {
  const source = String(input == null ? '' : input);
  if (source.length === 0) return { text: source, changes: 0 };

  const mask = puBuildProtectedMask(source);
  const cjkLines = puBuildLineFlags(source);
  const out = [];
  let changes = 0;
  let quoteOpen = false;
  let singleOpen = false;
  let i = 0;

  /** 输出替换标点，并吃掉它后面多余的半角空格。 */
  const emit = (replacement, from, consumed) => {
    out.push(replacement);
    changes += 1;
    let next = from + consumed;
    let probe = next;
    while (probe < source.length && (source[probe] === ' ' || source[probe] === '\t')) probe += 1;
    const after = probe < source.length ? source[probe] : '';
    if (probe > next && (after === '' || puIsCjk(after) || after === '\n' || after === '\r')) next = probe;
    return next;
  };

  while (i < source.length) {
    const ch = source[i];

    if (ch === '\n' || ch === '\r') {
      quoteOpen = false;
      singleOpen = false;
      out.push(ch);
      i += 1;
      continue;
    }
    if (mask[i] === 1) {
      out.push(ch);
      i += 1;
      continue;
    }

    const prev = puPrevChar(source, i);
    const next = puNextChar(source, i);
    const prevCjk = puIsCjk(prev);
    const nextCjk = puIsCjk(next);
    const nearCjk = prevCjk || nextCjk;
    const inCjkLine = cjkLines[i] === 1;

    // ---- 多字符：省略号 / 破折号 ----
    if (ch === '.' && source.startsWith('...', i)) {
      if (nearCjk || (inCjkLine && (next === '' || puIsCjk(source[i + 3] || '')))) {
        i = emit('……', i, 3);
        continue;
      }
    }
    if (ch === '-' && source.startsWith('--', i)) {
      if (nearCjk || (inCjkLine && puIsCjk(source[i + 2] || ''))) {
        i = emit('——', i, 2);
        continue;
      }
    }

    // ---- 单字符 ----
    switch (ch) {
      case ',':
        if (nearCjk) { i = emit('，', i, 1); continue; }
        break;
      case ';':
        if (nearCjk) { i = emit('；', i, 1); continue; }
        break;
      case ':':
        if (prevCjk && (nextCjk || next === '' || PU_COLON_AFTER.has(next))) {
          i = emit('：', i, 1);
          continue;
        }
        break;
      case '?':
        if (prevCjk || (nextCjk && prev === '')) { i = emit('？', i, 1); continue; }
        if (inCjkLine && next === '' && prev !== '' && !puIsAsciiLetter(prev)) { i = emit('？', i, 1); continue; }
        break;
      case '!':
        if (prevCjk || (inCjkLine && !puIsAsciiLetter(prev))) { i = emit('！', i, 1); continue; }
        break;
      case '.':
        if (puIsDigit(prev) || puIsDigit(next)) break;
        if (puIsAsciiLetter(prev) && mask[i - 1] !== 1) break; // 英文句号
        if (next === '' || next === '\n' || next === '\r' || nextCjk || next === '"' || next === '”' || next === '）' || next === '」') {
          if (inCjkLine) { i = emit('。', i, 1); continue; }
        }
        break;
      case '"':
        if (options.quotes === false) break;
        if (prevCjk || nextCjk || prev === '' || PU_OPEN_BEFORE.has(prev)) {
          out.push(quoteOpen ? '”' : '“');
          quoteOpen = !quoteOpen;
          changes += 1;
          i += 1;
          continue;
        }
        break;
      case '\'':
        if (options.quotes === false) break;
        if (puIsAsciiLetter(prev) || puIsAsciiLetter(next)) break;
        if (prevCjk || nextCjk) {
          out.push(singleOpen ? '’' : '‘');
          singleOpen = !singleOpen;
          changes += 1;
          i += 1;
          continue;
        }
        break;
      case '(':
        if (nextCjk || prevCjk) { i = emit('（', i, 1); continue; }
        break;
      case ')':
        if (prevCjk || nextCjk) { i = emit('）', i, 1); continue; }
        break;
      default:
        break;
    }

    out.push(ch);
    i += 1;
  }

  return { text: out.join(''), changes };
}

/** 只返回规范化后的文本。 */
export function normalizeText(input, options = {}) {
  return normalizePunctuation(input, options).text;
}
