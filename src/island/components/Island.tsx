import { AnimatePresence, MotionConfig, motion } from 'motion/react'
import { useReducedMotion } from '../../shared/hooks/useReducedMotion.ts'
import { useActivity } from '../../platform/desktop.ts'
import { useCommand } from '../../shared/hooks/useCommand.ts'
import { Icon } from '../../shared/ui/Icon.tsx'
import { useIsland } from '../activity/useIsland.ts'
import { activeKinds } from '../activity/select.ts'
import { useHitTest } from '../hooks/useHitTest.ts'
import { contentTransition, expandedHeights, islandSizes, islandSpring } from '../motion/presets.ts'
import { ActivityGlyph, CompactContent, ExpandedContent } from './ActivityContent.tsx'
import { activityNames } from '../activity/labels.ts'
import styles from './Island.module.css'

export function Island() {
  const snapshot = useActivity()
  const { primary, secondary, expanded, open, close } = useIsland(snapshot)
  const reduced = useReducedMotion()
  const { run, error } = useCommand()
  useHitTest()
  const size = expanded ? { ...islandSizes.expanded, height: expandedHeights[primary] } : islandSizes.compact
  const kinds = Array.from(new Set([...activeKinds(snapshot), 'battery' as const, ...(snapshot.preferences.volume ? ['volume' as const] : [])]))
  const low = snapshot.battery.percentage !== null && snapshot.battery.percentage <= 20 && snapshot.battery.charging !== 'charging'
  return <MotionConfig reducedMotion="user"><main className={styles.overlay}>
    <div className={styles.cluster}>
      <motion.section data-island data-kind={primary} className={`${styles.island} ${styles[primary]} ${primary === 'battery' && low ? styles.low : ''}`}
        initial={false} animate={{ width: size.width, height: size.height, borderRadius: size.radius, clipPath: `inset(0 round ${size.radius}px)` }} transition={reduced ? { duration: 0 } : islandSpring}
        aria-label="Dynamic Island">
        <button className={styles.trigger} type="button" aria-expanded={expanded} aria-controls="island-content" aria-label={`${expanded ? 'Tutup' : 'Buka'} ${activityNames[primary]}`} onClick={() => expanded ? close() : open(primary)}>
          {expanded ? <><span className={styles.handle}/><span className={styles.expandedName}>{activityNames[primary]}</span><Icon name="close" size={14}/></> : <CompactContent kind={primary} snapshot={snapshot}/>}
        </button>
        <AnimatePresence initial={false} mode="wait">
          {expanded && <motion.div key={primary} id="island-content" className={styles.content} initial={{ opacity: 0, y: reduced ? 0 : 7, filter: reduced ? 'none' : 'blur(3px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} exit={{ opacity: 0, y: reduced ? 0 : -4 }} transition={reduced ? { duration: 0 } : contentTransition}>
            <ExpandedContent kind={primary} snapshot={snapshot}/>
          </motion.div>}
        </AnimatePresence>
        {expanded && <nav className={styles.navigation} aria-label="Aktivitas">{kinds.map(kind => <button type="button" key={kind} aria-label={activityNames[kind]} aria-pressed={kind === primary} onClick={() => open(kind)}><ActivityGlyph kind={kind} snapshot={snapshot}/></button>)}<button type="button" aria-label="Buka pengaturan" onClick={() => void run({ type: 'open-settings' })}><Icon name="settings" size={17}/></button></nav>}
        {error && expanded && <p className={styles.error} role="alert">{error}</p>}
      </motion.section>
      <AnimatePresence initial={false}>{secondary && !expanded && <motion.button data-island data-secondary type="button" key={secondary} className={`${styles.bubble} ${styles[secondary]}`} aria-label={`Buka ${activityNames[secondary]}`} onClick={() => open(secondary)} initial={{ opacity: 0, scale: .6, x: -8 }} animate={{ opacity: 1, scale: 1, x: 0 }} exit={{ opacity: 0, scale: .6, x: -8 }} transition={reduced ? { duration: 0 } : islandSpring}><ActivityGlyph kind={secondary} snapshot={snapshot}/></motion.button>}</AnimatePresence>
    </div>
  </main></MotionConfig>
}
