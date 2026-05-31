# Diaflow Tower — Tracking Guide

Landing page analytics instrumentation for GA4 (via GTM) and Microsoft Clarity.

**Linear issue:** [GRO-1](https://linear.app/diaflow/issue/GRO-1/add-tracking-for-diaflow-tower-landing-page)

---

## Event Catalogue

All custom events pushed to GTM's `dataLayer` and tagged in Clarity sessions.

| Event Name | Parameters | Trigger |
|------------|-----------|---------|
| `iris_interaction` | `action`: `open_modal` \| `add_teammate` \| `save_team` | User clicks Iris NPC or uses Iris modal actions |
| `mia_interaction` | `action`: `open_modal` | User clicks Mia NPC |
| `leo_video_complete` | `percent`: number | User watches Leo's video past ~80% |
| `signup_click` | `source`: `header` \| `iris` \| `mobile_share` \| `onboarding` \| `mobile_nav` | User clicks any signup CTA |
| `signup_complete` | `method`: `email` \| `google` | User finishes account creation |
| `discord_click` | `source`: `squad_drawer` \| `how_it_works` | User clicks Discord join link |
| `share_click` | `platform`: `twitter` \| `linkedin` \| `copy`; `source`: `share_modal` \| `mobile_share` \| `iris_modal` \| `squad_drawer` | User clicks any share button |
| `nav_click_tower_view` | _(none)_ | User navigates to Tower View |
| `nav_click_how_it_works` | _(none)_ | User opens How It Works |

### Funnel Sequence

```
page_view → iris_interaction → mia_interaction → leo_video_complete → signup_click → signup_complete → discord_click → share_click
```

`page_view` is auto-collected by GA4. The remaining 8 are custom events.

---

## Part 1: Developer Guide

### How `trackEvent()` works

All tracking flows through a single function in `src/lib/tracking.ts`:

```ts
import { trackEvent } from '@/lib/tracking'

// With parameters
trackEvent('signup_click', { source: 'header' })

// Without parameters
trackEvent('nav_click_tower_view')
```

Internally, `trackEvent()` does two things:
1. Pushes `{ event: name, ...params }` to `window.dataLayer` (for GTM/GA4)
2. Calls `window.clarity('event', name)` (tags the Clarity session recording)

An SSR guard (`typeof window === 'undefined'`) prevents crashes if accidentally called server-side.

### How to add a new event

1. Add the event to the `TrackingEvents` interface in `src/lib/tracking.ts`:

```ts
interface TrackingEvents {
  // ... existing events ...
  my_new_event: { some_param: 'value_a' | 'value_b' }
}
```

2. Call `trackEvent()` at the interaction point in the relevant component:

```ts
trackEvent('my_new_event', { some_param: 'value_a' })
```

3. TypeScript enforces correct event names and parameter shapes at compile time. Mistyped event names or missing parameters will fail `tsc`.

4. After deploying, create a matching GTM trigger (see Part 2).

### File map

| File | Events tracked |
|------|---------------|
| `src/lib/tracking.ts` | Event type definitions + `trackEvent()` utility |
| `src/components/MicrosoftClarity.tsx` | Clarity script loader |
| `src/app/layout.tsx` | Mounts Clarity alongside GTM/GA4 |
| `src/app/TowerLanding.client.tsx` | `iris_interaction`, `mia_interaction`, `signup_click`, `signup_complete` (Google OAuth), `nav_click_tower_view` |
| `src/components/LeoEmailDrawer.tsx` | `leo_video_complete` |
| `src/components/SignupModal.tsx` | `signup_complete` (email), `signup_click` (Google OAuth) |
| `src/app/signup/page.tsx` | `signup_complete` (email) |
| `src/components/ShareModal.tsx` | `share_click` |
| `src/components/mobile/MobileShareSheet.tsx` | `share_click` |
| `src/components/IrisHireModal.tsx` | `share_click`, `iris_interaction` (add_teammate, save_team) |
| `src/components/MySquadDrawer.tsx` | `share_click`, `discord_click`, `nav_click_how_it_works` |
| `src/app/how-it-works/HowItWorksClient.tsx` | `discord_click` |

### Leo video tracking

`LeoEmailDrawer.tsx` uses the YouTube iframe postMessage API to track video progress:

- `enablejsapi=1` is appended to the embed URL
- A `setInterval` polls the iframe every 1s via `postMessage({ event: 'listening' })`
- YouTube responds with `infoDelivery` messages containing `currentTime` and `duration`
- When `currentTime / duration >= 0.8`, `leo_video_complete` fires once (guarded by a `useRef`)
- The interval and listener are cleaned up when the modal closes

### Google OAuth `signup_complete` deduplication

Email and Google OAuth signups both redirect to `/?just_signed_up=1`. To avoid double-counting:

1. **Email signup:** `SignupModal.tsx` and `signup/page.tsx` fire `trackEvent('signup_complete', { method: 'email' })` and set `sessionStorage.signup_tracked = '1'`
2. **Google OAuth:** `TowerLanding.client.tsx` detects `?just_signed_up=1`. If `sessionStorage.signup_tracked` is NOT set, it fires `trackEvent('signup_complete', { method: 'google' })`. If it IS set (email path), it clears the flag.

This ensures each signup fires exactly one `signup_complete` event with the correct method.

### Verifying events locally

1. Run `npm run dev`
2. Open browser DevTools console
3. Interact with the page (click Iris, share, etc.)
4. Type `window.dataLayer` in console — all custom events appear in the array
5. Each entry has `{ event: 'event_name', ...params }`

---

## Part 2: GTM / GA4 / Clarity Setup

### Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `NEXT_PUBLIC_GA_ID` | Yes | GA4 measurement ID (e.g., `G-8R963NKFKL`) |
| `NEXT_PUBLIC_GTM_ID` | No | Override default GTM container (default: `GTM-KDPNP5XB`) |
| `NEXT_PUBLIC_CLARITY_ID` | Yes | Microsoft Clarity project ID |

### GTM: Creating triggers for custom events

Each custom event needs a GTM trigger to forward it to GA4.

**Option A: Per-event triggers (more control)**

For each event in the catalogue:

1. Go to GTM > Triggers > New
2. Trigger type: **Custom Event**
3. Event name: the exact event name (e.g., `iris_interaction`)
4. Save

Then create a GA4 Event tag:

1. Go to Tags > New
2. Tag type: **Google Analytics: GA4 Event**
3. Measurement ID: your GA4 property ID
4. Event name: `{{Event}}` (uses the dataLayer event name)
5. Event parameters: add rows for each parameter the event carries (e.g., `action`, `source`, `platform`)
6. Triggering: select the Custom Event trigger you created
7. Save and publish

**Option B: Catch-all trigger (simpler)**

1. Create one Custom Event trigger with event name matching regex:
   ```
   iris_interaction|mia_interaction|leo_video_complete|signup_click|signup_complete|discord_click|share_click|nav_click_tower_view|nav_click_how_it_works
   ```
2. Create one GA4 Event tag that fires on this trigger
3. Use `{{Event}}` as the event name so each event keeps its identity
4. Add event parameters using GTM's Data Layer Variable feature to extract `action`, `source`, `platform`, `method`, `percent`

**To extract dataLayer parameters as GTM variables:**

1. Go to Variables > User-Defined Variables > New
2. Variable type: **Data Layer Variable**
3. Data Layer Variable Name: `action` (or `source`, `platform`, etc.)
4. Save
5. Reference as `{{action}}` in your GA4 Event tag parameters

### GA4: Building the funnel report

1. Go to GA4 > Explore > Create new exploration
2. Technique: **Funnel Exploration**
3. Add steps in order:
   - Step 1: `page_view` (auto-collected)
   - Step 2: `iris_interaction`
   - Step 3: `mia_interaction`
   - Step 4: `leo_video_complete`
   - Step 5: `signup_click`
   - Step 6: `signup_complete`
   - Step 7: `discord_click`
   - Step 8: `share_click`
4. Set the funnel to **Open** (users can enter at any step) or **Closed** (must follow sequence) depending on your analysis needs
5. Save the exploration

### GA4: Session length by visitor type

No custom events needed — GA4 handles this natively:

1. Go to Explore > Free Form
2. Rows: `New / returning` dimension
3. Values: `Average engagement time per session` metric
4. This gives you session duration split by first-time vs. returning visitors

### GA4: US segment for Series A reporting

1. Go to Explore or Reports
2. Click **Comparisons** > Add comparison
3. Dimension: `Country`
4. Value: `United States`
5. Apply — all reports now show US-only data alongside the global view

For a reusable segment:

1. Go to Explore > Segments > Create segment
2. User segment > Conditions
3. Dimension: `Country` equals `United States`
4. Name: "US Users"
5. Apply to any exploration to filter `signup_complete` and other events to US-only

### Microsoft Clarity: Setup

1. Go to [clarity.microsoft.com](https://clarity.microsoft.com) > Create new project
2. Enter your site URL (e.g., `https://diaflow.io`)
3. Copy the **Project ID** from Settings > Overview
4. Set `NEXT_PUBLIC_CLARITY_ID=<project-id>` in your environment variables
5. Deploy — the Clarity script loads automatically

**What you get immediately (no config needed):**

- Click heatmaps per page
- Scroll depth heatmaps
- Full session recordings with playback
- Rage click detection (user clicking repeatedly with no response)
- Dead click detection (clicks on non-interactive elements)
- Device, browser, country breakdowns

**Filtering recordings by event:**

Custom events are tagged on Clarity sessions via `window.clarity('event', name)`. To find sessions where a specific event happened:

1. Go to Clarity > Recordings
2. Click Filters > Custom tags
3. Select the event name (e.g., `signup_complete`)
4. View all session recordings where that event fired

This is useful for debugging drop-off: filter for `signup_click` sessions that did NOT also have `signup_complete` to watch users abandon the signup flow.
