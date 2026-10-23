using System.Runtime.InteropServices;
using WindowsBridge.Protocol;

namespace WindowsBridge.Audio;

public sealed class AudioService
{
    public AudioState Read()
    {
        try { return WithEndpoint((volume, device) => { volume.GetMasterVolumeLevelScalar(out float level); volume.GetMute(out bool muted); return new AudioState("available", level, muted, device); }); }
        catch { return new AudioState(); }
    }
    public void SetVolume(float value) => WithEndpoint((volume, _) => { volume.SetMasterVolumeLevelScalar(Math.Clamp(value, 0, 1), Guid.Empty); return true; });
    public void SetMute(bool value) => WithEndpoint((volume, _) => { volume.SetMute(value, Guid.Empty); return true; });

    private static T WithEndpoint<T>(Func<IAudioEndpointVolume, string, T> operation)
    {
        var enumerator = (IMMDeviceEnumerator)new MMDeviceEnumerator();
        IMMDevice? device = null;
        object? endpoint = null;
        try
        {
            enumerator.GetDefaultAudioEndpoint(0, 1, out device);
            var id = typeof(IAudioEndpointVolume).GUID;
            device.Activate(ref id, 23, IntPtr.Zero, out endpoint);
            return operation((IAudioEndpointVolume)endpoint, FriendlyName(device));
        }
        finally
        {
            if (endpoint is not null) Marshal.ReleaseComObject(endpoint);
            if (device is not null) Marshal.ReleaseComObject(device);
            Marshal.ReleaseComObject(enumerator);
        }
    }
    private static string FriendlyName(IMMDevice device)
    {
        IPropertyStore? store = null;
        try
        {
            device.OpenPropertyStore(0, out store);
            var key = new PropertyKey { FormatId = new Guid("a45c254e-df1c-4efd-8020-67d146a850e0"), Id = 14 };
            store.GetValue(ref key, out var value);
            try { return value.Type == 31 ? Marshal.PtrToStringUni(value.Pointer) ?? "Output Windows" : "Output Windows"; }
            finally { PropVariantClear(ref value); }
        }
        catch { return "Output Windows"; }
        finally { if (store is not null) Marshal.ReleaseComObject(store); }
    }
    [DllImport("ole32.dll")] private static extern int PropVariantClear(ref PropVariant value);
}

[ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")] internal class MMDeviceEnumerator { }
[ComImport, Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
internal interface IMMDeviceEnumerator
{
    void EnumAudioEndpoints(int flow, int mask, out IntPtr devices);
    void GetDefaultAudioEndpoint(int flow, int role, out IMMDevice device);
    void GetDevice([MarshalAs(UnmanagedType.LPWStr)] string id, out IMMDevice device);
    void RegisterEndpointNotificationCallback(IntPtr client);
    void UnregisterEndpointNotificationCallback(IntPtr client);
}
[ComImport, Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
internal interface IMMDevice
{
    void Activate(ref Guid id, int context, IntPtr parameters, [MarshalAs(UnmanagedType.IUnknown)] out object endpoint);
    void OpenPropertyStore(int access, out IPropertyStore store);
    void GetId([MarshalAs(UnmanagedType.LPWStr)] out string id);
    void GetState(out int state);
}
[ComImport, Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
internal interface IAudioEndpointVolume
{
    void RegisterControlChangeNotify(IntPtr notify);
    void UnregisterControlChangeNotify(IntPtr notify);
    void GetChannelCount(out uint count);
    void SetMasterVolumeLevel(float level, [MarshalAs(UnmanagedType.LPStruct)] Guid context);
    void SetMasterVolumeLevelScalar(float level, [MarshalAs(UnmanagedType.LPStruct)] Guid context);
    void GetMasterVolumeLevel(out float level);
    void GetMasterVolumeLevelScalar(out float level);
    void SetChannelVolumeLevel(uint channel, float level, [MarshalAs(UnmanagedType.LPStruct)] Guid context);
    void SetChannelVolumeLevelScalar(uint channel, float level, [MarshalAs(UnmanagedType.LPStruct)] Guid context);
    void GetChannelVolumeLevel(uint channel, out float level);
    void GetChannelVolumeLevelScalar(uint channel, out float level);
    void SetMute([MarshalAs(UnmanagedType.Bool)] bool mute, [MarshalAs(UnmanagedType.LPStruct)] Guid context);
    void GetMute([MarshalAs(UnmanagedType.Bool)] out bool mute);
    void GetVolumeStepInfo(out uint step, out uint count);
    void VolumeStepUp([MarshalAs(UnmanagedType.LPStruct)] Guid context);
    void VolumeStepDown([MarshalAs(UnmanagedType.LPStruct)] Guid context);
    void QueryHardwareSupport(out uint mask);
    void GetVolumeRange(out float min, out float max, out float increment);
}
[StructLayout(LayoutKind.Sequential)] internal struct PropertyKey { public Guid FormatId; public uint Id; }
[StructLayout(LayoutKind.Explicit, Size = 24)] internal struct PropVariant { [FieldOffset(0)] public ushort Type; [FieldOffset(8)] public IntPtr Pointer; }
[ComImport, Guid("886d8eeb-8cf2-4446-8d02-cdba1dbdcf99"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
internal interface IPropertyStore
{
    void GetCount(out uint count);
    void GetAt(uint index, out PropertyKey key);
    void GetValue(ref PropertyKey key, out PropVariant value);
    void SetValue(ref PropertyKey key, ref PropVariant value);
    void Commit();
}
