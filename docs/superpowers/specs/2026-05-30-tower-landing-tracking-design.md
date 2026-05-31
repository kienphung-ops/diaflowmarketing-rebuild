# Add Tracking for Diaflow Tower Landing Page

**Linear issue:** GRO-1
**Date:** 2026-05-30
**Status:** Approved

## Overview

Instrument the Diaflow Tower landing page with GA4 custom events (via GTM `dataLayer.push()`) and Microsoft Clarity (heatmaps + session recordings). The goal is to track the full user funnel from page load through signup, sharing, and Discord join — with US vs. non-US segmentation for Series A reporting.

## Approach

Centralized tracking utility (`src/lib/tracking.ts`) with typed event helpers. Each helper calls `dataLayer.push()` for GTM/GA4 and `window.clarity('event', name)` for Clarity session tagging. Tracking calls are placed inline at existing interaction points in components.

## Microsoft Clarity Integration

- New `src/components/MicrosoftClarity.tsx` component loads the Clarity snippet via `next/script` with `strategy="afterInteractive"`
- Mounted in `src/app/layout.tsx` alongside GTM/GA4
- Project ID stored as `NEXT_PUBLIC_CLARITY_ID` env var
- Base script provides: click heatmaps, scroll depth, session recordings, rage/dead click detection — no custom config needed
- Custom events via `window.clarity('event', name)` tag sessions for filtering in the Clarity dashboard

## Tracking Utility

### File: `src/lib/tracking.ts`

Typed event map ensures event name consistency and correct parameters:

| Event Name | Parameters | Description |
|------------|-----------|-------------|
| `iris_interaction` | `action: 'open_modal' \| 'add_teammate' \| 'save_team'` | User interacts with Iris NPC |
| `mia_interaction` | `action: 'open_modal'` | User interacts with Mia NPC |
| `leo_video_complete` | `percent: number` | User watches Leo's video past ~80% |
| `signup_click` | `source: 'header' \| 'iris' \| 'mobile_share' \| 'onboarding'` | User clicks any signup CTA |
| `signup_complete` | `method: 'email' \| 'google'` | User finishes account creation |
| `discord_click` | `source: 'squad_drawer' \| 'how_it_works'` | User clicks Discord join CTA |
| `share_click` | `platform: 'twitter' \| 'linkedin' \| 'copy'; source: string` | User clicks any share button |
| `nav_click_tower_view` | (none) | User navigates to Tower View |
| `nav_click_how_it_works` | (none) | User navigates to How It Works |

### Logic

`trackEvent(name, params)`:
1. Pushes `{ event: name, ...params }` to `window.dataLayer`
2. If `window.clarity` exists, calls `window.clarity('event', name)`

## Event Instrumentation Locations

| Event | File | Trigger Point |
|-------|------|---------------|
| `iris_interaction` | `TowerLanding.client.tsx` | `setIrisModalOpen(true)` |
| `mia_interaction` | `TowerLanding.client.tsx` | `setActiveNpcModal('mia')` |
| `leo_video_complete` | `LeoEmailDrawer.tsx` | YouTube iframe API: `getCurrentTime() / getDuration() >= 0.8` |
| `signup_click` | `TowerLanding.client.tsx` + components | All `setShowSignupModal(true)` call sites, with `source` param |
| `signup_complete` | `SignupModal.tsx`, signup page | After successful `/api/auth/signup` response |
| `discord_click` | `MySquadDrawer.tsx`, `HowItWorksClient` | Discord link click handlers |
| `share_click` | `ShareModal`, `MobileShareSheet`, `IrisHireModal` | Share button click handlers |
| `nav_click_tower_view` | `TowerLanding.client.tsx` | `router.push('/tower')` calls |
| `nav_click_how_it_works` | `TowerLanding.client.tsx` | `/how-it-works` link clicks |

### Leo Video ~80% Tracking

The Leo modal embeds a YouTube video. Implementation:
- Use YouTube iframe API `YT.Player` to access `getCurrentTime()` and `getDuration()`
- Poll via `setInterval` while video is playing
- Fire `leo_video_complete` once `getCurrentTime / getDuration >= 0.8`
- Guard with a ref (`hasTrackedVideoComplete`) to fire only once per session

## GA4 Funnel Configuration (GA4 UI, not code)

The funnel from the ticket maps to these events in order:

```
page_view -> iris_interaction -> mia_interaction -> leo_video_complete -> signup_click -> signup_complete -> discord_click -> share_click
```

Setup in GA4 via Explore > Funnel Exploration — select events in order. This is a reporting task, not a code task.

### GTM Setup (GTM UI, not code)

Two options:
1. **Per-event triggers:** Create a Custom Event trigger for each event name, each forwarding to a GA4 Event tag
2. **Catch-all trigger:** One GA4 Event tag that fires on all custom events matching a regex pattern — simpler to maintain

Either approach works. The `dataLayer.push()` calls are the same regardless.

## Session Length Tracking (no code needed)

- GA4 auto-collects `engagement_time_msec`
- Filter by `newVsReturning` dimension in GA4 Explore for first vs. return visit comparison
- No custom events required

## US vs. Non-US Segment (no code needed)

- GA4 auto-collects `country` from IP geolocation
- Create a GA4 segment where `country = "United States"`
- Filter `signup_complete` events by this segment for Series A reporting

## What Lives Where

| Concern | Location |
|---------|----------|
| `dataLayer.push()` calls | Code: `tracking.ts` + components |
| Clarity script | Code: `layout.tsx` |
| Clarity custom event tags | Code: alongside dataLayer calls |
| GTM event -> GA4 forwarding | GTM UI |
| Funnel Exploration report | GA4 UI |
| Session duration by visitor type | GA4 UI |
| US signup segment | GA4 UI |
| Heatmaps & session recordings | Clarity dashboard |

## Files to Create

- `src/lib/tracking.ts` — tracking utility with typed events
- `src/components/MicrosoftClarity.tsx` — Clarity script loader

## Files to Modify

- `src/app/layout.tsx` — mount MicrosoftClarity component
- `src/app/TowerLanding.client.tsx` — add tracking calls for iris, mia, leo, signup_click, nav events
- `src/components/SignupModal.tsx` — track `signup_complete`
- `src/app/signup/page.tsx` (or its client component) — track `signup_complete`
- `src/components/ShareModal.tsx` — track `share_click`
- `src/components/MobileShareSheet.tsx` — track `share_click`
- `src/components/IrisHireModal.tsx` — track `share_click`, `iris_interaction` sub-actions
- `src/components/MySquadDrawer.tsx` — track `discord_click`
- `src/components/HowItWorksClient.tsx` (or equivalent) — track `discord_click`
- `src/app/TowerLanding.client.tsx` — track `nav_click_tower_view` at `router.push('/tower')` calls, `nav_click_how_it_works` at `/how-it-works` link clicks
- `src/components/LeoEmailDrawer.tsx` — track `leo_video_complete` via YouTube iframe API

## Environment Variables

- `NEXT_PUBLIC_CLARITY_ID` — Microsoft Clarity project ID (obtain from clarity.microsoft.com)
