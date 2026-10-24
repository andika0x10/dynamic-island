import type { ActivitySnapshot, NotificationAccess } from '../../../shared/contracts/activity.ts'
import { isDesktop } from '../../platform/desktop.ts'
import { Button, ErrorMessage } from '../../shared/ui/Button.tsx'
import { useCommand } from '../../shared/hooks/useCommand.ts'
import ui from '../../shared/ui/Controls.module.css'
import styles from './NotificationPanel.module.css'

const accessMessages: Record<NotificationAccess, string> = {
  unknown: 'Izinkan akses notifikasi Windows untuk menampilkan notifikasi baru.',
  allowed: 'Notifikasi baru akan muncul di sini.',
  denied: 'Akses notifikasi ditolak. Izinkan akses melalui pengaturan notifikasi Windows.',
  'requires-package': 'Notifikasi Windows memerlukan versi MSIX. Installer EXE dan ZIP belum mendukung akses ini.',
  unavailable: 'Layanan notifikasi Windows sedang tidak tersedia. Coba lagi nanti.',
}

export function NotificationPanel({ snapshot }: { snapshot: ActivitySnapshot }) {
  const { notification, notificationAccess: access, preferences } = snapshot
  const { run, error, pending } = useCommand()
  const supported = isDesktop && access !== 'requires-package' && access !== 'unavailable'
  const enable = async () => {
    if (access !== 'allowed') {
      const result = await run({ type: 'notification-access' })
      if (!result.ok) return
    }
    await run({ type: 'preferences', value: { notifications: true } })
  }
  return <div role="status" aria-live="polite">
    <p className={ui.caption} style={{ margin: '0 0 8px' }}>{notification?.app || 'Notifikasi Windows'}</p>
    <h2 className={ui.title}>{notification?.title || (preferences.notifications ? 'Tidak ada notifikasi baru' : 'Notifikasi belum aktif')}</h2>
    <p className={styles.body} tabIndex={0} aria-label="Isi notifikasi">{notification?.body || (!isDesktop ? 'Buka aplikasi desktop untuk menggunakan notifikasi Windows.' : accessMessages[access])}</p>
    {notification ? <Button disabled={pending} onClick={() => void run({ type: 'notification-dismiss' })}>Tutup tampilan</Button>
      : preferences.notifications && access === 'allowed' ? <Button disabled={pending} onClick={() => void run({ type: 'preferences', value: { notifications: false } })}>Nonaktifkan notifikasi</Button>
      : supported && <Button primary disabled={pending} onClick={() => void enable()}>{access === 'allowed' ? 'Aktifkan notifikasi' : 'Izinkan notifikasi'}</Button>}
    <ErrorMessage message={error}/>
  </div>
}
