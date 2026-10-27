/**
 * Offline validation for the Format Studio engine.
 *
 * Generates one .docx per preset from realistic Chinese source text, then
 * reports the detected structure so the layout can be inspected (and rendered
 * with LibreOffice or opened with python-docx).
 *
 *   node test/validate.mjs
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatDocument, previewDocument, PRESETS } from '../src/engine.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const outDir = join(root, 'test', 'out');
mkdirSync(outDir, { recursive: true });

const GOV_SAMPLE = [
  '关于开展2026年度安全生产大检查的通知',
  '',
  'XX府发〔2025〕18号',
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
  '（一）加强组织领导。各区县、各部门要成立相应工作机构，主要负责同志亲自部署、亲自督办，确保检查工作落到实处。',
  '',
  '（二）严格执法检查。对发现的重大隐患要挂牌督办，对违法违规行为要依法严惩，坚决防止重特大事故发生。',
  '',
  '（三）强化宣传引导。充分利用各类媒体，广泛宣传安全生产法律法规和应急知识，营造全社会关注安全的良好氛围。',
  '',
  '请各区县、各部门于2026年3月31日前将检查情况书面报市应急管理局。',
  '',
  'XX市人民政府',
  '',
  '2025年12月20日',
].join('\n');

const PAPER_SAMPLE = [
  '基于注意力机制的中文短文本分类方法研究',
  '',
  '张三，李四',
  '',
  'XX大学计算机科学与技术学院，北京 100084',
  '',
  '摘要：针对中文短文本特征稀疏、语义依赖性强的问题，提出一种融合字词双粒度注意力机制的分类模型。实验在三个公开数据集上进行，准确率较基线模型提升3.2个百分点，验证了方法的有效性。',
  '',
  '关键词：短文本分类；注意力机制；预训练语言模型；深度学习',
  '',
  '一、引言',
  '',
  '随着移动互联网的快速发展，短文本数据在社交媒体、电商评论等场景中大量涌现。短文本具有长度短、特征稀疏、表达不规范等特点，给传统文本分类方法带来了挑战。',
  '',
  '（一）研究背景',
  '',
  '近年来，预训练语言模型在自然语言处理领域取得了显著进展，为短文本分类提供了新的思路。',
  '',
  '二、相关工作',
  '',
  '已有研究主要从特征扩展和模型结构两个方向改进短文本分类性能。',
  '',
  '1. 特征扩展方法',
  '',
  '通过引入外部知识库或搜索日志对短文本进行特征扩展，可以缓解特征稀疏问题。',
  '',
  '三、结论',
  '',
  '本文提出的双粒度注意力模型在多个数据集上取得了优于基线的效果，后续将进一步研究跨领域迁移问题。',
  '',
  '参考文献',
  '',
  '[1] 王某. 中文短文本分类研究综述[J]. 中文信息学报, 2023, 37(4): 1-12.',
  '',
  '[2] 李某, 赵某. 基于预训练模型的文本分类[J]. 计算机学报, 2024, 47(2): 233-245.',
].join('\n');

const REPORT_SAMPLE = [
  '2025年度安全生产工作总结',
  '',
  '一、总体情况',
  '',
  '2025年，全市安全生产形势总体平稳，全年共发生各类生产安全事故12起，同比下降18.6%，未发生重特大事故。',
  '',
  '（一）责任体系不断健全',
  '',
  '严格落实党政领导责任、部门监管责任和企业主体责任，层层签订目标责任书，形成齐抓共管的工作格局。',
  '',
  '（二）专项整治成效明显',
  '',
  '围绕危险化学品、城镇燃气、建筑施工等重点领域开展专项整治，排查隐患3400余项，整改率98.7%。',
  '',
  '二、存在问题',
  '',
  '部分中小企业安全投入不足，从业人员安全意识有待提高，基层监管力量相对薄弱。',
  '',
  '三、下一步工作',
  '',
  '持续深化重点行业领域专项整治，加强安全教育培训，完善应急管理体系，坚决守住安全底线。',
  '',
  'XX市应急管理局',
  '',
  '2025年12月28日',
].join('\n');

const SAMPLES = {
  gov: GOV_SAMPLE,
  report: REPORT_SAMPLE,
  paper: PAPER_SAMPLE,
  thesis: PAPER_SAMPLE,
  news: PAPER_SAMPLE,
  business: PAPER_SAMPLE,
  letter: GOV_SAMPLE,
  resume: PAPER_SAMPLE,
};

const results = [];
let failures = 0;

for (const preset of PRESETS) {
  const text = SAMPLES[preset.id] || PAPER_SAMPLE;
  const preview = previewDocument({ text, preset: preset.id });
  let outcome;
  try {
    const result = formatDocument({ text, preset: preset.id });
    const fileName = `${preset.id}.docx`;
    writeFileSync(join(outDir, fileName), result.bytes);
    const counts = {};
    for (const block of result.blocks) counts[block.kind] = (counts[block.kind] || 0) + 1;
    outcome = {
      preset: preset.id,
      presetName: preset.name,
      file: join(outDir, fileName),
      bytes: result.bytes.length,
      pages: result.pages,
      paragraphs: result.stats.paragraphs,
      headings: result.stats.headings,
      characters: result.stats.characters,
      counts,
      firstKinds: preview.outline.slice(0, 12).map((row) => `${row.label}:${row.text.slice(0, 14)}`),
    };
  } catch (error) {
    failures += 1;
    outcome = { preset: preset.id, error: String((error && error.stack) || error) };
  }
  results.push(outcome);
}

writeFileSync(join(outDir, 'report.json'), JSON.stringify(results, null, 2), 'utf8');
process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
if (failures > 0) {
  process.stderr.write(`\n${failures} preset(s) failed\n`);
  process.exitCode = 1;
}
