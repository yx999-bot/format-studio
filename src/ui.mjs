/**
 * Format Studio - browser half.
 *
 * A collapsible "排版工作台" bar docked above the composer. Paste text, pick or
 * describe a target format, and generate a .docx entirely in the browser (the
 * same pure engine that powers the agent tool), or hand the request to the
 * agent through the composer.
 */

export function createClientApp(React) {
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
