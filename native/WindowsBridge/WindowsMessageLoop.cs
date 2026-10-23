using System.Collections.Concurrent;
using System.ComponentModel;
using System.Runtime.InteropServices;

namespace WindowsBridge;

// Keep WinRT calls and their async continuations on one STA without Windows Forms.
internal sealed class WindowsMessageLoop : SynchronizationContext, IDisposable
{
    private const uint WorkMessage = 0x8000;
    private readonly ConcurrentQueue<(SendOrPostCallback Callback, object? State)> pending = new();
    private readonly uint threadId = GetCurrentThreadId();
    private readonly SynchronizationContext? previous = Current;
    private volatile bool stopped;

    public WindowsMessageLoop()
    {
        // PostThreadMessage requires the target thread to have a message queue.
        PeekMessage(out _, IntPtr.Zero, 0, 0, 0);
        SetSynchronizationContext(this);
    }

    public override SynchronizationContext CreateCopy() => this;

    public override void Post(SendOrPostCallback callback, object? state)
    {
        if (stopped) return;
        pending.Enqueue((callback, state));
        if (!PostThreadMessage(threadId, WorkMessage, UIntPtr.Zero, IntPtr.Zero) && !stopped)
            throw new Win32Exception(Marshal.GetLastWin32Error());
    }

    public void Run()
    {
        int result;
        while ((result = GetMessage(out var message, IntPtr.Zero, 0, 0)) > 0)
        {
            if (message.Id == WorkMessage)
            {
                while (!stopped && pending.TryDequeue(out var work)) work.Callback(work.State);
            }
            else
            {
                TranslateMessage(ref message);
                DispatchMessage(ref message);
            }
        }
        if (result < 0) throw new Win32Exception(Marshal.GetLastWin32Error());
    }

    // Called on the loop thread, including after stdin reaches EOF.
    public void Stop() { stopped = true; PostQuitMessage(0); }
    public void Dispose() { stopped = true; SetSynchronizationContext(previous); }

    [StructLayout(LayoutKind.Sequential)]
    private struct Message
    {
        public IntPtr Window;
        public uint Id;
        public UIntPtr WParam;
        public IntPtr LParam;
        public uint Time;
        public int X;
        public int Y;
        public uint Private;
    }

    [DllImport("kernel32.dll")] private static extern uint GetCurrentThreadId();
    [DllImport("user32.dll", EntryPoint = "PeekMessageW")] private static extern bool PeekMessage(out Message message, IntPtr window, uint min, uint max, uint remove);
    [DllImport("user32.dll", EntryPoint = "GetMessageW", SetLastError = true)] private static extern int GetMessage(out Message message, IntPtr window, uint min, uint max);
    [DllImport("user32.dll", EntryPoint = "PostThreadMessageW", SetLastError = true)] private static extern bool PostThreadMessage(uint thread, uint message, UIntPtr wParam, IntPtr lParam);
    [DllImport("user32.dll")] private static extern bool TranslateMessage(ref Message message);
    [DllImport("user32.dll", EntryPoint = "DispatchMessageW")] private static extern IntPtr DispatchMessage(ref Message message);
    [DllImport("user32.dll")] private static extern void PostQuitMessage(int code);
}
