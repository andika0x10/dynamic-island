using System.Runtime.InteropServices;
using Windows.UI.Notifications;
using Windows.UI.Notifications.Management;
using WindowsBridge.Protocol;

namespace WindowsBridge.Notifications;

public sealed class NotificationService
{
    private readonly HashSet<uint> seen = [];
    private bool initialized;
    public string Access { get; private set; } = "unknown";
    public NotificationState? Latest { get; private set; }
    public bool Enabled { get; set; }
    private static bool HasIdentity()
    {
        uint length = 0;
        return GetCurrentPackageFullName(ref length, IntPtr.Zero) != 15700;
    }
    public async Task RequestAccessAsync()
    {
        if (!HasIdentity()) { Access = "requires-package"; return; }
        Access = Map(await UserNotificationListener.Current.RequestAccessAsync());
    }
    public async Task PollAsync()
    {
        if (!HasIdentity()) { Access = "requires-package"; return; }
        try
        {
            var listener = UserNotificationListener.Current;
            Access = Map(listener.GetAccessStatus());
            if (!Enabled || Access != "allowed") { initialized = false; Latest = null; return; }
            var notifications = await listener.GetNotificationsAsync(NotificationKinds.Toast);
            var ids = new HashSet<uint>(notifications.Select(item => item.Id));
            if (initialized)
            {
                foreach (var notification in notifications.OrderBy(item => item.CreationTime))
                {
                    if (seen.Contains(notification.Id)) continue;
                    try
                    {
                        var binding = notification.Notification.Visual.GetBinding(KnownNotificationBindings.ToastGeneric);
                        var texts = binding?.GetTextElements().Select(item => item.Text).ToArray() ?? [];
                        var created = notification.CreationTime.ToUnixTimeMilliseconds();
                        Latest = new NotificationState($"{notification.Id}:{created}", notification.AppInfo.DisplayInfo.DisplayName,
                            Limit(texts.FirstOrDefault() ?? "Notifikasi", 300), Limit(string.Join("\n", texts.Skip(1)), 1500), created);
                    }
                    catch { /* One malformed notification must not hide the others. */ }
                }
            }
            seen.Clear(); seen.UnionWith(ids); initialized = true;
        }
        catch { Access = "unavailable"; Latest = null; }
    }
    private static string Limit(string value, int size) => value.Length <= size ? value : value.Substring(0, size);
    private static string Map(UserNotificationListenerAccessStatus status) => status switch { UserNotificationListenerAccessStatus.Allowed => "allowed", UserNotificationListenerAccessStatus.Denied => "denied", _ => "unknown" };
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode)] private static extern int GetCurrentPackageFullName(ref uint length, IntPtr name);
}
