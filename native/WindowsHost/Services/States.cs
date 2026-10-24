namespace WindowsHost.Services;

public record Controls(bool Play = false, bool Pause = false, bool Previous = false, bool Next = false, bool Seek = false);
public record MediaState(string Availability = "unavailable", string Title = "", string Artist = "", string? Artwork = null,
    bool Playing = false, double Position = 0, double Duration = 0, long UpdatedAt = 0, Controls? Controls = null)
{
    public static MediaState Empty => new(Controls: new());
}
public record AudioState(string Availability = "unavailable", double Volume = 0, bool Muted = false, string Device = "");
public record NotificationState(string Id, string App, string Title, string Body, long ReceivedAt);
