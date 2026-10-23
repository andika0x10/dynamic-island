using System.Drawing;
using System.Runtime.InteropServices;
using System.Text.Json;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace WindowsHost;

internal static class Program
{
    [STAThread]
    private static int Main(string[] args)
    {
        if (args.Contains("--ensure-webview")) return RuntimeInstaller.Ensure();
        var profile = Environment.GetEnvironmentVariable("ISLAND_PROFILE_DIR");
        var suffix = "";
        if (profile != null) {
            using var hash = System.Security.Cryptography.SHA256.Create();
            suffix = "." + BitConverter.ToString(hash.ComputeHash(System.Text.Encoding.UTF8.GetBytes(Path.GetFullPath(profile).ToLowerInvariant()))).Replace("-", "").Substring(0, 16);
        }
        Native.ShowMessage = Native.RegisterShowMessage(suffix);
        using var mutex = new Mutex(true, @"Local\Andika.DynamicIsland.WebView2" + suffix, out var first);
        if (!first) { Native.PostMessage((IntPtr)0xffff, Native.ShowMessage, IntPtr.Zero, IntPtr.Zero); return 0; }
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        Application.SetUnhandledExceptionMode(UnhandledExceptionMode.ThrowException);
        try { Trace("Creating overlay"); Application.Run(new Overlay()); }
        catch (Exception error) { Trace(error.ToString()); if (Environment.GetEnvironmentVariable("ISLAND_TEST") != "1") MessageBox.Show(error.Message, "Dynamic Island", MessageBoxButtons.OK, MessageBoxIcon.Error); return 1; }
        return 0;
    }
    internal static void Trace(string text)
    {
        if (Environment.GetEnvironmentVariable("ISLAND_TEST") != "1") return;
        try { File.AppendAllText(Path.Combine(Environment.GetEnvironmentVariable("ISLAND_PROFILE_DIR")!, "startup-trace.txt"), DateTime.UtcNow.ToString("O") + " " + text + Environment.NewLine); } catch { }
    }
}

internal sealed class Overlay : Form
{
    private readonly WebView2 web = new() { Dock = DockStyle.Fill, DefaultBackgroundColor = Color.Transparent };
    private readonly NotifyIcon tray;
    private readonly ActivityService service;
    private readonly System.Windows.Forms.Timer hitTest = new() { Interval = 40 };
    private bool ready, moving;
    private bool ignore = true;
    private readonly string profile;
    internal Overlay()
    {
        Text = "Dynamic Island"; FormBorderStyle = FormBorderStyle.None;
        ShowInTaskbar = false; TopMost = true; StartPosition = FormStartPosition.Manual;
        BackColor = Color.Black; AutoScaleMode = AutoScaleMode.None;
        profile = Environment.GetEnvironmentVariable("ISLAND_PROFILE_DIR") ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "dynamic-island");
        Directory.CreateDirectory(profile);
        service = new(profile);
        Controls.Add(web);
        var menu = new ContextMenuStrip();
        menu.Items.Add("Tampilkan", null, (_, _) => ShowOverlay());
        menu.Items.Add("Sembunyikan", null, (_, _) => Hide());
        menu.Items.Add(new ToolStripSeparator());
        menu.Items.Add("Keluar", null, (_, _) => Close());
        using var bitmap = new Bitmap(16, 16);
        using (var graphics = Graphics.FromImage(bitmap)) { graphics.Clear(Color.Transparent); graphics.FillRoundedPill(); }
        var iconHandle = bitmap.GetHicon();
        using var borrowed = Icon.FromHandle(iconHandle);
        var icon = (Icon)borrowed.Clone(); Native.DestroyIcon(iconHandle);
        tray = new NotifyIcon { Text = "Dynamic Island", Icon = icon, ContextMenuStrip = menu, Visible = true };
        tray.DoubleClick += (_, _) => ShowOverlay();
        service.Changed += Publish;
        Shown += async (_, _) => await InitializeAsync();
        Microsoft.Win32.SystemEvents.DisplaySettingsChanged += DisplayChanged;
        PositionOverlay();
        // Unlike Electron's forwarding mode, WebView2 doesn't receive mousemove
        // while click-through is enabled. Poll the cursor and ask the DOM to hit-test.
        hitTest.Tick += async (_, _) => {
            if (!ready || !Visible || moving) return;
            moving = true;
            try {
                var point = web.PointToClient(Cursor.Position);
                var scale = DeviceDpi / 96.0;
                var x = (point.X / scale).ToString(System.Globalization.CultureInfo.InvariantCulture);
                var y = (point.Y / scale).ToString(System.Globalization.CultureInfo.InvariantCulture);
                var inside = await web.ExecuteScriptAsync($"!!document.elementFromPoint({x},{y})?.closest('[data-island]')");
                SetClickThrough(inside != "true");
            } catch { } finally { moving = false; }
        };
    }
    protected override bool ShowWithoutActivation => true;
    protected override CreateParams CreateParams { get { var p = base.CreateParams; p.ExStyle |= 0x80; return p; } }
    protected override void OnHandleCreated(EventArgs e)
    {
        base.OnHandleCreated(e);
        var blur = new Native.Blur { Flags = 3, Enabled = true, Region = Native.CreateRectRgn(0, 0, -1, -1) };
        Native.DwmEnableBlurBehindWindow(Handle, ref blur); Native.DeleteObject(blur.Region);
        SetClickThrough(true, true);
    }
    protected override void OnPaintBackground(PaintEventArgs e) { e.Graphics.Clear(Color.Black); }
    private async Task InitializeAsync()
    {
        try
        {
            Program.Trace("Creating WebView2 environment");
            var environment = await CoreWebView2Environment.CreateAsync(null, Path.Combine(profile, "WebView2"));
            Program.Trace("Creating WebView2 controller");
            await web.EnsureCoreWebView2Async(environment);
            Program.Trace("WebView2 controller ready");
            var core = web.CoreWebView2;
            core.Settings.AreDefaultContextMenusEnabled = false;
            core.Settings.AreDevToolsEnabled = Environment.GetEnvironmentVariable("ISLAND_TEST") == "1";
            core.Settings.AreBrowserAcceleratorKeysEnabled = false;
            core.Settings.IsStatusBarEnabled = false;
            core.Settings.IsZoomControlEnabled = false;
            core.Settings.AreHostObjectsAllowed = false;
            core.SetVirtualHostNameToFolderMapping("island.local", Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "ui"), CoreWebView2HostResourceAccessKind.DenyCors);
            core.PermissionRequested += (_, e) => e.State = CoreWebView2PermissionState.Deny;
            core.NewWindowRequested += (_, e) => e.Handled = true;
            core.WindowCloseRequested += (_, _) => Close();
            core.DownloadStarting += (_, e) => e.Cancel = true;
            core.NavigationStarting += (_, e) => e.Cancel = e.Uri != "https://island.local/index.html";
            core.WebMessageReceived += async (_, e) => await ReceiveAsync(e);
            await core.AddScriptToExecuteOnDocumentCreatedAsync(File.ReadAllText(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "desktop.js")));
            core.NavigationCompleted += (_, e) => { if (e.IsSuccess) { ready = true; service.Start(); hitTest.Start(); } };
            core.Navigate("https://island.local/index.html");
        }
        catch (Exception error)
        {
            File.WriteAllText(Path.Combine(profile, "startup-error.txt"), error.ToString());
            MessageBox.Show("Aplikasi memerlukan Microsoft Edge WebView2 Runtime. Jalankan installer untuk memasangnya.\n\n" + error.Message, "Dynamic Island", MessageBoxButtons.OK, MessageBoxIcon.Error);
            Close();
        }
    }
    private async Task ReceiveAsync(CoreWebView2WebMessageReceivedEventArgs e)
    {
        if (e.Source != "https://island.local/index.html") return;
        try
        {
            using var message = JsonDocument.Parse(e.WebMessageAsJson);
            var root = message.RootElement;
            var type = root.GetProperty("type").GetString();
            if (type == "clickThrough") { SetClickThrough(root.GetProperty("value").GetBoolean()); return; }
            var id = root.GetProperty("id").GetInt64();
            object? value = type switch {
                "getActivity" => service.Snapshot, "getBattery" => service.Snapshot.Battery,
                "command" => await service.CommandAsync(root.GetProperty("value").Clone()), _ => null,
            };
            web.CoreWebView2.PostWebMessageAsJson(JsonSerializer.Serialize(new { type = "response", id, value }, ActivityService.Json));
        }
        catch { /* Reject malformed/untrusted messages without exposing host APIs. */ }
    }
    private void Publish() { if (ready && !IsDisposed) web.CoreWebView2.PostWebMessageAsJson(JsonSerializer.Serialize(new { type = "snapshot", value = service.Snapshot }, ActivityService.Json)); }
    private void SetClickThrough(bool value, bool force = false)
    {
        if (!force && ignore == value) return;
        ignore = value;
        var style = Native.GetWindowLong(Handle, -20);
        // WS_EX_LAYERED is required for cross-process WS_EX_TRANSPARENT hit testing.
        Native.SetWindowLong(Handle, -20, value ? style | 0x20 | 0x80000 : style & ~0x20);
        Native.SetLayeredWindowAttributes(Handle, 0, 255, 2);
    }
    private void PositionOverlay()
    {
        var area = Screen.PrimaryScreen!.WorkingArea;
        var scale = DeviceDpi / 96.0;
        var width = Math.Min((int)Math.Round(460 * scale), area.Width);
        var height = Math.Min((int)Math.Round(320 * scale), area.Height);
        Bounds = new Rectangle(area.X + (area.Width - width) / 2, area.Y + (int)Math.Round(12 * scale), width, height);
    }
    private void DisplayChanged(object? sender, EventArgs e) { if (!IsDisposed && IsHandleCreated) BeginInvoke(new Action(PositionOverlay)); }
    private void ShowOverlay() { Show(); Native.SetWindowPos(Handle, (IntPtr)(-1), 0, 0, 0, 0, 0x53); }
    protected override void WndProc(ref Message m)
    {
        if (m.Msg == Native.ShowMessage) ShowOverlay();
        base.WndProc(ref m);
        if (m.Msg == 0x02e0) PositionOverlay();
    }
    protected override void Dispose(bool disposing)
    {
        if (disposing) { Microsoft.Win32.SystemEvents.DisplaySettingsChanged -= DisplayChanged; ready = false; hitTest.Dispose(); service.Dispose(); tray.Visible = false; var icon = tray.Icon; var menu = tray.ContextMenuStrip; tray.Dispose(); icon?.Dispose(); menu?.Dispose(); }
        base.Dispose(disposing);
    }
}

internal static class Native
{
    internal static uint ShowMessage;
    internal static uint RegisterShowMessage(string suffix) => RegisterWindowMessage("Andika.DynamicIsland.Show" + suffix);
    [StructLayout(LayoutKind.Sequential)] internal struct Blur { public uint Flags; [MarshalAs(UnmanagedType.Bool)] public bool Enabled; public IntPtr Region; [MarshalAs(UnmanagedType.Bool)] public bool Transition; }
    [DllImport("dwmapi.dll")] internal static extern int DwmEnableBlurBehindWindow(IntPtr window, ref Blur blur);
    [DllImport("gdi32.dll")] internal static extern IntPtr CreateRectRgn(int left, int top, int right, int bottom);
    [DllImport("gdi32.dll")] internal static extern bool DeleteObject(IntPtr obj);
    [DllImport("user32.dll")] internal static extern bool DestroyIcon(IntPtr icon);
    [DllImport("user32.dll")] internal static extern int GetWindowLong(IntPtr window, int index);
    [DllImport("user32.dll")] internal static extern int SetWindowLong(IntPtr window, int index, int value);
    [DllImport("user32.dll")] internal static extern bool SetLayeredWindowAttributes(IntPtr window, uint key, byte alpha, uint flags);
    [DllImport("user32.dll")] internal static extern bool SetWindowPos(IntPtr window, IntPtr after, int x, int y, int width, int height, uint flags);
    [DllImport("user32.dll")] internal static extern bool PostMessage(IntPtr window, uint message, IntPtr wParam, IntPtr lParam);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern uint RegisterWindowMessage(string name);
    internal static void FillRoundedPill(this Graphics graphics) { graphics.FillRectangle(Brushes.White, 4, 4, 8, 8); graphics.FillEllipse(Brushes.White, 0, 4, 8, 8); graphics.FillEllipse(Brushes.White, 8, 4, 8, 8); }
}
