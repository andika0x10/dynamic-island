param([Parameter(Mandatory)][string]$OutputPath)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms
$area = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea
$image = [System.Drawing.Bitmap]::new(460, 320)
$graphics = [System.Drawing.Graphics]::FromImage($image)
try {
  $graphics.CopyFromScreen($area.X + [int](($area.Width - 460) / 2), $area.Y + 12, 0, 0, $image.Size)
  $image.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
} finally { $graphics.Dispose(); $image.Dispose() }
