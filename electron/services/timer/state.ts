import { emptyTimer, type TimerSnapshot } from '../../../shared/contracts/activity.ts'

export function remainingSeconds(timer: TimerSnapshot, now: number): number {
  return timer.status === 'running' && timer.deadline !== null ? Math.max(0, Math.ceil((timer.deadline - now) / 1000)) : timer.remaining
}
export function advanceTimer(timer: TimerSnapshot, now: number): TimerSnapshot {
  if (timer.status !== 'running') return timer
  const remaining = remainingSeconds(timer, now)
  return remaining === timer.remaining ? timer : { ...timer, remaining, status: remaining === 0 ? 'finished' : 'running' }
}
export function transitionTimer(timer: TimerSnapshot, action: 'start' | 'pause' | 'resume' | 'cancel', now: number, seconds = 0): TimerSnapshot {
  switch (action) {
    case 'start': return { status: 'running', duration: seconds, remaining: seconds, deadline: now + seconds * 1000 }
    case 'pause': {
      const next = advanceTimer(timer, now)
      return next.status === 'running' ? { ...next, status: 'paused', deadline: null } : next
    }
    case 'resume': return timer.status === 'paused' ? { ...timer, status: 'running', deadline: now + timer.remaining * 1000 } : timer
    case 'cancel': return { ...emptyTimer }
  }
}
export function restoreTimer(value: unknown, now: number): TimerSnapshot {
  if (!value || typeof value !== 'object') return { ...emptyTimer }
  const timer = value as TimerSnapshot
  if (!['idle', 'running', 'paused', 'finished'].includes(timer.status)
    || !Number.isFinite(timer.duration) || timer.duration < 0 || timer.duration > 86400
    || !Number.isFinite(timer.remaining) || timer.remaining < 0 || timer.remaining > timer.duration
    || (timer.status === 'running' && (!Number.isFinite(timer.deadline) || timer.deadline === null))) return { ...emptyTimer }
  return advanceTimer(timer, now)
}
