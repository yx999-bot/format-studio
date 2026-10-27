window.__ModuleLoader__.load({
  id: "@local/format-studio",
  factory(require) {
    const React = require('react');
    // ---- src/presets.mjs ----
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
    function mm(v) {
      return Math.round(v * TWIPS_PER_MM);
    }

    /** Points to twips. */
    function tw(v) {
      return Math.round(v * 20);
    }

    /** Points to half-points (the docx `w:sz` unit). */
    function hp(v) {
      return Math.round(v * 2);
    }

    const A4 = { width: mm(210), height: mm(297) };

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
    function mergeStyle(base, over) {
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
    const PRESETS = [PAPER, THESIS, GOV, REPORT, NEWS, BUSINESS, LETTER, RESUME].map(normalizePreset);

    /** Lookup by id; falls back to the generic report preset. */
    function getPreset(id) {
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
    function resolvePreset(presetId, scenario) {
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
    const PRESET_IDS = ['auto', ...PRESETS.map((p) => p.id)];

    // ---- src/parser.mjs ----
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
    function parseDocument(raw, opts = {}) {
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

    // ---- src/layout.mjs ----
    /**
     * Layout for Format Studio: maps parsed blocks onto a preset's styles.
     *
     * Output is a renderer-neutral document model consumed by docx.mjs (and by the
     * in-browser preview). One paragraph = { kind, style, runs }.
     */


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
    function layoutBlocks(blocks, stats, preset, options = {}) {
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
    function formatText(text, preset, options = {}) {
      const { blocks, stats } = parseDocument(text, { family: preset.family });
      return { blocks, stats, layout: layoutBlocks(blocks, stats, preset, options) };
    }

    /**
     * Human-readable outline of the detected structure, used by the preview panel
     * and by the agent tool's text summary.
     */
    function describeBlocks(blocks) {
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

    // ---- src/docx.mjs ----
    /**
     * Minimal WordprocessingML (.docx) writer.
     *
     * Pure JavaScript: no node:zlib, no libraries, no DOM. The ZIP container uses
     * the STORE method (compression 0), which Word, WPS and LibreOffice all accept,
     * so the same code runs in the host process and in the browser.
     */

    const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

    const NS_W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
    const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

    /** Escape text for XML content and attributes. */
    function xmlEscape(value) {
      return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
    }

    function alignValue(align) {
      switch (align) {
        case 'center':
          return 'center';
        case 'right':
          return 'right';
        case 'left':
        case 'start':
          return 'left';
        case 'justify':
        case 'both':
        default:
          return 'both';
      }
    }

    /** Character-count indents are 1/100 of a character in OOXML. */
    function charUnits(chars) {
      return Math.round(chars * 100);
    }

    function runProperties(font, bold) {
      const props = [];
      props.push(
        `<w:rFonts w:ascii="${xmlEscape(font.latin)}" w:hAnsi="${xmlEscape(font.latin)}" w:eastAsia="${xmlEscape(font.eastAsia)}" w:cs="${xmlEscape(font.latin)}"/>`,
      );
      props.push(bold ? '<w:b/><w:bCs/>' : '<w:b w:val="0"/><w:bCs w:val="0"/>');
      if (font.italic) props.push('<w:i/><w:iCs/>');
      const halfPoints = Math.round((font.size || 12) * 2);
      props.push(`<w:sz w:val="${halfPoints}"/><w:szCs w:val="${halfPoints}"/>`);
      if (font.color) props.push(`<w:color w:val="${xmlEscape(font.color)}"/>`);
      return props.join('');
    }

    function paragraphProperties(style) {
      const props = [];
      if (style.pageBreakBefore) props.push('<w:pageBreakBefore/>');
      if (style.keepNext) props.push('<w:keepNext/>');
      if (style.borderBottom) {
        props.push('<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="auto"/></w:pBdr>');
      }
      const before = Math.round((style.before || 0) * 20);
      const after = Math.round((style.after || 0) * 20);
      const line = style.line || { rule: 'auto', value: 240 };
      const lineXml = line.rule === 'exact'
        ? `w:line="${Math.round(line.value)}" w:lineRule="exact"`
        : `w:line="${Math.round(line.value)}" w:lineRule="auto"`;
      props.push(`<w:spacing w:before="${before}" w:after="${after}" ${lineXml}/>`);
      props.push(`<w:jc w:val="${alignValue(style.align)}"/>`);

      const charTwips = Math.round((style.font.size || 12) * 20);
      const ind = [];
      if (style.hangingChars) {
        ind.push(`w:hangingChars="${charUnits(style.hangingChars)}"`, `w:hanging="${Math.round(style.hangingChars * charTwips)}"`);
      } else if (style.firstLineChars) {
        ind.push(`w:firstLineChars="${charUnits(style.firstLineChars)}"`, `w:firstLine="${Math.round(style.firstLineChars * charTwips)}"`);
      }
      if (style.leftChars) {
        ind.push(`w:leftChars="${charUnits(style.leftChars)}"`, `w:left="${Math.round(style.leftChars * charTwips)}"`);
      }
      if (style.rightChars) {
        ind.push(`w:rightChars="${charUnits(style.rightChars)}"`, `w:right="${Math.round(style.rightChars * charTwips)}"`);
      }
      if (ind.length > 0) props.push(`<w:ind ${ind.join(' ')}/>`);
      return props.join('');
    }

    function runXml(run, style) {
      const text = String(run.text ?? '');
      if (text.length === 0) return '';
      const bold = run.bold === undefined ? style.font.bold : run.bold;
      const props = runProperties(style.font, bold);
      // Preserve internal line breaks as <w:br/>.
      const chunks = text.split('\n');
      const inner = chunks
        .map((chunk) => `<w:t xml:space="preserve">${xmlEscape(chunk)}</w:t>`)
        .join('<w:br/>');
      return `<w:r><w:rPr>${props}</w:rPr>${inner}</w:r>`;
    }

    function paragraphXml(paragraph) {
      const style = paragraph.style;
      const pPr = paragraphProperties(style);
      const runs = (paragraph.runs || []).map((run) => runXml(run, style)).join('');
      return `<w:p><w:pPr>${pPr}</w:pPr>${runs}</w:p>`;
    }

    function footerXml(footer) {
      if (!footer || !footer.enabled) return '';
      const size = Math.round((footer.size || 9) * 2);
      const font = `<w:rFonts w:ascii="${xmlEscape(footer.latin || 'Times New Roman')}" w:hAnsi="${xmlEscape(footer.latin || 'Times New Roman')}" w:eastAsia="${xmlEscape(footer.eastAsia || '宋体')}"/>`;
      const rPr = `<w:rPr>${font}<w:sz w:val="${size}"/><w:szCs w:val="${size}"/></w:rPr>`;
      const format = footer.format || 'plain';
      const left = format === 'gongwen' ? '— ' : '';
      const right = format === 'gongwen' ? ' —' : '';
      const field = [
        '<w:r><w:fldChar w:fldCharType="begin"/></w:r>',
        '<w:r><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r>',
        '<w:r><w:fldChar w:fldCharType="separate"/></w:r>',
        `<w:r>${rPr}<w:t>1</w:t></w:r>`,
        '<w:r><w:fldChar w:fldCharType="end"/></w:r>',
      ].join('');
      const open = left ? `<w:r>${rPr}<w:t xml:space="preserve">${xmlEscape(left)}</w:t></w:r>` : '';
      const close = right ? `<w:r>${rPr}<w:t xml:space="preserve">${xmlEscape(right)}</w:t></w:r>` : '';
      return `${XML_HEAD}<w:ftr xmlns:w="${NS_W}" xmlns:r="${NS_R}"><w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/></w:pPr>${open}${field}${close}</w:p></w:ftr>`;
    }

    function documentXml(layout) {
      const paragraphs = (layout.paragraphs || []).map(paragraphXml).join('');
      const page = layout.page;
      const margin = page.margin;
      const footerRef = layout.footer && layout.footer.enabled
        ? '<w:footerReference w:type="default" r:id="rIdFooter1"/>'
        : '';
      const sectPr = [
        '<w:sectPr>',
        footerRef,
        `<w:pgSz w:w="${page.width}" w:h="${page.height}"/>`,
        `<w:pgMar w:top="${margin.top}" w:right="${margin.right}" w:bottom="${margin.bottom}" w:left="${margin.left}" w:header="851" w:footer="992" w:gutter="0"/>`,
        '<w:cols w:space="425"/>',
        '<w:docGrid w:type="none"/>',
        '</w:sectPr>',
      ].join('');
      return `${XML_HEAD}<w:document xmlns:w="${NS_W}" xmlns:r="${NS_R}"><w:body>${paragraphs}${sectPr}</w:body></w:document>`;
    }

    function stylesXml(layout) {
      const font = layout.defaultFont || { eastAsia: '宋体', latin: 'Times New Roman', size: 12 };
      const halfPoints = Math.round((font.size || 12) * 2);
      const defaults = [
        '<w:docDefaults>',
        '<w:rPrDefault><w:rPr>',
        `<w:rFonts w:ascii="${xmlEscape(font.latin)}" w:hAnsi="${xmlEscape(font.latin)}" w:eastAsia="${xmlEscape(font.eastAsia)}" w:cs="${xmlEscape(font.latin)}"/>`,
        `<w:sz w:val="${halfPoints}"/><w:szCs w:val="${halfPoints}"/>`,
        '<w:lang w:val="en-US" w:eastAsia="zh-CN" w:bidi="ar-SA"/>',
        '</w:rPr></w:rPrDefault>',
        '<w:pPrDefault><w:pPr><w:spacing w:line="240" w:lineRule="auto"/></w:pPr></w:pPrDefault>',
        '</w:docDefaults>',
      ].join('');
      const normalStyle = [
        '<w:style w:type="paragraph" w:default="1" w:styleId="Normal">',
        '<w:name w:val="Normal"/><w:qFormat/>',
        '</w:style>',
      ].join('');
      return `${XML_HEAD}<w:styles xmlns:w="${NS_W}">${defaults}${normalStyle}</w:styles>`;
    }

    function settingsXml() {
      return `${XML_HEAD}<w:settings xmlns:w="${NS_W}"><w:zoom w:percent="100"/><w:defaultTabStop w:val="420"/><w:characterSpacingControl w:val="compressPunctuation"/><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>`;
    }

    function coreXml(title) {
      const now = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
      return `${XML_HEAD}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xmlEscape(title || '')}</dc:title><dc:creator>DSH Format Studio</dc:creator><cp:lastModifiedBy>DSH Format Studio</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`;
    }

    function appXml(layout) {
      return `${XML_HEAD}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>DSH Format Studio</Application><DocSecurity>0</DocSecurity><Paragraphs>${(layout.paragraphs || []).length}</Paragraphs></Properties>`;
    }

    function contentTypesXml(hasFooter) {
      const overrides = [
        '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>',
        '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>',
        '<Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>',
        hasFooter ? '<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>' : '',
        '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>',
        '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>',
      ].join('');
      return `${XML_HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${overrides}</Types>`;
    }

    function rootRelsXml() {
      return `${XML_HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`;
    }

    function documentRelsXml(hasFooter) {
      const footerRel = hasFooter
        ? '<Relationship Id="rIdFooter1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>'
        : '';
      return `${XML_HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>${footerRel}</Relationships>`;
    }

    /* ------------------------------------------------------------------ ZIP --- */

    const CRC_TABLE = (() => {
      const table = new Uint32Array(256);
      for (let i = 0; i < 256; i += 1) {
        let c = i;
        for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        table[i] = c >>> 0;
      }
      return table;
    })();

    function crc32(bytes) {
      let crc = 0xffffffff;
      for (let i = 0; i < bytes.length; i += 1) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
      return (crc ^ 0xffffffff) >>> 0;
    }

    function encode(text) {
      return new TextEncoder().encode(text);
    }

    /** Build a STORE-method ZIP archive from [{ name, data: Uint8Array }]. */
    function zipStore(files) {
      const encoder = new TextEncoder();
      const now = new Date();
      const dosTime = ((now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2)) & 0xffff;
      const dosDate = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xffff;

      const locals = [];
      const centrals = [];
      let offset = 0;

      for (const file of files) {
        const nameBytes = encoder.encode(file.name);
        const data = file.data;
        const crc = crc32(data);
        const size = data.length;

        const local = new Uint8Array(30 + nameBytes.length);
        const lv = new DataView(local.buffer);
        lv.setUint32(0, 0x04034b50, true);
        lv.setUint16(4, 20, true);
        lv.setUint16(6, 0x0800, true);
        lv.setUint16(8, 0, true);
        lv.setUint16(10, dosTime, true);
        lv.setUint16(12, dosDate, true);
        lv.setUint32(14, crc, true);
        lv.setUint32(18, size, true);
        lv.setUint32(22, size, true);
        lv.setUint16(26, nameBytes.length, true);
        lv.setUint16(28, 0, true);
        local.set(nameBytes, 30);
        locals.push(local, data);

        const central = new Uint8Array(46 + nameBytes.length);
        const cv = new DataView(central.buffer);
        cv.setUint32(0, 0x02014b50, true);
        cv.setUint16(4, 20, true);
        cv.setUint16(6, 20, true);
        cv.setUint16(8, 0x0800, true);
        cv.setUint16(10, 0, true);
        cv.setUint16(12, dosTime, true);
        cv.setUint16(14, dosDate, true);
        cv.setUint32(16, crc, true);
        cv.setUint32(20, size, true);
        cv.setUint32(24, size, true);
        cv.setUint16(28, nameBytes.length, true);
        cv.setUint16(30, 0, true);
        cv.setUint16(32, 0, true);
        cv.setUint16(34, 0, true);
        cv.setUint16(36, 0, true);
        cv.setUint32(38, 0, true);
        cv.setUint32(42, offset, true);
        central.set(nameBytes, 46);
        centrals.push(central);

        offset += local.length + size;
      }

      const centralSize = centrals.reduce((sum, part) => sum + part.length, 0);
      const end = new Uint8Array(22);
      const ev = new DataView(end.buffer);
      ev.setUint32(0, 0x06054b50, true);
      ev.setUint16(4, 0, true);
      ev.setUint16(6, 0, true);
      ev.setUint16(8, files.length, true);
      ev.setUint16(10, files.length, true);
      ev.setUint32(12, centralSize, true);
      ev.setUint32(16, offset, true);
      ev.setUint16(20, 0, true);

      const total = offset + centralSize + end.length;
      const out = new Uint8Array(total);
      let cursor = 0;
      for (const part of locals) {
        out.set(part, cursor);
        cursor += part.length;
      }
      for (const part of centrals) {
        out.set(part, cursor);
        cursor += part.length;
      }
      out.set(end, cursor);
      return out;
    }

    /* --------------------------------------------------------------- public --- */

    /** Render a layout model into .docx bytes. */
    function buildDocx(layout) {
      const hasFooter = Boolean(layout.footer && layout.footer.enabled);
      const files = [
        { name: '[Content_Types].xml', data: encode(contentTypesXml(hasFooter)) },
        { name: '_rels/.rels', data: encode(rootRelsXml()) },
        { name: 'docProps/core.xml', data: encode(coreXml(layout.title)) },
        { name: 'docProps/app.xml', data: encode(appXml(layout)) },
        { name: 'word/document.xml', data: encode(documentXml(layout)) },
        { name: 'word/styles.xml', data: encode(stylesXml(layout)) },
        { name: 'word/settings.xml', data: encode(settingsXml()) },
        { name: 'word/_rels/document.xml.rels', data: encode(documentRelsXml(hasFooter)) },
      ];
      if (hasFooter) files.push({ name: 'word/footer1.xml', data: encode(footerXml(layout.footer)) });
      return zipStore(files);
    }

    /** Approximate the rendered page count for display purposes. */
    function estimatePages(layout) {
      const area = (layout.page.height - layout.page.margin.top - layout.page.margin.bottom) / 20; // points
      let used = 0;
      for (const paragraph of layout.paragraphs || []) {
        const style = paragraph.style;
        const linePt = style.line.rule === 'exact' ? style.line.value / 20 : (style.line.value / 240) * style.font.size * 1.2;
        const lines = Math.max(1, Math.ceil((paragraph.runs || []).reduce((sum, r) => sum + String(r.text || '').length, 0) / 38));
        used += lines * linePt + (style.before || 0) + (style.after || 0);
        if (style.pageBreakBefore) used = area;
      }
      return Math.max(1, Math.ceil(used / area));
    }

    // ---- src/engine.mjs ----
    /**
     * Format Studio - engine facade.
     * Shared by the host half (agent tool) and the browser half (panel).
     */


    /**
     * Format a document: parse, lay out and render .docx bytes.
     * @param {{ text: string, preset?: string, scenario?: string, title?: string }} input
     */
    function formatDocument(input) {
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
    function previewDocument(input) {
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
    function suggestedFileName(presetName, title) {
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


    // ---- src/ui.mjs ----
    /**
     * Format Studio - browser half.
     *
     * A collapsible "排版工作台" bar docked above the composer. Paste text, pick or
     * describe a target format, and generate a .docx entirely in the browser (the
     * same pure engine that powers the agent tool), or hand the request to the
     * agent through the composer.
     */

    function createClientApp(React) {
      const h = React.createElement;
      const useState = React.useState;
      const useMemo = React.useMemo;
      const useCallback = React.useCallback;

      const STYLE_ID = 'dsh-format-studio-style';
      const STORAGE_KEYS = { open: 'dsh.formatStudio.open', preset: 'dsh.formatStudio.preset' };

      const CSS = `
    .dsh-fs { font-size: 12px; color: var(--dsw-alias-label-primary); line-height: 1.5; }
    .dsh-fs * { box-sizing: border-box; }
    .dsh-fs-toggle { display: flex; align-items: center; gap: 8px; width: 100%; padding: 6px 10px; border: 1px solid var(--dsw-alias-border-l1); border-radius: 8px; background: var(--dsw-alias-bg-layer-1); color: inherit; font: inherit; cursor: pointer; text-align: left; }
    .dsh-fs-toggle:hover { border-color: var(--dsw-alias-border-l2); }
    .dsh-fs-toggle-mark { display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; border-radius: 4px; background: var(--dsw-alias-brand-primary); color: #fff; font-size: 11px; font-weight: 600; flex: none; }
    .dsh-fs-toggle-title { font-weight: 600; }
    .dsh-fs-toggle-sub { color: var(--dsw-alias-label-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }
    .dsh-fs-toggle-chev { color: var(--dsw-alias-label-secondary); font-size: 10px; flex: none; }
    .dsh-fs-panel { margin-top: 6px; padding: 12px; border: 1px solid var(--dsw-alias-border-l1); border-radius: 10px; background: var(--dsw-alias-bg-layer-1); display: flex; flex-direction: column; gap: 10px; }
    .dsh-fs-row { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
    .dsh-fs-label { width: 100%; color: var(--dsw-alias-label-secondary); font-weight: 600; }
    .dsh-fs-chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .dsh-fs-chip { padding: 3px 10px; border-radius: 999px; border: 1px solid var(--dsw-alias-border-l1); background: transparent; color: var(--dsw-alias-label-secondary); font: inherit; cursor: pointer; }
    .dsh-fs-chip:hover { border-color: var(--dsw-alias-border-l2); color: var(--dsw-alias-label-primary); }
    .dsh-fs-chip[data-active="true"] { background: var(--dsw-alias-brand-primary); border-color: transparent; color: #fff; }
    .dsh-fs-input, .dsh-fs-textarea { width: 100%; padding: 7px 9px; border: 1px solid var(--dsw-alias-border-l1); border-radius: 8px; background: var(--dsw-alias-bg-base); color: var(--dsw-alias-label-primary); font: inherit; }
    .dsh-fs-input:focus, .dsh-fs-textarea:focus { outline: none; border-color: var(--dsw-alias-brand-primary); }
    .dsh-fs-textarea { min-height: 132px; resize: vertical; line-height: 1.7; }
    .dsh-fs-hint { color: var(--dsw-alias-label-secondary); font-size: 11px; }
    .dsh-fs-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
    .dsh-fs-btn { padding: 5px 12px; border-radius: 6px; border: 1px solid var(--dsw-alias-border-l1); background: transparent; color: var(--dsw-alias-label-primary); font: inherit; cursor: pointer; }
    .dsh-fs-btn:hover { border-color: var(--dsw-alias-border-l2); }
    .dsh-fs-btn[disabled] { opacity: .5; cursor: default; }
    .dsh-fs-btn-primary { background: var(--dsw-alias-brand-primary); border-color: transparent; color: #fff; font-weight: 600; }
    .dsh-fs-btn-primary:hover { filter: brightness(1.05); }
    .dsh-fs-btn-link { border: none; background: none; color: var(--dsw-alias-brand-primary); padding: 2px 4px; }
    .dsh-fs-status { padding: 7px 9px; border-radius: 6px; background: var(--dsw-alias-bg-layer-2); white-space: pre-wrap; word-break: break-word; }
    .dsh-fs-status[data-kind="ok"] { color: var(--dsw-alias-state-success-primary); }
    .dsh-fs-status[data-kind="error"] { color: var(--dsw-alias-state-error-primary); }
    .dsh-fs-status[data-kind="info"] { color: var(--dsw-alias-label-secondary); }
    .dsh-fs-outline { max-height: 150px; overflow: auto; border: 1px solid var(--dsw-alias-border-l1); border-radius: 8px; padding: 6px 8px; display: flex; flex-direction: column; gap: 2px; }
    .dsh-fs-outline-row { display: flex; gap: 6px; align-items: baseline; min-width: 0; }
    .dsh-fs-tag { flex: none; padding: 0 5px; border-radius: 4px; background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-secondary); font-size: 10px; line-height: 16px; }
    .dsh-fs-outline-text { color: var(--dsw-alias-label-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .dsh-fs-meta { display: flex; flex-wrap: wrap; gap: 10px; color: var(--dsw-alias-label-secondary); font-size: 11px; }
    `;

      function readStored(key, fallback) {
        try {
          const value = window.localStorage.getItem(key);
          return value === null ? fallback : value;
        } catch {
          return fallback;
        }
      }

      function store(key, value) {
        try {
          window.localStorage.setItem(key, String(value));
        } catch {
          /* storage may be unavailable */
        }
      }

      const PRESET_OPTIONS = [{ id: 'auto', name: '自动匹配场景', short: '自动' }]
        .concat(PRESETS.map((preset) => ({ id: preset.id, name: preset.name, short: preset.short })));

      const SAMPLE = [
        '关于开展2026年度安全生产大检查的通知',
        '',
        '各区县人民政府，市政府各部门：',
        '',
        '为深入贯彻落实上级关于安全生产工作的决策部署，切实加强岁末年初安全防范工作，经市政府同意，决定于2026年1月至3月在全市范围内开展安全生产大检查。现将有关事项通知如下。',
        '',
        '一、检查范围',
        '',
        '全市所有生产经营单位，重点是危险化学品、建筑施工、交通运输、消防安全、城镇燃气等行业领域。',
        '',
        '（一）危险化学品领域',
        '',
        '重点检查重大危险源监测监控、特殊作业审批、应急预案演练等情况。',
        '',
        '（二）建筑施工领域',
        '',
        '重点检查深基坑、高支模、起重机械等危险性较大的分部分项工程安全管理情况。',
        '',
        '二、工作要求',
        '',
        '（一）加强组织领导。各区县、各部门要成立相应工作机构，主要负责同志亲自部署、亲自督办。',
        '',
        '（二）严格执法检查。对发现的重大隐患要挂牌督办，对违法违规行为要依法严惩。',
        '',
        '（三）强化宣传引导。充分利用各类媒体，广泛宣传安全生产法律法规和应急知识。',
        '',
        '请各区县、各部门于2026年3月31日前将检查情况书面报市应急管理局。',
        '',
        'XX市人民政府',
        '',
        '2025年12月20日',
      ].join('\n');

      /** Plain-text rendering of the layout, for the clipboard path. */
      function toPlainText(layout) {
        const lines = [];
        for (const paragraph of layout.paragraphs) {
          if (!paragraph.runs || paragraph.runs.length === 0) {
            lines.push('');
            continue;
          }
          const text = paragraph.runs.map((run) => run.text).join('');
          const indent = paragraph.style.firstLineChars >= 2 ? '\u3000\u3000' : '';
          lines.push(indent + text);
        }
        return lines.join('\n').replace(/\n{3,}/g, '\n\n');
      }

      function triggerDownload(bytes, fileName) {
        const blob = new Blob([bytes], {
          type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = fileName;
        anchor.rel = 'noopener';
        anchor.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 5000);
        return blob;
      }

      function fillComposer(inputActions, text) {
        if (!inputActions || typeof inputActions !== 'object') return null;
        const candidates = ['setText', 'replaceText', 'setValue', 'setInput', 'updateText', 'insertText', 'appendText', 'setDraft'];
        for (const name of candidates) {
          const fn = inputActions[name];
          if (typeof fn === 'function') {
            try {
              fn(text);
              return name;
            } catch {
              /* try the next candidate */
            }
          }
        }
        return null;
      }

      function copyText(text) {
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
          return navigator.clipboard.writeText(text).then(() => true).catch(() => false);
        }
        return Promise.resolve(false);
      }

      function outlineRows(blocks) {
        const labels = {
          title: '标题', subtitle: '副标题', author: '作者', affiliation: '单位', docnum: '文号',
          addressee: '主送', abstract: '摘要', keywords: '关键词', h1: '一级', h2: '二级',
          h3: '三级', h4: '四级', body: '正文', list: '条目', quote: '引文',
          refHeading: '参考', ref: '文献', signature: '落款', date: '日期', note: '注释',
        };
        return blocks.map((block) => ({
          kind: block.kind,
          label: labels[block.kind] || block.kind,
          text: String(block.text || '').replace(/\s+/g, ' ').slice(0, 80),
        }));
      }

      function FormatStudio(props) {
        const inputActions = props && props.inputActions;
        const [open, setOpen] = useState(() => readStored(STORAGE_KEYS.open, '0') === '1');
        const [preset, setPreset] = useState(() => readStored(STORAGE_KEYS.preset, 'auto'));
        const [scenario, setScenario] = useState('');
        const [title, setTitle] = useState('');
        const [text, setText] = useState('');
        const [status, setStatus] = useState(null);
        const [showOutline, setShowOutline] = useState(false);

        const preview = useMemo(() => {
          if (text.trim().length === 0) return null;
          try {
            return previewDocument({ text, preset, scenario });
          } catch (error) {
            return { error: String((error && error.message) || error) };
          }
        }, [text, preset, scenario]);

        const toggleOpen = useCallback(() => {
          setOpen((value) => {
            store(STORAGE_KEYS.open, value ? '0' : '1');
            return !value;
          });
        }, []);

        const choosePreset = useCallback((id) => {
          setPreset(id);
          store(STORAGE_KEYS.preset, id);
        }, []);

        const currentPresetName = preview && preview.presetName ? preview.presetName : '自动匹配';
        const characters = Array.from(text).length;

        const onGenerate = useCallback(async () => {
          if (text.trim().length === 0) {
            setStatus({ kind: 'error', message: '请先粘贴需要整理格式的全文。' });
            return;
          }
          try {
            const result = formatDocument({ text, preset, scenario, title });
            const fileName = suggestedFileName(result.presetName, result.layout.title);
            triggerDownload(result.bytes, fileName);
            const counts = result.stats;
            setStatus({
              kind: 'ok',
              message:
                `已生成 ${fileName}\n格式：${result.presetName}（${result.matched ? result.reason : '手动指定'}）` +
                `｜段落 ${counts.paragraphs} 个｜标题 ${counts.headings} 个｜约 ${result.pages} 页\n` +
                '文件已开始下载，打开后即为排版好的 Word 文档。',
            });
          } catch (error) {
            setStatus({ kind: 'error', message: `生成失败：${String((error && error.message) || error)}` });
          }
        }, [text, preset, scenario, title]);

        const onCopyText = useCallback(async () => {
          if (text.trim().length === 0) {
            setStatus({ kind: 'error', message: '请先粘贴需要整理格式的全文。' });
            return;
          }
          try {
            const result = formatDocument({ text, preset, scenario, title });
            const ok = await copyText(toPlainText(result.layout));
            setStatus(ok
              ? { kind: 'ok', message: '已复制整理后的纯文本（含首行缩进），可直接粘贴到任意编辑器。' }
              : { kind: 'error', message: '浏览器拒绝了剪贴板访问，请改用「生成 Word 文档」。' });
          } catch (error) {
            setStatus({ kind: 'error', message: `生成失败：${String((error && error.message) || error)}` });
          }
        }, [text, preset, scenario, title]);

        const onHandToAgent = useCallback(async () => {
          if (text.trim().length === 0) {
            setStatus({ kind: 'error', message: '请先粘贴需要整理格式的全文。' });
            return;
          }
          const presetLine = preset === 'auto'
            ? `目标格式：按应用场景自动匹配${scenario ? `（场景：${scenario}）` : ''}`
            : `目标格式：${currentPresetName}（preset="${preset}"）`;
          const prompt = [
            '请用 format_document 工具把下面这段全文整理成标准版式的 Word 文档，并保存到当前工作目录。',
            presetLine,
            '要求：只调整结构与版式（标题层级、字体字号、行距、缩进、对齐、页码、落款位置），不要改写、删减或摘要正文内容。完成后告诉我生成的文件路径。',
            '',
            '===== 原文开始 =====',
            text,
            '===== 原文结束 =====',
          ].join('\n');
          const used = fillComposer(inputActions, prompt);
          if (used) {
            setStatus({ kind: 'ok', message: '已把排版指令填入输入框，确认后发送即可由 AI 生成 Word 文档。' });
            return;
          }
          const ok = await copyText(prompt);
          setStatus(ok
            ? { kind: 'ok', message: '当前界面不支持直接填充输入框，排版指令已复制到剪贴板，请粘贴后发送。' }
            : { kind: 'error', message: '无法填充输入框，也无法写入剪贴板，请直接对我说「把这段文字改成公文格式」。' });
        }, [text, preset, scenario, title, currentPresetName, inputActions]);

        const children = [];

        children.push(h('style', { key: 'style', dangerouslySetInnerHTML: { __html: CSS } }));
        children.push(h('button', {
          key: 'toggle',
          type: 'button',
          className: 'dsh-fs-toggle',
          onClick: toggleOpen,
          title: '排版工作台：粘贴全文，一键整理成论文/公文/总结等标准格式',
        },
        h('span', { className: 'dsh-fs-toggle-mark' }, '排'),
        h('span', { className: 'dsh-fs-toggle-title' }, '排版工作台'),
        h('span', { className: 'dsh-fs-toggle-sub' },
          text.trim().length > 0
            ? `${currentPresetName} · ${characters} 字`
            : '粘贴全文 → 选格式 → 一键生成 Word'),
        h('span', { className: 'dsh-fs-toggle-chev' }, open ? '▲' : '▼')));

        if (open) {
          const panel = [];

          panel.push(h('div', { key: 'presets', className: 'dsh-fs-row' },
            h('span', { className: 'dsh-fs-label' }, '目标格式'),
            h('div', { className: 'dsh-fs-chips' },
              PRESET_OPTIONS.map((option) => h('button', {
                key: option.id,
                type: 'button',
                className: 'dsh-fs-chip',
                'data-active': String(option.id === preset),
                onClick: () => choosePreset(option.id),
              }, option.name)))));

          panel.push(h('input', {
            key: 'scenario',
            className: 'dsh-fs-input',
            value: scenario,
            placeholder: '应用场景（可留空）：例如「给市政府的请示」「硕士毕业论文」「企业年度工作总结」「公众号新闻稿」',
            onChange: (event) => setScenario(event.target.value),
          }));

          panel.push(h('input', {
            key: 'title',
            className: 'dsh-fs-input',
            value: title,
            placeholder: '文档标题（可留空，默认使用正文中识别到的标题）',
            onChange: (event) => setTitle(event.target.value),
          }));

          panel.push(h('textarea', {
            key: 'text',
            className: 'dsh-fs-textarea',
            value: text,
            placeholder: '在此粘贴全文（Ctrl+V）。支持：标题、副标题、作者、摘要、关键词、一、/（一）/1./（1）/第X章 等各级标题、主送机关、落款与成文日期。\n也可以用 # / ## / ### 手动标记标题层级。',
            onChange: (event) => setText(event.target.value),
            spellCheck: false,
          }));

          panel.push(h('div', { key: 'meta', className: 'dsh-fs-row' },
            h('span', { className: 'dsh-fs-hint' },
              characters > 0
                ? `${characters} 字符${preview && preview.presetName ? ` · 将按「${preview.presetName}」排版` : ''}${preview && preview.matched === false ? ' · 未识别场景，用通用格式' : ''}`
                : '支持整篇粘贴，不会改动任何文字内容。'),
            h('span', { className: 'dsh-fs-hint', style: { flex: 1 } }),
            h('button', { type: 'button', className: 'dsh-fs-btn dsh-fs-btn-link', onClick: () => { setText(SAMPLE); setPreset('gov'); store(STORAGE_KEYS.preset, 'gov'); setStatus(null); } }, '填入示例'),
            h('button', { type: 'button', className: 'dsh-fs-btn dsh-fs-btn-link', onClick: () => { setText(''); setStatus(null); } }, '清空')));

          panel.push(h('div', { key: 'actions', className: 'dsh-fs-actions' },
            h('button', { type: 'button', className: 'dsh-fs-btn dsh-fs-btn-primary', onClick: onGenerate }, '生成 Word 文档'),
            h('button', { type: 'button', className: 'dsh-fs-btn', onClick: onCopyText }, '复制排版文本'),
            h('button', { type: 'button', className: 'dsh-fs-btn', onClick: onHandToAgent }, '交给 AI 整理'),
            h('span', { className: 'dsh-fs-hint', style: { flex: 1 } }),
            preview && preview.outline
              ? h('button', { type: 'button', className: 'dsh-fs-btn dsh-fs-btn-link', onClick: () => setShowOutline((v) => !v) },
                showOutline ? '收起结构' : `查看识别结构（${preview.outline.length}）`)
              : null));

          if (status) {
            panel.push(h('div', { key: 'status', className: 'dsh-fs-status', 'data-kind': status.kind }, status.message));
          }

          if (preview && preview.error) {
            panel.push(h('div', { key: 'perror', className: 'dsh-fs-status', 'data-kind': 'error' }, preview.error));
          }

          if (showOutline && preview && preview.outline) {
            panel.push(h('div', { key: 'outline', className: 'dsh-fs-outline' },
              preview.outline.map((row, index) => h('div', { key: `row-${index}`, className: 'dsh-fs-outline-row' },
                h('span', { className: 'dsh-fs-tag' }, row.label),
                h('span', { className: 'dsh-fs-outline-text' }, row.text)))));
          }

          const summary = preview && preview.presetSummary ? preview.presetSummary : null;
          if (summary) {
            panel.push(h('div', { key: 'summary', className: 'dsh-fs-meta' }, `版式说明：${summary}`));
          }

          children.push(h('div', { key: 'panel', className: 'dsh-fs-panel' }, panel));
        }

        return h('div', { className: 'dsh-fs' }, children);
      }

      return {
        inject: ['slots'],
        apply(ctx) {
          ctx.slots.inject('conversation.input.dock', () =>
            ctx.slots.register(
              { name: 'conversation.input.dock', id: 'format-studio', order: 30 },
              FormatStudio,
            ));
        },
      };
    }

    return createClientApp(React);
  },
});
