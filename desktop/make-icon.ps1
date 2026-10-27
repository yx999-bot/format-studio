# Generates app.ico (32bpp PNG-compressed entries) and icon-preview.png.
# Drawing only uses System.Drawing, which ships with Windows.

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$outIco = Join-Path $PSScriptRoot 'app.ico'
$preview = Join-Path $PSScriptRoot 'icon-preview.png'

function New-RoundedPath([float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $d = $r * 2
    $path.AddArc($x, $y, $d, $d, 180, 90)
    $path.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
    $path.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
    $path.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
    $path.CloseFigure()
    return $path
}

function New-IconPng([int]$size) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.Clear([System.Drawing.Color]::Transparent)

    $s = [float]$size
    $bg = New-RoundedPath (0.5 * $s / 64) (0.5 * $s / 64) ($s - $s / 64) ($s - $s / 64) (13 * $s / 64)
    $brush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 31, 95, 191))
    $g.FillPath($brush, $bg)
    $brush.Dispose()

    # document sheet
    $sheet = New-RoundedPath (19 * $s / 64) (10 * $s / 64) (28 * $s / 64) (45 * $s / 64) (3 * $s / 64)
    $white = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
    $g.FillPath($white, $sheet)
    $white.Dispose()
    $sheet.Dispose()

    # folded corner
    $fold = New-Object System.Drawing.Drawing2D.GraphicsPath
    $fold.AddPolygon(@(
        (New-Object System.Drawing.PointF ((37 * $s / 64), (10 * $s / 64))),
        (New-Object System.Drawing.PointF ((47 * $s / 64), (20 * $s / 64))),
        (New-Object System.Drawing.PointF ((37 * $s / 64), (20 * $s / 64)))
    ))
    $light = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 207, 224, 247))
    $g.FillPath($light, $fold)
    $light.Dispose()
    $fold.Dispose()

    # text lines
    $line = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 31, 95, 191))
    $soft = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 147, 180, 224))
    $h = [Math]::Max(1.0, 2.4 * $s / 64)
    $g.FillRectangle($line, 23 * $s / 64, 26 * $s / 64, 20 * $s / 64, $h)
    $g.FillRectangle($soft, 23 * $s / 64, 33 * $s / 64, 20 * $s / 64, $h)
    $g.FillRectangle($soft, 23 * $s / 64, 40 * $s / 64, 20 * $s / 64, $h)
    $g.FillRectangle($soft, 23 * $s / 64, 47 * $s / 64, 12 * $s / 64, $h)
    $line.Dispose()
    $soft.Dispose()

    $stream = New-Object System.IO.MemoryStream
    $bmp.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
    $bytes = $stream.ToArray()
    $stream.Dispose()
    return ,$bytes
}

$sizes = @(16, 24, 32, 48, 64, 128, 256)
$images = New-Object 'System.Collections.Generic.List[byte[]]'
foreach ($size in $sizes) { $images.Add((New-IconPng $size)) }

# preview for inspection
[System.IO.File]::WriteAllBytes($preview, $images[$images.Count - 1])

$stream = New-Object System.IO.MemoryStream
$writer = New-Object System.IO.BinaryWriter($stream)
$writer.Write([UInt16]0)            # reserved
$writer.Write([UInt16]1)            # type = icon
$writer.Write([UInt16]$sizes.Count) # image count

$offset = 6 + 16 * $sizes.Count
for ($i = 0; $i -lt $sizes.Count; $i++) {
    $size = $sizes[$i]
    $dim = if ($size -ge 256) { 0 } else { $size }
    $writer.Write([Byte]$dim)
    $writer.Write([Byte]$dim)
    $writer.Write([Byte]0)          # palette
    $writer.Write([Byte]0)          # reserved
    $writer.Write([UInt16]1)        # planes
    $writer.Write([UInt16]32)       # bpp
    $writer.Write([UInt32]$images[$i].Length)
    $writer.Write([UInt32]$offset)
    $offset += $images[$i].Length
}
foreach ($image in $images) { $writer.Write($image) }
$writer.Flush()
[System.IO.File]::WriteAllBytes($outIco, $stream.ToArray())
$writer.Dispose()
$stream.Dispose()

Write-Output ("app.ico written: " + (Get-Item $outIco).Length + " bytes, entries: " + $sizes.Count)
Write-Output ("preview: " + $preview)
