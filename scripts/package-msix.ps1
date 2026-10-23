param(
  [string]$MakeAppx = $env:MAKEAPPX_PATH,
  [string]$SignTool = $env:SIGNTOOL_PATH,
  [string]$Publisher = 'CN=Andika',
  [string]$CertificatePath = $env:MSIX_CERTIFICATE_PATH,
  [string]$CertificatePassword = $env:MSIX_CERTIFICATE_PASSWORD
)
$ErrorActionPreference = 'Stop'
$workspace = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$source = Join-Path $workspace 'release/webview-unpacked'
if (-not (Test-Path -LiteralPath (Join-Path $source 'Dynamic Island.exe'))) { throw 'Run npm run pack before packaging MSIX.' }
if (-not $MakeAppx) {
  $sdkRoots = @((Join-Path $workspace '.tools/windows-sdk'), "${env:ProgramFiles(x86)}/Windows Kits/10/bin")
  $candidates = foreach ($sdkRoot in $sdkRoots) {
    if (Test-Path -LiteralPath $sdkRoot) { Get-ChildItem -LiteralPath $sdkRoot -Filter 'makeappx.exe' -Recurse | Where-Object { $_.Directory.Name -eq 'x64' } }
  }
  $MakeAppx = ($candidates | Sort-Object FullName -Descending | Select-Object -First 1).FullName
}
if (-not $MakeAppx -or -not (Test-Path -LiteralPath $MakeAppx)) { throw 'Install Windows SDK Build Tools or set MAKEAPPX_PATH to MakeAppx.exe.' }
# A unique staging directory avoids deleting or mutating an earlier distribution.
$stage = Join-Path $workspace ('release/msix-stage-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $stage -Force | Out-Null
Get-ChildItem -LiteralPath $source | Copy-Item -Destination $stage -Recurse
[xml]$manifest = Get-Content -LiteralPath (Join-Path $workspace 'packaging/AppxManifest.xml') -Raw
$manifest.Package.Identity.Publisher = $Publisher
$version = (Get-Content -LiteralPath (Join-Path $workspace 'package.json') -Raw | ConvertFrom-Json).version
$manifest.Package.Identity.Version = "$version.0"
$manifest.Save((Join-Path $stage 'AppxManifest.xml'))
$assets = Join-Path $stage 'Assets'
New-Item -ItemType Directory -Path $assets -Force | Out-Null
Add-Type -AssemblyName System.Drawing
foreach ($asset in @(@('StoreLogo', 50), @('Square44x44Logo', 44), @('Square150x150Logo', 150))) {
  $size = [int]$asset[1]
  $bitmap = [Drawing.Bitmap]::new($size, $size)
  $graphics = [Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.Clear([Drawing.Color]::Transparent)
  $path = [Drawing.Drawing2D.GraphicsPath]::new()
  $x = [single]($size * .08); $y = [single]($size * .32); $height = [single]($size * .36); $width = [single]($size * .84)
  $path.AddArc($x, $y, $height, $height, 90, 180)
  $path.AddArc($x + $width - $height, $y, $height, $height, 270, 180)
  $path.CloseFigure()
  $graphics.FillPath([Drawing.Brushes]::Black, $path)
  $pen = [Drawing.Pen]::new([Drawing.Color]::FromArgb(100, 255, 255, 255), [single]($size * .015))
  $graphics.DrawPath($pen, $path)
  $brush = [Drawing.SolidBrush]::new([Drawing.Color]::FromArgb(48, 209, 88))
  $graphics.FillEllipse($brush, [single]($size * .66), [single]($size * .44), [single]($size * .12), [single]($size * .12))
  $bitmap.Save((Join-Path $assets ($asset[0] + '.png')), [Drawing.Imaging.ImageFormat]::Png)
  $brush.Dispose(); $pen.Dispose(); $path.Dispose(); $graphics.Dispose(); $bitmap.Dispose()
}
$output = Join-Path $workspace "release/Dynamic-Island-$version-x64.msix"
$buildLog = $stage + '.log'
& $MakeAppx pack /o /d $stage /p $output *> $buildLog
if ($LASTEXITCODE -ne 0) { throw "MakeAppx validation or packaging failed. See $buildLog" }
if ($CertificatePath) {
  if (-not $SignTool) { $SignTool = Join-Path (Split-Path -Parent $MakeAppx) 'signtool.exe' }
  if (-not (Test-Path -LiteralPath $SignTool)) { throw 'Set SIGNTOOL_PATH to SignTool.exe to sign the package.' }
  $signArguments = @('sign', '/fd', 'SHA256', '/f', $CertificatePath)
  if ($CertificatePassword) { $signArguments += @('/p', $CertificatePassword) }
  $signArguments += $output
  & $SignTool @signArguments
  if ($LASTEXITCODE -ne 0) { throw 'MSIX signing failed. Certificate subject must match Publisher.' }
  Write-Host "Signed MSIX: $output"
} else { Write-Host "Unsigned MSIX: $output — sign with a certificate matching '$Publisher' before installation." }
