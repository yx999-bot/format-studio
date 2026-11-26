/**
 * 标点规范化单元测试。
 *
 *   node test/punctuation.test.mjs
 */

import { normalizePunctuation } from '../src/punctuation.mjs';

const cases = [
  // [输入, 期望输出, 说明]
  ['你好,世界.', '你好，世界。', '句内逗号与句末句号'],
  ['他说:"可以",然后走了.', '他说：“可以”，然后走了。', '冒号与成对引号'],
  ['这是 "重点" 内容.', '这是 “重点” 内容。', '引号成对'],
  ['详见 https://example.com/a?b=1, 或 www.test.com.', '详见 https://example.com/a?b=1，或 www.test.com。', '网址保护'],
  ['邮箱 test@example.com, 密码别写.', '邮箱 test@example.com，密码别写。', '邮箱保护'],
  ['版本 1.2, 占比 3.5%.', '版本 1.2，占比 3.5%。', '数字上下文不转换小数点'],
  ['时间 12:30 出发, 请准时.', '时间 12:30 出发，请准时。', '时间不转换冒号'],
  ['1. 第一条, 内容.', '1. 第一条，内容。', '行首编号保护'],
  ['（1）第一条, 内容.', '（1）第一条，内容。', '全角编号保护'],
  ['见[1], 以及[2-3].', '见[1]，以及[2-3]。', '引用标记保护'],
  ['A, B and C.', 'A, B and C.', '英文句子不动'],
  ['等等...', '等等……', '省略号'],
  ['他说--然后走了', '他说——然后走了', '破折号'],
  ['(见附件)', '（见附件）', '括号'],
  ['这是‘重点’; 也是重点.', '这是‘重点’；也是重点。', '单引号与分号'],
  ['中文(English)混排, 保持.', '中文（English）混排，保持。', '中英混排'],
  ['他说:\n"第二段"\n结束.', '他说：\n“第二段”\n结束。', '跨行引号重置'],
];

let failed = 0;
for (const [input, expected, note] of cases) {
  const { text, changes } = normalizePunctuation(input);
  const ok = text === expected;
  if (!ok) {
    failed += 1;
    console.log('FAIL  ' + note);
    console.log('  in       : ' + JSON.stringify(input));
    console.log('  expected : ' + JSON.stringify(expected));
    console.log('  actual   : ' + JSON.stringify(text) + '  (changes=' + changes + ')');
  } else {
    console.log('ok    ' + note);
  }
}

console.log('');
if (failed > 0) {
  console.log(failed + ' case(s) failed');
  process.exitCode = 1;
} else {
  console.log('all ' + cases.length + ' cases passed');
}
