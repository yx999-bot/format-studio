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
export function xmlEscape(value) {
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
export function zipStore(files) {
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
export function buildDocx(layout) {
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
export function estimatePages(layout) {
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
