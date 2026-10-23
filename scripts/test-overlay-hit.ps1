param([Parameter(Mandatory)][int]$HostProcessId)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class OverlayHit {
  private delegate bool EnumProc(IntPtr window, IntPtr data);
  [DllImport("user32.dll")] private static extern bool EnumWindows(EnumProc callback, IntPtr data);
  [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(IntPtr window, out uint process);
  [DllImport("user32.dll")] private static extern bool IsWindowVisible(IntPtr window);
  public static IntPtr Find(uint process) { IntPtr found = IntPtr.Zero; EnumWindows((window, data) => { uint id; GetWindowThreadProcessId(window, out id); if (id == process && IsWindowVisible(window)) { found = window; return false; } return true; }, IntPtr.Zero); return found; }
  [StructLayout(LayoutKind.Sequential)] public struct Point { public int X, Y; }
  [StructLayout(LayoutKind.Sequential)] public struct Rect { public int Left, Top, Right, Bottom; }
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr window, out Rect rect);
  [DllImport("user32.dll")] public static extern int GetWindowLong(IntPtr window, int index);
  [DllImport("user32.dll")] public static extern IntPtr WindowFromPoint(Point point);
  [DllImport("user32.dll")] public static extern IntPtr GetAncestor(IntPtr window, uint flags);
}
'@
$window = [OverlayHit]::Find($HostProcessId)
if ($window -eq [IntPtr]::Zero) { throw 'Overlay window not found' }
$rect = [OverlayHit+Rect]::new()
[void][OverlayHit]::GetWindowRect($window, [ref]$rect)
$original = [System.Windows.Forms.Cursor]::Position
try {
  $point = [OverlayHit+Point]::new()
  $point.X = [int](($rect.Left + $rect.Right) / 2)
  $point.Y = $rect.Top + 20
  [void][OverlayHit]::SetCursorPos($point.X, $point.Y)
  Start-Sleep -Milliseconds 350
  if (([OverlayHit]::GetWindowLong($window, -20) -band 0x20) -ne 0) { throw 'Pill must receive clicks' }
  if ([OverlayHit]::GetAncestor([OverlayHit]::WindowFromPoint($point), 2) -ne $window) { throw 'Pill does not receive native hit testing' }
  $point.X = $rect.Left + 5; $point.Y = $rect.Top + 150
  [void][OverlayHit]::SetCursorPos($point.X, $point.Y)
  Start-Sleep -Milliseconds 350
  if (([OverlayHit]::GetWindowLong($window, -20) -band 0x20) -eq 0) { throw 'Empty area must forward clicks' }
  if ([OverlayHit]::GetAncestor([OverlayHit]::WindowFromPoint($point), 2) -eq $window) { throw 'Empty area blocks the app underneath' }
  Write-Host 'Native hit testing passed: pill receives clicks, empty area passes through'
} finally { [void][OverlayHit]::SetCursorPos($original.X, $original.Y) }
