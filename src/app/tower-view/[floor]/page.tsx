import { getFloorPreview } from '@/lib/towerFloorPreview'
import { getAllFloorsConfig } from '@/lib/floorsApi'
import TowerFloorViewClient from './TowerFloorView.client'

// Statically generate every floor's preview page at build time. The
// floor catalogue itself comes from the DB (via the Redis-cached
// helper); ids that exist in the DB get their own static page.
export async function generateStaticParams() {
  const all = await getAllFloorsConfig()
  return all.map(c => ({ floor: String(c.id) }))
}

interface Params {
  params: { floor: string }
}

export default async function TowerFloorPage({ params }: Params) {
  const preview = await getFloorPreview(params.floor)
  return <TowerFloorViewClient preview={preview} />
}

export async function generateMetadata({ params }: Params) {
  const preview = await getFloorPreview(params.floor)
  return {
    title: `Floor ${preview.floor} — ${preview.floorLabel} | Diaflow Tower`,
    description: `Preview Floor ${preview.floor} of the Diaflow Tower. Unlock at ${preview.invitesRequired} invites.`,
  }
}
