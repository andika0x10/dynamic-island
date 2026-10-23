import type { BatterySnapshot } from '../../../shared/desktop.ts'
import { isDesktop } from '../../platform/desktop.ts'
import styles from './Battery.module.css'
import ui from '../../shared/ui/Controls.module.css'
import { batteryLevel } from './format.ts'

export function BatteryGlyph({ battery, size = 28 }: { battery: BatterySnapshot; size?: number }) {
  return <svg width={size} height={size * 18 / 29} viewBox="0 0 29 18" fill="none" aria-hidden="true">
    <rect x="1" y="2" width="23" height="14" rx="4" stroke="currentColor" strokeOpacity=".45" strokeWidth="1.5"/>
    <path d="M26 6v6" stroke="currentColor" strokeOpacity=".6" strokeWidth="2" strokeLinecap="round"/>
    <rect x="3.5" y="4.5" width={18 * ((battery.percentage ?? 0) / 100)} height="9" rx="2" fill="currentColor"/>
    {battery.charging === 'charging' && <path d="m14 1-5 9h4l-1 7 6-10h-4V1Z" fill="white" stroke="#000" strokeWidth="1"/>}
  </svg>
}
export function BatteryPanel({ battery }: { battery: BatterySnapshot }) {
  const status = !isDesktop ? 'Integrasi tersedia di aplikasi desktop' : battery.availability === 'absent' ? 'Perangkat ini tidak memiliki baterai' : battery.availability === 'unavailable' ? 'Pembacaan baterai belum tersedia' : {
    charging: 'Sedang mengisi daya', full: 'Baterai penuh', discharging: 'Menggunakan baterai', unknown: 'Status pengisian belum diketahui',
  }[battery.charging]
  return <div className={styles.panel}>
    <div className={ui.row}><div><h2 className={ui.title}>Baterai</h2><p className={ui.subtitle}>{status}</p></div><strong className={styles.level}>{batteryLevel(battery)}</strong></div>
    <div className={styles.track}><span style={{ width: `${battery.percentage ?? 0}%` }}/></div>
    <div className={ui.row}><span className={ui.caption}>{battery.source === 'ac' ? 'Terhubung listrik' : battery.source === 'battery' ? 'Daya baterai' : 'Sumber daya belum diketahui'}</span><BatteryGlyph battery={battery}/></div>
  </div>
}
