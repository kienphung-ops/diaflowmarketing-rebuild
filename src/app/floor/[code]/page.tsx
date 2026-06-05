import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { readSession } from '@/lib/auth'
import { getUnlockedItemsForFloor } from '@/lib/floorsDb'
import { maskEmail, type InviterInfo } from '@/lib/inviter'
import FloorVisitorClient from './FloorVisitor.client'

export async function generateMetadata(
  { params }: { params: { code: string } },
): Promise<Metadata> {
  const code = params.code?.toUpperCase()
  if (!code) return {}
  const owner = await prisma.user.findUnique({
    where: { referralCode: code },
    select: { teamName: true, currentFloor: true },
  })
  // Unknown / 404 code — fall through to root-layout defaults.
  if (!owner) return {}

  const teamName = owner.teamName?.trim() || 'A Diaflow team'
  const title = `Visit ${teamName} office on Diaflow`
  const description = `${teamName} is building an AI office on Diaflow — now on Level ${owner.currentFloor}. Step inside their office, poke their AI teammates, and start building your own AI team in 30 seconds.`
  const url = `/floor/${code}`
  // Per-room share thumbnail — the actual office scene (not the logo) so
  // the preview shows what the visitor is being invited into. 2221×1211
  // PNG in /public; dimensions MUST match the file or LinkedIn/Facebook
  // silently reject it (and cache the "no image" verdict ~7 days).
  const imageAlt = `${teamName}'s AI office on Diaflow`
  // `type` → og:image:type. Facebook (and others) render more reliably
  // when the MIME type is declared.
  const ogImage = { url: '/thumbnail.png', width: 2221, height: 1211, alt: imageAlt, type: 'image/png' }

  return {
    title,
    description,
    // Next.js's metadata merge is SHALLOW — defining `openGraph` or
    // `twitter` here REPLACES the root layout's whole block instead
    // of patching individual fields. So we re-state every inherited
    // field (image, card type, siteName, type) alongside the per-room
    // overrides, otherwise the image drops out of shared previews.
    //
    // openGraph covers Facebook, LinkedIn, Instagram (DM/threads link
    // unfurl), Discord, iMessage, Zalo, etc.; `twitter` covers X.
    openGraph: {
      type: 'website',
      siteName: 'Diaflow',
      title,
      description,
      url,
      locale: 'en_US',
      images: [ogImage],
    },
    twitter: {
      card: 'summary_large_image', // big landscape preview on X
      title,
      description,
      images: ['/thumbnail.png'],
    },
    alternates: { canonical: url },
    // Facebook-specific: `fb:app_id` attributes the share to your FB app
    // (Insights / domain-claim controls). Core FB link preview already
    // works from the Open Graph tags above — this just unlocks the
    // extras. Emitted only when NEXT_PUBLIC_FB_APP_ID is set, so we never
    // ship a bogus/hard-coded ID. Set the env to enable; no code change.
    ...(process.env.NEXT_PUBLIC_FB_APP_ID
      ? { other: { 'fb:app_id': process.env.NEXT_PUBLIC_FB_APP_ID } }
      : {}),
  }
}

/**
 * /floor/[code] — unified invite + shared-floor URL.
 *
 * `code` is the owner's referral code (a public identifier). The
 * route resolves any valid code now — the `publicVisible` privacy
 * gate was removed when invite + share were unified, so a single
 * link does both jobs:
 *
 *   - Signed-in visitors see the owner's scene and can poke. We ALSO
 *     hydrate the visitor's own profile (their floor, invites,
 *     teammates, inviter) so the standard Header + MySquadDrawer
 *     render on top — same chrome they'd see on /office, just over
 *     someone else's floor.
 *   - Unlogged visitors see the same scene + a bottom-center CTA
 *     that funnels them into the referral signup flow
 *     (/?ref=<code>). Header still renders but in trial mode.
 *
 * Only 404 when the code doesn't exist at all.
 */
export default async function FloorPage({ params }: { params: { code: string } }) {
  const code = params.code?.toUpperCase()
  if (!code) notFound()

  // Owner record (the floor being visited) + visitor session in
  // parallel — they're independent reads against different keys.
  const [owner, session] = await Promise.all([
    prisma.user.findUnique({
      where: { referralCode: code },
      select: {
        id: true,
        teamName: true,
        currentFloor: true,
        totalInvites: true,
        recruitedTeams: {
          select: { id: true, slug: true, name: true, role: true, pokes: true, isDefault: true, description: true },
          orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
        },
      },
    }),
    readSession(),
  ])

  if (!owner) notFound()

  const unlocked = await getUnlockedItemsForFloor(owner.currentFloor)
  let unlockedItemKeys = unlocked.map(i => i.itemKey)
  if (unlockedItemKeys.length === 0) unlockedItemKeys = ['company_picture_frame']

  // Visitor's own profile — only fetched when there's a valid session.
  // Anonymous visitors get blank values + the trial-state Header /
  // MySquad fall back to those.
  let visitorCurrentFloor = 1
  let visitorTotalInvites = 0
  let visitorTeamName: string | null = null
  let visitorReferralCode: string | null = null
  let visitorRecruits: { id: string; name: string; role: string; slug?: string | null; isDefault?: boolean; pokes?: number }[] = []
  let visitorInviter: InviterInfo | null = null
  let visitorEmail: string | null = null
  let visitorEmailVerified = false
  // Track whether the visitor's session JWT actually resolves to a
  // real DB row. A valid-but-stale token (e.g. account deleted, DB
  // wiped) would otherwise leak signed-in chrome — most visibly the
  // Sign-out link in MySquadDrawer — to someone the server can't
  // actually act on. See the parallel fix in src/app/page.tsx.
  let visitorResolved = false

  if (session) {
    const me = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        email: true,
        emailVerified: true,
        currentFloor: true,
        totalInvites: true,
        teamName: true,
        referralCode: true,
        referredAt: true,
        recruitedTeams: {
          select: { id: true, name: true, role: true, slug: true, isDefault: true, pokes: true, description: true },
          orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
        },
        referredBy: {
          select: { referralCode: true, teamName: true, country: true, email: true },
        },
      },
    })
    if (me) {
      visitorResolved = true
      visitorEmail = me.email
      visitorEmailVerified = !!me.emailVerified
      visitorCurrentFloor = me.currentFloor
      visitorTotalInvites = me.totalInvites
      visitorTeamName = me.teamName
      visitorReferralCode = me.referralCode
      visitorRecruits = me.recruitedTeams
      if (me.referredBy) {
        visitorInviter = {
          referralCode: me.referredBy.referralCode,
          teamName: me.referredBy.teamName,
          country: me.referredBy.country,
          emailMasked: maskEmail(me.referredBy.email),
          invitedAt: me.referredAt ? me.referredAt.toISOString() : null,
        }
      }
    }
  }

  return (
    <FloorVisitorClient
      code={code}
      teamName={owner.teamName}
      currentFloor={owner.currentFloor}
      totalInvites={owner.totalInvites}
      unlockedItemKeys={unlockedItemKeys}
      teammates={owner.recruitedTeams}
      visitorSignedIn={visitorResolved}
      visitorCurrentFloor={visitorCurrentFloor}
      visitorTotalInvites={visitorTotalInvites}
      visitorTeamName={visitorTeamName}
      visitorReferralCode={visitorReferralCode}
      visitorRecruits={visitorRecruits}
      visitorInviter={visitorInviter}
      visitorEmail={visitorEmail}
      visitorEmailVerified={visitorEmailVerified}
    />
  )
}

export const dynamic = 'force-dynamic'
