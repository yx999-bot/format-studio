# Builds the standalone Windows app with the .NET Framework compiler that ships
# with Windows. No SDK, no NuGet, no runtime install required on the target PC.
#
#   pwsh -File desktop/build.ps1
#
# Output: dist\排版工作台.exe

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$dist = Join-Path $root 'dist'
$csc = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (-not (Test-Path $csc)) {
    $csc = Join-Path $env:WINDIR 'Microsoft.NET\Framework\v4.0.30319\csc.exe'
}
if (-not (Test-Path $csc)) { throw 'csc.exe (.NET Framework 4.x) not found' }

New-Item -ItemType Directory -Path $dist -Force | Out-Null

$icon = Join-Path $PSScriptRoot 'app.ico'
if (-not (Test-Path $icon)) { & (Join-Path $PSScriptRoot 'make-icon.ps1') | Out-Null }
if (-not (Test-Path $icon)) { throw 'app.ico is missing; run make-icon.ps1' }

$manifest = Join-Path $PSScriptRoot 'app.manifest'
# ASCII output name only: Windows PowerShell 5.1 reads this script with the ANSI
# codepage, so non-ASCII literals here would be corrupted. Rename/copy the
# produced exe outside this script.
$built = Join-Path $dist 'FormatStudio.exe'
$sources = Get-ChildItem (Join-Path $PSScriptRoot '*.cs') | ForEach-Object { $_.FullName }

$arguments = @(
    '/nologo',
    '/target:winexe',
    '/optimize+',
    '/codepage:65001',
    ('/out:"' + $built + '"'),
    ('/win32icon:"' + $icon + '"'),
    ('/win32manifest:"' + $manifest + '"'),
    '/r:System.dll',
    '/r:System.Core.dll',
    '/r:System.Drawing.dll',
    '/r:System.Windows.Forms.dll'
) + $sources

& $csc @arguments
if ($LASTEXITCODE -ne 0) { throw "compile failed with exit code $LASTEXITCODE" }

$info = Get-Item -LiteralPath $built
Write-Output ("built: " + $info.FullName + " (" + $info.Length + " bytes, " + $sources.Count + " source files)")
