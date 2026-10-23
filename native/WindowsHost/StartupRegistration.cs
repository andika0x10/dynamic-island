using Microsoft.Win32;

namespace WindowsHost;

internal sealed class StartupRegistration
{
    private const string ValueName = "Dynamic Island";
    private readonly string command;
    private readonly string preferencesPath;
    private readonly string runPath;

    internal StartupRegistration(string executable,
        string preferencesPath = @"Software\Andika\DynamicIsland",
        string runPath = @"Software\Microsoft\Windows\CurrentVersion\Run")
    {
        command = "\"" + Path.GetFullPath(executable) + "\"";
        this.preferencesPath = preferencesPath;
        this.runPath = runPath;
    }

    internal bool Enabled
    {
        get { using var key = Registry.CurrentUser.OpenSubKey(preferencesPath); return !Equals(key?.GetValue("StartupEnabled"), 0); }
    }

    internal void Synchronize()
    {
        using var key = Registry.CurrentUser.CreateSubKey(runPath);
        if (Enabled) key.SetValue(ValueName, command, RegistryValueKind.String);
        else key.DeleteValue(ValueName, false);
    }

    internal void SetEnabled(bool enabled)
    {
        using var key = Registry.CurrentUser.CreateSubKey(preferencesPath);
        key.SetValue("StartupEnabled", enabled ? 1 : 0, RegistryValueKind.DWord);
        Synchronize();
    }

    internal void Remove()
    {
        using var key = Registry.CurrentUser.OpenSubKey(runPath, writable: true);
        // Uninstalling an older copy must not remove another copy's registration.
        if (string.Equals(key?.GetValue(ValueName) as string, command, StringComparison.OrdinalIgnoreCase))
            key!.DeleteValue(ValueName, false);
    }
}
