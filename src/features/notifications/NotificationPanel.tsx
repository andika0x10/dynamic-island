import type { NotificationSnapshot } from '../../../shared/contracts/activity.ts'
import { Button, ErrorMessage } from '../../shared/ui/Button.tsx'
import { useCommand } from '../../shared/hooks/useCommand.ts'
import ui from '../../shared/ui/Controls.module.css'

export function NotificationPanel({ notification }: { notification: NotificationSnapshot | null }) {
  const { run, error, pending } = useCommand()
  return <div role="status" aria-live="polite">
    <p className={ui.caption} style={{ margin: '0 0 8px' }}>{notification?.app || 'Notifikasi'}</p>
    <h2 className={ui.title}>{notification?.title || 'Tidak ada notifikasi baru'}</h2>
    <p style={{ margin: '10px 0 20px', color: '#c6c6cc', fontSize: 13, lineHeight: 1.5, maxHeight: 60, overflow: 'auto', overflowWrap: 'anywhere' }}>{notification?.body || 'Notifikasi baru akan muncul di sini.'}</p>
    <Button disabled={pending} onClick={() => void run({ type: 'notification-dismiss' })}>Tutup tampilan</Button><ErrorMessage message={error}/>
  </div>
}
