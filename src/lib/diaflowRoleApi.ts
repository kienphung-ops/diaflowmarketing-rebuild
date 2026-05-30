/**
 * Diaflow process API — role → "what this teammate will do" sentence.
 *
 * Two-step call against api.diaflow.io builder `a7eSxQk9eE` (see
 * requirements/api_description.md):
 *
 *   1. POST  /process                       → { sessionId }
 *   2. GET   /process-checks/<sessionId>    → poll until { status: 'Done' }
 *
 * The interesting payload lives in the `openai-0` node's `output`
 * field — a plain string in this builder (NOT a JSON-encoded blob the
 * way the job-summary builder returns it). Sample output:
 *
 *   "I will fetch water, slice oranges, and provide a relaxing
 *    massage to lighten your burden."
 *
 * The UI prepends a name greeting + identity line, so this string is
 * the "launch-day promise" tail of the speech bubble (everything after
 * "When Diaflow launches, ").
 *
 * On any failure (auth, timeout, malformed payload) we fall back to
 * `{ success: false }` so callers can render a generic line and a
 * later edit-save can retry.
 *
 * Uses the `DIAFLOW_API_KEY` env var (same key as diaflowJobApi.ts —
 * one organisation key spans both builders). Never expose this key
 * to client bundles — only API routes / server components should
 * import this file.
 */

const BUILDER_BASE = 'https://api.diaflow.io/api/v1/builders/a7eSxQk9eE'
const POLL_INTERVAL_MS = 800
// Hard cap so a stuck process doesn't tie up the API route forever.
// Real-world latency hovers around 1–3 s based on the example payload.
const MAX_WAIT_MS = 25_000

export interface RoleTaskResult {
  success: boolean
  /** Trimmed, first-line of the Diaflow API output. Only present
   *  when `success === true`. */
  description?: string
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
 * Kick off the Diaflow process for `role`, poll until completion,
 * and pluck the `openai-0` node's plain-string output. Never throws —
 * any failure resolves to `{ success: false }` so the caller can
 * branch cleanly.
 *
 * The request body shape matches the example in api_description.md
 * exactly: a JSON object with `{ role: "<role text>" }`.
 */
export async function fetchRoleTaskDescription(role: string): Promise<RoleTaskResult> {
  const apiKey = process.env.DIAFLOW_API_KEY
  if (!apiKey) {
    console.warn('[diaflowRoleApi] DIAFLOW_API_KEY not set — returning success:false')
    return { success: false }
  }
  const trimmedRole = role.trim()
  if (!trimmedRole) {
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
      body: JSON.stringify({ role: trimmedRole }),
    })
    if (!startRes.ok) {
      console.warn('[diaflowRoleApi] start failed:', startRes.status)
      return { success: false }
    }
    const startJson = (await startRes.json()) as { sessionId?: unknown }
    if (typeof startJson.sessionId !== 'string' || !startJson.sessionId) {
      console.warn('[diaflowRoleApi] start returned no sessionId')
      return { success: false }
    }
    sessionId = startJson.sessionId
  } catch (err) {
    console.warn('[diaflowRoleApi] start error:', err)
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
      console.warn('[diaflowRoleApi] poll error:', err)
      continue
    }
    if (check.status !== 'Done') continue

    // ── 3. Pull the `openai-0` node's output ───────────────────────
    const node = check.node?.find(n => 'openai-0' in n)
    const rawOutput = node?.['openai-0']?.output
    if (typeof rawOutput !== 'string' || !rawOutput.trim()) {
      console.warn('[diaflowRoleApi] no openai-0 output found for role:', trimmedRole)
      return { success: false }
    }
    // The builder may pad the output with leading/trailing whitespace.
    // We don't try to strip quotes or re-shape sentences — the
    // builder's prompt is responsible for producing a clean
    // "I will <verbs>." string, and bending the response further
    // here would mask upstream regressions.
    return { success: true, description: rawOutput.trim() }
  }

  console.warn('[diaflowRoleApi] poll timed out after', MAX_WAIT_MS, 'ms for role:', trimmedRole)
  return { success: false }
}
