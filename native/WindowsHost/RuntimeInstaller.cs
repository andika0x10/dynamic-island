using System.Diagnostics;
using System.Net;
using System.Text;
using Microsoft.Web.WebView2.Core;

namespace WindowsHost;

internal static class RuntimeInstaller
{
    internal static int Ensure()
    {
        try { CoreWebView2Environment.GetAvailableBrowserVersionString(); return 0; }
        catch (WebView2RuntimeNotFoundException) { }
        string path = Path.Combine(Path.GetTempPath(), "island-webview-" + Guid.NewGuid().ToString("N") + ".exe");
        try
        {
            ServicePointManager.SecurityProtocol = SecurityProtocolType.Tls12;
            using (var client = new WebClient()) client.DownloadFile("https://go.microsoft.com/fwlink/p/?LinkId=2124703", path);
            // Validate both Authenticode trust and Microsoft publisher before execution.
            var script = "$s = Get-AuthenticodeSignature -LiteralPath '" + path.Replace("'", "''") + "'; if ($s.Status -ne 'Valid' -or $s.SignerCertificate.Subject -notmatch 'O=Microsoft Corporation') { exit 1 }";
            var powershell = Path.Combine(Environment.SystemDirectory, @"WindowsPowerShell\v1.0\powershell.exe");
            using (var verification = Process.Start(new ProcessStartInfo(powershell, "-NoProfile -NonInteractive -EncodedCommand " + Convert.ToBase64String(Encoding.Unicode.GetBytes(script))) { UseShellExecute = false, CreateNoWindow = true }))
            {
                if (verification == null || !verification.WaitForExit(60000) || verification.ExitCode != 0) return 1;
            }
            using (var install = Process.Start(new ProcessStartInfo(path, "/silent /install") { UseShellExecute = false, CreateNoWindow = true }))
            {
                if (install == null || !install.WaitForExit(600000)) return 1;
            }
            CoreWebView2Environment.GetAvailableBrowserVersionString();
            return 0;
        }
        catch { return 1; }
        finally { try { File.Delete(path); } catch { } }
    }
}
