param(
    [string]$Exe = 'D:\Users\ASUS\Desktop\format-studio\dist\FormatStudio.exe',
    [string]$Out = 'D:\Users\ASUS\Desktop\format-studio\test\gui-window.png',
    [string]$ScreenOut = 'D:\Users\ASUS\Desktop\format-studio\test\gui-screen.png'
)
# Launches the app, brings it to the foreground and captures it twice: the
# window bitmap via PrintWindow, and the on-screen rectangle. ASCII-only.

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
Add-Type -TypeDefinition @'
using System;
using System.Drawing;
using System.Runtime.InteropServices;

public class WindowCapture2
{
    [StructLayout(LayoutKind.Sequential)]
    public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }

    [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr hwnd, IntPtr hdc, uint flags);
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hwnd, out RECT rect);
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hwnd);
    [DllImport("user32.dll")] public static extern bool BringWindowToTop(IntPtr hwnd);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hwnd, int cmd);
    [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();

    public static string Describe(IntPtr hwnd)
    {
        RECT rect;
        GetWindowRect(hwnd, out rect);
        return (rect.Right - rect.Left) + "x" + (rect.Bottom - rect.Top) + " at " + rect.Left + "," + rect.Top;
    }

    public static Bitmap CaptureWindow(IntPtr hwnd)
    {
        RECT rect;
        GetWindowRect(hwnd, out rect);
        int width = Math.Max(1, rect.Right - rect.Left);
        int height = Math.Max(1, rect.Bottom - rect.Top);
        Bitmap bitmap = new Bitmap(width, height);
        using (Graphics graphics = Graphics.FromImage(bitmap))
        {
            IntPtr hdc = graphics.GetHdc();
            try { PrintWindow(hwnd, hdc, 2); }
            finally { graphics.ReleaseHdc(hdc); }
        }
        return bitmap;
    }

    public static Bitmap CaptureScreenRect(IntPtr hwnd)
    {
        RECT rect;
        GetWindowRect(hwnd, out rect);
        int width = Math.Max(1, rect.Right - rect.Left);
        int height = Math.Max(1, rect.Bottom - rect.Top);
        Bitmap bitmap = new Bitmap(width, height);
        using (Graphics graphics = Graphics.FromImage(bitmap))
        {
            graphics.CopyFromScreen(rect.Left, rect.Top, 0, 0, new Size(width, height));
        }
        return bitmap;
    }
}
'@ -ReferencedAssemblies System.Drawing

[void][WindowCapture2]::SetProcessDPIAware()

$process = New-Object System.Diagnostics.Process
$process.StartInfo.FileName = $Exe
$process.StartInfo.UseShellExecute = $false
[void]$process.Start()

$deadline = (Get-Date).AddSeconds(15)
while ((Get-Date) -lt $deadline) {
    Start-Sleep -Milliseconds 400
    $process.Refresh()
    if ($process.HasExited) { throw 'app exited before a window appeared' }
    if ($process.MainWindowHandle -ne 0) { break }
}
Start-Sleep -Milliseconds 1500
$process.Refresh()
$handle = $process.MainWindowHandle
if ($handle -eq 0) { throw 'no main window handle' }

[void][WindowCapture2]::ShowWindow($handle, 9)
[void][WindowCapture2]::SetForegroundWindow($handle)
[void][WindowCapture2]::BringWindowToTop($handle)
Start-Sleep -Milliseconds 1200

Write-Output ("window rect: " + [WindowCapture2]::Describe($handle))

$bitmap = [WindowCapture2]::CaptureWindow($handle)
$bitmap.Save($Out, [System.Drawing.Imaging.ImageFormat]::Png)
$bitmap.Dispose()

$screen = [WindowCapture2]::CaptureScreenRect($handle)
$screen.Save($ScreenOut, [System.Drawing.Imaging.ImageFormat]::Png)
$screen.Dispose()

Write-Output ("window: " + $process.MainWindowTitle)
Write-Output ("saved: " + $Out + " / " + $ScreenOut)

[void]$process.CloseMainWindow()
Start-Sleep -Milliseconds 800
if (-not $process.HasExited) { $process.Kill() }
Write-Output 'closed'
