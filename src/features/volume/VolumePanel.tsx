import { useState } from 'react'
import type { AudioSnapshot } from '../../../shared/contracts/activity.ts'
import { useCommand } from '../../shared/hooks/useCommand.ts'
import { Icon } from '../../shared/ui/Icon.tsx'
import { Button, ErrorMessage } from '../../shared/ui/Button.tsx'
import ui from '../../shared/ui/Controls.module.css'

export function VolumePanel({ audio }: { audio: AudioSnapshot }) {
  const { run, pending, error } = useCommand()
  const [draft, setDraft] = useState<number | null>(null)
  const value = draft ?? audio.volume
  const commit = (volume: number) => { void run({ type: 'volume', volume }).then(() => setDraft(null)) }
  const available = audio.availability === 'available'
  return <div>
    <div className={ui.row}><div><h2 className={ui.title}>Volume</h2><p className={ui.subtitle}>{available ? audio.device || 'Output Windows' : 'Perangkat audio belum tersedia'}</p></div><strong style={{ fontSize: 28 }}>{Math.round(value * 100)}%</strong></div>
    <input className={ui.slider} style={{ margin: '28px 0 20px' }} aria-label="Volume Windows" type="range" min="0" max="1" step=".01" disabled={!available || pending} value={value}
      onChange={event => setDraft(Number(event.target.value))}
      onPointerUp={event => commit(Number(event.currentTarget.value))}
      onKeyUp={event => { if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) commit(Number(event.currentTarget.value)) }}
      onBlur={() => { if (draft !== null) commit(draft) }}/>
    <Button disabled={!available || pending} onClick={() => void run({ type: 'mute', muted: !audio.muted })}><Icon name={audio.muted ? 'muted' : 'volume'} size={18}/>{audio.muted ? 'Aktifkan suara' : 'Bisukan'}</Button>
    <ErrorMessage message={error}/>
  </div>
}
