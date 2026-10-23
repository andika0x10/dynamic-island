using System.Text;
using System.Text.Json;
using WindowsBridge.Audio;
using WindowsBridge.Media;
using WindowsBridge.Notifications;
using WindowsBridge.Protocol;

namespace WindowsBridge;

internal static class Program
{
    [STAThread]
    private static void Main()
    {
        Console.InputEncoding = new UTF8Encoding(false);
        Console.OutputEncoding = new UTF8Encoding(false);
        ApplicationConfiguration.Initialize();
        using var host = new BridgeHost();
        Application.Run(host);
    }
}

internal sealed class BridgeHost : ApplicationContext
{
    private readonly MediaService media = new();
    private readonly AudioService audio = new();
    private readonly NotificationService notifications = new();
    private readonly System.Windows.Forms.Timer timer = new() { Interval = 500 };
    private readonly Control dispatcher = new();
    private readonly JsonSerializerOptions json = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };
    private bool polling;
    private bool mediaEnabled = true;
    private bool audioEnabled = true;
    private bool stopped;

    public BridgeHost()
    {
        dispatcher.CreateControl();
        timer.Tick += async (_, _) => await PollAsync();
        timer.Start();
        _ = Task.Run(ReadCommandsAsync);
    }
    private async Task PollAsync()
    {
        if (polling || stopped) return;
        polling = true;
        try
        {
            var mediaState = mediaEnabled ? await media.ReadAsync() : MediaState.Empty;
            await notifications.PollAsync();
            Write(new BridgeSnapshot(mediaState, audioEnabled ? audio.Read() : new AudioState(), notifications.Access, notifications.Latest));
        }
        catch { /* Individual services report availability and recover on the next poll. */ }
        finally { polling = false; }
    }
    private async Task ReadCommandsAsync()
    {
        try
        {
            while (await Console.In.ReadLineAsync().ConfigureAwait(false) is { } line)
            {
                if (line.Length > 16000) continue;
                using var document = JsonDocument.Parse(line);
                var command = document.RootElement.Clone();
                dispatcher.BeginInvoke(async () => await ExecuteAsync(command));
            }
        }
        catch { /* Broken pipe or malformed input: stop with the parent. */ }
        finally { if (!dispatcher.IsDisposed) dispatcher.BeginInvoke(() => ExitThread()); }
    }
    private async Task ExecuteAsync(JsonElement command)
    {
        var id = command.TryGetProperty("id", out var serial) && serial.TryGetInt64(out var number) ? number : 0;
        try
        {
            var ok = true;
            switch (command.GetProperty("type").GetString())
            {
                case "media": ok = await media.ControlAsync(command.GetProperty("action").GetString() ?? ""); break;
                case "seek": ok = await media.SeekAsync(command.GetProperty("position").GetDouble()); break;
                case "volume": audio.SetVolume(command.GetProperty("volume").GetSingle()); break;
                case "mute": audio.SetMute(command.GetProperty("muted").GetBoolean()); break;
                case "timer-sound": System.Media.SystemSounds.Exclamation.Play(); break;
                case "notification-access": await notifications.RequestAccessAsync(); ok = notifications.Access == "allowed"; break;
                case "preferences":
                    var value = command.GetProperty("value");
                    mediaEnabled = value.GetProperty("media").GetBoolean();
                    audioEnabled = value.GetProperty("volume").GetBoolean();
                    notifications.Enabled = value.GetProperty("notifications").GetBoolean();
                    break;
                default: ok = false; break;
            }
            await PollAsync();
            Write(new { type = "result", id, ok, error = ok ? null : "Windows tidak mendukung tindakan ini atau izin belum diberikan." });
        }
        catch { Write(new { type = "result", id, ok = false, error = "Integrasi Windows belum tersedia untuk tindakan ini." }); }
    }
    private void Write<T>(T value)
    {
        if (stopped) return;
        try { Console.WriteLine(JsonSerializer.Serialize(value, json)); }
        catch { ExitThread(); }
    }
    protected override void ExitThreadCore() { stopped = true; timer.Stop(); base.ExitThreadCore(); }
    protected override void Dispose(bool disposing) { if (disposing) { stopped = true; timer.Dispose(); dispatcher.Dispose(); } base.Dispose(disposing); }
}
