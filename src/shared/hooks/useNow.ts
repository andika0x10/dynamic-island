import { useEffect, useState } from 'react'
export function useNow() {
  const [now, setNow] = useState(Date.now)
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(id) }, [])
  return now
}
