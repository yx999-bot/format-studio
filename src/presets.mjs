/**
 * Format presets for the Format Studio plugin.
 *
 * Every preset is pure data: page geometry, a base body style, per-block-kind
 * style overrides, and a footer rule. All values are converted to Word's
 * internal units here so the layout and docx layers stay dumb.
 *
 * Length units used in this module:
 *   mm()  millimetres -> twips (1/1440 inch)
 *   tw()  points      -> twips
 * Font sizes are points. Line spacing: { rule: 'exact', value: twips } or
 * { rule: 'auto', value: 240 = single }.
 */

const TWIPS_PER_MM = 1440 / 25.4;

/** Millimetres to twips. */
export function mm(v) {
  return Math.round(v * TWIPS_PER_MM);
}

/** Points to twips. */
export function tw(v) {
  return Math.round(v * 20);
}

/** Points to half-points (the docx `w:sz` unit). */
export function hp(v) {
  return Math.round(v * 2);
}

export const A4 = { width: mm(210), height: mm(297) };

function baseStyle(over) {
  return {
    align: 'both',
    font: { eastAsia: '宋体', latin: 'Times New Roman', size: 12, bold: false, italic: false },
    line: { rule: 'auto', value: 240 },
    before: 0,
    after: 0,
    firstLineChars: 0,
    leftChars: 0,
    rightChars: 0,
    hangingChars: 0,
    keepNext: false,
    pageBreakBefore: false,
    borderBottom: false,
    ...over,
    font: { eastAsia: '宋体', latin: 'Times New Roman', size: 12, bold: false, italic: false, ...((over && over.font) || {}) },
    line: { rule: 'auto', value: 240, ...((over && over.line) || {}) },
  };
}

/** Merge a preset override over a base style (one level of font/line nesting). */
export function mergeStyle(base, over) {
  if (!over) return baseStyle({ ...base, font: { ...base.font }, line: { ...base.line } });
  return baseStyle({
    ...base,
    ...over,
    font: { ...base.font, ...(over.font || {}) },
    line: { ...base.line, ...(over.line || {}) },
  });
}

/** Normalise a preset: resolve every block kind into a full style. */
function normalizePreset(preset) {
  const body = baseStyle(preset.body || {});
  const styles = { body };
  const overrides = preset.styles || {};
  for (const key of Object.keys(overrides)) {
    styles[key] = mergeStyle(body, overrides[key]);
  }
  styles.subtitle = styles.subtitle || mergeStyle(body, { align: 'center', firstLineChars: 0 });
  styles.author = styles.author || mergeStyle(body, { align: 'center', firstLineChars: 0 });
  styles.affiliation = styles.affiliation || mergeStyle(body, { align: 'center', firstLineChars: 0, font: { size: 9 } });
  styles.docnum = styles.docnum || mergeStyle(body, { align: 'center', firstLineChars: 0 });
  styles.addressee = styles.addressee || mergeStyle(body, { align: 'left', firstLineChars: 0 });
  styles.quote = styles.quote || mergeStyle(body, { leftChars: 2, rightChars: 2 });
  styles.list = styles.list || mergeStyle(body, { firstLineChars: 0, leftChars: 2 });
  styles.signature = styles.signature || mergeStyle(body, { align: 'right', firstLineChars: 0, rightChars: 2 });
  styles.date = styles.date || mergeStyle(body, { align: 'right', firstLineChars: 0, rightChars: 2 });
  styles.note = styles.note || mergeStyle(body, { font: { size: 9 } });
  styles.refHeading = styles.refHeading || mergeStyle(body, { firstLineChars: 0, keepNext: true });
  styles.ref = styles.ref || mergeStyle(body, { firstLineChars: 0, hangingChars: 2, leftChars: 2 });
  return {
    ...preset,
    page: {
      width: preset.page.width,
      height: preset.page.height,
      margin: preset.page.margin,
    },
    styles,
    footer: preset.footer || { enabled: false },
  };
}

const paperBody = {
  font: { eastAsia: '宋体', latin: 'Times New Roman', size: 12 },
  line: { rule: 'auto', value: 360 },
  firstLineChars: 2,
  align: 'both',
};

const PAPER = {
  id: 'paper',
  name: '学术论文',
  short: '论文',
  family: 'academic',
  summary: '标题黑体二号居中，正文宋体小四、1.5 倍行距、首行缩进两字符，摘要与关键词五号，各级标题黑体分级，参考文献五号悬挂缩进。',
  page: { ...A4, margin: { top: mm(25.4), bottom: mm(25.4), left: mm(31.7), right: mm(31.7) } },
  body: paperBody,
  styles: {
    title: { font: { eastAsia: '黑体', size: 22, bold: true }, align: 'center', line: { rule: 'auto', value: 300 }, after: 12, firstLineChars: 0, keepNext: true },
    subtitle: { font: { eastAsia: '楷体_GB2312', size: 14 }, align: 'center', line: { rule: 'auto', value: 300 }, after: 6, firstLineChars: 0 },
    author: { font: { eastAsia: '楷体_GB2312', size: 12 }, align: 'center', after: 3, firstLineChars: 0 },
    affiliation: { font: { eastAsia: '宋体', size: 9 }, align: 'center', after: 6, firstLineChars: 0 },
    abstract: { font: { eastAsia: '宋体', size: 10.5 }, line: { rule: 'auto', value: 300 }, firstLineChars: 0, before: 6, after: 3, align: 'both' },
    keywords: { font: { eastAsia: '宋体', size: 10.5 }, line: { rule: 'auto', value: 300 }, firstLineChars: 0, after: 12, align: 'both' },
    h1: { font: { eastAsia: '黑体', size: 14 }, before: 12, after: 6, firstLineChars: 0, keepNext: true, line: { rule: 'auto', value: 300 } },
    h2: { font: { eastAsia: '黑体', size: 12 }, before: 8, after: 4, firstLineChars: 0, keepNext: true },
    h3: { font: { eastAsia: '宋体', size: 12, bold: true }, before: 6, after: 3, firstLineChars: 0, keepNext: true },
    h4: { font: { eastAsia: '宋体', size: 12, bold: true }, firstLineChars: 0, keepNext: true },
    refHeading: { font: { eastAsia: '黑体', size: 14 }, before: 18, after: 6, firstLineChars: 0, align: 'left', keepNext: true },
    ref: { font: { eastAsia: '宋体', size: 9 }, line: { rule: 'auto', value: 240 }, firstLineChars: 0, hangingChars: 2, leftChars: 2, align: 'both' },
    note: { font: { eastAsia: '宋体', size: 9 }, firstLineChars: 0 },
    quote: { leftChars: 2, rightChars: 2, font: { size: 10.5 }, line: { rule: 'auto', value: 300 } },
  },
  footer: { enabled: true, size: 9, eastAsia: '宋体', latin: 'Times New Roman', format: 'plain' },
};

const THESIS = {
  id: 'thesis',
  name: '学位论文',
  short: '学位',
  family: 'academic',
  summary: '正文宋体小四、1.5 倍行距，章标题黑体三号居中并另起一页，节标题黑体四号，三级标题小四黑体，落款与页码居中。',
  page: { ...A4, margin: { top: mm(30), bottom: mm(25), left: mm(30), right: mm(25) } },
  body: { font: { eastAsia: '宋体', latin: 'Times New Roman', size: 12 }, line: { rule: 'auto', value: 360 }, firstLineChars: 2, align: 'both' },
  styles: {
    title: { font: { eastAsia: '黑体', size: 22, bold: true }, align: 'center', line: { rule: 'auto', value: 300 }, after: 18, firstLineChars: 0, keepNext: true },
    subtitle: { font: { eastAsia: '楷体_GB2312', size: 16 }, align: 'center', after: 12, firstLineChars: 0 },
    author: { font: { eastAsia: '宋体', size: 14 }, align: 'center', after: 4, firstLineChars: 0 },
    affiliation: { font: { eastAsia: '宋体', size: 12 }, align: 'center', after: 12, firstLineChars: 0 },
    abstract: { font: { eastAsia: '宋体', size: 12 }, firstLineChars: 0, before: 6, after: 6, align: 'both' },
    keywords: { font: { eastAsia: '宋体', size: 12 }, firstLineChars: 0, after: 12, align: 'both' },
    h1: { font: { eastAsia: '黑体', size: 16 }, align: 'center', before: 24, after: 18, firstLineChars: 0, keepNext: true, pageBreakBefore: false },
    h2: { font: { eastAsia: '黑体', size: 14 }, before: 12, after: 6, firstLineChars: 0, keepNext: true },
    h3: { font: { eastAsia: '黑体', size: 12 }, before: 8, after: 4, firstLineChars: 0, keepNext: true },
    h4: { font: { eastAsia: '宋体', size: 12, bold: true }, firstLineChars: 0, keepNext: true },
    refHeading: { font: { eastAsia: '黑体', size: 16 }, align: 'center', before: 18, after: 12, firstLineChars: 0, keepNext: true },
    ref: { font: { eastAsia: '宋体', size: 10.5 }, line: { rule: 'auto', value: 300 }, firstLineChars: 0, hangingChars: 2, leftChars: 2, align: 'both' },
    note: { font: { eastAsia: '宋体', size: 10.5 }, firstLineChars: 0 },
  },
  footer: { enabled: true, size: 10.5, eastAsia: '宋体', latin: 'Times New Roman', format: 'plain' },
};

const GOV = {
  id: 'gov',
  name: '党政机关公文',
  short: '公文',
  family: 'official',
  summary: 'GB/T 9704-2012：版心 156×225mm，标题二号小标宋居中，正文三号仿宋_GB2312、固定行距 28 磅、首行缩进两字符，一级标题黑体、二级楷体、三级仿宋加粗，页码四号宋体加一字线。',
  page: { ...A4, margin: { top: mm(37), bottom: mm(35), left: mm(28), right: mm(26) } },
  body: { font: { eastAsia: '仿宋_GB2312', latin: 'Times New Roman', size: 16 }, line: { rule: 'exact', value: tw(28) }, firstLineChars: 2, align: 'both' },
  styles: {
    docnum: { font: { eastAsia: '仿宋_GB2312', size: 16 }, align: 'center', line: { rule: 'exact', value: tw(28) }, firstLineChars: 0 },
    title: { font: { eastAsia: '方正小标宋简体', size: 22 }, align: 'center', line: { rule: 'exact', value: tw(28) }, before: 0, after: 28, firstLineChars: 0, keepNext: true },
    subtitle: { font: { eastAsia: '楷体_GB2312', size: 16 }, align: 'center', line: { rule: 'exact', value: tw(28) }, firstLineChars: 0 },
    addressee: { font: { eastAsia: '仿宋_GB2312', size: 16 }, align: 'left', line: { rule: 'exact', value: tw(28) }, firstLineChars: 0, before: 0, after: 0 },
    h1: { font: { eastAsia: '黑体', size: 16 }, line: { rule: 'exact', value: tw(28) }, firstLineChars: 0, keepNext: true },
    h2: { font: { eastAsia: '楷体_GB2312', size: 16 }, line: { rule: 'exact', value: tw(28) }, firstLineChars: 0, keepNext: true },
    h3: { font: { eastAsia: '仿宋_GB2312', size: 16, bold: true }, line: { rule: 'exact', value: tw(28) }, firstLineChars: 0, keepNext: true },
    h4: { font: { eastAsia: '仿宋_GB2312', size: 16 }, line: { rule: 'exact', value: tw(28) }, firstLineChars: 0, keepNext: true },
    signature: { font: { eastAsia: '仿宋_GB2312', size: 16 }, align: 'right', line: { rule: 'exact', value: tw(28) }, firstLineChars: 0, rightChars: 2, before: 28 },
    date: { font: { eastAsia: '仿宋_GB2312', size: 16 }, align: 'right', line: { rule: 'exact', value: tw(28) }, firstLineChars: 0, rightChars: 4 },
    note: { font: { eastAsia: '仿宋_GB2312', size: 16 }, line: { rule: 'exact', value: tw(28) }, firstLineChars: 0 },
    ref: { font: { eastAsia: '仿宋_GB2312', size: 16 }, line: { rule: 'exact', value: tw(28) }, firstLineChars: 0 },
  },
  footer: { enabled: true, size: 14, eastAsia: '宋体', latin: 'Times New Roman', format: 'gongwen' },
};

const REPORT = {
  id: 'report',
  name: '工作总结 / 汇报',
  short: '总结',
  family: 'official',
  summary: '标题二号小标宋或黑体居中，正文三号仿宋、1.5 倍行距，一级标题黑体三号、二级楷体三号加粗，落款右对齐。',
  page: { ...A4, margin: { top: mm(32), bottom: mm(30), left: mm(28), right: mm(26) } },
  body: { font: { eastAsia: '仿宋_GB2312', latin: 'Times New Roman', size: 16 }, line: { rule: 'auto', value: 360 }, firstLineChars: 2, align: 'both' },
  styles: {
    title: { font: { eastAsia: '方正小标宋简体', size: 22 }, align: 'center', line: { rule: 'auto', value: 342 }, after: 24, firstLineChars: 0, keepNext: true },
    subtitle: { font: { eastAsia: '楷体_GB2312', size: 16 }, align: 'center', firstLineChars: 0 },
    h1: { font: { eastAsia: '黑体', size: 16 }, before: 12, after: 6, firstLineChars: 0, keepNext: true },
    h2: { font: { eastAsia: '楷体_GB2312', size: 16, bold: true }, before: 6, after: 3, firstLineChars: 0, keepNext: true },
    h3: { font: { eastAsia: '仿宋_GB2312', size: 16, bold: true }, firstLineChars: 0, keepNext: true },
    signature: { font: { eastAsia: '仿宋_GB2312', size: 16 }, align: 'right', firstLineChars: 0, rightChars: 2, before: 24 },
    date: { font: { eastAsia: '仿宋_GB2312', size: 16 }, align: 'right', firstLineChars: 0, rightChars: 4 },
    addressee: { font: { eastAsia: '仿宋_GB2312', size: 16 }, align: 'left', firstLineChars: 0 },
    note: { font: { eastAsia: '仿宋_GB2312', size: 16 }, firstLineChars: 0 },
  },
  footer: { enabled: true, size: 14, eastAsia: '宋体', latin: 'Times New Roman', format: 'gongwen' },
};

const NEWS = {
  id: 'news',
  name: '新闻稿 / 通讯',
  short: '新闻',
  family: 'media',
  summary: '标题黑体小二号居中，副标题楷体，作者/记者署名楷体居中，正文宋体小四、1.5 倍行距、首行缩进两字符。',
  page: { ...A4, margin: { top: mm(25.4), bottom: mm(25.4), left: mm(28), right: mm(28) } },
  body: { font: { eastAsia: '宋体', latin: 'Times New Roman', size: 12 }, line: { rule: 'auto', value: 360 }, firstLineChars: 2, align: 'both' },
  styles: {
    title: { font: { eastAsia: '黑体', size: 18, bold: true }, align: 'center', line: { rule: 'auto', value: 320 }, after: 6, firstLineChars: 0, keepNext: true },
    subtitle: { font: { eastAsia: '楷体_GB2312', size: 14 }, align: 'center', after: 6, firstLineChars: 0 },
    author: { font: { eastAsia: '楷体_GB2312', size: 10.5 }, align: 'center', after: 12, firstLineChars: 0 },
    h1: { font: { eastAsia: '黑体', size: 12 }, before: 12, after: 6, firstLineChars: 0, keepNext: true },
    h2: { font: { eastAsia: '楷体_GB2312', size: 12, bold: true }, firstLineChars: 0, keepNext: true },
    quote: { leftChars: 2, rightChars: 2, font: { eastAsia: '楷体_GB2312', size: 12 } },
    note: { font: { eastAsia: '楷体_GB2312', size: 10.5 }, firstLineChars: 0 },
  },
  footer: { enabled: true, size: 9, eastAsia: '宋体', latin: 'Times New Roman', format: 'plain' },
};

const BUSINESS = {
  id: 'business',
  name: '商业报告 / 方案',
  short: '方案',
  family: 'business',
  summary: '标题黑体二号居中，正文宋体小四、1.5 倍行距，一级标题黑体小三、二级四号黑体、三级小四加粗，页眉式页码。',
  page: { ...A4, margin: { top: mm(25.4), bottom: mm(25.4), left: mm(31.7), right: mm(31.7) } },
  body: { font: { eastAsia: '宋体', latin: 'Times New Roman', size: 12 }, line: { rule: 'auto', value: 360 }, firstLineChars: 2, align: 'both' },
  styles: {
    title: { font: { eastAsia: '黑体', size: 22, bold: true }, align: 'center', line: { rule: 'auto', value: 300 }, after: 18, firstLineChars: 0, keepNext: true },
    subtitle: { font: { eastAsia: '楷体_GB2312', size: 14 }, align: 'center', after: 12, firstLineChars: 0 },
    h1: { font: { eastAsia: '黑体', size: 15 }, before: 18, after: 8, firstLineChars: 0, keepNext: true },
    h2: { font: { eastAsia: '黑体', size: 14 }, before: 12, after: 6, firstLineChars: 0, keepNext: true },
    h3: { font: { eastAsia: '宋体', size: 12, bold: true }, before: 8, after: 4, firstLineChars: 0, keepNext: true },
    list: { firstLineChars: 0, leftChars: 2, hangingChars: 1 },
    note: { font: { eastAsia: '楷体_GB2312', size: 10.5 }, firstLineChars: 0 },
  },
  footer: { enabled: true, size: 9, eastAsia: '宋体', latin: 'Times New Roman', format: 'plain' },
};

const LETTER = {
  id: 'letter',
  name: '申请 / 信函',
  short: '信函',
  family: 'official',
  summary: '标题黑体三号居中，称呼顶格，正文三号仿宋、1.5 倍行距、首行缩进两字符，署名与日期右对齐。',
  page: { ...A4, margin: { top: mm(32), bottom: mm(30), left: mm(28), right: mm(26) } },
  body: { font: { eastAsia: '仿宋_GB2312', latin: 'Times New Roman', size: 16 }, line: { rule: 'auto', value: 360 }, firstLineChars: 2, align: 'both' },
  styles: {
    title: { font: { eastAsia: '黑体', size: 18, bold: true }, align: 'center', line: { rule: 'auto', value: 320 }, after: 18, firstLineChars: 0, keepNext: true },
    addressee: { font: { eastAsia: '仿宋_GB2312', size: 16 }, align: 'left', firstLineChars: 0 },
    h1: { font: { eastAsia: '黑体', size: 16 }, firstLineChars: 0, keepNext: true },
    h2: { font: { eastAsia: '楷体_GB2312', size: 16, bold: true }, firstLineChars: 0, keepNext: true },
    signature: { font: { eastAsia: '仿宋_GB2312', size: 16 }, align: 'right', firstLineChars: 0, rightChars: 2, before: 24 },
    date: { font: { eastAsia: '仿宋_GB2312', size: 16 }, align: 'right', firstLineChars: 0, rightChars: 4 },
    note: { font: { eastAsia: '仿宋_GB2312', size: 16 }, firstLineChars: 0 },
  },
  footer: { enabled: false },
};

const RESUME = {
  id: 'resume',
  name: '简历 / 个人材料',
  short: '简历',
  family: 'business',
  summary: '紧凑排版：标题黑体二号居中，栏目名黑体小四加下划线隔断，正文宋体五号、1.25 倍行距、不首行缩进。',
  page: { ...A4, margin: { top: mm(20), bottom: mm(20), left: mm(22), right: mm(22) } },
  body: { font: { eastAsia: '宋体', latin: 'Times New Roman', size: 10.5 }, line: { rule: 'auto', value: 300 }, firstLineChars: 0, align: 'left' },
  styles: {
    title: { font: { eastAsia: '黑体', size: 22, bold: true }, align: 'center', line: { rule: 'auto', value: 280 }, after: 4, firstLineChars: 0 },
    subtitle: { font: { eastAsia: '宋体', size: 10.5 }, align: 'center', firstLineChars: 0 },
    author: { font: { eastAsia: '宋体', size: 10.5 }, align: 'center', firstLineChars: 0 },
    h1: { font: { eastAsia: '黑体', size: 12.5 }, before: 10, after: 4, firstLineChars: 0, keepNext: true, borderBottom: true },
    h2: { font: { eastAsia: '宋体', size: 10.5, bold: true }, before: 4, after: 2, firstLineChars: 0, keepNext: true },
    h3: { font: { eastAsia: '宋体', size: 10.5 }, firstLineChars: 0, keepNext: true },
    list: { firstLineChars: 0, leftChars: 1, hangingChars: 1 },
    note: { font: { eastAsia: '宋体', size: 9 }, firstLineChars: 0 },
  },
  footer: { enabled: false },
};

/** All usable presets, in UI order. */
export const PRESETS = [PAPER, THESIS, GOV, REPORT, NEWS, BUSINESS, LETTER, RESUME].map(normalizePreset);

/** Lookup by id; falls back to the generic report preset. */
export function getPreset(id) {
  return PRESETS.find((p) => p.id === id) || PRESETS[1];
}

/**
 * Keyword table used by the "custom scenario" mode. Order matters: the first
 * match wins, so more specific families come first.
 */
const SCENARIO_RULES = [
  { preset: 'gov', words: ['公文', '机关', '请示', '通知', '通报', '批复', '意见', '决定', '公告', '通告', '纪要', '党委', '政府', '红头', '发文', '部委', '事业单位', '上行文', '下行文'] },
  { preset: 'thesis', words: ['学位', '毕业论文', '毕业设计', '硕士', '博士', '本科论文', '开题', '答辩'] },
  { preset: 'paper', words: ['论文', '期刊', '投稿', '摘要', '关键词', '参考文献', '学术', '文献综述', '研究'] },
  { preset: 'news', words: ['新闻', '通讯', '报道', '采访', '稿件', '媒体', '宣传稿', '消息稿', '公众号'] },
  { preset: 'resume', words: ['简历', '求职', '个人陈述', '自我介绍', '履历'] },
  { preset: 'letter', words: ['申请', '信函', '申请书', '感谢信', '邀请函', '致', '书'] },
  { preset: 'report', words: ['总结', '汇报', '述职', '工作报告', '情况说明', '自查', '整改', '年度'] },
  { preset: 'business', words: ['方案', '商业', '计划书', '报告书', '策划', '可行性', '项目', '市场', '运营', '商业计划'] },
];

/**
 * Resolve a requested preset id plus a free-text scenario description.
 * Returns { preset, matched: boolean, reason }.
 */
export function resolvePreset(presetId, scenario) {
  if (presetId && presetId !== 'auto' && presetId !== 'custom') {
    const found = PRESETS.find((p) => p.id === presetId);
    if (found) return { preset: found, matched: true, reason: 'preset' };
  }
  const text = String(scenario || '');
  for (const rule of SCENARIO_RULES) {
    for (const word of rule.words) {
      if (text.includes(word)) {
        const preset = getPreset(rule.preset);
        return { preset, matched: true, reason: `关键词「${word}」→ ${preset.name}` };
      }
    }
  }
  const fallback = getPreset('report');
  return { preset: fallback, matched: false, reason: '未识别到明确场景，使用通用「工作总结 / 汇报」格式' };
}

/** Preset ids accepted by the agent tool. */
export const PRESET_IDS = ['auto', ...PRESETS.map((p) => p.id)];
