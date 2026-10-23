import { useActivity, isDesktop } from '../../platform/desktop.ts'
import { useCommand } from '../../shared/hooks/useCommand.ts'
import type { Preferences } from '../../../shared/contracts/activity.ts'
import { TimerPanel, TimerSetup } from '../timer/Timer.tsx'
import { Button, ErrorMessage } from '../../shared/ui/Button.tsx'
import { Icon } from '../../shared/ui/Icon.tsx'
import styles from './Settings.module.css'

const options: { key: keyof Preferences; title: string; description: string }[] = [
  { key: 'media', title: 'Musik', description: 'Judul lagu dan kontrol dari sesi media Windows.' },
  { key: 'volume', title: 'Volume', description: 'Tampilkan perubahan volume dan status mute.' },
  { key: 'notifications', title: 'Notifikasi', description: 'Tampilkan notifikasi baru setelah akses diizinkan.' },
  { key: 'sound', title: 'Bunyi timer', description: 'Bunyikan pengingat singkat saat waktu habis.' },
]
const accessLabels = { unknown: 'Akses belum diminta.', allowed: 'Akses notifikasi diizinkan.', denied: 'Akses ditolak. Periksa izin notifikasi di Pengaturan Windows.', 'requires-package': 'Instal versi MSIX untuk mengaktifkan akses notifikasi Windows.', unavailable: 'Pembacaan notifikasi belum tersedia.' }
export function Settings() {
  const snapshot = useActivity()
  const { run, error, pending } = useCommand()
  return <main className={styles.page}>
    <header className={styles.header}><span className={styles.mark}/><h1>Dynamic Island</h1><p>Aktivitas Anda, selalu dekat.</p></header>
    {!isDesktop && <p className={styles.notice}>Preview browser. Jalankan aplikasi desktop untuk mengakses Windows.</p>}
    <section className={styles.section} style={{ '--accent': '#ff9f0a' } as React.CSSProperties}><div className={styles.heading}><Icon name="timer"/><h2>Timer</h2></div>{snapshot.timer.status === 'idle' ? <TimerSetup/> : <TimerPanel timer={snapshot.timer}/>}</section>
    <section className={styles.section}><h2>Aktivitas</h2>{options.map(option => <label key={option.key} className={styles.option}><span><strong>{option.title}</strong><small>{option.description}</small></span><input type="checkbox" role="switch" checked={snapshot.preferences[option.key]} disabled={pending || !isDesktop} onChange={event => void run({ type: 'preferences', value: { [option.key]: event.target.checked } })}/></label>)}</section>
    <section className={styles.section}><div className={styles.heading}><Icon name="bell"/><h2>Akses notifikasi</h2></div><p>{accessLabels[snapshot.notificationAccess]}</p><Button disabled={!isDesktop || pending || ['requires-package', 'unavailable', 'allowed'].includes(snapshot.notificationAccess)} onClick={() => void run({ type: 'notification-access' })}>Izinkan akses notifikasi</Button><ErrorMessage message={error}/></section>
    <footer className={styles.footer}><span className={`${styles.status} ${snapshot.bridge === 'ready' ? styles.ready : ''}`}/>{snapshot.bridge === 'ready' ? 'Terhubung ke Windows' : snapshot.bridge === 'starting' ? 'Menghubungkan ke Windows…' : 'Integrasi native belum tersedia — build helper Windows terlebih dahulu.'}</footer>
  </main>
}
