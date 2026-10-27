using System;
using System.Collections.Generic;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Windows.Forms;

namespace FormatStudio
{
    /// <summary>Shared composition helpers used by both the GUI and the CLI.</summary>
    internal static class Engine
    {
        public static LayoutDoc Compose(string text, string presetId, string scenario, string title)
        {
            ResolvedPreset resolved = Presets.Resolve(presetId, scenario);
            LayoutDoc doc = Layouter.Build(text, resolved.Preset, title);
            doc.Preset = resolved.Preset;
            return doc;
        }

        public static ResolvedPreset Resolve(string presetId, string scenario)
        {
            return Presets.Resolve(presetId, scenario);
        }

        public static string SuggestedFileName(LayoutDoc doc)
        {
            StringBuilder builder = new StringBuilder();
            string title = (doc.Title ?? "").Trim();
            char[] invalid = Path.GetInvalidFileNameChars();
            for (int i = 0; i < title.Length && builder.Length < 40; i++)
            {
                char ch = title[i];
                bool bad = false;
                for (int k = 0; k < invalid.Length; k++) if (invalid[k] == ch) { bad = true; break; }
                if (!bad && ch != '\r' && ch != '\n') builder.Append(ch);
            }
            string name = builder.ToString().Trim();
            if (name.Length == 0) name = "排版-" + doc.Preset.Name;
            return name + "_" + DateTime.Now.ToString("yyyyMMdd-HHmm") + ".docx";
        }

        public static string ReadTextFile(string path)
        {
            byte[] bytes = File.ReadAllBytes(path);
            if (bytes.Length >= 3 && bytes[0] == 0xEF && bytes[1] == 0xBB && bytes[2] == 0xBF) return Encoding.UTF8.GetString(bytes, 3, bytes.Length - 3);
            if (bytes.Length >= 2 && bytes[0] == 0xFF && bytes[1] == 0xFE) return Encoding.Unicode.GetString(bytes, 2, bytes.Length - 2);
            if (bytes.Length >= 2 && bytes[0] == 0xFE && bytes[1] == 0xFF) return Encoding.BigEndianUnicode.GetString(bytes, 2, bytes.Length - 2);
            try
            {
                UTF8Encoding strict = new UTF8Encoding(false, true);
                return strict.GetString(bytes);
            }
            catch (DecoderFallbackException)
            {
                return Encoding.GetEncoding(936).GetString(bytes);
            }
        }

        public static string Json(string value)
        {
            if (value == null) return "null";
            StringBuilder builder = new StringBuilder("\"");
            foreach (char ch in value)
            {
                switch (ch)
                {
                    case '"': builder.Append("\\\""); break;
                    case '\\': builder.Append("\\\\"); break;
                    case '\n': builder.Append("\\n"); break;
                    case '\r': builder.Append("\\r"); break;
                    case '\t': builder.Append("\\t"); break;
                    default:
                        if (ch < ' ') builder.Append("\\u").Append(((int)ch).ToString("x4"));
                        else builder.Append(ch);
                        break;
                }
            }
            builder.Append("\"");
            return builder.ToString();
        }
    }

    internal static class Program
    {
        [DllImport("kernel32.dll")]
        private static extern bool AttachConsole(int processId);

        [STAThread]
        private static void Main(string[] args)
        {
            if (args.Length > 0 && (args[0] == "--cli" || args[0] == "/cli"))
            {
                AttachConsole(-1);
                Environment.ExitCode = RunCli(args);
                return;
            }
            if (args.Length > 0 && (args[0] == "--selftest" || args[0] == "/selftest"))
            {
                AttachConsole(-1);
                Environment.ExitCode = RunSelfTest(args.Length > 1 ? args[1] : ".");
                return;
            }
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new MainForm());
        }

        private static Dictionary<string, string> ParseFlags(string[] args)
        {
            Dictionary<string, string> flags = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            for (int i = 1; i < args.Length; i++)
            {
                string arg = args[i];
                if (!arg.StartsWith("--", StringComparison.Ordinal)) continue;
                string key = arg.Substring(2);
                string value = "";
                if (i + 1 < args.Length && !args[i + 1].StartsWith("--", StringComparison.Ordinal))
                {
                    value = args[i + 1];
                    i++;
                }
                flags[key] = value;
            }
            return flags;
        }

        private static string Get(Dictionary<string, string> flags, string key, string fallback)
        {
            string value;
            return flags.TryGetValue(key, out value) ? value : fallback;
        }

        private static int RunCli(string[] args)
        {
            Dictionary<string, string> flags = ParseFlags(args);
            string text;
            string input = Get(flags, "input", "");
            if (input.Length > 0)
            {
                if (!File.Exists(input)) { Console.WriteLine("error: input file not found: " + input); return 2; }
                text = Engine.ReadTextFile(input);
            }
            else
            {
                text = Get(flags, "text", "");
            }
            if (text.Trim().Length == 0) { Console.WriteLine("error: no input text; pass --input <file.txt> or --text <text>"); return 2; }

            string presetId = Get(flags, "preset", "auto");
            string scenario = Get(flags, "scenario", "");
            string title = Get(flags, "title", "");
            string output = Get(flags, "out", "");
            if (output.Length == 0) { Console.WriteLine("error: --out <file.docx> is required"); return 2; }

            try
            {
                ResolvedPreset resolved = Engine.Resolve(presetId, scenario);
                LayoutDoc doc = Layouter.Build(text, resolved.Preset, title);
                byte[] bytes = Docx.Build(doc);
                string directory = Path.GetDirectoryName(Path.GetFullPath(output));
                if (!string.IsNullOrEmpty(directory)) Directory.CreateDirectory(directory);
                File.WriteAllBytes(output, bytes);

                StringBuilder json = new StringBuilder();
                json.Append("{\"ok\":true,\"path\":").Append(Engine.Json(Path.GetFullPath(output)));
                json.Append(",\"preset\":").Append(Engine.Json(resolved.Preset.Id));
                json.Append(",\"presetName\":").Append(Engine.Json(resolved.Preset.Name));
                json.Append(",\"matched\":").Append(resolved.Matched ? "true" : "false");
                json.Append(",\"reason\":").Append(Engine.Json(resolved.Reason));
                json.Append(",\"bytes\":").Append(bytes.Length);
                json.Append(",\"paragraphs\":").Append(doc.ParagraphCount);
                json.Append(",\"headings\":").Append(doc.HeadingCount);
                json.Append(",\"characters\":").Append(doc.CharacterCount);
                json.Append(",\"pages\":").Append(Layouter.EstimatePages(doc));
                json.Append(",\"title\":").Append(Engine.Json(doc.Title)).Append("}");
                Console.WriteLine(json.ToString());
                return 0;
            }
            catch (Exception error)
            {
                Console.WriteLine("error: " + error.Message);
                return 1;
            }
        }

        private static int RunSelfTest(string outputDirectory)
        {
            try
            {
                Directory.CreateDirectory(outputDirectory);
                StringBuilder json = new StringBuilder("[");
                List<Preset> presets = Presets.All;
                for (int i = 0; i < presets.Count; i++)
                {
                    Preset preset = presets[i];
                    string text = Samples.For(preset.Id);
                    LayoutDoc doc = Layouter.Build(text, preset, "");
                    byte[] bytes = Docx.Build(doc);
                    string path = Path.Combine(outputDirectory, preset.Id + ".docx");
                    File.WriteAllBytes(path, bytes);
                    if (i > 0) json.Append(",");
                    json.Append("{\"preset\":").Append(Engine.Json(preset.Id));
                    json.Append(",\"file\":").Append(Engine.Json(path));
                    json.Append(",\"bytes\":").Append(bytes.Length);
                    json.Append(",\"paragraphs\":").Append(doc.ParagraphCount);
                    json.Append(",\"headings\":").Append(doc.HeadingCount);
                    json.Append(",\"pages\":").Append(Layouter.EstimatePages(doc));
                    json.Append(",\"title\":").Append(Engine.Json(doc.Title)).Append("}");
                }
                json.Append("]");
                Console.WriteLine(json.ToString());
                return 0;
            }
            catch (Exception error)
            {
                Console.WriteLine("error: " + error.Message);
                return 1;
            }
        }
    }
}
