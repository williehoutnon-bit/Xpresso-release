/**
 * What number the launcher icon should show.
 *
 * Two things write that number on Android:
 *  - the native plugin, per notification (always right, runs even when the app is closed)
 *  - JS, from the local database count (lags behind new pushes: there is no realtime sync)
 * JS must never lower the badge below what the native side knows is unread, otherwise a stale
 * "1" from the database overwrites the real count.
 */
export function effectiveBadgeCount(dbCount: number, nativeTotal?: number | null): number {
  const clean = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0);
  return Math.max(clean(dbCount), clean(nativeTotal));
}
