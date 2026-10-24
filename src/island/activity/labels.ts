import type { ActivityKind } from './select.ts'
import type { IconName } from '../../shared/ui/Icon.tsx'
export const activityNames: Record<ActivityKind, string> = { battery: 'Baterai', media: 'Musik', timer: 'Timer', volume: 'Volume' }
export const activityIcons: Record<Exclude<ActivityKind, 'battery' | 'media'>, IconName> = { timer: 'timer', volume: 'volume' }
