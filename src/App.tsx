import { Island } from './island/components/Island.tsx'
import { Settings } from './features/settings/Settings.tsx'

export default function App() {
  return window.location.hash === '#settings' ? <Settings/> : <Island/>
}
