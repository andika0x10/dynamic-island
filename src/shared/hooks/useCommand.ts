import { useState } from 'react'
import type { DesktopCommand } from '../../../shared/contracts/activity.ts'
import { sendCommand } from '../../platform/desktop.ts'

export function useCommand() {
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  async function run(command: DesktopCommand) {
    setError(''); setPending(true)
    const result = await sendCommand(command)
    setPending(false)
    if (!result.ok) setError(result.error ?? 'Perintah gagal. Coba lagi.')
    return result
  }
  return { run, error, pending }
}
