$ErrorActionPreference = 'Stop'
$source = Get-Content -LiteralPath (Join-Path $PSScriptRoot '../native/WindowsHost/StartupRegistration.cs') -Raw
# Compile the production implementation with an isolated HKCU integration harness.
$source = "using System;`nusing System.IO;`n" + $source.Replace('namespace WindowsHost;', 'namespace WindowsHost {') + "`n}"
$harness = @'
#nullable disable
public static class StartupRegistrationTest
{
    private static void Check(bool condition, string message)
    {
        if (!condition) throw new System.Exception(message);
    }

    public static void Run()
    {
        var root = @"Software\Andika\DynamicIslandStartupTests\" + System.Guid.NewGuid().ToString("N");
        var preferences = root + @"\Preferences";
        var run = root + @"\Run";
        var first = new WindowsHost.StartupRegistration(@"C:\Test App\Dynamic Island.exe", preferences, run);
        var moved = new WindowsHost.StartupRegistration(@"C:\Moved App\Dynamic Island.exe", preferences, run);
        try
        {
            Check(first.Enabled, "Startup must default to enabled");
            first.Synchronize();
            using (var key = Microsoft.Win32.Registry.CurrentUser.OpenSubKey(run))
                Check((string)key.GetValue("Dynamic Island") == "\"C:\\Test App\\Dynamic Island.exe\"", "Executable path must be quoted");
            first.SetEnabled(false);
            moved.Synchronize();
            Check(!moved.Enabled, "Opt-out must persist across upgrades and moves");
            using (var key = Microsoft.Win32.Registry.CurrentUser.OpenSubKey(run))
                Check(key.GetValue("Dynamic Island") == null, "Disabled startup must stay removed");
            moved.SetEnabled(true);
            first.Remove();
            using (var key = Microsoft.Win32.Registry.CurrentUser.OpenSubKey(run))
                Check((string)key.GetValue("Dynamic Island") == "\"C:\\Moved App\\Dynamic Island.exe\"", "Old uninstall must preserve new path");
            first.Synchronize();
            using (var key = Microsoft.Win32.Registry.CurrentUser.OpenSubKey(run))
                Check((string)key.GetValue("Dynamic Island") == "\"C:\\Test App\\Dynamic Island.exe\"", "Launching a moved copy must refresh the path");
            first.Remove();
            first.Remove();
            using (var key = Microsoft.Win32.Registry.CurrentUser.OpenSubKey(run))
                Check(key.GetValue("Dynamic Island") == null, "Uninstall must remove its registration idempotently");
        }
        finally { Microsoft.Win32.Registry.CurrentUser.DeleteSubKeyTree(root, false); }
    }
}
'@
Add-Type -TypeDefinition ($source + "`n" + $harness) -CompilerOptions '/nullable:enable' -WarningAction SilentlyContinue
[StartupRegistrationTest]::Run()
Write-Host 'Startup registration integration tests passed.'
