using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Windows.Forms;

namespace FormatStudio
{
    /// <summary>Main window: paste text, pick a format, generate a typeset .docx.</summary>
    internal sealed class MainForm : Form
    {
        private ComboBox presetBox;
        private TextBox scenarioBox;
        private TextBox titleBox;
        private TextBox editor;
        private Label statusLabel;
        private Button openButton;
        private Timer statusTimer;
        private string lastOutput = "";

        private static readonly Color Accent = Color.FromArgb(31, 95, 191);
        private static readonly Color Muted = Color.FromArgb(110, 118, 129);
        private static readonly Color PageBack = Color.FromArgb(244, 246, 249);
        private static readonly Color Ink = Color.FromArgb(32, 37, 45);

        public MainForm()
        {
            SuspendLayout();
            Text = "排版工作台 — 文档格式一键整理";
            Font = new Font("Microsoft YaHei UI", 9F);
            AutoScaleMode = AutoScaleMode.None;
            ClientSize = new Size(1100, 700);
            MinimumSize = new Size(880, 560);
            StartPosition = FormStartPosition.CenterScreen;
            AllowDrop = true;
            KeyPreview = true;
            BackColor = PageBack;

            BuildLayout();

            DragEnter += OnDragEnter;
            DragDrop += OnDragDrop;
            KeyDown += OnKeyDown;

            statusTimer = new Timer();
            statusTimer.Interval = 500;
            statusTimer.Tick += (sender, e) => { statusTimer.Stop(); UpdateStatus(); };

            ResumeLayout(false);
            PerformLayout();
            UpdateStatus();
        }

        /* ------------------------------------------------------------ layout --- */

        private void BuildLayout()
        {
            TableLayoutPanel root = new TableLayoutPanel();
            root.Dock = DockStyle.Fill;
            root.ColumnCount = 1;
            root.RowCount = 5;
            root.Padding = new Padding(18, 14, 18, 10);
            root.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
            root.RowStyles.Add(new RowStyle(SizeType.Absolute, 100));
            root.RowStyles.Add(new RowStyle(SizeType.Absolute, 24));
            root.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
            root.RowStyles.Add(new RowStyle(SizeType.Absolute, 8));
            root.RowStyles.Add(new RowStyle(SizeType.Absolute, 88));

            root.Controls.Add(BuildHeader(), 0, 0);
            root.Controls.Add(BuildHint(), 0, 1);
            root.Controls.Add(BuildEditor(), 0, 2);
            root.Controls.Add(BuildFooter(), 0, 4);
            Controls.Add(root);
        }

        private Control BuildHeader()
        {
            TableLayoutPanel grid = new TableLayoutPanel();
            grid.Dock = DockStyle.Fill;
            grid.Margin = new Padding(0);
            grid.ColumnCount = 4;
            grid.RowCount = 2;
            grid.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 150));
            grid.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 236));
            grid.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 150));
            grid.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
            grid.RowStyles.Add(new RowStyle(SizeType.Absolute, 36));
            grid.RowStyles.Add(new RowStyle(SizeType.Absolute, 36));

            presetBox = new ComboBox();
            presetBox.DropDownStyle = ComboBoxStyle.DropDownList;
            presetBox.Dock = DockStyle.Fill;
            presetBox.Margin = new Padding(0, 4, 12, 4);
            presetBox.Items.Add("自动匹配（按应用场景）");
            for (int i = 0; i < Presets.All.Count; i++) presetBox.Items.Add(Presets.All[i].Name);
            presetBox.SelectedIndex = 0;

            scenarioBox = new TextBox();
            scenarioBox.Dock = DockStyle.Fill;
            scenarioBox.Margin = new Padding(0, 4, 0, 4);
            scenarioBox.TextChanged += (sender, e) => ScheduleStatus();
            scenarioBox.Font = new Font("Microsoft YaHei UI", 9F);

            titleBox = new TextBox();
            titleBox.Dock = DockStyle.Fill;
            titleBox.Margin = new Padding(0, 4, 0, 4);

            grid.Controls.Add(MakeLabel("目标格式"), 0, 0);
            grid.Controls.Add(presetBox, 1, 0);
            grid.Controls.Add(MakeLabel("应用场景"), 2, 0);
            grid.Controls.Add(scenarioBox, 3, 0);
            grid.Controls.Add(MakeLabel("文档标题"), 0, 1);
            grid.Controls.Add(titleBox, 1, 1);
            grid.SetColumnSpan(titleBox, 3);
            return grid;
        }

        private Control BuildHint()
        {
            Label hint = new Label();
            hint.Dock = DockStyle.Fill;
            hint.Margin = new Padding(0);
            hint.Text = "全文内容（Ctrl+V 粘贴；也可以把 .txt 文件直接拖进窗口）";
            hint.ForeColor = Muted;
            hint.TextAlign = ContentAlignment.MiddleLeft;
            return hint;
        }

        private Control BuildEditor()
        {
            editor = new TextBox();
            editor.Dock = DockStyle.Fill;
            editor.Margin = new Padding(0);
            editor.Multiline = true;
            editor.ScrollBars = ScrollBars.Vertical;
            editor.AcceptsReturn = true;
            editor.AcceptsTab = true;
            editor.WordWrap = true;
            editor.Font = new Font("宋体", 11F);
            editor.BorderStyle = BorderStyle.FixedSingle;
            editor.BackColor = Color.White;
            editor.TextChanged += (sender, e) => ScheduleStatus();
            editor.AllowDrop = true;
            editor.DragEnter += OnDragEnter;
            editor.DragDrop += OnDragDrop;
            return editor;
        }

        private Control BuildFooter()
        {
            TableLayoutPanel footer = new TableLayoutPanel();
            footer.Dock = DockStyle.Fill;
            footer.Margin = new Padding(0);
            footer.ColumnCount = 1;
            footer.RowCount = 2;
            footer.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
            footer.RowStyles.Add(new RowStyle(SizeType.Absolute, 46));
            footer.RowStyles.Add(new RowStyle(SizeType.Absolute, 32));

            FlowLayoutPanel buttons = new FlowLayoutPanel();
            buttons.Dock = DockStyle.Fill;
            buttons.Margin = new Padding(0);
            buttons.WrapContents = false;
            buttons.FlowDirection = FlowDirection.LeftToRight;

            Button generateButton = MakeButton("生成 Word 文档", true);
            generateButton.Click += OnGenerate;
            openButton = MakeButton("打开刚生成的文件", false);
            openButton.Enabled = false;
            openButton.Click += (sender, e) => OpenOutput();
            Button copyButton = MakeButton("复制排版文本", false);
            copyButton.Click += OnCopy;
            Button outlineButton = MakeButton("查看识别结构", false);
            outlineButton.Click += OnOutline;
            Button openFileButton = MakeButton("打开文本文件", false);
            openFileButton.Click += OnOpenFile;
            Button sampleButton = MakeButton("填入示例", false);
            sampleButton.Click += OnSample;
            Button clearButton = MakeButton("清空", false);
            clearButton.Click += OnClear;

            buttons.Controls.Add(generateButton);
            buttons.Controls.Add(openButton);
            buttons.Controls.Add(copyButton);
            buttons.Controls.Add(outlineButton);
            buttons.Controls.Add(openFileButton);
            buttons.Controls.Add(sampleButton);
            buttons.Controls.Add(clearButton);

            statusLabel = new Label();
            statusLabel.Dock = DockStyle.Fill;
            statusLabel.Margin = new Padding(2, 0, 0, 0);
            statusLabel.ForeColor = Muted;
            statusLabel.TextAlign = ContentAlignment.MiddleLeft;
            statusLabel.AutoEllipsis = true;

            footer.Controls.Add(buttons, 0, 0);
            footer.Controls.Add(statusLabel, 0, 1);
            return footer;
        }

        private static Label MakeLabel(string text)
        {
            Label label = new Label();
            label.Text = text;
            label.Dock = DockStyle.Fill;
            label.Margin = new Padding(0, 4, 8, 4);
            label.TextAlign = ContentAlignment.MiddleLeft;
            return label;
        }

        private static Button MakeButton(string text, bool primary)
        {
            Button button = new Button();
            button.Text = text;
            button.AutoSize = false;
            button.Height = 34;
            button.Width = Math.Max(92, text.Length * 15 + 30);
            button.Margin = new Padding(0, 6, 8, 4);
            button.FlatStyle = FlatStyle.Flat;
            button.FlatAppearance.BorderSize = 1;
            button.Cursor = Cursors.Hand;
            button.UseVisualStyleBackColor = false;
            if (primary)
            {
                button.BackColor = Accent;
                button.ForeColor = Color.White;
                button.FlatAppearance.BorderColor = Accent;
                button.Font = new Font("Microsoft YaHei UI", 9.5F, FontStyle.Bold);
            }
            else
            {
                button.BackColor = Color.White;
                button.ForeColor = Ink;
                button.FlatAppearance.BorderColor = Color.FromArgb(206, 212, 222);
            }
            return button;
        }

        /* ------------------------------------------------------------ actions --- */

        private string CurrentPresetId()
        {
            int index = presetBox.SelectedIndex;
            if (index <= 0) return "auto";
            return index - 1 < Presets.All.Count ? Presets.All[index - 1].Id : "auto";
        }

        private void ScheduleStatus()
        {
            if (statusTimer == null) return;
            statusTimer.Stop();
            statusTimer.Start();
        }

        private void UpdateStatus()
        {
            string text = editor.Text;
            if (text.Trim().Length == 0)
            {
                statusLabel.ForeColor = Muted;
                statusLabel.Text = "① 粘贴全文　② 选格式或填场景　③ 点「生成 Word 文档」，再选择保存位置即可";
                return;
            }
            ResolvedPreset resolved = Engine.Resolve(CurrentPresetId(), scenarioBox.Text);
            string suffix = resolved.Matched ? "" : "（未识别场景，用通用格式）";
            statusLabel.ForeColor = Ink;
            statusLabel.Text = string.Format("{0:N0} 字符 · 将按「{1}」排版{2}", text.Length, resolved.Preset.Name, suffix);
        }

        private void OnGenerate(object sender, EventArgs e)
        {
            string text = editor.Text;
            if (text.Trim().Length == 0)
            {
                MessageBox.Show(this, "请先粘贴或打开需要整理格式的全文。", "还没有内容", MessageBoxButtons.OK, MessageBoxIcon.Information);
                editor.Focus();
                return;
            }
            try
            {
                ResolvedPreset resolved = Engine.Resolve(CurrentPresetId(), scenarioBox.Text);
                LayoutDoc doc = Layouter.Build(text, resolved.Preset, titleBox.Text.Trim());
                string suggested = Engine.SuggestedFileName(doc);
                using (SaveFileDialog dialog = new SaveFileDialog())
                {
                    dialog.Title = "保存排版好的 Word 文档";
                    dialog.Filter = "Word 文档 (*.docx)|*.docx";
                    dialog.FileName = suggested;
                    dialog.OverwritePrompt = true;
                    try { dialog.InitialDirectory = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory); }
                    catch { }
                    if (dialog.ShowDialog(this) != DialogResult.OK) return;

                    byte[] bytes = Docx.Build(doc);
                    File.WriteAllBytes(dialog.FileName, bytes);
                    lastOutput = dialog.FileName;
                    openButton.Enabled = true;
                    statusLabel.ForeColor = Color.FromArgb(20, 120, 60);
                    statusLabel.Text = string.Format("已保存：{0}（{1}，约 {2} 页）", dialog.FileName, resolved.Preset.Name, Layouter.EstimatePages(doc));
                    DialogResult open = MessageBox.Show(this,
                        "文档已生成：\n" + dialog.FileName + "\n\n现在打开看看吗？",
                        "生成成功", MessageBoxButtons.YesNo, MessageBoxIcon.Information);
                    if (open == DialogResult.Yes) OpenOutput();
                }
            }
            catch (Exception error)
            {
                MessageBox.Show(this, "生成失败：" + error.Message, "出错了", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

        private void OnCopy(object sender, EventArgs e)
        {
            if (editor.Text.Trim().Length == 0)
            {
                MessageBox.Show(this, "请先粘贴或打开需要整理格式的全文。", "还没有内容", MessageBoxButtons.OK, MessageBoxIcon.Information);
                return;
            }
            try
            {
                ResolvedPreset resolved = Engine.Resolve(CurrentPresetId(), scenarioBox.Text);
                LayoutDoc doc = Layouter.Build(editor.Text, resolved.Preset, titleBox.Text.Trim());
                Clipboard.SetText(Layouter.ToPlainText(doc));
                statusLabel.ForeColor = Color.FromArgb(20, 120, 60);
                statusLabel.Text = "已复制整理后的纯文本（含首行缩进），可直接粘贴到任意编辑器。";
            }
            catch (Exception error)
            {
                MessageBox.Show(this, "复制失败：" + error.Message, "出错了", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

        private void OnOutline(object sender, EventArgs e)
        {
            if (editor.Text.Trim().Length == 0)
            {
                MessageBox.Show(this, "请先粘贴或打开需要整理格式的全文。", "还没有内容", MessageBoxButtons.OK, MessageBoxIcon.Information);
                return;
            }
            ParseResult parsed = Parser.Parse(editor.Text);
            System.Collections.Generic.List<string[]> rows = Layouter.Describe(parsed.Blocks);

            Form window = new Form();
            window.Text = "识别结构 — 共 " + parsed.Blocks.Count + " 段";
            window.Size = new Size(760, 560);
            window.StartPosition = FormStartPosition.CenterParent;
            window.Font = Font;
            window.MinimizeBox = false;
            window.BackColor = Color.White;

            ListView list = new ListView();
            list.Dock = DockStyle.Fill;
            list.View = View.Details;
            list.FullRowSelect = true;
            list.GridLines = false;
            list.Columns.Add("类型", 110);
            list.Columns.Add("内容", 600);
            for (int i = 0; i < rows.Count; i++) list.Items.Add(new ListViewItem(new string[] { rows[i][1], rows[i][2] }));
            window.Controls.Add(list);
            window.ShowDialog(this);
        }

        private void OnOpenFile(object sender, EventArgs e)
        {
            using (OpenFileDialog dialog = new OpenFileDialog())
            {
                dialog.Title = "打开文本文件";
                dialog.Filter = "文本文件 (*.txt;*.md)|*.txt;*.md|所有文件 (*.*)|*.*";
                if (dialog.ShowDialog(this) != DialogResult.OK) return;
                try
                {
                    editor.Text = Engine.ReadTextFile(dialog.FileName);
                    statusLabel.ForeColor = Muted;
                    statusLabel.Text = "已载入：" + dialog.FileName;
                }
                catch (Exception error)
                {
                    MessageBox.Show(this, "读取失败：" + error.Message, "出错了", MessageBoxButtons.OK, MessageBoxIcon.Error);
                }
            }
        }

        private void OnSample(object sender, EventArgs e)
        {
            editor.Text = Samples.Gov;
            presetBox.SelectedIndex = 3;
            statusLabel.ForeColor = Muted;
            statusLabel.Text = "已填入示例：一份需要排版的公文草稿。";
        }

        private void OnClear(object sender, EventArgs e)
        {
            editor.Text = "";
            titleBox.Text = "";
            editor.Focus();
        }

        private void OpenOutput()
        {
            if (lastOutput.Length == 0 || !File.Exists(lastOutput)) return;
            try
            {
                ProcessStartInfo info = new ProcessStartInfo(lastOutput);
                info.UseShellExecute = true;
                Process.Start(info);
            }
            catch (Exception error)
            {
                MessageBox.Show(this, "无法打开文件：" + error.Message, "出错了", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            }
        }

        private void OnKeyDown(object sender, KeyEventArgs e)
        {
            if (e.Control && e.KeyCode == Keys.Enter)
            {
                e.SuppressKeyPress = true;
                OnGenerate(sender, EventArgs.Empty);
            }
        }

        private void OnDragEnter(object sender, DragEventArgs e)
        {
            if (e.Data != null && e.Data.GetDataPresent(DataFormats.FileDrop)) e.Effect = DragDropEffects.Copy;
        }

        private void OnDragDrop(object sender, DragEventArgs e)
        {
            try
            {
                string[] files = (string[])e.Data.GetData(DataFormats.FileDrop);
                if (files == null || files.Length == 0) return;
                string path = files[0];
                if (!File.Exists(path)) return;
                string extension = Path.GetExtension(path).ToLowerInvariant();
                if (extension == ".txt" || extension == ".md" || extension == "")
                {
                    editor.Text = Engine.ReadTextFile(path);
                    statusLabel.ForeColor = Muted;
                    statusLabel.Text = "已载入：" + path;
                }
                else
                {
                    MessageBox.Show(this, "目前只支持拖入 .txt / .md 文本文件。\n如果是 Word 文档，请打开后复制正文，再粘贴到输入框。",
                        "暂不支持该文件", MessageBoxButtons.OK, MessageBoxIcon.Information);
                }
            }
            catch (Exception error)
            {
                MessageBox.Show(this, "读取失败：" + error.Message, "出错了", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }
    }
}
