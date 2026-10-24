using System.Text.Json;

namespace WindowsHost.Services;

// Only cache durations actually reported by the player, never elapsed time.
public sealed class MediaCache
{
    private const int Limit = 256;
    private readonly string file;
    private readonly Dictionary<string, double> durations = new();
    private string artworkKey = "";
    private long nextArtworkRead;
    public string? Artwork { get; private set; }

    public MediaCache(string profile)
    {
        file = Path.Combine(profile, "media-durations.json");
        try
        {
            var saved = JsonSerializer.Deserialize<Dictionary<string, double>>(File.ReadAllText(file));
            if (saved != null)
                foreach (var entry in saved.Take(Limit))
                    if (Valid(entry.Value)) durations[entry.Key] = entry.Value;
        }
        catch { /* A missing or corrupt cache must not interrupt playback. */ }
    }

    public static string TrackKey(string source, string title, string artist, string album, int trackNumber) =>
        JsonSerializer.Serialize(new object[] { source, title, artist, album, trackNumber });

    public bool ShouldReadArtwork(string key, long now)
    {
        if (artworkKey != key)
        {
            artworkKey = key;
            Artwork = null;
            nextArtworkRead = 0;
        }
        return now >= nextArtworkRead;
    }

    public void SetArtwork(string? value, long now)
    {
        Artwork = value;
        // Missing/failed thumbnails retry on the next poll. Even successful ones
        // refresh because metadata and the thumbnail can arrive separately.
        nextArtworkRead = now + (value == null ? 500 : 2000);
    }

    public void ResetArtwork() { artworkKey = ""; Artwork = null; nextArtworkRead = 0; }

    private static bool Valid(double duration) => !double.IsNaN(duration) && !double.IsInfinity(duration)
        && duration > 0 && duration <= 604800;

    public double Duration(string key, double reported, bool cacheable = true)
    {
        if (!cacheable) return Valid(reported) ? reported : 0;
        if (!Valid(reported)) return durations.TryGetValue(key, out var cached) ? cached : 0;
        if (durations.TryGetValue(key, out var previous) && previous == reported) return reported;
        durations.Remove(key);
        if (durations.Count >= Limit) durations.Remove(durations.Keys.First());
        durations[key] = reported;
        try
        {
            Directory.CreateDirectory(Path.GetDirectoryName(file)!);
            File.WriteAllText(file + ".tmp", JsonSerializer.Serialize(durations));
            if (File.Exists(file)) File.Replace(file + ".tmp", file, null);
            else File.Move(file + ".tmp", file);
        }
        catch { /* Keep the in-memory value if the profile is read-only. */ }
        return reported;
    }
}
