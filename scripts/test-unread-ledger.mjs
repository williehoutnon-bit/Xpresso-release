/**
 * Run: node scripts/test-unread-ledger.mjs
 * Compiles and runs the plain-Java unit test for the notification unread ledger.
 * Needs a JDK on PATH (javac + java). No Android SDK required: the logic under test has no Android imports.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const plugin = 'plugins/capacitor-conversation-notifications';
const src = `${plugin}/android/src/main/java/com/xpresso/convnotif`;
const out = mkdtempSync(join(tmpdir(), 'unread-ledger-'));
try {
  execFileSync('javac', ['-d', out,
    `${src}/UnreadLedgerCore.java`, `${src}/NotificationText.java`,
    `${plugin}/test/com/xpresso/convnotif/UnreadLedgerCoreTest.java`], { stdio: 'inherit' });
  execFileSync('java', ['-cp', out, 'com.xpresso.convnotif.UnreadLedgerCoreTest'], { stdio: 'inherit' });
} catch (e) {
  console.error('\nUnread ledger tests failed (or no JDK found on PATH).');
  process.exitCode = 1;
} finally {
  rmSync(out, { recursive: true, force: true });
}
