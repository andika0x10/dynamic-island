import type { TimerSnapshot } from '../../../shared/contracts/activity.ts'
export function timerRemaining(timer: TimerSnapshot, now: number) {
  return timer.status === 'running' && timer.deadline !== null ? Math.max(0, Math.ceil((timer.deadline - now) / 1000)) : timer.remaining
}
