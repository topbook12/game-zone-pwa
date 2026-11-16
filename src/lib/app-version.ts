/**
 * Single source of truth for the running app version.
 *
 * - `package.json` version and this constant are bumped together on release.
 * - `/api/version` serves it with `no-store` so a phone can ask the server
 *   which build is live (Phase 1 version guard — stale phones self-heal).
 */
export const APP_VERSION = '2.6.0'
