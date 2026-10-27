using System;
using System.Collections.Generic;

namespace FormatStudio
{
    /// <summary>Unit helpers. Word stores lengths in twips (1/1440 inch).</summary>
    internal static class U
    {
        public const double TwipsPerMm = 1440.0 / 25.4;

        public static int Mm(double value) { return (int)Math.Round(value * TwipsPerMm); }
        public static int Tw(double points) { return (int)Math.Round(points * 20.0); }
        public static int HalfPt(double points) { return (int)Math.Round(points * 2.0); }
    }

    internal sealed class FontSpec
    {
        public string EastAsia = "宋体";
        public string Latin = "Times New Roman";
        public double Size = 12;
        public bool Bold;
        public bool Italic;

        public FontSpec Clone()
        {
            FontSpec copy = new FontSpec();
            copy.EastAsia = EastAsia;
            copy.Latin = Latin;
            copy.Size = Size;
            copy.Bold = Bold;
            copy.Italic = Italic;
            return copy;
        }
    }

    internal sealed class PStyle
    {
        public string Align = "both";
        public FontSpec Font = new FontSpec();
        /// <summary>True: LineValue is an exact height in twips. False: LineValue is 240 * multiple.</summary>
        public bool LineExact = false;
        public double LineValue = 240;
        public double Before = 0;
        public double After = 0;
        public double FirstLineChars = 0;
        public double LeftChars = 0;
        public double RightChars = 0;
        public double HangingChars = 0;
        public bool KeepNext = false;
        public bool PageBreakBefore = false;
        public bool BorderBottom = false;

        public PStyle Clone()
        {
            PStyle copy = new PStyle();
            copy.Align = Align;
            copy.Font = Font.Clone();
            copy.LineExact = LineExact;
            copy.LineValue = LineValue;
            copy.Before = Before;
            copy.After = After;
            copy.FirstLineChars = FirstLineChars;
            copy.LeftChars = LeftChars;
            copy.RightChars = RightChars;
            copy.HangingChars = HangingChars;
            copy.KeepNext = KeepNext;
            copy.PageBreakBefore = PageBreakBefore;
            copy.BorderBottom = BorderBottom;
            return copy;
        }
    }

    internal sealed class FooterSpec
    {
        public bool Enabled = false;
        public double Size = 9;
        public string EastAsia = "宋体";
        public string Latin = "Times New Roman";
        public string Format = "plain";
    }

    internal sealed class Preset
    {
        public string Id = "";
        public string Name = "";
        public string Short = "";
        public string Summary = "";
        public string Family = "";
        public int PageWidth = U.Mm(210);
        public int PageHeight = U.Mm(297);
        public int MarginTop;
        public int MarginBottom;
        public int MarginLeft;
        public int MarginRight;
        public PStyle Body = new PStyle();
        public Dictionary<string, PStyle> Styles = new Dictionary<string, PStyle>();
        public FooterSpec Footer = new FooterSpec();

        public PStyle Style(string kind)
        {
            PStyle style;
            return Styles.TryGetValue(kind, out style) ? style : Body;
        }
    }

    internal sealed class Block
    {
        public string Kind = "body";
        public string Text = "";
        public string Label = "";
    }

    internal sealed class Run
    {
        public string Text = "";
        public bool Bold;
        public bool BoldSet;
    }

    internal sealed class Para
    {
        public string Kind = "body";
        public PStyle Style = new PStyle();
        public List<Run> Runs = new List<Run>();

        public string PlainText()
        {
            System.Text.StringBuilder builder = new System.Text.StringBuilder();
            for (int i = 0; i < Runs.Count; i++) builder.Append(Runs[i].Text);
            return builder.ToString();
        }
    }

    internal sealed class LayoutDoc
    {
        public Preset Preset;
        public List<Para> Paragraphs = new List<Para>();
        public FontSpec DefaultFont = new FontSpec();
        public FooterSpec Footer = new FooterSpec();
        public string Title = "";
        public int ParagraphCount;
        public int HeadingCount;
        public int CharacterCount;
    }

    internal static class StyleOps
    {
        /// <summary>Create a copy of <paramref name="baseStyle"/> with the callback applied.</summary>
        public static PStyle Ov(PStyle baseStyle, Action<PStyle> mutate)
        {
            PStyle style = baseStyle.Clone();
            mutate(style);
            return style;
        }

        public static PStyle Make(string eastAsia, double size, bool exact, double lineValue, double firstLineChars)
        {
            PStyle style = new PStyle();
            style.Font.EastAsia = eastAsia;
            style.Font.Size = size;
            style.LineExact = exact;
            style.LineValue = lineValue;
            style.FirstLineChars = firstLineChars;
            return style;
        }
    }
}
