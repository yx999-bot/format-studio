using System;
using System.Collections.Generic;

namespace FormatStudio
{
    internal sealed class ResolvedPreset
    {
        public Preset Preset;
        public bool Matched;
        public string Reason = "";
    }

    /// <summary>Format presets, ported 1:1 from the browser engine's presets module.</summary>
    internal static class Presets
    {
        private static List<Preset> all;

        public static List<Preset> All
        {
            get
            {
                if (all == null)
                {
                    all = new List<Preset>();
                    all.Add(Paper());
                    all.Add(Thesis());
                    all.Add(Gov());
                    all.Add(Report());
                    all.Add(News());
                    all.Add(Business());
                    all.Add(Letter());
                    all.Add(Resume());
                }
                return all;
            }
        }

        public static Preset Get(string id)
        {
            List<Preset> list = All;
            for (int i = 0; i < list.Count; i++)
            {
                if (string.Equals(list[i].Id, id, StringComparison.OrdinalIgnoreCase)) return list[i];
            }
            return list[0];
        }

        public static string[] Ids()
        {
            List<Preset> list = All;
            string[] ids = new string[list.Count + 1];
            ids[0] = "auto";
            for (int i = 0; i < list.Count; i++) ids[i + 1] = list[i].Id;
            return ids;
        }

        private sealed class ScenarioRule
        {
            public string PresetId;
            public string[] Words;
            public ScenarioRule(string presetId, params string[] words) { PresetId = presetId; Words = words; }
        }

        private static readonly ScenarioRule[] ScenarioRules = new ScenarioRule[]
        {
            new ScenarioRule("gov", "公文", "机关", "请示", "通知", "通报", "批复", "意见", "决定", "公告", "通告", "纪要", "党委", "政府", "红头", "发文", "部委", "事业单位", "上行文", "下行文"),
            new ScenarioRule("thesis", "学位", "毕业论文", "毕业设计", "硕士", "博士", "本科论文", "开题", "答辩"),
            new ScenarioRule("paper", "论文", "期刊", "投稿", "摘要", "关键词", "参考文献", "学术", "文献综述", "研究"),
            new ScenarioRule("news", "新闻", "通讯", "报道", "采访", "稿件", "媒体", "宣传稿", "消息稿", "公众号"),
            new ScenarioRule("resume", "简历", "求职", "个人陈述", "自我介绍", "履历"),
            new ScenarioRule("letter", "申请", "信函", "申请书", "感谢信", "邀请函", "致", "书"),
            new ScenarioRule("report", "总结", "汇报", "述职", "工作报告", "情况说明", "自查", "整改", "年度"),
            new ScenarioRule("business", "方案", "商业", "计划书", "报告书", "策划", "可行性", "项目", "市场", "运营", "商业计划"),
        };

        public static ResolvedPreset Resolve(string presetId, string scenario)
        {
            ResolvedPreset result = new ResolvedPreset();
            if (!string.IsNullOrEmpty(presetId) && presetId != "auto" && presetId != "custom")
            {
                List<Preset> list = All;
                for (int i = 0; i < list.Count; i++)
                {
                    if (string.Equals(list[i].Id, presetId, StringComparison.OrdinalIgnoreCase))
                    {
                        result.Preset = list[i];
                        result.Matched = true;
                        result.Reason = "手动指定";
                        return result;
                    }
                }
            }
            string text = scenario ?? "";
            for (int r = 0; r < ScenarioRules.Length; r++)
            {
                ScenarioRule rule = ScenarioRules[r];
                for (int w = 0; w < rule.Words.Length; w++)
                {
                    if (text.IndexOf(rule.Words[w], StringComparison.Ordinal) >= 0)
                    {
                        Preset preset = Get(rule.PresetId);
                        result.Preset = preset;
                        result.Matched = true;
                        result.Reason = "关键词「" + rule.Words[w] + "」→ " + preset.Name;
                        return result;
                    }
                }
            }
            result.Preset = Get("report");
            result.Matched = false;
            result.Reason = "未识别到明确场景，使用通用「工作总结 / 汇报」格式";
            return result;
        }

        /// <summary>Fill in the styles every preset may leave undefined.</summary>
        private static Preset Normalize(Preset preset)
        {
            PStyle body = preset.Body;
            AddDefault(preset, "subtitle", StyleOps.Ov(body, s => { s.Align = "center"; s.FirstLineChars = 0; }));
            AddDefault(preset, "author", StyleOps.Ov(body, s => { s.Align = "center"; s.FirstLineChars = 0; }));
            AddDefault(preset, "affiliation", StyleOps.Ov(body, s => { s.Align = "center"; s.FirstLineChars = 0; s.Font.Size = 9; }));
            AddDefault(preset, "docnum", StyleOps.Ov(body, s => { s.Align = "center"; s.FirstLineChars = 0; }));
            AddDefault(preset, "addressee", StyleOps.Ov(body, s => { s.Align = "left"; s.FirstLineChars = 0; }));
            AddDefault(preset, "quote", StyleOps.Ov(body, s => { s.LeftChars = 2; s.RightChars = 2; }));
            AddDefault(preset, "list", StyleOps.Ov(body, s => { s.FirstLineChars = 0; s.LeftChars = 2; }));
            AddDefault(preset, "signature", StyleOps.Ov(body, s => { s.Align = "right"; s.FirstLineChars = 0; s.RightChars = 2; }));
            AddDefault(preset, "date", StyleOps.Ov(body, s => { s.Align = "right"; s.FirstLineChars = 0; s.RightChars = 2; }));
            AddDefault(preset, "note", StyleOps.Ov(body, s => { s.Font.Size = 9; }));
            AddDefault(preset, "refHeading", StyleOps.Ov(body, s => { s.FirstLineChars = 0; s.KeepNext = true; }));
            AddDefault(preset, "ref", StyleOps.Ov(body, s => { s.FirstLineChars = 0; s.HangingChars = 2; s.LeftChars = 2; }));
            return preset;
        }

        private static void AddDefault(Preset preset, string kind, PStyle style)
        {
            if (!preset.Styles.ContainsKey(kind)) preset.Styles[kind] = style;
        }

        private static Preset Begin(string id, string name, string shortName, string family, string summary)
        {
            Preset preset = new Preset();
            preset.Id = id;
            preset.Name = name;
            preset.Short = shortName;
            preset.Family = family;
            preset.Summary = summary;
            preset.PageWidth = U.Mm(210);
            preset.PageHeight = U.Mm(297);
            return preset;
        }

        private static void Page(Preset preset, double top, double bottom, double left, double right)
        {
            preset.MarginTop = U.Mm(top);
            preset.MarginBottom = U.Mm(bottom);
            preset.MarginLeft = U.Mm(left);
            preset.MarginRight = U.Mm(right);
        }

        private static FooterSpec Foot(double size, string format)
        {
            FooterSpec footer = new FooterSpec();
            footer.Enabled = true;
            footer.Size = size;
            footer.EastAsia = "宋体";
            footer.Latin = "Times New Roman";
            footer.Format = format;
            return footer;
        }

        private static Preset Paper()
        {
            Preset p = Begin("paper", "学术论文", "论文", "academic",
                "标题黑体二号居中，正文宋体小四、1.5 倍行距、首行缩进两字符，摘要与关键词五号，各级标题黑体分级，参考文献五号悬挂缩进。");
            Page(p, 25.4, 25.4, 31.7, 31.7);
            PStyle body = StyleOps.Make("宋体", 12, false, 360, 2);
            p.Body = body;
            p.Styles["title"] = StyleOps.Ov(body, s => { s.Font.EastAsia = "黑体"; s.Font.Size = 22; s.Font.Bold = true; s.Align = "center"; s.LineValue = 300; s.After = 12; s.FirstLineChars = 0; s.KeepNext = true; });
            p.Styles["subtitle"] = StyleOps.Ov(body, s => { s.Font.EastAsia = "楷体_GB2312"; s.Font.Size = 14; s.Align = "center"; s.LineValue = 300; s.After = 6; s.FirstLineChars = 0; });
            p.Styles["author"] = StyleOps.Ov(body, s => { s.Font.EastAsia = "楷体_GB2312"; s.Align = "center"; s.After = 3; s.FirstLineChars = 0; });
            p.Styles["affiliation"] = StyleOps.Ov(body, s => { s.Font.Size = 9; s.Align = "center"; s.After = 6; s.FirstLineChars = 0; });
            p.Styles["abstract"] = StyleOps.Ov(body, s => { s.Font.Size = 10.5; s.LineValue = 300; s.FirstLineChars = 0; s.Before = 6; s.After = 3; s.Align = "both"; });
            p.Styles["keywords"] = StyleOps.Ov(body, s => { s.Font.Size = 10.5; s.LineValue = 300; s.FirstLineChars = 0; s.After = 12; s.Align = "both"; });
            p.Styles["h1"] = StyleOps.Ov(body, s => { s.Font.EastAsia = "黑体"; s.Font.Size = 14; s.Before = 12; s.After = 6; s.FirstLineChars = 0; s.KeepNext = true; s.LineValue = 300; });
            p.Styles["h2"] = StyleOps.Ov(body, s => { s.Font.EastAsia = "黑体"; s.Before = 8; s.After = 4; s.FirstLineChars = 0; s.KeepNext = true; });
            p.Styles["h3"] = StyleOps.Ov(body, s => { s.Font.Bold = true; s.Before = 6; s.After = 3; s.FirstLineChars = 0; s.KeepNext = true; });
            p.Styles["h4"] = StyleOps.Ov(body, s => { s.Font.Bold = true; s.FirstLineChars = 0; s.KeepNext = true; });
            p.Styles["refHeading"] = StyleOps.Ov(body, s => { s.Font.EastAsia = "黑体"; s.Font.Size = 14; s.Before = 18; s.After = 6; s.FirstLineChars = 0; s.Align = "left"; s.KeepNext = true; });
            p.Styles["ref"] = StyleOps.Ov(body, s => { s.Font.Size = 9; s.LineValue = 240; s.FirstLineChars = 0; s.HangingChars = 2; s.LeftChars = 2; s.Align = "both"; });
            p.Styles["note"] = StyleOps.Ov(body, s => { s.Font.Size = 9; s.FirstLineChars = 0; });
            p.Styles["quote"] = StyleOps.Ov(body, s => { s.LeftChars = 2; s.RightChars = 2; s.Font.Size = 10.5; s.LineValue = 300; });
            p.Footer = Foot(9, "plain");
            return Normalize(p);
        }

        private static Preset Thesis()
        {
            Preset p = Begin("thesis", "学位论文", "学位", "academic",
                "正文宋体小四、1.5 倍行距，章标题黑体三号居中并另起一页，节标题黑体四号，三级标题小四黑体，参考文献另起一页。");
            Page(p, 30, 25, 30, 25);
            PStyle body = StyleOps.Make("宋体", 12, false, 360, 2);
            p.Body = body;
            p.Styles["title"] = StyleOps.Ov(body, s => { s.Font.EastAsia = "黑体"; s.Font.Size = 22; s.Font.Bold = true; s.Align = "center"; s.LineValue = 300; s.After = 18; s.FirstLineChars = 0; s.KeepNext = true; });
            p.Styles["subtitle"] = StyleOps.Ov(body, s => { s.Font.EastAsia = "楷体_GB2312"; s.Font.Size = 16; s.Align = "center"; s.After = 12; s.FirstLineChars = 0; });
            p.Styles["author"] = StyleOps.Ov(body, s => { s.Font.Size = 14; s.Align = "center"; s.After = 4; s.FirstLineChars = 0; });
            p.Styles["affiliation"] = StyleOps.Ov(body, s => { s.Align = "center"; s.After = 12; s.FirstLineChars = 0; });
            p.Styles["abstract"] = StyleOps.Ov(body, s => { s.FirstLineChars = 0; s.Before = 6; s.After = 6; s.Align = "both"; });
            p.Styles["keywords"] = StyleOps.Ov(body, s => { s.FirstLineChars = 0; s.After = 12; s.Align = "both"; });
            p.Styles["h1"] = StyleOps.Ov(body, s => { s.Font.EastAsia = "黑体"; s.Font.Size = 16; s.Align = "center"; s.Before = 24; s.After = 18; s.FirstLineChars = 0; s.KeepNext = true; });
            p.Styles["h2"] = StyleOps.Ov(body, s => { s.Font.EastAsia = "黑体"; s.Font.Size = 14; s.Before = 12; s.After = 6; s.FirstLineChars = 0; s.KeepNext = true; });
            p.Styles["h3"] = StyleOps.Ov(body, s => { s.Font.EastAsia = "黑体"; s.Before = 8; s.After = 4; s.FirstLineChars = 0; s.KeepNext = true; });
            p.Styles["h4"] = StyleOps.Ov(body, s => { s.Font.Bold = true; s.FirstLineChars = 0; s.KeepNext = true; });
            p.Styles["refHeading"] = StyleOps.Ov(body, s => { s.Font.EastAsia = "黑体"; s.Font.Size = 16; s.Align = "center"; s.Before = 18; s.After = 12; s.FirstLineChars = 0; s.KeepNext = true; });
            p.Styles["ref"] = StyleOps.Ov(body, s => { s.Font.Size = 10.5; s.LineValue = 300; s.FirstLineChars = 0; s.HangingChars = 2; s.LeftChars = 2; s.Align = "both"; });
            p.Styles["note"] = StyleOps.Ov(body, s => { s.Font.Size = 10.5; s.FirstLineChars = 0; });
            p.Footer = Foot(10.5, "plain");
            return Normalize(p);
        }

        private static Preset Gov()
        {
            Preset p = Begin("gov", "党政机关公文", "公文", "official",
                "GB/T 9704-2012：版心 156×225mm，标题二号小标宋居中，正文三号仿宋_GB2312、固定行距 28 磅、首行缩进两字符，一级标题黑体、二级楷体、三级仿宋加粗，页码四号宋体加一字线。");
            Page(p, 37, 35, 28, 26);
            PStyle body = StyleOps.Make("仿宋_GB2312", 16, true, U.Tw(28), 2);
            p.Body = body;
            p.Styles["docnum"] = StyleOps.Ov(body, s => { s.Align = "center"; s.FirstLineChars = 0; });
            p.Styles["title"] = StyleOps.Ov(body, s => { s.Font.EastAsia = "方正小标宋简体"; s.Font.Size = 22; s.Align = "center"; s.After = 28; s.FirstLineChars = 0; s.KeepNext = true; });
            p.Styles["subtitle"] = StyleOps.Ov(body, s => { s.Font.EastAsia = "楷体_GB2312"; s.Align = "center"; s.FirstLineChars = 0; });
            p.Styles["addressee"] = StyleOps.Ov(body, s => { s.Align = "left"; s.FirstLineChars = 0; s.Before = 0; s.After = 0; });
            p.Styles["h1"] = StyleOps.Ov(body, s => { s.Font.EastAsia = "黑体"; s.FirstLineChars = 0; s.KeepNext = true; });
            p.Styles["h2"] = StyleOps.Ov(body, s => { s.Font.EastAsia = "楷体_GB2312"; s.FirstLineChars = 0; s.KeepNext = true; });
            p.Styles["h3"] = StyleOps.Ov(body, s => { s.Font.Bold = true; s.FirstLineChars = 0; s.KeepNext = true; });
            p.Styles["h4"] = StyleOps.Ov(body, s => { s.FirstLineChars = 0; s.KeepNext = true; });
            p.Styles["signature"] = StyleOps.Ov(body, s => { s.Align = "right"; s.FirstLineChars = 0; s.RightChars = 2; s.Before = 28; });
            p.Styles["date"] = StyleOps.Ov(body, s => { s.Align = "right"; s.FirstLineChars = 0; s.RightChars = 4; });
            p.Styles["note"] = StyleOps.Ov(body, s => { s.FirstLineChars = 0; });
            p.Styles["ref"] = StyleOps.Ov(body, s => { s.FirstLineChars = 0; });
            p.Footer = Foot(14, "gongwen");
            return Normalize(p);
        }

        private static Preset Report()
        {
            Preset p = Begin("report", "工作总结 / 汇报", "总结", "official",
                "标题二号小标宋居中，正文三号仿宋、1.5 倍行距，一级标题黑体三号、二级楷体三号加粗，落款右对齐。");
            Page(p, 32, 30, 28, 26);
            PStyle body = StyleOps.Make("仿宋_GB2312", 16, false, 360, 2);
            p.Body = body;
            p.Styles["title"] = StyleOps.Ov(body, s => { s.Font.EastAsia = "方正小标宋简体"; s.Font.Size = 22; s.Align = "center"; s.LineValue = 342; s.After = 24; s.FirstLineChars = 0; s.KeepNext = true; });
            p.Styles["subtitle"] = StyleOps.Ov(body, s => { s.Font.EastAsia = "楷体_GB2312"; s.Align = "center"; s.FirstLineChars = 0; });
            p.Styles["h1"] = StyleOps.Ov(body, s => { s.Font.EastAsia = "黑体"; s.Before = 12; s.After = 6; s.FirstLineChars = 0; s.KeepNext = true; });
            p.Styles["h2"] = StyleOps.Ov(body, s => { s.Font.EastAsia = "楷体_GB2312"; s.Font.Bold = true; s.Before = 6; s.After = 3; s.FirstLineChars = 0; s.KeepNext = true; });
            p.Styles["h3"] = StyleOps.Ov(body, s => { s.Font.Bold = true; s.FirstLineChars = 0; s.KeepNext = true; });
            p.Styles["signature"] = StyleOps.Ov(body, s => { s.Align = "right"; s.FirstLineChars = 0; s.RightChars = 2; s.Before = 24; });
            p.Styles["date"] = StyleOps.Ov(body, s => { s.Align = "right"; s.FirstLineChars = 0; s.RightChars = 4; });
            p.Styles["addressee"] = StyleOps.Ov(body, s => { s.Align = "left"; s.FirstLineChars = 0; });
            p.Styles["note"] = StyleOps.Ov(body, s => { s.FirstLineChars = 0; });
            p.Footer = Foot(14, "gongwen");
            return Normalize(p);
        }

        private static Preset News()
        {
            Preset p = Begin("news", "新闻稿 / 通讯", "新闻", "media",
                "标题黑体小二号居中，副标题楷体，作者/记者署名楷体居中，正文宋体小四、1.5 倍行距、首行缩进两字符。");
            Page(p, 25.4, 25.4, 28, 28);
            PStyle body = StyleOps.Make("宋体", 12, false, 360, 2);
            p.Body = body;
            p.Styles["title"] = StyleOps.Ov(body, s => { s.Font.EastAsia = "黑体"; s.Font.Size = 18; s.Font.Bold = true; s.Align = "center"; s.LineValue = 320; s.After = 6; s.FirstLineChars = 0; s.KeepNext = true; });
            p.Styles["subtitle"] = StyleOps.Ov(body, s => { s.Font.EastAsia = "楷体_GB2312"; s.Font.Size = 14; s.Align = "center"; s.After = 6; s.FirstLineChars = 0; });
            p.Styles["author"] = StyleOps.Ov(body, s => { s.Font.EastAsia = "楷体_GB2312"; s.Font.Size = 10.5; s.Align = "center"; s.After = 12; s.FirstLineChars = 0; });
            p.Styles["h1"] = StyleOps.Ov(body, s => { s.Font.EastAsia = "黑体"; s.Before = 12; s.After = 6; s.FirstLineChars = 0; s.KeepNext = true; });
            p.Styles["h2"] = StyleOps.Ov(body, s => { s.Font.EastAsia = "楷体_GB2312"; s.Font.Bold = true; s.FirstLineChars = 0; s.KeepNext = true; });
            p.Styles["quote"] = StyleOps.Ov(body, s => { s.LeftChars = 2; s.RightChars = 2; s.Font.EastAsia = "楷体_GB2312"; });
            p.Styles["note"] = StyleOps.Ov(body, s => { s.Font.EastAsia = "楷体_GB2312"; s.Font.Size = 10.5; s.FirstLineChars = 0; });
            p.Footer = Foot(9, "plain");
            return Normalize(p);
        }

        private static Preset Business()
        {
            Preset p = Begin("business", "商业报告 / 方案", "方案", "business",
                "标题黑体二号居中，正文宋体小四、1.5 倍行距，一级标题黑体小三、二级四号黑体、三级小四加粗，页脚页码。");
            Page(p, 25.4, 25.4, 31.7, 31.7);
            PStyle body = StyleOps.Make("宋体", 12, false, 360, 2);
            p.Body = body;
            p.Styles["title"] = StyleOps.Ov(body, s => { s.Font.EastAsia = "黑体"; s.Font.Size = 22; s.Font.Bold = true; s.Align = "center"; s.LineValue = 300; s.After = 18; s.FirstLineChars = 0; s.KeepNext = true; });
            p.Styles["subtitle"] = StyleOps.Ov(body, s => { s.Font.EastAsia = "楷体_GB2312"; s.Font.Size = 14; s.Align = "center"; s.After = 12; s.FirstLineChars = 0; });
            p.Styles["h1"] = StyleOps.Ov(body, s => { s.Font.EastAsia = "黑体"; s.Font.Size = 15; s.Before = 18; s.After = 8; s.FirstLineChars = 0; s.KeepNext = true; });
            p.Styles["h2"] = StyleOps.Ov(body, s => { s.Font.EastAsia = "黑体"; s.Font.Size = 14; s.Before = 12; s.After = 6; s.FirstLineChars = 0; s.KeepNext = true; });
            p.Styles["h3"] = StyleOps.Ov(body, s => { s.Font.Bold = true; s.Before = 8; s.After = 4; s.FirstLineChars = 0; s.KeepNext = true; });
            p.Styles["list"] = StyleOps.Ov(body, s => { s.FirstLineChars = 0; s.LeftChars = 2; s.HangingChars = 1; });
            p.Styles["note"] = StyleOps.Ov(body, s => { s.Font.EastAsia = "楷体_GB2312"; s.Font.Size = 10.5; s.FirstLineChars = 0; });
            p.Footer = Foot(9, "plain");
            return Normalize(p);
        }

        private static Preset Letter()
        {
            Preset p = Begin("letter", "申请 / 信函", "信函", "official",
                "标题黑体三号居中，称呼顶格，正文三号仿宋、1.5 倍行距、首行缩进两字符，署名与日期右对齐。");
            Page(p, 32, 30, 28, 26);
            PStyle body = StyleOps.Make("仿宋_GB2312", 16, false, 360, 2);
            p.Body = body;
            p.Styles["title"] = StyleOps.Ov(body, s => { s.Font.EastAsia = "黑体"; s.Font.Size = 18; s.Font.Bold = true; s.Align = "center"; s.LineValue = 320; s.After = 18; s.FirstLineChars = 0; s.KeepNext = true; });
            p.Styles["addressee"] = StyleOps.Ov(body, s => { s.Align = "left"; s.FirstLineChars = 0; });
            p.Styles["h1"] = StyleOps.Ov(body, s => { s.Font.EastAsia = "黑体"; s.FirstLineChars = 0; s.KeepNext = true; });
            p.Styles["h2"] = StyleOps.Ov(body, s => { s.Font.EastAsia = "楷体_GB2312"; s.Font.Bold = true; s.FirstLineChars = 0; s.KeepNext = true; });
            p.Styles["signature"] = StyleOps.Ov(body, s => { s.Align = "right"; s.FirstLineChars = 0; s.RightChars = 2; s.Before = 24; });
            p.Styles["date"] = StyleOps.Ov(body, s => { s.Align = "right"; s.FirstLineChars = 0; s.RightChars = 4; });
            p.Styles["note"] = StyleOps.Ov(body, s => { s.FirstLineChars = 0; });
            p.Footer = new FooterSpec();
            p.Footer.Enabled = false;
            return Normalize(p);
        }

        private static Preset Resume()
        {
            Preset p = Begin("resume", "简历 / 个人材料", "简历", "business",
                "紧凑排版：标题黑体二号居中，栏目名黑体小四加下划线隔断，正文宋体五号、1.25 倍行距、不首行缩进。");
            Page(p, 20, 20, 22, 22);
            PStyle body = StyleOps.Make("宋体", 10.5, false, 300, 0);
            body.Align = "left";
            p.Body = body;
            p.Styles["title"] = StyleOps.Ov(body, s => { s.Font.EastAsia = "黑体"; s.Font.Size = 22; s.Font.Bold = true; s.Align = "center"; s.LineValue = 280; s.After = 4; s.FirstLineChars = 0; });
            p.Styles["subtitle"] = StyleOps.Ov(body, s => { s.Align = "center"; s.FirstLineChars = 0; });
            p.Styles["author"] = StyleOps.Ov(body, s => { s.Align = "center"; s.FirstLineChars = 0; });
            p.Styles["h1"] = StyleOps.Ov(body, s => { s.Font.EastAsia = "黑体"; s.Font.Size = 12.5; s.Before = 10; s.After = 4; s.FirstLineChars = 0; s.KeepNext = true; s.BorderBottom = true; });
            p.Styles["h2"] = StyleOps.Ov(body, s => { s.Font.Bold = true; s.Before = 4; s.After = 2; s.FirstLineChars = 0; s.KeepNext = true; });
            p.Styles["h3"] = StyleOps.Ov(body, s => { s.FirstLineChars = 0; s.KeepNext = true; });
            p.Styles["list"] = StyleOps.Ov(body, s => { s.FirstLineChars = 0; s.LeftChars = 1; s.HangingChars = 1; });
            p.Styles["note"] = StyleOps.Ov(body, s => { s.Font.Size = 9; s.FirstLineChars = 0; });
            p.Footer = new FooterSpec();
            p.Footer.Enabled = false;
            return Normalize(p);
        }
    }
}
