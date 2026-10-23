import { useSyncExternalStore } from 'react'
const query = window.matchMedia('(prefers-reduced-motion: reduce)')
const subscribe = (callback: () => void) => { query.addEventListener('change', callback); return () => query.removeEventListener('change', callback) }
export const useReducedMotion = () => useSyncExternalStore(subscribe, () => query.matches)
