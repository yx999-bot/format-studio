using System;
using System.Collections.Generic;
using System.Text;
using System.Text.RegularExpressions;

namespace FormatStudio
{
    /// <summary>Layout assembly, ported from the browser engine's layout module.</summary>
    internal static class Layouter
    {
        private static readonly HashSet<string> BodyOnly = new HashSet<string> { "body", "list", "quote", "ref", "note" };

        public static LayoutDoc Build(string text, Preset preset, string titleOverride)
        {
            return BuildFrom(Parser.Parse(text), preset, titleOverride);
        }

        public static LayoutDoc BuildFrom(ParseResult parsed, Preset preset, string titleOverride)
        {
            LayoutDoc doc = new LayoutDoc();
            doc.Preset = preset;
            doc.Paragraphs = new List<Para>();
            doc.DefaultFont = preset.Body.Font.Clone();
            doc.Footer = preset.Footer;
            doc.CharacterCount = parsed.CharacterCount;
            doc.ParagraphCount = parsed.ParagraphCount;
            doc.HeadingCount = parsed.HeadingCount;

            List<Block> blocks = parsed.Blocks;
            bool hasTitle = false;
            for (int i = 0; i < blocks.Count; i++) if (blocks[i].Kind == "title") hasTitle = true;

            for (int i = 0; i < blocks.Count; i++)
            {
                Block block = blocks[i];
                if (block.Kind == "pagebreak")
                {
                    Para breakPara = new Para();
                    breakPara.Kind = "pagebreak";
                    breakPara.Style = preset.Body.Clone();
                    breakPara.Style.PageBreakBefore = true;
                    doc.Paragraphs.Add(breakPara);
                    continue;
                }

                PStyle style = preset.Style(block.Kind).Clone();
                if (preset.Id == "thesis" && block.Kind == "h1" && Regex.IsMatch(block.Text, @"^第\s*.{1,3}\s*[章篇]")) style.PageBreakBefore = true;
                if (preset.Id == "thesis" && block.Kind == "refHeading") style.PageBreakBefore = true;
                if (IsHeading(block.Kind) && i == 0) style.Before = 0;

                Para para = new Para();
                para.Kind = block.Kind;
                para.Style = style;
                if (!string.IsNullOrEmpty(block.Label))
                {
                    Run labelRun = new Run();
                    labelRun.Text = block.Label;
                    labelRun.Bold = true;
                    labelRun.BoldSet = true;
                    para.Runs.Add(labelRun);
                    Run textRun = new Run();
                    textRun.Text = block.Text;
                    textRun.Bold = false;
                    textRun.BoldSet = true;
                    para.Runs.Add(textRun);
                }
                else
                {
                    Run run = new Run();
                    run.Text = block.Text;
                    run.Bold = style.Font.Bold;
                    run.BoldSet = true;
                    para.Runs.Add(run);
                }
                doc.Paragraphs.Add(para);
            }

            if (!hasTitle && blocks.Count > 0 && BodyOnly.Contains(blocks[0].Kind))
            {
                Block first = blocks[0];
                if (first.Text.Length <= 60 && !Regex.IsMatch(first.Text, @"[。！？；]"))
                {
                    PStyle style = preset.Style("title").Clone();
                    Para para = new Para();
                    para.Kind = "title";
                    para.Style = style;
                    Run run = new Run();
                    run.Text = first.Text;
                    run.Bold = style.Font.Bold;
                    run.BoldSet = true;
                    para.Runs.Add(run);
                    doc.Paragraphs[0] = para;
                }
            }

            string detected = "";
            for (int i = 0; i < blocks.Count; i++) if (blocks[i].Kind == "title") detected = blocks[i].Text;
            doc.Title = (titleOverride ?? "").Trim();
            if (doc.Title.Length == 0) doc.Title = detected.Trim();
            return doc;
        }

        private static bool IsHeading(string kind)
        {
            return kind == "h1" || kind == "h2" || kind == "h3" || kind == "h4";
        }

        private static readonly Dictionary<string, string> Labels = new Dictionary<string, string>
        {
            { "title", "标题" }, { "subtitle", "副标题" }, { "author", "作者" }, { "affiliation", "单位" },
            { "docnum", "发文字号" }, { "addressee", "主送机关" }, { "abstract", "摘要" }, { "keywords", "关键词" },
            { "h1", "一级标题" }, { "h2", "二级标题" }, { "h3", "三级标题" }, { "h4", "四级标题" },
            { "body", "正文" }, { "list", "条目" }, { "quote", "引文" }, { "refHeading", "参考文献标题" },
            { "ref", "参考文献条目" }, { "signature", "落款" }, { "date", "成文日期" }, { "note", "注释" },
            { "pagebreak", "分页" },
        };

        public static List<string[]> Describe(List<Block> blocks)
        {
            List<string[]> rows = new List<string[]>();
            for (int i = 0; i < blocks.Count; i++)
            {
                Block block = blocks[i];
                string label;
                if (!Labels.TryGetValue(block.Kind, out label)) label = block.Kind;
                rows.Add(new string[] { block.Kind, label, block.Text });
            }
            return rows;
        }

        /// <summary>Rough page estimate for the status line.</summary>
        public static int EstimatePages(LayoutDoc doc)
        {
            double area = (doc.Preset.PageHeight - doc.Preset.MarginTop - doc.Preset.MarginBottom) / 20.0;
            double used = 0;
            for (int i = 0; i < doc.Paragraphs.Count; i++)
            {
                Para para = doc.Paragraphs[i];
                PStyle style = para.Style;
                double linePt = style.LineExact ? style.LineValue / 20.0 : (style.LineValue / 240.0) * style.Font.Size * 1.2;
                int chars = para.PlainText().Length;
                int lines = Math.Max(1, (int)Math.Ceiling(chars / 38.0));
                used += lines * linePt + style.Before + style.After;
                if (style.PageBreakBefore) used = area;
            }
            return Math.Max(1, (int)Math.Ceiling(used / area));
        }

        /// <summary>Plain text rendering used by the copy-to-clipboard action.</summary>
        public static string ToPlainText(LayoutDoc doc)
        {
            StringBuilder builder = new StringBuilder();
            for (int i = 0; i < doc.Paragraphs.Count; i++)
            {
                Para para = doc.Paragraphs[i];
                if (i > 0) builder.Append('\n');
                if (para.Runs.Count == 0) continue;
                if (para.Style.FirstLineChars >= 2) builder.Append('\u3000').Append('\u3000');
                builder.Append(para.PlainText());
            }
            return Regex.Replace(builder.ToString(), @"\n{3,}", "\n\n");
        }
    }
}
