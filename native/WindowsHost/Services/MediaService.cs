using Windows.Media.Control;
using Windows.Storage.Streams;

namespace WindowsHost.Services;

public sealed class MediaService
{
    private GlobalSystemMediaTransportControlsSessionManager? manager;
    private GlobalSystemMediaTransportControlsSession? session;
    private readonly MediaCache cache;

    public MediaService(string profile) { cache = new MediaCache(profile); }

    public async Task<MediaState> ReadAsync()
    {
        try
        {
            manager ??= await GlobalSystemMediaTransportControlsSessionManager.RequestAsync();
            session = manager.GetCurrentSession();
            if (session is null) { cache.ResetArtwork(); return MediaState.Empty; }
            var properties = await session.TryGetMediaPropertiesAsync();
            var playback = session.GetPlaybackInfo();
            var timeline = session.GetTimelineProperties();
            var key = MediaCache.TrackKey(session.SourceAppUserModelId, properties.Title, properties.Artist, properties.AlbumTitle, properties.TrackNumber);
            var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            if (cache.ShouldReadArtwork(key, now))
            {
                string? artwork = null;
                if (properties.Thumbnail is not null)
                {
                    try
                    {
                        using var stream = await properties.Thumbnail.OpenReadAsync();
                        if (stream.Size is > 0 and <= 1_500_000 && new[] { "image/png", "image/jpeg", "image/webp" }.Contains(stream.ContentType))
                        {
                            using var reader = new DataReader(stream);
                            await reader.LoadAsync((uint)stream.Size);
                            var bytes = new byte[(int)stream.Size]; reader.ReadBytes(bytes);
                            artwork = $"data:{stream.ContentType};base64,{Convert.ToBase64String(bytes)}";
                        }
                    }
                    catch { artwork = null; }
                }
                cache.SetArtwork(artwork, now);
            }
            var controls = playback.Controls;
            return new MediaState("available", properties.Title, properties.Artist, cache.Artwork,
                playback.PlaybackStatus == GlobalSystemMediaTransportControlsSessionPlaybackStatus.Playing,
                Math.Max(0, (timeline.Position - timeline.StartTime).TotalSeconds),
                cache.Duration(key, (timeline.EndTime - timeline.StartTime).TotalSeconds, !string.IsNullOrWhiteSpace(properties.Title)),
                timeline.LastUpdatedTime.ToUnixTimeMilliseconds(),
                new Controls(controls.IsPlayEnabled, controls.IsPauseEnabled, controls.IsPreviousEnabled, controls.IsNextEnabled, controls.IsPlaybackPositionEnabled));
        }
        catch { session = null; cache.ResetArtwork(); return MediaState.Empty; }
    }
    public async Task<bool> ControlAsync(string action)
    {
        var current = manager?.GetCurrentSession();
        if (current is null) return false;
        return action switch
        {
            "play" => await current.TryPlayAsync(), "pause" => await current.TryPauseAsync(),
            "previous" => await current.TrySkipPreviousAsync(), "next" => await current.TrySkipNextAsync(), _ => false
        };
    }
    public async Task<bool> SeekAsync(double position)
    {
        var current = manager?.GetCurrentSession();
        if (current is null) return false;
        var timeline = current.GetTimelineProperties();
        var properties = await current.TryGetMediaPropertiesAsync();
        var key = MediaCache.TrackKey(current.SourceAppUserModelId, properties.Title, properties.Artist, properties.AlbumTitle, properties.TrackNumber);
        var duration = cache.Duration(key, (timeline.EndTime - timeline.StartTime).TotalSeconds, !string.IsNullOrWhiteSpace(properties.Title));
        if (duration <= 0) return false;
        var target = Math.Min(duration, Math.Max(0, position));
        return await current.TryChangePlaybackPositionAsync(timeline.StartTime.Ticks + TimeSpan.FromSeconds(target).Ticks);
    }
}
