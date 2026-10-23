using System.Runtime.InteropServices;
using System.Text.Json;
using WindowsBridge.Audio;
using WindowsBridge.Media;
using WindowsBridge.Notifications;
using WindowsBridge.Protocol;

namespace WindowsHost;

internal sealed record BatteryState(string Availability = "unavailable", double? Percentage = null, string Source = "unknown", string Charging = "unknown");
internal sealed record TimerState(string Status = "idle", double Duration = 0, double Remaining = 0, long? Deadline = null);
internal sealed record Preferences(bool Media = true, bool Volume = true, bool Notifications = false, bool Sound = true);
internal sealed record ActivityState(BatteryState Battery, MediaState Media, AudioState Audio, TimerState Timer,
    NotificationState? Notification, string NotificationAccess, Preferences Preferences, string Bridge = "ready");
internal sealed record CommandResult(bool Ok, string? Error = null);

internal sealed class ActivityService : IDisposable
{
    internal static readonly JsonSerializerOptions Json = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };
    private readonly MediaService media = new();
    private readonly AudioService audio = new();
    private readonly NotificationService notifications = new();
    private readonly HashSet<string> dismissed = new();
    private readonly System.Windows.Forms.Timer tick = new() { Interval = 500 };
    private readonly System.Windows.Forms.Timer clock = new() { Interval = 250 };
    private readonly string file;
    private bool polling, stopped;
    private bool alarmPending;
    internal ActivityState Snapshot { get; private set; }
    internal event Action? Changed;
    internal static long Now => DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

    internal ActivityService(string profile)
    {
        file = Path.Combine(profile, "settings.json");
        var preferences = new Preferences();
        var timer = new TimerState();
        try
        {
            using var saved = JsonDocument.Parse(File.ReadAllText(file));
            if (saved.RootElement.TryGetProperty("preferences", out var p)) preferences = ReadPreferences(p, preferences);
            if (saved.RootElement.TryGetProperty("timer", out var t))
            {
                var candidate = JsonSerializer.Deserialize<TimerState>(t.GetRawText(), Json);
                if (candidate != null && new[] { "idle", "running", "paused", "finished" }.Contains(candidate.Status)
                    && Finite(candidate.Duration, 0, 86400) && Finite(candidate.Remaining, 0, candidate.Duration)
                    && (candidate.Status != "running" || candidate.Deadline.HasValue)) timer = Advance(candidate);
            }
        }
        catch { /* First launch, inaccessible or corrupt settings: use defaults. */ }
        Snapshot = new(ReadBattery(), MediaState.Empty, new AudioState(), timer, null, "unknown", preferences);
        notifications.Enabled = preferences.Notifications;
        alarmPending = timer.Status == "finished" && preferences.Sound;
        tick.Tick += async (_, _) => await PollAsync();
        clock.Tick += (_, _) => RefreshTimer();
    }

    internal void Start() { clock.Start(); tick.Start(); RefreshTimer(); _ = PollAsync(); }
    private void RefreshTimer()
    {
        var timer = Advance(Snapshot.Timer);
        var finished = timer.Status == "finished" && Snapshot.Timer.Status != "finished";
        var changed = timer != Snapshot.Timer;
        Snapshot = Snapshot with { Timer = timer };
        if (finished) Save();
        if ((finished || alarmPending) && Snapshot.Preferences.Sound) System.Media.SystemSounds.Exclamation.Play();
        alarmPending = false;
        if (changed) Changed?.Invoke();
    }
    private static TimerState Advance(TimerState timer)
    {
        if (timer.Status != "running" || !timer.Deadline.HasValue) return timer;
        var remaining = Math.Max(0, Math.Ceiling((timer.Deadline.Value - (double)Now) / 1000));
        return timer with { Remaining = remaining, Status = remaining == 0 ? "finished" : "running" };
    }
    private async Task PollAsync()
    {
        if (polling || stopped) return;
        polling = true;
        try
        {
            Snapshot = Snapshot with { Battery = ReadBattery() };
            var nextMedia = Snapshot.Preferences.Media ? await media.ReadAsync() : MediaState.Empty;
            await notifications.PollAsync();
            if (stopped) return;
            Snapshot = Snapshot with {
                Media = nextMedia, Audio = Snapshot.Preferences.Volume ? audio.Read() : new AudioState(),
                NotificationAccess = notifications.Access,
                Notification = notifications.Latest is { } n && !dismissed.Contains(n.Id) ? n : null,
            };
            Changed?.Invoke();
        }
        catch { /* A disconnected OS service is retried on the next tick. */ }
        finally { polling = false; }
    }
    private static bool Finite(double value, double min, double max) => !double.IsNaN(value) && !double.IsInfinity(value) && value >= min && value <= max;
    private static Preferences ReadPreferences(JsonElement value, Preferences current)
    {
        if (value.ValueKind != JsonValueKind.Object) throw new ArgumentException();
        foreach (var property in value.EnumerateObject())
        {
            if (property.Value.ValueKind != JsonValueKind.True && property.Value.ValueKind != JsonValueKind.False) throw new ArgumentException();
            var enabled = property.Value.GetBoolean();
            current = property.Name switch {
                "media" => current with { Media = enabled }, "volume" => current with { Volume = enabled },
                "notifications" => current with { Notifications = enabled }, "sound" => current with { Sound = enabled },
                _ => throw new ArgumentException(),
            };
        }
        return current;
    }
    internal async Task<CommandResult> CommandAsync(JsonElement command)
    {
        try
        {
            var type = command.GetProperty("type").GetString();
            var timer = Advance(Snapshot.Timer);
            switch (type)
            {
                case "timer-start":
                    var seconds = command.GetProperty("seconds").GetDouble();
                    if (!Finite(seconds, 1, 86400) || seconds != Math.Floor(seconds)) return new(false, "Perintah tidak valid.");
                    timer = new("running", seconds, seconds, Now + (long)seconds * 1000); break;
                case "timer-pause": if (timer.Status == "running") timer = timer with { Status = "paused", Deadline = null }; break;
                case "timer-resume": if (timer.Status == "paused") timer = timer with { Status = "running", Deadline = Now + (long)timer.Remaining * 1000 }; break;
                case "timer-cancel": timer = new(); break;
                case "preferences":
                    var preferences = ReadPreferences(command.GetProperty("value"), Snapshot.Preferences);
                    Snapshot = Snapshot with { Preferences = preferences, Notification = preferences.Notifications ? Snapshot.Notification : null };
                    notifications.Enabled = preferences.Notifications;
                    var result = Save(); Changed?.Invoke(); return result;
                case "notification-dismiss":
                    if (Snapshot.Notification != null) dismissed.Add(Snapshot.Notification.Id);
                    if (dismissed.Count > 200) dismissed.Remove(dismissed.First());
                    Snapshot = Snapshot with { Notification = null }; Changed?.Invoke(); return new(true);
                case "notification-access": await notifications.RequestAccessAsync(); return new(notifications.Access == "allowed");
                case "volume":
                    var volume = command.GetProperty("volume").GetDouble();
                    if (!Finite(volume, 0, 1)) return new(false, "Perintah tidak valid.");
                    audio.SetVolume((float)volume); await PollAsync(); return new(true);
                case "mute": audio.SetMute(command.GetProperty("muted").GetBoolean()); await PollAsync(); return new(true);
                case "media":
                    var action = command.GetProperty("action").GetString() ?? "";
                    if (!new[] { "play", "pause", "next", "previous" }.Contains(action)) return new(false, "Perintah tidak valid.");
                    var ok = await media.ControlAsync(action); await PollAsync(); return new(ok);
                case "seek":
                    var position = command.GetProperty("position").GetDouble();
                    if (!Finite(position, 0, 604800)) return new(false, "Perintah tidak valid.");
                    var sought = await media.SeekAsync(position); await PollAsync(); return new(sought);
                default: return new(false, "Perintah tidak valid.");
            }
            alarmPending = false;
            Snapshot = Snapshot with { Timer = timer };
            var saved = Save(); Changed?.Invoke(); return saved;
        }
        catch { return new(false, "Perintah gagal. Coba lagi."); }
    }
    private CommandResult Save()
    {
        try
        {
            Directory.CreateDirectory(Path.GetDirectoryName(file)!);
            File.WriteAllText(file + ".tmp", JsonSerializer.Serialize(new { Snapshot.Preferences, Snapshot.Timer }, Json));
            if (File.Exists(file)) File.Replace(file + ".tmp", file, null);
            else File.Move(file + ".tmp", file);
            return new(true);
        }
        catch { return new(false, "Pengaturan tidak dapat disimpan. Periksa akses folder aplikasi."); }
    }
    private static BatteryState ReadBattery()
    {
        if (!GetSystemPowerStatus(out var p)) return new();
        var source = p.Ac == 1 ? "ac" : p.Ac == 0 ? "battery" : "unknown";
        if (p.Flags != 255 && (p.Flags & 128) != 0) return new("absent", null, source);
        double? percentage = p.Percent <= 100 ? p.Percent : null;
        var charging = p.Flags == 255 ? "unknown" : (p.Flags & 8) != 0 ? "charging" : source == "battery" ? "discharging" : source == "ac" && percentage == 100 ? "full" : "unknown";
        return new(percentage.HasValue ? "available" : "unavailable", percentage, source, charging);
    }
    public void Dispose() { stopped = true; clock.Dispose(); tick.Dispose(); Save(); }
    [StructLayout(LayoutKind.Sequential)] private struct PowerStatus { public byte Ac, Flags, Percent, Saver; public uint Lifetime, FullLifetime; }
    [DllImport("kernel32.dll")] private static extern bool GetSystemPowerStatus(out PowerStatus status);
}
