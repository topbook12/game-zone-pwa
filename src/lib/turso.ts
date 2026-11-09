/**
 * Turso (libSQL) server-side client — global leaderboard storage.
 *
 * Cost-effective by design:
 *  - Only used by the tiny /api/scores route (everything else is client-side).
 *  - Responses are edge-cached (s-maxage) so repeated reads never touch the DB.
 *  - Turso free tier is more than enough for a long time.
 */
import { createClient, type Client } from '@libsql/client'

let client: Client | null = null

export function getTurso(): Client {
  if (!client) {
    const url = process.env.TURSO_DATABASE_URL
    const authToken = process.env.TURSO_AUTH_TOKEN
    if (!url || !authToken) {
      throw new Error(
        'Missing Turso config — set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN env vars.'
      )
    }
    client = createClient({ url, authToken })
  }
  return client
}
