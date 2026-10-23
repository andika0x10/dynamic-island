import { useCallback, useRef, useState } from 'react'
import type { ActivityKind } from '../activity/select.ts'

// Match the content's top inset and the space reserved for bottom navigation.
const panelChrome = 47 + 54 + 2

export function usePanelHeight(kind: ActivityKind) {
  const [heights, setHeights] = useState<Partial<Record<ActivityKind, number>>>({})
  const observer = useRef<ResizeObserver | null>(null)
  const measure = useCallback((element: HTMLDivElement | null) => {
    observer.current?.disconnect()
    observer.current = null
    if (!element) return
    const update = () => {
      const height = Math.ceil(element.getBoundingClientRect().height) + panelChrome
      setHeights(previous => previous[kind] === height ? previous : { ...previous, [kind]: height })
    }
    update()
    observer.current = new ResizeObserver(update)
    observer.current.observe(element)
  }, [kind])
  return { height: heights[kind] ?? 270, measure }
}
