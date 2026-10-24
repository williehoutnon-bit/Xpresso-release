/** Run: npx tsx scripts/test-badge-count.ts */
import assert from 'node:assert/strict';
import { effectiveBadgeCount } from '../src/native/badgeCount';

let n = 0;
const t = (name: string, fn: () => void) => { fn(); n++; console.log('  ok   ' + name); };

t('REPORTED BUG: stale database count of 1 does not overwrite 5 unread notifications', () =>
  assert.equal(effectiveBadgeCount(1, 5), 5));
t('database count wins when it is higher (unread without a notification)', () =>
  assert.equal(effectiveBadgeCount(7, 3), 7));
t('both zero -> clear the badge', () => assert.equal(effectiveBadgeCount(0, 0), 0));
t('chat read: both drop, badge drops', () => assert.equal(effectiveBadgeCount(2, 2), 2));
t('old APK without getUnreadTotal (undefined) -> database count', () => assert.equal(effectiveBadgeCount(4, undefined), 4));
t('null native total -> database count', () => assert.equal(effectiveBadgeCount(4, null), 4));
t('NaN and negative are ignored', () => {
  assert.equal(effectiveBadgeCount(NaN, 3), 3);
  assert.equal(effectiveBadgeCount(-2, 0), 0);
  assert.equal(effectiveBadgeCount(2, Infinity), 2);
});
t('fractions are rounded', () => assert.equal(effectiveBadgeCount(2.6, 1), 3));
console.log(`\n${n} passed`);
