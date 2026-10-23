using System.Text;
using System.Text.Json;
using System.Runtime.InteropServices;
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
        using var loop = new WindowsMessageLoop();
        using var host = new BridgeHost(loop);
        loop.Run();
    }
}

internal sealed class BridgeHost : IDisposable
{
    private readonly MediaService media = new();
    private readonly AudioService audio = new();
    private readonly NotificationService notifications = new();
    private readonly System.Threading.Timer timer;
    private readonly WindowsMessageLoop dispatcher;
    private bool polling;
    private bool mediaEnabled = true;
    private bool audioEnabled = true;
    private bool stopped;

    public BridgeHost(WindowsMessageLoop dispatcher)
    {
        this.dispatcher = dispatcher;
        timer = new System.Threading.Timer(_ => dispatcher.Post(async _ => await PollAsync(), null), null, 500, 500);
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
                dispatcher.Post(async _ => await ExecuteAsync(command), null);
            }
        }
        catch { /* Broken pipe or malformed input: stop with the parent. */ }
        finally { dispatcher.Post(_ => Stop(), null); }
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
                case "timer-sound": MessageBeep(0x30); break;
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
            Write(new BridgeResult(id, ok, ok ? null : "Windows tidak mendukung tindakan ini atau izin belum diberikan."));
        }
        catch { Write(new BridgeResult(id, false, "Integrasi Windows belum tersedia untuk tindakan ini.")); }
    }
    private void Write<T>(T value)
    {
        if (stopped) return;
        try { Console.WriteLine(JsonSerializer.Serialize(value, typeof(T), BridgeJsonContext.Default)); }
        catch { Stop(); }
    }
    private void Stop() { stopped = true; timer.Change(Timeout.Infinite, Timeout.Infinite); dispatcher.Stop(); }
    public void Dispose() { stopped = true; timer.Dispose(); }
    [DllImport("user32.dll")] private static extern bool MessageBeep(uint type);
}
