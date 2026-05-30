/**
 * Klaviyo client — transactional events + list subscriptions.
 *
 * Wraps the official `klaviyo-api` SDK (npm package) so:
 *   - We don't pin / leak the Klaviyo API revision date — the SDK
 *     version we depend on already targets a known-good revision.
 *   - Calls return narrow `Promise<boolean>` rather than the raw
 *     Axios responses the SDK surfaces, so callers stay terse.
 *   - Failures never throw — they log and return false, matching the
 *     fail-silent pattern in `lib/diaflowEmail.ts`. Email delivery is
 *     best-effort; signup / floor-up / capture-email flows continue
 *     regardless.
 *
 * Klaviyo's transactional model is event-driven, not "send-this-HTML":
 *
 *   1. Configure a Flow in Klaviyo's UI, triggered by an event
 *      metric name (e.g. "Tower Floor Up", "Tower Welcome").
 *   2. `trackKlaviyoEvent` fires that event for a specific profile
 *      with any custom properties needed in the template.
 *   3. Klaviyo's Flow runs and delivers the email.
 *
 * Env vars consumed:
 *   - `KLAVIYO_PRIVATE_API_KEY` — required for any outbound call.
 *     Klaviyo private keys start with `pk_*`. Server-only — NEVER
 *     prefix this with NEXT_PUBLIC.
 */

import {
  ApiKeySession,
  EventsApi,
  ProfilesApi,
} from 'klaviyo-api'

interface KlaviyoProfileAttrs {
  email: string
  /** Optional name fields surfaced inside Klaviyo dashboards / templates. */
  firstName?: string
  lastName?: string
  /** Phone E.164 — used by SMS flows; ignored by email flows. */
  phoneNumber?: string
  /** Arbitrary key/value props attached to the profile (e.g.
   *  `current_floor`, `team_name`). Klaviyo merges these into the
   *  profile's properties on every event we send. */
  properties?: Record<string, unknown>
}

/* ── Session singleton ────────────────────────────────────────────── */

// Cache the session + API instances so repeated calls share the same
// underlying axios client (HTTP keep-alive, lower latency).
// Re-created lazily if the API key changes between hot reloads.
let cachedKey: string | undefined
let cachedEvents: EventsApi | null = null
let cachedProfiles: ProfilesApi | null = null

function getApis(): { events: EventsApi; profiles: ProfilesApi } | null {
  const apiKey = process.env.KLAVIYO_PRIVATE_API_KEY
  if (!apiKey) return null
  if (cachedKey !== apiKey || !cachedEvents || !cachedProfiles) {
    const session = new ApiKeySession(apiKey)
    cachedEvents = new EventsApi(session)
    cachedProfiles = new ProfilesApi(session)
    cachedKey = apiKey
  }
  return { events: cachedEvents, profiles: cachedProfiles }
}

/* ── 1. Fire an event ─────────────────────────────────────────────── */

interface TrackEventArgs {
  /** Metric name (e.g. "Tower Floor Up"). Configure a Flow in
   *  Klaviyo against this exact name to trigger the email. */
  metricName: string
  /** Profile to fire the event for. */
  profile: KlaviyoProfileAttrs
  /** Event-specific properties — referenced inside the Klaviyo email
   *  template via `{{ event.<key> }}`. */
  properties?: Record<string, unknown>
  /** Optional Date; defaults to now. Override for backfill only. */
  time?: Date
  /** Optional unique id so Klaviyo dedupes retries. Use any stable
   *  hash of the source action (e.g. `signup:<userId>`). */
  uniqueId?: string
  /** Optional monetary value for revenue-tracking events. */
  value?: number
  valueCurrency?: string
}

/**
 * Fire a Klaviyo event for a profile. Returns true on success, false
 * on any failure (missing API key, network error, non-2xx response).
 */
export async function trackKlaviyoEvent(args: TrackEventArgs): Promise<boolean> {
  if (process.env.NODE_ENV !== 'production') {
    console.log('[klaviyo:event:dev]', {
      metric: args.metricName,
      email: args.profile.email,
      properties: args.properties,
    })
  }

  const apis = getApis()
  if (!apis) {
    console.warn('[klaviyo] KLAVIYO_PRIVATE_API_KEY not set — event not sent')
    return false
  }

  try {
    await apis.events.createEvent({
      data: {
        type: 'event',
        attributes: {
          properties: args.properties ?? {},
          ...(args.time ? { time: args.time } : {}),
          ...(args.uniqueId ? { uniqueId: args.uniqueId } : {}),
          ...(typeof args.value === 'number' ? { value: args.value } : {}),
          ...(args.valueCurrency ? { valueCurrency: args.valueCurrency } : {}),
          metric: {
            data: {
              type: 'metric',
              attributes: { name: args.metricName },
            },
          },
          profile: {
            data: {
              type: 'profile',
              attributes: profileAttrsForSdk(args.profile),
            },
          },
        },
      },
    })
    return true
  } catch (err) {
    // SDK errors surface as AxiosError — extract the response body so
    // the log is useful (Klaviyo returns structured validation errors).
    const e = err as { response?: { status?: number; data?: unknown }; message?: string }
    console.error(
      '[klaviyo:event]',
      e.response?.status ?? '?',
      e.response?.data ?? e.message ?? err,
    )
    return false
  }
}

/* ── 2. Subscribe a profile to a list ─────────────────────────────── */

interface SubscribeArgs {
  /** Klaviyo list id (e.g. "X7gJP9") — find under Audience → Lists. */
  listId: string
  /** Profile to add to the list. */
  profile: KlaviyoProfileAttrs
  /** When true (default), opts the profile in to email marketing
   *  consent. Use false for transactional-only signups so the
   *  profile doesn't receive promo blasts. */
  marketingConsent?: boolean
}

/**
 * Subscribe a profile to a Klaviyo list. Used for waitlist signups
 * (the Leo onboarding step / /api/capture-email) so the email lands
 * in a campaign-ready segment.
 *
 * Returns true on success, false on any failure.
 */
export async function subscribeKlaviyoProfile(args: SubscribeArgs): Promise<boolean> {
  if (process.env.NODE_ENV !== 'production') {
    console.log('[klaviyo:subscribe:dev]', {
      list: args.listId,
      email: args.profile.email,
    })
  }

  const apis = getApis()
  if (!apis) {
    console.warn('[klaviyo] KLAVIYO_PRIVATE_API_KEY not set — subscribe skipped')
    return false
  }

  // `subscriptions` is REQUIRED on the SDK's profile-subscription
  // attributes (even when adding the profile without marketing
  // consent). When the caller opts out we pass an empty object —
  // Klaviyo still attaches the profile to the list but skips the
  // consent record. The bulk-subscribe attrs only accept
  // email/phoneNumber/subscriptions, so name + properties are NOT
  // forwarded here; use a separate `trackKlaviyoEvent` if you need
  // to attach extra profile context.
  const wantsMarketing = args.marketingConsent !== false
  const subscriptions = wantsMarketing
    ? { email: { marketing: { consent: 'SUBSCRIBED' as const } } }
    : {}

  try {
    await apis.profiles.bulkSubscribeProfiles({
      data: {
        type: 'profile-subscription-bulk-create-job',
        attributes: {
          profiles: {
            data: [
              {
                type: 'profile',
                attributes: {
                  email: args.profile.email,
                  ...(args.profile.phoneNumber ? { phoneNumber: args.profile.phoneNumber } : {}),
                  subscriptions,
                },
              },
            ],
          },
        },
        relationships: {
          list: { data: { type: 'list', id: args.listId } },
        },
      },
    })
    return true
  } catch (err) {
    const e = err as { response?: { status?: number; data?: unknown }; message?: string }
    console.error(
      '[klaviyo:subscribe]',
      e.response?.status ?? '?',
      e.response?.data ?? e.message ?? err,
    )
    return false
  }
}

/* ── Internals ────────────────────────────────────────────────────── */

/**
 * Normalise our `KlaviyoProfileAttrs` into the camelCase shape the
 * SDK's profile attributes expect. Strips undefined fields so the
 * SDK doesn't serialise them as nulls.
 */
function profileAttrsForSdk(p: KlaviyoProfileAttrs): Record<string, unknown> {
  const out: Record<string, unknown> = { email: p.email }
  if (p.firstName) out.firstName = p.firstName
  if (p.lastName) out.lastName = p.lastName
  if (p.phoneNumber) out.phoneNumber = p.phoneNumber
  if (p.properties && Object.keys(p.properties).length > 0) {
    out.properties = p.properties
  }
  return out
}

/* ── Single metric + type discriminator ───────────────────────────── */

/**
 * Single metric name used for every transactional / lifecycle email
 * the app fires. All Klaviyo Flows triggered against this metric
 * branch on the `type` event property (see `KlaviyoEventType`) to
 * decide which template + audience to use.
 *
 * Why one metric instead of one-per-action? Klaviyo bills each metric
 * separately and the dashboard's "Metric activity" view scales
 * better with a smaller set of high-level metrics. Filtering by a
 * `type` property inside Flows is the recommended pattern from
 * Klaviyo's own docs.
 */
export const KlaviyoEvent = {
  METRIC: 'diaflow-tower',
} as const

/**
 * Type discriminator passed as `properties.type` on every event
 * fired against `KlaviyoEvent.METRIC`. Klaviyo Flows filter on this
 * value (`event.type == "verify_email"`) so a single metric powers
 * many separate email templates / audiences.
 *
 * Keep these strings in sync with the Flow filter conditions in
 * Klaviyo — a typo in either place silently drops the email.
 */
export const KlaviyoEventType = {
  /** Email-verify OTP — properties: `otp`, `expiresInMinutes`. */
  VERIFY_EMAIL: 'verify_email',
  /** Password reset link — properties: `resetUrl`, `expiresInMinutes`. */
  FORGOT_PASSWORD: 'forgot_password',
  /** Fired right after a new account is created. */
  WELCOME: 'welcome',
  /** Fired when the user's totalInvites increases. */
  INVITE_ACCEPTED: 'invite_accepted',
  /** Fired when the user crosses a floor threshold. */
  FLOOR_UP: 'floor_up',
  /** Fired from the Leo onboarding step — waitlist join. */
  WAITLIST_JOINED: 'waitlist_joined',
} as const
