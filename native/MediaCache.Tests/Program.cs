using WindowsHost.Services;

static void Check(bool condition, string message)
{
    if (!condition) throw new Exception(message);
}

var profile = Path.Combine(Path.GetTempPath(), "island-media-test-" + Guid.NewGuid().ToString("N"));
try
{
    var cache = new MediaCache(profile);
    var first = MediaCache.TrackKey("player", "Song", "Artist", "Album", 1);
    var second = MediaCache.TrackKey("player", "Next", "Artist", "Album", 2);
    Check(cache.ShouldReadArtwork(first, 1000), "First artwork must load");
    cache.SetArtwork(null, 1000);
    Check(cache.ShouldReadArtwork(first, 1500), "Late/failed artwork must retry");
    cache.SetArtwork("cover-one", 1500);
    Check(!cache.ShouldReadArtwork(first, 2000), "Successful covers should be throttled");
    Check(cache.ShouldReadArtwork(first, 3500), "Cover must refresh even with identical metadata");
    cache.SetArtwork("cover-updated", 3500);
    Check(cache.Artwork == "cover-updated", "Late cover update must replace the old image");
    Check(cache.ShouldReadArtwork(second, 3501) && cache.Artwork == null, "Track switch must clear previous cover immediately");
    cache.SetArtwork("cover-two", 3501);
    cache.ResetArtwork();
    Check(cache.Artwork == null && cache.ShouldReadArtwork(second, 3502), "Session disconnect must reset artwork");
    Check(first != MediaCache.TrackKey("other-player", "Song", "Artist", "Album", 1), "Players must have separate cache keys");
    Check(MediaCache.TrackKey("a|b", "c", "", "", 0) != MediaCache.TrackKey("a", "b|c", "", "", 0), "Metadata delimiters must not collide");
    Check(cache.Duration(first, 0) == 0, "Unknown duration must not be fabricated");
    Check(cache.Duration(first, 180) == 180, "Reported duration must be cached");
    foreach (var invalid in new[] { 0d, -1, double.NaN, double.PositiveInfinity })
        Check(cache.Duration(first, invalid) == 180, "Missing duration must recover from cache");
    Check(cache.Duration(second, 0) == 0, "Duration must not leak into another track");
    Check(new MediaCache(profile).Duration(first, 0) == 180, "Duration must survive restart");
    Check(cache.Duration(first, 200) == 200, "Updated duration must replace cached value");
    Check(cache.Duration(first, 0, false) == 0, "Untitled tracks must not reuse cached timing");
    for (var i = 0; i < 260; i++) cache.Duration("track-" + i, 100 + i);
    var restored = new MediaCache(profile);
    Check(restored.Duration(first, 0) == 0 && restored.Duration("track-259", 0) == 359, "Cache must stay bounded and retain recent entries");
    File.WriteAllText(Path.Combine(profile, "media-durations.json"), "invalid json");
    Check(new MediaCache(profile).Duration(first, 0) == 0, "Corrupt cache must be ignored");
    var blocked = Path.Combine(profile, "blocked");
    File.WriteAllText(blocked, "file instead of directory");
    var memoryOnly = new MediaCache(blocked);
    Check(memoryOnly.Duration(first, 120) == 120 && memoryOnly.Duration(first, 0) == 120, "Unwritable profile must preserve memory cache");
    Console.WriteLine("Media cache regression checks passed.");
}
finally
{
    // Only the uniquely named temporary test profile is removed.
    if (Directory.Exists(profile)) Directory.Delete(profile, true);
}
