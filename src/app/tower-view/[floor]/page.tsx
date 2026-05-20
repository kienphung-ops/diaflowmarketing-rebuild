import { getFloorPreview } from '@/lib/towerFloorPreview'
import { FLOOR_CONFIG } from '@/lib/floors'
import TowerFloorViewClient from './TowerFloorView.client'

// Statically generate every floor's preview page at build time. The
// content depends only on the URL param (no auth, no DB), so they're
// effectively static marketing pages.
export function generateStaticParams() {
  return FLOOR_CONFIG.map(c => ({ floor: String(c.floor) }))
}

interface Params {
  params: { floor: string }
}

export default function TowerFloorPage({ params }: Params) {
  const preview = getFloorPreview(params.floor)
  return <TowerFloorViewClient preview={preview} />
}

export function generateMetadata({ params }: Params) {
  const preview = getFloorPreview(params.floor)
  return {
    title: `Floor ${preview.floor} — ${preview.floorLabel} | Diaflow Tower`,
    description: `Preview Floor ${preview.floor} of the Diaflow Tower. Unlock at ${preview.invitesRequired} invites.`,
  }
}
