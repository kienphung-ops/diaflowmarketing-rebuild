import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { readSession } from '@/lib/auth'
import { getUnlockedItemsForFloor } from '@/lib/floorsDb'

// Edge runtime would have a longer max duration on Pro plans, but Prisma
// data-proxy isn't required here — we keep node runtime for the existing
// Prisma + pg adapter. Vercel allows up to ~25s for streaming responses on
// hobby tier; client reconnects automatically when the stream closes.
export const dynamic = 'force-dynamic'
export const maxDuration = 25

const POLL_MS = 2_000
// Close the stream OURSELVES a beat before Vercel's hard `maxDuration`
// kill. If we let the function run to the 25s limit, Vercel terminates it
// and logs "Task timed out after 25 seconds". Ending the stream cleanly
// at ~23s lets the function return normally — the browser's EventSource
// then auto-reconnects (picking up where we left off via the snapshot).
const SELF_CLOSE_MS = 23_000

/**
 * Server-Sent Events stream that pushes floor / invite changes to a
 * signed-in user in near-real-time. The server polls Prisma every 2s and
 * emits a `data:` line when the user's currentFloor or totalInvites moves;
 * the browser's EventSource auto-reconnects when the function execution
 * window closes, so the next reconnection picks up where we left off.
 */
export async function GET(req: NextRequest) {
  const session = await readSession()
  if (!session) {
    return new Response('Unauthorized', { status: 401 })
  }
  const userId = session.userId

  let lastFloor = -1
  let lastInvites = -1

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      function send(event: string, payload: unknown) {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`))
      }

      // Initial state push so the client has a baseline immediately on connect.
      try {
        const u = await prisma.user.findUnique({
          where: { id: userId },
          select: {
            currentFloor: true,
            totalInvites: true,
          },
        })
        if (u) {
          lastFloor = u.currentFloor
          lastInvites = u.totalInvites
          const unlocked = await getUnlockedItemsForFloor(u.currentFloor)
          send('snapshot', {
            currentFloor: u.currentFloor,
            totalInvites: u.totalInvites,
            unlockedItemKeys: unlocked.map(i => i.itemKey),
          })
        }
      } catch {
        // ignore initial-read failures; the poll loop will retry
      }

      const interval = setInterval(async () => {
        try {
          const u = await prisma.user.findUnique({
            where: { id: userId },
            select: {
              currentFloor: true,
              totalInvites: true,
            },
          })
          if (!u) return
          const floorUp = u.currentFloor > lastFloor && lastFloor !== -1
          const invitesUp = u.totalInvites > lastInvites && lastInvites !== -1

          if (floorUp) {
            // Only resolve the item list on actual floor-ups — keeps the
            // hot path (heartbeat tick) at one round-trip.
            const unlocked = await getUnlockedItemsForFloor(u.currentFloor)
            send('floor-up', {
              currentFloor: u.currentFloor,
              totalInvites: u.totalInvites,
              unlockedItemKeys: unlocked.map(i => i.itemKey),
            })
          }
          if (invitesUp) {
            send('invite-accepted', {
              delta: u.totalInvites - lastInvites,
              totalInvites: u.totalInvites,
            })
          }
          lastFloor = u.currentFloor
          lastInvites = u.totalInvites

          // Heartbeat to keep proxies from closing the connection.
          controller.enqueue(encoder.encode(`: ping\n\n`))
        } catch {
          // swallow polling errors
        }
      }, POLL_MS)

      // Graceful self-close before Vercel's hard timeout (see comment on
      // SELF_CLOSE_MS). The client reconnects automatically.
      const selfClose = setTimeout(() => {
        clearInterval(interval)
        try {
          controller.close()
        } catch {
          /* already closed */
        }
      }, SELF_CLOSE_MS)

      const onAbort = () => {
        clearInterval(interval)
        clearTimeout(selfClose)
        try {
          controller.close()
        } catch {
          /* already closed */
        }
      }
      req.signal.addEventListener('abort', onAbort)
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
