using System;
using System.Collections.Generic;
using System.IO;
using System.Text;

namespace FormatStudio
{
    /// <summary>WordprocessingML writer: pure .NET, STORE-method ZIP, no external libraries.</summary>
    internal static class Docx
    {
        private const string XmlHead = "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\n";
        private const string NsW = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
        private const string NsR = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

        public static string XmlEscape(string value)
        {
            if (value == null) return "";
            StringBuilder builder = new StringBuilder(value.Length + 16);
            foreach (char ch in value)
            {
                switch (ch)
                {
                    case '&': builder.Append("&amp;"); break;
                    case '<': builder.Append("&lt;"); break;
                    case '>': builder.Append("&gt;"); break;
                    case '"': builder.Append("&quot;"); break;
                    case '\'': builder.Append("&apos;"); break;
                    default: builder.Append(ch); break;
                }
            }
            return builder.ToString();
        }

        private static string AlignValue(string align)
        {
            if (align == "center") return "center";
            if (align == "right") return "right";
            if (align == "left") return "left";
            return "both";
        }

        private static string RunProperties(FontSpec font, bool bold)
        {
            StringBuilder builder = new StringBuilder();
            builder.Append("<w:rFonts w:ascii=\"").Append(XmlEscape(font.Latin))
                .Append("\" w:hAnsi=\"").Append(XmlEscape(font.Latin))
                .Append("\" w:eastAsia=\"").Append(XmlEscape(font.EastAsia))
                .Append("\" w:cs=\"").Append(XmlEscape(font.Latin)).Append("\"/>");
            builder.Append(bold ? "<w:b/><w:bCs/>" : "<w:b w:val=\"0\"/><w:bCs w:val=\"0\"/>");
            if (font.Italic) builder.Append("<w:i/><w:iCs/>");
            int halfPoints = U.HalfPt(font.Size);
            builder.Append("<w:sz w:val=\"").Append(halfPoints).Append("\"/><w:szCs w:val=\"").Append(halfPoints).Append("\"/>");
            return builder.ToString();
        }

        private static string ParagraphProperties(PStyle style)
        {
            StringBuilder builder = new StringBuilder();
            if (style.PageBreakBefore) builder.Append("<w:pageBreakBefore/>");
            if (style.KeepNext) builder.Append("<w:keepNext/>");
            if (style.BorderBottom) builder.Append("<w:pBdr><w:bottom w:val=\"single\" w:sz=\"6\" w:space=\"1\" w:color=\"auto\"/></w:pBdr>");

            int before = U.Tw(style.Before);
            int after = U.Tw(style.After);
            int line = (int)Math.Round(style.LineValue);
            builder.Append("<w:spacing w:before=\"").Append(before).Append("\" w:after=\"").Append(after)
                .Append("\" w:line=\"").Append(line)
                .Append("\" w:lineRule=\"").Append(style.LineExact ? "exact" : "auto").Append("\"/>");
            builder.Append("<w:jc w:val=\"").Append(AlignValue(style.Align)).Append("\"/>");

            int charTwips = U.Tw(style.Font.Size);
            List<string> ind = new List<string>();
            if (style.HangingChars > 0)
            {
                ind.Add("w:hangingChars=\"" + (int)Math.Round(style.HangingChars * 100) + "\"");
                ind.Add("w:hanging=\"" + (int)Math.Round(style.HangingChars * charTwips) + "\"");
            }
            else if (style.FirstLineChars > 0)
            {
                ind.Add("w:firstLineChars=\"" + (int)Math.Round(style.FirstLineChars * 100) + "\"");
                ind.Add("w:firstLine=\"" + (int)Math.Round(style.FirstLineChars * charTwips) + "\"");
            }
            if (style.LeftChars > 0)
            {
                ind.Add("w:leftChars=\"" + (int)Math.Round(style.LeftChars * 100) + "\"");
                ind.Add("w:left=\"" + (int)Math.Round(style.LeftChars * charTwips) + "\"");
            }
            if (style.RightChars > 0)
            {
                ind.Add("w:rightChars=\"" + (int)Math.Round(style.RightChars * 100) + "\"");
                ind.Add("w:right=\"" + (int)Math.Round(style.RightChars * charTwips) + "\"");
            }
            if (ind.Count > 0) builder.Append("<w:ind ").Append(string.Join(" ", ind.ToArray())).Append("/>");
            return builder.ToString();
        }

        private static string RunXml(Run run, PStyle style)
        {
            if (run.Text == null || run.Text.Length == 0) return "";
            bool bold = run.BoldSet ? run.Bold : style.Font.Bold;
            StringBuilder builder = new StringBuilder();
            builder.Append("<w:r><w:rPr>").Append(RunProperties(style.Font, bold)).Append("</w:rPr>");
            string[] chunks = run.Text.Split('\n');
            for (int i = 0; i < chunks.Length; i++)
            {
                if (i > 0) builder.Append("<w:br/>");
                builder.Append("<w:t xml:space=\"preserve\">").Append(XmlEscape(chunks[i])).Append("</w:t>");
            }
            builder.Append("</w:r>");
            return builder.ToString();
        }

        private static string ParagraphXml(Para para)
        {
            StringBuilder builder = new StringBuilder();
            builder.Append("<w:p><w:pPr>").Append(ParagraphProperties(para.Style)).Append("</w:pPr>");
            for (int i = 0; i < para.Runs.Count; i++) builder.Append(RunXml(para.Runs[i], para.Style));
            builder.Append("</w:p>");
            return builder.ToString();
        }

        private static string FooterXml(FooterSpec footer)
        {
            if (footer == null || !footer.Enabled) return "";
            int halfPoints = U.HalfPt(footer.Size);
            string rPr = "<w:rPr><w:rFonts w:ascii=\"" + XmlEscape(footer.Latin) + "\" w:hAnsi=\"" + XmlEscape(footer.Latin)
                + "\" w:eastAsia=\"" + XmlEscape(footer.EastAsia) + "\"/><w:sz w:val=\"" + halfPoints + "\"/><w:szCs w:val=\""
                + halfPoints + "\"/></w:rPr>";
            bool gongwen = footer.Format == "gongwen";
            string left = gongwen ? "— " : "";
            string right = gongwen ? " —" : "";
            StringBuilder builder = new StringBuilder();
            builder.Append(XmlHead).Append("<w:ftr xmlns:w=\"").Append(NsW).Append("\" xmlns:r=\"").Append(NsR).Append("\">");
            builder.Append("<w:p><w:pPr><w:jc w:val=\"center\"/><w:spacing w:before=\"0\" w:after=\"0\" w:line=\"240\" w:lineRule=\"auto\"/></w:pPr>");
            if (left.Length > 0) builder.Append("<w:r>").Append(rPr).Append("<w:t xml:space=\"preserve\">").Append(XmlEscape(left)).Append("</w:t></w:r>");
            builder.Append("<w:r><w:fldChar w:fldCharType=\"begin\"/></w:r>");
            builder.Append("<w:r><w:instrText xml:space=\"preserve\"> PAGE </w:instrText></w:r>");
            builder.Append("<w:r><w:fldChar w:fldCharType=\"separate\"/></w:r>");
            builder.Append("<w:r>").Append(rPr).Append("<w:t>1</w:t></w:r>");
            builder.Append("<w:r><w:fldChar w:fldCharType=\"end\"/></w:r>");
            if (right.Length > 0) builder.Append("<w:r>").Append(rPr).Append("<w:t xml:space=\"preserve\">").Append(XmlEscape(right)).Append("</w:t></w:r>");
            builder.Append("</w:p></w:ftr>");
            return builder.ToString();
        }

        private static string DocumentXml(LayoutDoc doc)
        {
            bool hasFooter = doc.Footer != null && doc.Footer.Enabled;
            Preset preset = doc.Preset;
            StringBuilder builder = new StringBuilder();
            builder.Append(XmlHead).Append("<w:document xmlns:w=\"").Append(NsW).Append("\" xmlns:r=\"").Append(NsR).Append("\"><w:body>");
            for (int i = 0; i < doc.Paragraphs.Count; i++) builder.Append(ParagraphXml(doc.Paragraphs[i]));
            builder.Append("<w:sectPr>");
            if (hasFooter) builder.Append("<w:footerReference w:type=\"default\" r:id=\"rIdFooter1\"/>");
            builder.Append("<w:pgSz w:w=\"").Append(preset.PageWidth).Append("\" w:h=\"").Append(preset.PageHeight).Append("\"/>");
            builder.Append("<w:pgMar w:top=\"").Append(preset.MarginTop).Append("\" w:right=\"").Append(preset.MarginRight)
                .Append("\" w:bottom=\"").Append(preset.MarginBottom).Append("\" w:left=\"").Append(preset.MarginLeft)
                .Append("\" w:header=\"851\" w:footer=\"992\" w:gutter=\"0\"/>");
            builder.Append("<w:cols w:space=\"425\"/><w:docGrid w:type=\"none\"/></w:sectPr></w:body></w:document>");
            return builder.ToString();
        }

        private static string StylesXml(LayoutDoc doc)
        {
            FontSpec font = doc.DefaultFont;
            int halfPoints = U.HalfPt(font.Size);
            StringBuilder builder = new StringBuilder();
            builder.Append(XmlHead).Append("<w:styles xmlns:w=\"").Append(NsW).Append("\"><w:docDefaults><w:rPrDefault><w:rPr>");
            builder.Append("<w:rFonts w:ascii=\"").Append(XmlEscape(font.Latin)).Append("\" w:hAnsi=\"").Append(XmlEscape(font.Latin))
                .Append("\" w:eastAsia=\"").Append(XmlEscape(font.EastAsia)).Append("\" w:cs=\"").Append(XmlEscape(font.Latin)).Append("\"/>");
            builder.Append("<w:sz w:val=\"").Append(halfPoints).Append("\"/><w:szCs w:val=\"").Append(halfPoints).Append("\"/>");
            builder.Append("<w:lang w:val=\"en-US\" w:eastAsia=\"zh-CN\" w:bidi=\"ar-SA\"/></w:rPr></w:rPrDefault>");
            builder.Append("<w:pPrDefault><w:pPr><w:spacing w:line=\"240\" w:lineRule=\"auto\"/></w:pPr></w:pPrDefault></w:docDefaults>");
            builder.Append("<w:style w:type=\"paragraph\" w:default=\"1\" w:styleId=\"Normal\"><w:name w:val=\"Normal\"/><w:qFormat/></w:style>");
            builder.Append("</w:styles>");
            return builder.ToString();
        }

        private static string SettingsXml()
        {
            return XmlHead + "<w:settings xmlns:w=\"" + NsW + "\"><w:zoom w:percent=\"100\"/><w:defaultTabStop w:val=\"420\"/>"
                + "<w:characterSpacingControl w:val=\"compressPunctuation\"/><w:compat><w:compatSetting w:name=\"compatibilityMode\" "
                + "w:uri=\"http://schemas.microsoft.com/office/word\" w:val=\"15\"/></w:compat></w:settings>";
        }

        private static string CoreXml(string title)
        {
            string now = DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ");
            return XmlHead + "<cp:coreProperties xmlns:cp=\"http://schemas.openxmlformats.org/package/2006/metadata/core-properties\" "
                + "xmlns:dc=\"http://purl.org/dc/elements/1.1/\" xmlns:dcterms=\"http://purl.org/dc/terms/\" "
                + "xmlns:dcmitype=\"http://purl.org/dc/dcmitype/\" xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\">"
                + "<dc:title>" + XmlEscape(title) + "</dc:title><dc:creator>排版工作台</dc:creator>"
                + "<cp:lastModifiedBy>排版工作台</cp:lastModifiedBy>"
                + "<dcterms:created xsi:type=\"dcterms:W3CDTF\">" + now + "</dcterms:created>"
                + "<dcterms:modified xsi:type=\"dcterms:W3CDTF\">" + now + "</dcterms:modified></cp:coreProperties>";
        }

        private static string AppXml(LayoutDoc doc)
        {
            return XmlHead + "<Properties xmlns=\"http://schemas.openxmlformats.org/officeDocument/2006/extended-properties\" "
                + "xmlns:vt=\"http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes\"><Application>排版工作台</Application>"
                + "<DocSecurity>0</DocSecurity><Paragraphs>" + doc.Paragraphs.Count + "</Paragraphs></Properties>";
        }

        private static string ContentTypesXml(bool hasFooter)
        {
            StringBuilder builder = new StringBuilder();
            builder.Append(XmlHead).Append("<Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\">");
            builder.Append("<Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/>");
            builder.Append("<Default Extension=\"xml\" ContentType=\"application/xml\"/>");
            builder.Append("<Override PartName=\"/word/document.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml\"/>");
            builder.Append("<Override PartName=\"/word/styles.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml\"/>");
            builder.Append("<Override PartName=\"/word/settings.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml\"/>");
            if (hasFooter) builder.Append("<Override PartName=\"/word/footer1.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml\"/>");
            builder.Append("<Override PartName=\"/docProps/core.xml\" ContentType=\"application/vnd.openxmlformats-package.core-properties+xml\"/>");
            builder.Append("<Override PartName=\"/docProps/app.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.extended-properties+xml\"/>");
            builder.Append("</Types>");
            return builder.ToString();
        }

        private static string RootRelsXml()
        {
            return XmlHead + "<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">"
                + "<Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"word/document.xml\"/>"
                + "<Relationship Id=\"rId2\" Type=\"http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties\" Target=\"docProps/core.xml\"/>"
                + "<Relationship Id=\"rId3\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties\" Target=\"docProps/app.xml\"/>"
                + "</Relationships>";
        }

        private static string DocumentRelsXml(bool hasFooter)
        {
            StringBuilder builder = new StringBuilder();
            builder.Append(XmlHead).Append("<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">");
            builder.Append("<Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles\" Target=\"styles.xml\"/>");
            builder.Append("<Relationship Id=\"rId2\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings\" Target=\"settings.xml\"/>");
            if (hasFooter) builder.Append("<Relationship Id=\"rIdFooter1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer\" Target=\"footer1.xml\"/>");
            builder.Append("</Relationships>");
            return builder.ToString();
        }

        /// <summary>Render the layout into .docx bytes.</summary>
        public static byte[] Build(LayoutDoc doc)
        {
            bool hasFooter = doc.Footer != null && doc.Footer.Enabled;
            List<string> names = new List<string>();
            List<byte[]> parts = new List<byte[]>();
            names.Add("[Content_Types].xml"); parts.Add(Utf8(ContentTypesXml(hasFooter)));
            names.Add("_rels/.rels"); parts.Add(Utf8(RootRelsXml()));
            names.Add("docProps/core.xml"); parts.Add(Utf8(CoreXml(doc.Title)));
            names.Add("docProps/app.xml"); parts.Add(Utf8(AppXml(doc)));
            names.Add("word/document.xml"); parts.Add(Utf8(DocumentXml(doc)));
            names.Add("word/styles.xml"); parts.Add(Utf8(StylesXml(doc)));
            names.Add("word/settings.xml"); parts.Add(Utf8(SettingsXml()));
            names.Add("word/_rels/document.xml.rels"); parts.Add(Utf8(DocumentRelsXml(hasFooter)));
            if (hasFooter)
            {
                names.Add("word/footer1.xml"); parts.Add(Utf8(FooterXml(doc.Footer)));
            }
            return Zip(names, parts);
        }

        private static byte[] Utf8(string value)
        {
            return new UTF8Encoding(false).GetBytes(value);
        }

        private static readonly uint[] CrcTable = BuildCrcTable();

        private static uint[] BuildCrcTable()
        {
            uint[] table = new uint[256];
            for (uint i = 0; i < 256; i++)
            {
                uint c = i;
                for (int k = 0; k < 8; k++) c = (c & 1) != 0 ? 0xedb88320u ^ (c >> 1) : c >> 1;
                table[i] = c;
            }
            return table;
        }

        private static uint Crc32(byte[] bytes)
        {
            uint crc = 0xffffffffu;
            for (int i = 0; i < bytes.Length; i++) crc = CrcTable[(crc ^ bytes[i]) & 0xff] ^ (crc >> 8);
            return crc ^ 0xffffffffu;
        }

        private static byte[] Zip(List<string> names, List<byte[]> parts)
        {
            DateTime now = DateTime.Now;
            ushort dosTime = (ushort)((now.Hour << 11) | (now.Minute << 5) | (now.Second / 2));
            ushort dosDate = (ushort)(((now.Year - 1980) << 9) | (now.Month << 5) | now.Day);

            MemoryStream buffer = new MemoryStream();
            BinaryWriter writer = new BinaryWriter(buffer);
            List<byte[]> centrals = new List<byte[]>();
            uint offset = 0;

            for (int i = 0; i < names.Count; i++)
            {
                byte[] nameBytes = Utf8(names[i]);
                byte[] data = parts[i];
                uint crc = Crc32(data);
                uint size = (uint)data.Length;

                writer.Write(0x04034b50u);
                writer.Write((ushort)20);
                writer.Write((ushort)0x0800);
                writer.Write((ushort)0);
                writer.Write(dosTime);
                writer.Write(dosDate);
                writer.Write(crc);
                writer.Write(size);
                writer.Write(size);
                writer.Write((ushort)nameBytes.Length);
                writer.Write((ushort)0);
                writer.Write(nameBytes);
                writer.Write(data);

                MemoryStream centralStream = new MemoryStream();
                BinaryWriter central = new BinaryWriter(centralStream);
                central.Write(0x02014b50u);
                central.Write((ushort)20);
                central.Write((ushort)20);
                central.Write((ushort)0x0800);
                central.Write((ushort)0);
                central.Write(dosTime);
                central.Write(dosDate);
                central.Write(crc);
                central.Write(size);
                central.Write(size);
                central.Write((ushort)nameBytes.Length);
                central.Write((ushort)0);
                central.Write((ushort)0);
                central.Write((ushort)0);
                central.Write((ushort)0);
                central.Write(0u);
                central.Write(offset);
                central.Write(nameBytes);
                central.Flush();
                centrals.Add(centralStream.ToArray());

                offset += (uint)(30 + nameBytes.Length + data.Length);
            }

            uint centralSize = 0;
            for (int i = 0; i < centrals.Count; i++)
            {
                writer.Write(centrals[i]);
                centralSize += (uint)centrals[i].Length;
            }

            writer.Write(0x06054b50u);
            writer.Write((ushort)0);
            writer.Write((ushort)0);
            writer.Write((ushort)names.Count);
            writer.Write((ushort)names.Count);
            writer.Write(centralSize);
            writer.Write(offset);
            writer.Write((ushort)0);
            writer.Flush();
            return buffer.ToArray();
        }
    }
}
