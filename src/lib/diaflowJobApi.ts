/**
 * Diaflow process API — job → recommended role + reason.
 *
 * Two-step call against api.diaflow.io builder `CJqk6qCun5`:
 *
 *   1. POST  /process                       → { sessionId }
 *   2. GET   /process-checks/<sessionId>    → poll until { status: 'Done' }
 *
 * The interesting payload lives in the `openai-0` node's `output`
 * field — a JSON-encoded string of the shape
 *   `{"success": true, "data": { "recommendedRole": "…", "reason": "…" }}`.
 * We parse it and return a normalised result. On any failure (auth,
 * timeout, malformed payload, success=false) we fall back to
 * `{ success: false }` so callers can render their default copy.
 *
 * Uses the `DIAFLOW_API_KEY` env var. Never expose this key to client
 * bundles — only API routes / server components should import this
 * file.
 */

const BUILDER_BASE = 'https://api.diaflow.io/api/v1/builders/CJqk6qCun5'
const POLL_INTERVAL_MS = 800
// Hard cap so a stuck process doesn't tie up the API route forever.
// Real-world latency hovers around 1–3 s based on the example payload.
const MAX_WAIT_MS = 25_000

export interface JobSummaryResult {
  success: boolean
  recommendedRole?: string
  reason?: string
}

interface OpenAiNode {
  status?: string
  output?: unknown
}
interface ProcessCheck {
  status?: string
  node?: Array<Record<string, OpenAiNode>>
}

/**
 * Kick off the Diaflow process for `job`, poll until completion, and
 * pluck the parsed `openai-0` payload. Never throws — failures are
 * mapped to `{ success: false }` so the caller can branch cleanly.
 */
export async function fetchJobSummary(job: string): Promise<JobSummaryResult> {
  const apiKey = process.env.DIAFLOW_API_KEY
  if (!apiKey) {
    console.warn('[diaflowJobApi] DIAFLOW_API_KEY not set — returning success:false')
    return { success: false }
  }

  // ── 1. Start the process ────────────────────────────────────────
  let sessionId: string
  try {
    const startRes = await fetch(`${BUILDER_BASE}/process`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({ job }),
    })
    if (!startRes.ok) {
      console.warn('[diaflowJobApi] start failed:', startRes.status)
      return { success: false }
    }
    const startJson = (await startRes.json()) as { sessionId?: unknown }
    if (typeof startJson.sessionId !== 'string' || !startJson.sessionId) {
      console.warn('[diaflowJobApi] start returned no sessionId')
      return { success: false }
    }
    sessionId = startJson.sessionId
  } catch (err) {
    console.warn('[diaflowJobApi] start error:', err)
    return { success: false }
  }

  // ── 2. Poll process-checks until Done (or timeout) ──────────────
  const deadline = Date.now() + MAX_WAIT_MS
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS))
    let check: ProcessCheck
    try {
      const checkRes = await fetch(`${BUILDER_BASE}/process-checks/${sessionId}`, {
        method: 'GET',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
        },
      })
      if (!checkRes.ok) continue
      check = (await checkRes.json()) as ProcessCheck
    } catch (err) {
      console.warn('[diaflowJobApi] poll error:', err)
      continue
    }
    if (check.status !== 'Done') continue

    // ── 3. Pull the `openai-0` node's output ───────────────────────
    const node = check.node?.find(n => 'openai-0' in n)
    const rawOutput = node?.['openai-0']?.output
    if (typeof rawOutput !== 'string') {
      console.warn('[diaflowJobApi] no openai-0 output found')
      return { success: false }
    }
    try {
      const parsed = JSON.parse(rawOutput) as {
        success?: unknown
        data?: { recommendedRole?: unknown; reason?: unknown }
      }
      if (
        parsed.success === true &&
        typeof parsed.data?.recommendedRole === 'string' &&
        typeof parsed.data?.reason === 'string'
      ) {
        return {
          success: true,
          recommendedRole: parsed.data.recommendedRole.trim(),
          reason: parsed.data.reason.trim(),
        }
      }
      return { success: false }
    } catch (err) {
      console.warn('[diaflowJobApi] failed to parse openai-0 output:', err)
      return { success: false }
    }
  }

  console.warn('[diaflowJobApi] poll timed out after', MAX_WAIT_MS, 'ms')
  return { success: false }
}
