using Windows.Media.Control;
using Windows.Storage.Streams;

namespace WindowsHost.Services;

public sealed class MediaService
{
    private GlobalSystemMediaTransportControlsSessionManager? manager;
    private GlobalSystemMediaTransportControlsSession? session;
    private string artworkKey = "";
    private string? artwork;

    public async Task<MediaState> ReadAsync()
    {
        try
        {
            manager ??= await GlobalSystemMediaTransportControlsSessionManager.RequestAsync();
            session = manager.GetCurrentSession();
            if (session is null) { artworkKey = ""; artwork = null; return MediaState.Empty; }
            var properties = await session.TryGetMediaPropertiesAsync();
            var playback = session.GetPlaybackInfo();
            var timeline = session.GetTimelineProperties();
            var key = $"{session.SourceAppUserModelId}|{properties.Title}|{properties.Artist}|{properties.AlbumTitle}";
            if (key != artworkKey)
            {
                artworkKey = key;
                artwork = null;
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
            }
            var controls = playback.Controls;
            return new MediaState("available", properties.Title, properties.Artist, artwork,
                playback.PlaybackStatus == GlobalSystemMediaTransportControlsSessionPlaybackStatus.Playing,
                Math.Max(0, (timeline.Position - timeline.StartTime).TotalSeconds),
                Math.Max(0, (timeline.EndTime - timeline.StartTime).TotalSeconds),
                timeline.LastUpdatedTime.ToUnixTimeMilliseconds(),
                new Controls(controls.IsPlayEnabled, controls.IsPauseEnabled, controls.IsPreviousEnabled, controls.IsNextEnabled, controls.IsPlaybackPositionEnabled));
        }
        catch { session = null; return MediaState.Empty; }
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
        var target = Math.Min(Math.Max(0, (timeline.EndTime - timeline.StartTime).TotalSeconds), Math.Max(0, position));
        return await current.TryChangePlaybackPositionAsync(timeline.StartTime.Ticks + TimeSpan.FromSeconds(target).Ticks);
    }
}
