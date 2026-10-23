import type { CSSProperties } from 'react'
export type IconName = 'battery' | 'bolt' | 'music' | 'volume' | 'muted' | 'timer' | 'bell' | 'play' | 'pause' | 'next' | 'previous' | 'close' | 'check'
const paths: Record<IconName, React.ReactNode> = {
  battery: <><rect x="2" y="6" width="17" height="12" rx="3"/><path d="M22 10v4M5 9h10v6H5z"/></>,
  bolt: <path d="m13 2-8 12h6l-1 8 9-13h-6l1-7Z"/>,
  music: <><path d="M9 18V5l11-2v13M9 9l11-2"/><ellipse cx="6" cy="18" rx="3" ry="2.5"/><ellipse cx="17" cy="16" rx="3" ry="2.5"/></>,
  volume: <><path d="m11 4-5 5H2v6h4l5 5V4Z"/><path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/></>,
  muted: <><path d="m11 4-5 5H2v6h4l5 5V4Z"/><path d="m16 9 6 6m0-6-6 6"/></>,
  timer: <><circle cx="12" cy="14" r="8"/><path d="M9 2h6m-3 0v4m6 1 2-2m-8 5v5l3 2"/></>,
  bell: <><path d="M5 10a7 7 0 0 1 14 0c0 7 3 7 3 8H2c0-1 3-1 3-8Zm4 11h6"/></>,
  play: <path d="m8 4 13 8-13 8Z" fill="currentColor" stroke="none"/>,
  pause: <><path d="M6 4h4v16H6zm8 0h4v16h-4z" fill="currentColor" stroke="none"/></>,
  next: <><path d="m3 5 11 7L3 19Zm10 0 9 7-9 7Z" fill="currentColor" stroke="none"/></>,
  previous: <><path d="m21 5-11 7 11 7ZM11 5l-9 7 9 7Z" fill="currentColor" stroke="none"/></>,
  close: <path d="m6 6 12 12M6 18 18 6"/>,
  check: <path d="m5 12 5 5L20 7"/>,
}
export function Icon({ name, size = 22, style }: { name: IconName; size?: number; style?: CSSProperties }) {
  return <svg style={style} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}
