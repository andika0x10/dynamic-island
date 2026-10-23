import { useEffect } from 'react'

export function useHitTest() {
  useEffect(() => {
    const desktop = window.desktop
    if (!desktop) return
    let pointer: { x: number; y: number } | null = null
    let frame = 0
    function update() {
      const focused = document.activeElement?.closest('[data-island]') && document.hasFocus()
      const inside = pointer && document.elementFromPoint(pointer.x, pointer.y)?.closest('[data-island]')
      desktop!.setClickThrough(!inside && !focused)
    }
    function move(event: PointerEvent) { pointer = { x: event.clientX, y: event.clientY }; update() }
    function leave() { pointer = null; update() }
    function tick() { update(); frame = requestAnimationFrame(tick) }
    // Re-evaluate during morphs: the pointer can stay still while the shell shrinks.
    frame = requestAnimationFrame(tick)
    window.addEventListener('pointermove', move)
    document.documentElement.addEventListener('pointerleave', leave)
    window.addEventListener('blur', leave)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('pointermove', move)
      document.documentElement.removeEventListener('pointerleave', leave)
      window.removeEventListener('blur', leave)
      desktop.setClickThrough(true)
    }
  }, [])
}
