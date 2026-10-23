import type { ActivitySnapshot } from '../../../shared/contracts/activity.ts'
import type { ActivityKind } from '../activity/select.ts'
import { BatteryGlyph, BatteryPanel } from '../../features/battery/Battery.tsx'
import { batteryLevel } from '../../features/battery/format.ts'
import { Artwork, MediaPanel, Waveform } from '../../features/media/Media.tsx'
import { TimerPanel } from '../../features/timer/Timer.tsx'
import { timerRemaining } from '../../features/timer/remaining.ts'
import { VolumePanel } from '../../features/volume/VolumePanel.tsx'
import { NotificationPanel } from '../../features/notifications/NotificationPanel.tsx'
import { Icon } from '../../shared/ui/Icon.tsx'
import { clock } from '../../shared/ui/format.ts'
import { useNow } from '../../shared/hooks/useNow.ts'
import styles from './Island.module.css'
import { activityNames, activityIcons } from '../activity/labels.ts'

export function ActivityGlyph({ kind, snapshot }: { kind: ActivityKind; snapshot: ActivitySnapshot }) {
  return kind === 'battery' ? <BatteryGlyph battery={snapshot.battery}/> : kind === 'media' ? <Artwork media={snapshot.media} small/> : <Icon name={kind === 'volume' && snapshot.audio.muted ? 'muted' : activityIcons[kind]} size={20}/>
}
export function CompactContent({ kind, snapshot }: { kind: ActivityKind; snapshot: ActivitySnapshot }) {
  const now = useNow()
  return <><span className={styles.glyph}><ActivityGlyph kind={kind} snapshot={snapshot}/></span><span className={styles.compactLabel}>{kind === 'media' ? snapshot.media.title || 'Musik' : kind === 'notification' ? snapshot.notification?.app || 'Notifikasi' : kind === 'timer' ? snapshot.timer.status === 'finished' ? 'Waktu habis' : clock(timerRemaining(snapshot.timer, now)) : kind === 'battery' && !window.desktop ? 'Preview' : activityNames[kind]}</span>
    {kind === 'media' ? <Waveform playing={snapshot.media.playing}/> : <span className={styles.value}>{kind === 'battery' ? batteryLevel(snapshot.battery) : kind === 'volume' ? `${Math.round(snapshot.audio.volume * 100)}%` : kind === 'timer' ? <span className={styles.timerDot}/> : null}</span>}</>
}
export function ExpandedContent({ kind, snapshot }: { kind: ActivityKind; snapshot: ActivitySnapshot }) {
  switch (kind) {
    case 'battery': return <BatteryPanel battery={snapshot.battery}/>
    case 'media': return <MediaPanel media={snapshot.media}/>
    case 'timer': return <TimerPanel timer={snapshot.timer}/>
    case 'volume': return <VolumePanel audio={snapshot.audio}/>
    case 'notification': return <NotificationPanel notification={snapshot.notification}/>
  }
}
