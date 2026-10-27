using System;
using System.Collections.Generic;
using System.Text;
using System.Text.RegularExpressions;

namespace FormatStudio
{
    internal sealed class ParseResult
    {
        public List<Block> Blocks = new List<Block>();
        public int ParagraphCount;
        public int CharacterCount;
        public int HeadingCount;
        public bool HasTitle;
    }

    /// <summary>Text parser, ported 1:1 from the browser engine's parser module.</summary>
    internal static class Parser
    {
        private const RegexOptions O = RegexOptions.Compiled;

        private static readonly Regex Cjk = new Regex(@"[\u3000-\u303f\u3400-\u4dbf\u4e00-\u9fff\uff00-\uffef]", O);
        private static readonly Regex MdHeading = new Regex(@"^(#{1,6})\s+(.*\S)\s*$", O);
        private static readonly Regex PageBreak = new Regex(@"^([-*_]\s*){3,}$", O);
        private static readonly Regex AbstractLine = new Regex(@"^(?:\[?\s*(?:内容)?摘\s*要\s*\]?\s*[:：]?|abstract\s*[:：]?)\s*(.*)$", O | RegexOptions.IgnoreCase);
        private static readonly Regex KeywordsLine = new Regex(@"^(?:\[?\s*关\s*键\s*词\s*\]?\s*[:：]?|key\s*words?\s*[:：]?)\s*(.*)$", O | RegexOptions.IgnoreCase);
        private static readonly Regex RefHeading = new Regex(@"^(?:\[?\s*参\s*考\s*文\s*献\s*\]?\s*|references?\s*[:：]?)\s*(.*)$", O | RegexOptions.IgnoreCase);
        private static readonly Regex DocNum = new Regex(@"〔\s*\d{4}\s*〕\s*\d+\s*号", O);
        private static readonly Regex H1 = new Regex(@"^([一二三四五六七八九十百]{1,3})\s*[、.．]\s*(.*)$", O);
        private static readonly Regex H2 = new Regex(@"^[（(]\s*([一二三四五六七八九十百]{1,3})\s*[)）]\s*(.*)$", O);
        private static readonly Regex H3 = new Regex(@"^(\d{1,2})\s*[、.．]\s*(.+)$", O);
        private static readonly Regex H4 = new Regex(@"^[（(]\s*(\d{1,2})\s*[)）]\s*(.+)$", O);
        private static readonly Regex Chapter = new Regex(@"^第\s*([一二三四五六七八九十百零〇\d]{1,3})\s*[章节篇部分]\s*(.*)$", O);
        private static readonly Regex RefItem = new Regex(@"^\[\s*(\d{1,3})\s*\]\s*(.*)$", O);
        private static readonly Regex DateLine = new Regex(@"^[（(]?\s*(?:[〇零一二三四五六七八九十]{2,4}|\d{4})\s*年\s*(?:[〇零一二三四五六七八九十]{1,2}|\d{1,2})\s*月\s*(?:[〇零一二三四五六七八九十]{1,2}|\d{1,2})\s*日?\s*[）)]?$", O);
        private static readonly Regex OrgEnd = new Regex(@"(?:委员会|人民政府|政府|局|厅|部|委|办公室|公司|集团|学校|学院|大学|研究院|中心|协会|学会|街道|镇|乡|县|市|区)$", O);
        private static readonly Regex AuthorLine = new Regex(@"^[\u4e00-\u9fff·]{2,4}(?:\s*[，,、]\s*[\u4e00-\u9fff·]{2,4}){0,6}$", O);
        private static readonly Regex EndingPunct = new Regex(@"[。！？；：!?;:…]$", O);
        private static readonly Regex Bullet = new Regex(@"^[-*•·]\s+(.*)$", O);
        private static readonly Regex SentenceEnd = new Regex(@"[。！？；：!?;:”""』」）)】.]$", O);
        private static readonly Regex ZeroWidth = new Regex(@"[\u200b\u200c\u200d\ufeff]", O);

        private static bool IsCjkBoundary(char ch)
        {
            return Cjk.IsMatch(ch.ToString());
        }

        private static string JoinLines(string prev, string next)
        {
            if (prev.Length == 0) return next;
            if (prev.EndsWith("-", StringComparison.Ordinal)) return prev.Substring(0, prev.Length - 1) + next;
            char a = prev[prev.Length - 1];
            char b = next.Length > 0 ? next[0] : '\0';
            if (IsCjkBoundary(a) || IsCjkBoundary(b)) return prev + next;
            return prev + " " + next;
        }

        private static bool EndsSentence(string line)
        {
            if (SentenceEnd.IsMatch(line)) return true;
            if (MdHeading.IsMatch(line)) return true;
            if (Regex.IsMatch(line, @"^[（(]?[一二三四五六七八九十\d]+[、.．)）]")) return true;
            return false;
        }

        private static string CleanLine(string line)
        {
            string cleaned = ZeroWidth.Replace(line, "");
            return cleaned.TrimEnd(' ', '\t').TrimStart('\t');
        }

        private static List<string> ToParagraphs(string raw)
        {
            string text = (raw ?? "").Replace("\r\n", "\n").Replace("\r", "\n");
            text = Regex.Replace(text, @"```[a-zA-Z]*\n?", "");
            string[] lines = text.Split('\n');
            List<string> result = new List<string>();
            StringBuilder current = new StringBuilder();
            bool blank = true;

            for (int i = 0; i < lines.Length; i++)
            {
                string line = CleanLine(lines[i]);
                if (line.Trim().Length == 0)
                {
                    if (current.ToString().Trim().Length > 0) result.Add(current.ToString().Trim());
                    current.Length = 0;
                    blank = true;
                    continue;
                }
                bool structural = MdHeading.IsMatch(line) || PageBreak.IsMatch(line) || Bullet.IsMatch(line)
                    || AbstractLine.IsMatch(line) || KeywordsLine.IsMatch(line) || RefHeading.IsMatch(line) || RefItem.IsMatch(line);
                if (structural)
                {
                    if (current.ToString().Trim().Length > 0) result.Add(current.ToString().Trim());
                    current.Length = 0;
                    result.Add(line.Trim());
                    blank = true;
                    continue;
                }
                if (current.Length == 0)
                {
                    current.Append(line);
                    blank = false;
                    continue;
                }
                string existing = current.ToString();
                if (EndsSentence(existing) && !blank)
                {
                    result.Add(existing.Trim());
                    current.Length = 0;
                    current.Append(line);
                }
                else
                {
                    current.Length = 0;
                    current.Append(JoinLines(existing, line));
                }
                blank = false;
            }
            if (current.ToString().Trim().Length > 0) result.Add(current.ToString().Trim());
            return result;
        }

        private static int CountCjk(string text)
        {
            int n = 0;
            foreach (char ch in text) if (Cjk.IsMatch(ch.ToString())) n++;
            return n;
        }

        private static bool LooksLikeHeading(string text, string next)
        {
            if (text.Length > 14) return false;
            if (Regex.IsMatch(text, @"[，。；：、！？“”""''()（）\[\]【】《》0-9]")) return false;
            if (next.Length == 0 || !Regex.IsMatch(next, @"[。！？]")) return false;
            if (Regex.IsMatch(text, @"[了的吗呢吧啊]$")) return false;
            if (CountCjk(text) < 2) return false;
            if (text.Length <= 3) return false;
            return true;
        }

        private static string FirstGroupOrEmpty(Match match)
        {
            return match.Groups.Count > 1 ? match.Groups[1].Value : "";
        }

        private static bool OnlyStructural(List<Block> blocks)
        {
            for (int i = 0; i < blocks.Count; i++)
            {
                string kind = blocks[i].Kind;
                if (kind != "docnum" && kind != "pagebreak") return false;
            }
            return true;
        }

        private static string NumberedKind(string para)
        {
            if (Chapter.IsMatch(para)) return "h1";
            if (H1.IsMatch(para)) return "h1";
            if (H2.IsMatch(para)) return "h2";
            if (H4.IsMatch(para)) return "h4";
            if (H3.IsMatch(para) && para.Length <= 60) return "h3";
            return null;
        }

        public static ParseResult Parse(string raw)
        {
            List<string> paragraphs = ToParagraphs(raw);
            ParseResult result = new ParseResult();
            List<Block> blocks = result.Blocks;
            int total = paragraphs.Count;
            bool sawTitle = false;
            bool sawAbstract = false;
            bool sawKeywords = false;
            bool refMode = false;
            const int InlineHeadingMax = 40;

            for (int i = 0; i < total; i++)
            {
                string para = paragraphs[i];
                string next = i + 1 < total ? paragraphs[i + 1] : "";

                if (PageBreak.IsMatch(para))
                {
                    Block pb = new Block();
                    pb.Kind = "pagebreak";
                    pb.Text = "";
                    blocks.Add(pb);
                    continue;
                }

                Match md = MdHeading.Match(para);
                if (md.Success)
                {
                    int level = Math.Min(md.Groups[1].Value.Length, 4);
                    Block block = new Block();
                    block.Kind = (level == 1 && !sawTitle) ? "title" : ("h" + level);
                    block.Text = md.Groups[2].Value;
                    blocks.Add(block);
                    if (level == 1) sawTitle = true;
                    continue;
                }

                if (refMode)
                {
                    Match item = RefItem.Match(para);
                    Block block = new Block();
                    block.Kind = "ref";
                    block.Text = item.Success ? ("[" + item.Groups[1].Value + "] " + item.Groups[2].Value) : para;
                    blocks.Add(block);
                    continue;
                }

                Match refHeading = RefHeading.Match(para);
                if (refHeading.Success && Regex.Replace(para, @"\s", "").Length <= 12)
                {
                    Block block = new Block();
                    block.Kind = "refHeading";
                    block.Text = "参考文献";
                    blocks.Add(block);
                    refMode = true;
                    continue;
                }

                Match abs = AbstractLine.Match(para);
                if (abs.Success && !sawAbstract)
                {
                    string rest = FirstGroupOrEmpty(abs);
                    Block block = new Block();
                    block.Kind = "abstract";
                    block.Text = rest.Length > 0 ? rest : para;
                    block.Label = Regex.IsMatch(para, "abstract", RegexOptions.IgnoreCase) ? "Abstract:" : "摘要：";
                    blocks.Add(block);
                    sawAbstract = true;
                    continue;
                }

                Match kw = KeywordsLine.Match(para);
                if (kw.Success && !sawKeywords && FirstGroupOrEmpty(kw).Length > 0)
                {
                    Block block = new Block();
                    block.Kind = "keywords";
                    block.Text = FirstGroupOrEmpty(kw);
                    block.Label = Regex.IsMatch(para, "^key", RegexOptions.IgnoreCase) ? "Key words:" : "关键词：";
                    blocks.Add(block);
                    sawKeywords = true;
                    continue;
                }

                if (DocNum.IsMatch(para) && Regex.Replace(para, @"\s", "").Length <= 30)
                {
                    Block block = new Block();
                    block.Kind = "docnum";
                    block.Text = para;
                    blocks.Add(block);
                    continue;
                }

                string numbered = NumberedKind(para);
                if (numbered != null)
                {
                    if (para.Length <= InlineHeadingMax)
                    {
                        Block block = new Block();
                        block.Kind = numbered;
                        block.Text = para;
                        blocks.Add(block);
                        if (numbered == "h1" && !sawTitle) sawTitle = true;
                    }
                    else
                    {
                        Block block = new Block();
                        block.Kind = "body";
                        block.Text = para;
                        blocks.Add(block);
                    }
                    continue;
                }

                int remaining = total - i;
                string trimmed = para.Trim();
                if (remaining <= 3 && DateLine.IsMatch(trimmed))
                {
                    Block block = new Block();
                    block.Kind = "date";
                    block.Text = trimmed;
                    blocks.Add(block);
                    continue;
                }
                if (remaining <= 4 && trimmed.Length <= 30 && OrgEnd.IsMatch(trimmed) && !Regex.IsMatch(trimmed, @"[，。；：]"))
                {
                    Block block = new Block();
                    block.Kind = "signature";
                    block.Text = trimmed;
                    blocks.Add(block);
                    continue;
                }

                if (!sawTitle && OnlyStructural(blocks))
                {
                    if (trimmed.Length <= 60 && !EndingPunct.IsMatch(trimmed))
                    {
                        Block block = new Block();
                        block.Kind = "title";
                        block.Text = trimmed;
                        blocks.Add(block);
                        sawTitle = true;
                        continue;
                    }
                }

                if (sawTitle && blocks.Count > 0)
                {
                    Block prev = blocks[blocks.Count - 1];
                    if ((prev.Kind == "title" || prev.Kind == "subtitle") && AuthorLine.IsMatch(trimmed) && para.Length <= 30)
                    {
                        Block block = new Block();
                        block.Kind = "author";
                        block.Text = trimmed;
                        blocks.Add(block);
                        continue;
                    }
                    if (prev.Kind == "author" && Regex.IsMatch(para, @"(大学|学院|学校|研究所|研究院|公司|医院|中心|实验室)") && para.Length <= 60)
                    {
                        Block block = new Block();
                        block.Kind = "affiliation";
                        block.Text = trimmed;
                        blocks.Add(block);
                        continue;
                    }
                }

                if (Regex.IsMatch(para, @"[：:]$") && para.Length <= 40 && !Regex.IsMatch(para, @"^[（(]?\d"))
                {
                    Block block = new Block();
                    block.Kind = "addressee";
                    block.Text = para;
                    blocks.Add(block);
                    continue;
                }

                Match bullet = Bullet.Match(para);
                if (bullet.Success)
                {
                    Block block = new Block();
                    block.Kind = "list";
                    block.Text = "· " + bullet.Groups[1].Value;
                    blocks.Add(block);
                    continue;
                }

                if (Regex.IsMatch(para, @"^[>＞]"))
                {
                    Block block = new Block();
                    block.Kind = "quote";
                    block.Text = Regex.Replace(para, @"^[>＞]\s*", "");
                    blocks.Add(block);
                    continue;
                }

                if (LooksLikeHeading(para, next))
                {
                    Block block = new Block();
                    block.Kind = "h2";
                    block.Text = para;
                    blocks.Add(block);
                    continue;
                }

                Block body = new Block();
                body.Kind = "body";
                body.Text = para;
                blocks.Add(body);
            }

            List<Block> filtered = new List<Block>();
            for (int i = 0; i < blocks.Count; i++)
            {
                Block block = blocks[i];
                if (block.Kind == "pagebreak" || block.Text.Trim().Length > 0) filtered.Add(block);
            }
            result.Blocks = filtered;

            result.ParagraphCount = 0;
            for (int i = 0; i < filtered.Count; i++)
            {
                if (filtered[i].Kind == "pagebreak") continue;
                result.ParagraphCount++;
                if (filtered[i].Kind.Length == 2 && filtered[i].Kind[0] == 'h') result.HeadingCount++;
                if (filtered[i].Kind == "title") result.HasTitle = true;
            }
            result.CharacterCount = (raw ?? "").Length;
            return result;
        }
    }
}
