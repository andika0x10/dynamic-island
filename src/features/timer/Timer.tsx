import { useState } from 'react'
import type { TimerSnapshot } from '../../../shared/contracts/activity.ts'
import { useCommand } from '../../shared/hooks/useCommand.ts'
import { useNow } from '../../shared/hooks/useNow.ts'
import { clock } from '../../shared/ui/format.ts'
import { Icon } from '../../shared/ui/Icon.tsx'
import { Button, ErrorMessage } from '../../shared/ui/Button.tsx'
import styles from './Timer.module.css'
import ui from '../../shared/ui/Controls.module.css'
import { timerRemaining } from './remaining.ts'

export function TimerPanel({ timer }: { timer: TimerSnapshot }) {
  const now = useNow(), remaining = timerRemaining(timer, now)
  const { run, error, pending } = useCommand()
  if (timer.status === 'idle') return <TimerSetup run={run} error={error} pending={pending}/>
  return <div>
    <div className={ui.row}><h2 className={ui.title}>{timer.status === 'finished' ? 'Waktu habis' : 'Timer'}</h2><span className={ui.caption}>{timer.status === 'paused' ? 'Dijeda' : timer.status === 'running' ? 'Sedang berjalan' : ''}</span></div>
    <div className={styles.face}><svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="44"/><circle cx="50" cy="50" r="44" className={styles.progress} style={{ strokeDashoffset: 276.46 * (1 - (timer.duration ? remaining / timer.duration : 0)) }}/></svg><span>{clock(remaining)}</span></div>
    <div className={ui.row}>
      <Button disabled={pending} onClick={() => void run({ type: 'timer-cancel' })}>{timer.status === 'finished' ? 'Selesai' : 'Batalkan'}</Button>
      {timer.status !== 'finished' && <Button primary disabled={pending} onClick={() => void run({ type: timer.status === 'paused' ? 'timer-resume' : 'timer-pause' })}><Icon name={timer.status === 'paused' ? 'play' : 'pause'} size={16}/>{timer.status === 'paused' ? 'Lanjutkan' : 'Jeda'}</Button>}
    </div><ErrorMessage message={error}/>
  </div>
}
function TimerSetup({ run, error, pending }: ReturnType<typeof useCommand>) {
  const [minutes, setMinutes] = useState('5')
  const duration = Number(minutes)
  const valid = Number.isInteger(duration) && duration >= 1 && duration <= 1440
  const seconds = duration * 60
  return <div className={styles.setup}>
    <div className={styles.presets}>{[1, 5, 15, 25].map(value => <Button key={value} onClick={() => setMinutes(String(value))} primary={Number(minutes) === value}>{value} mnt</Button>)}</div>
    <form onSubmit={event => { event.preventDefault(); if (valid && !pending) void run({ type: 'timer-start', seconds }) }}>
      <label>Durasi <span className={ui.caption}>(menit)</span><input aria-label="Durasi timer dalam menit" type="number" min="1" max="1440" step="1" value={minutes} onChange={event => setMinutes(event.target.value)} required/></label>
      <Button primary type="submit" disabled={pending || !valid}><Icon name="play" size={16}/>Mulai timer</Button>
    </form><ErrorMessage message={error}/>
  </div>
}
