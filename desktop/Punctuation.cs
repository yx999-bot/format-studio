using System;
using System.Collections.Generic;
using System.Text;
using System.Text.RegularExpressions;

namespace FormatStudio
{
    /// <summary>标点规范化的结果。</summary>
    internal sealed class PunctuationResult
    {
        public string Text = "";
        public int Changes;
    }

    /// <summary>
    /// 中文标点规范化，与 src/punctuation.mjs 逐条对应。
    /// 只在中文字符附近把半角标点换成全角，跳过网址、邮箱、路径、行内代码、
    /// 引用标记、行首编号和数字上下文。
    /// </summary>
    internal static class Punctuation
    {
        private static bool PuIsCjk(char ch)
        {
            return (ch >= '\u3400' && ch <= '\u4dbf')
                || (ch >= '\u4e00' && ch <= '\u9fff')
                || (ch >= '\uf900' && ch <= '\ufaff');
        }

        private static bool PuIsDigit(char ch) { return ch >= '0' && ch <= '9'; }

        private static bool PuIsAsciiLetter(char ch)
        {
            return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z');
        }

        private static bool PuIsBoundary(char ch)
        {
            return ch == '\0' || ch == '\n' || ch == '\r';
        }

        private static char PuPrevChar(string text, int index)
        {
            int i = index - 1;
            while (i >= 0 && (text[i] == ' ' || text[i] == '\t')) i -= 1;
            if (i < 0) return '\0';
            return PuIsBoundary(text[i]) ? '\0' : text[i];
        }

        private static char PuNextChar(string text, int index)
        {
            int i = index + 1;
            while (i < text.Length && (text[i] == ' ' || text[i] == '\t')) i += 1;
            if (i >= text.Length) return '\0';
            return PuIsBoundary(text[i]) ? '\0' : text[i];
        }

        private static bool PuStartsWithAt(string text, int index, string token)
        {
            if (index < 0 || index + token.Length > text.Length) return false;
            for (int i = 0; i < token.Length; i += 1)
            {
                if (text[index + i] != token[i]) return false;
            }
            return true;
        }

        /// <summary>每行是否含汉字（纯英文行不替换）。</summary>
        private static bool[] PuBuildLineFlags(string text)
        {
            bool[] flags = new bool[text.Length];
            int start = 0;
            while (start <= text.Length)
            {
                int end = text.IndexOf('\n', start);
                if (end < 0) end = text.Length;
                bool hasCjk = false;
                for (int i = start; i < end; i += 1)
                {
                    if (PuIsCjk(text[i])) { hasCjk = true; break; }
                }
                for (int i = start; i < end; i += 1) flags[i] = hasCjk;
                start = end + 1;
            }
            return flags;
        }

        private sealed class ProtectedPattern
        {
            public Regex Pattern;
            public string Trim;

            public ProtectedPattern(string pattern, string trim, RegexOptions extra)
            {
                Pattern = new Regex(pattern, RegexOptions.Compiled | extra);
                Trim = trim;
            }
        }

        private static readonly ProtectedPattern[] ProtectedPatterns = new ProtectedPattern[]
        {
            new ProtectedPattern(@"https?://[^\s，。；）)]+", ",.;:!?", RegexOptions.None),
            new ProtectedPattern(@"www\.[A-Za-z0-9.-]+", ",.;:!?", RegexOptions.None),
            new ProtectedPattern(@"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}", ",.;:!?", RegexOptions.None),
            new ProtectedPattern(@"[A-Za-z]:\\[^\s]+", ",.;:!?", RegexOptions.None),
            new ProtectedPattern("`[^`\\n]*`", "", RegexOptions.None),
            new ProtectedPattern(@"\[\s*\d{1,3}(?:\s*[-–—,，]\s*\d{1,3})*\s*\]", "", RegexOptions.None),
            new ProtectedPattern(@"^[ \t]*\d{1,2}[.)][ \t]?", "", RegexOptions.Multiline),
            new ProtectedPattern(@"^[ \t]*[（(]\s*\d{1,2}\s*[)）]", "", RegexOptions.Multiline),
            new ProtectedPattern(@"^[ \t]*[一二三四五六七八九十]{1,3}[、.．]", "", RegexOptions.Multiline),
            new ProtectedPattern(@"^[ \t]*#{1,6}[ \t]", "", RegexOptions.Multiline),
        };

        private static bool[] PuBuildProtectedMask(string text)
        {
            bool[] mask = new bool[text.Length];
            for (int p = 0; p < ProtectedPatterns.Length; p += 1)
            {
                ProtectedPattern item = ProtectedPatterns[p];
                Match match = item.Pattern.Match(text);
                while (match.Success)
                {
                    int start = match.Index;
                    int end = Math.Min(text.Length, start + match.Length);
                    while (end > start && item.Trim.IndexOf(text[end - 1]) >= 0) end -= 1;
                    for (int i = start; i < end; i += 1) mask[i] = true;
                    match = match.NextMatch();
                }
            }
            return mask;
        }

        private static readonly HashSet<char> PuOpenBefore = new HashSet<char>(
            new char[] { '（', '【', '《', '「', '『', '“', '‘', '，', '。', '：', '；', '、' });

        private static readonly HashSet<char> PuColonAfter = new HashSet<char>(
            new char[] { '"', '\'', '“', '‘', '（', '《', '【', '「' });

        /// <summary>规范化标点。</summary>
        public static PunctuationResult Normalize(string input, bool quotes)
        {
            PunctuationResult result = new PunctuationResult();
            string source = input ?? "";
            if (source.Length == 0) { result.Text = source; return result; }

            bool[] mask = PuBuildProtectedMask(source);
            bool[] cjkLines = PuBuildLineFlags(source);
            StringBuilder outText = new StringBuilder(source.Length + 16);
            int changes = 0;
            bool quoteOpen = false;
            bool singleOpen = false;
            int i = 0;

            while (i < source.Length)
            {
                char ch = source[i];

                if (ch == '\n' || ch == '\r')
                {
                    quoteOpen = false;
                    singleOpen = false;
                    outText.Append(ch);
                    i += 1;
                    continue;
                }
                if (mask[i])
                {
                    outText.Append(ch);
                    i += 1;
                    continue;
                }

                char prev = PuPrevChar(source, i);
                char next = PuNextChar(source, i);
                bool prevCjk = PuIsCjk(prev);
                bool nextCjk = PuIsCjk(next);
                bool nearCjk = prevCjk || nextCjk;
                bool inCjkLine = cjkLines[i];

                // 多字符：省略号 / 破折号
                if (ch == '.' && PuStartsWithAt(source, i, "..."))
                {
                    char after = i + 3 < source.Length ? source[i + 3] : '\0';
                    if (nearCjk || (inCjkLine && (after == '\0' || PuIsCjk(after))))
                    {
                        outText.Append("……");
                        changes += 1;
                        i = SkipSpaces(source, i + 3);
                        continue;
                    }
                }
                if (ch == '-' && PuStartsWithAt(source, i, "--"))
                {
                    char after = i + 2 < source.Length ? source[i + 2] : '\0';
                    if (nearCjk || (inCjkLine && PuIsCjk(after)))
                    {
                        outText.Append("——");
                        changes += 1;
                        i = SkipSpaces(source, i + 2);
                        continue;
                    }
                }

                switch (ch)
                {
                    case ',':
                        if (nearCjk) { outText.Append('，'); changes += 1; i = SkipSpaces(source, i + 1); continue; }
                        break;
                    case ';':
                        if (nearCjk) { outText.Append('；'); changes += 1; i = SkipSpaces(source, i + 1); continue; }
                        break;
                    case ':':
                        if (prevCjk && (nextCjk || next == '\0' || PuColonAfter.Contains(next)))
                        {
                            outText.Append('：'); changes += 1; i = SkipSpaces(source, i + 1); continue;
                        }
                        break;
                    case '?':
                        if (prevCjk || (nextCjk && prev == '\0') || (inCjkLine && next == '\0' && prev != '\0' && !PuIsAsciiLetter(prev)))
                        {
                            outText.Append('？'); changes += 1; i = SkipSpaces(source, i + 1); continue;
                        }
                        break;
                    case '!':
                        if (prevCjk || (inCjkLine && !PuIsAsciiLetter(prev)))
                        {
                            outText.Append('！'); changes += 1; i = SkipSpaces(source, i + 1); continue;
                        }
                        break;
                    case '.':
                        if (PuIsDigit(prev) || PuIsDigit(next)) break;
                        if (PuIsAsciiLetter(prev) && !(i > 0 && mask[i - 1])) break;
                        if (next == '\0' || next == '\n' || next == '\r' || nextCjk || next == '"' || next == '”' || next == '）' || next == '」')
                        {
                            if (inCjkLine) { outText.Append('。'); changes += 1; i = SkipSpaces(source, i + 1); continue; }
                        }
                        break;
                    case '"':
                        if (!quotes) break;
                        if (prevCjk || nextCjk || prev == '\0' || PuOpenBefore.Contains(prev))
                        {
                            outText.Append(quoteOpen ? '”' : '“');
                            quoteOpen = !quoteOpen;
                            changes += 1;
                            i += 1;
                            continue;
                        }
                        break;
                    case '\'':
                        if (!quotes) break;
                        if (PuIsAsciiLetter(prev) || PuIsAsciiLetter(next)) break;
                        if (prevCjk || nextCjk)
                        {
                            outText.Append(singleOpen ? '’' : '‘');
                            singleOpen = !singleOpen;
                            changes += 1;
                            i += 1;
                            continue;
                        }
                        break;
                    case '(':
                        if (nextCjk || prevCjk) { outText.Append('（'); changes += 1; i = SkipSpaces(source, i + 1); continue; }
                        break;
                    case ')':
                        if (prevCjk || nextCjk) { outText.Append('）'); changes += 1; i = SkipSpaces(source, i + 1); continue; }
                        break;
                    default:
                        break;
                }

                outText.Append(ch);
                i += 1;
            }

            result.Text = outText.ToString();
            result.Changes = changes;
            return result;
        }

        /// <summary>吃掉标点后面多余的半角空格（后接汉字/换行/结尾时）。</summary>
        private static int SkipSpaces(string source, int index)
        {
            int probe = index;
            while (probe < source.Length && (source[probe] == ' ' || source[probe] == '\t')) probe += 1;
            if (probe == index) return index;
            char after = probe < source.Length ? source[probe] : '\0';
            if (after == '\0' || PuIsCjk(after) || after == '\n' || after == '\r') return probe;
            return index;
        }
    }
}
