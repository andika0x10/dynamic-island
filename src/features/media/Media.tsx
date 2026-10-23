import { useState } from 'react'
import type { MediaSnapshot } from '../../../shared/contracts/activity.ts'
import { Icon } from '../../shared/ui/Icon.tsx'
import { Button, ErrorMessage } from '../../shared/ui/Button.tsx'
import { clock } from '../../shared/ui/format.ts'
import { useNow } from '../../shared/hooks/useNow.ts'
import { useCommand } from '../../shared/hooks/useCommand.ts'
import { mediaTimeline } from './timeline.ts'
import styles from './Media.module.css'
import ui from '../../shared/ui/Controls.module.css'

export function Artwork({ media, small = false }: { media: MediaSnapshot; small?: boolean }) {
  return <span className={`${styles.artwork} ${small ? styles.small : ''}`}>{media.artwork ? <img src={media.artwork} alt=""/> : <Icon name="music" size={small ? 14 : 28}/>}</span>
}
export function Waveform({ playing }: { playing: boolean }) {
  return <span className={`${styles.wave} ${playing ? styles.playing : ''}`} aria-hidden="true">{[0, 1, 2, 3, 4].map(i => <i key={i} style={{ animationDelay: `${i * -.19}s` }}/>)}</span>
}
export function MediaPanel({ media }: { media: MediaSnapshot }) {
  const now = useNow()
  const { run, error, pending } = useCommand()
  const [scrub, setScrub] = useState<number | null>(null)
  const timeline = mediaTimeline(media, now)
  const position = timeline ? Math.min(timeline.duration, Math.max(0, scrub ?? timeline.position)) : 0
  return <div>
    <div className={styles.heading}><Artwork media={media}/><div className={styles.metadata}><h2 className={ui.title}>{media.title || 'Media tanpa judul'}</h2><p className={ui.subtitle}>{media.artist || 'Media Windows'}</p></div><Waveform playing={media.playing}/></div>
    {timeline ? <><input className={ui.slider} aria-label="Posisi pemutaran" type="range" min="0" max={timeline.duration} step="1" value={position} disabled={!media.controls.seek || pending}
      onChange={event => setScrub(Number(event.target.value))} onPointerUp={event => { void run({ type: 'seek', position: Number(event.currentTarget.value) }); setScrub(null) }}
      onKeyUp={event => { if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) { void run({ type: 'seek', position: Number(event.currentTarget.value) }); setScrub(null) } }} onBlur={() => setScrub(null)}/>
    <div className={ui.row}><span className={ui.caption}>{clock(position)}</span><span className={ui.caption}>−{clock(timeline.duration - position)}</span></div></>
      : <p className={ui.caption} role="status">Durasi tidak tersedia</p>}
    <div className={styles.transport}>
      <Button icon aria-label="Lagu sebelumnya" disabled={!media.controls.previous || pending} onClick={() => void run({ type: 'media', action: 'previous' })}><Icon name="previous"/></Button>
      <Button icon primary aria-label={media.playing ? 'Jeda musik' : 'Putar musik'} disabled={pending || !(media.playing ? media.controls.pause : media.controls.play)} onClick={() => void run({ type: 'media', action: media.playing ? 'pause' : 'play' })}><Icon name={media.playing ? 'pause' : 'play'} size={26}/></Button>
      <Button icon aria-label="Lagu berikutnya" disabled={!media.controls.next || pending} onClick={() => void run({ type: 'media', action: 'next' })}><Icon name="next"/></Button>
    </div><ErrorMessage message={error}/>
  </div>
}
