// import supabase from '../../services/supabaseClient';

export interface ChalkPresence {
userId: string;
userName: string;
heldAt: number; // Date.now() — detect stale locks
}

const LOCK_TIMEOUT_MS = 30_000; // release if holder goes silent for 30s

/**
* Acquire the chalk lock.
* Returns false immediately if another user currently holds it.
*/
export async function acquireChalk(
channel: any,
userId: string,
userName: string,
currentState: Record<string, ChalkPresence[]>
): Promise<boolean> {
const holders: ChalkPresence[] = Object.values(currentState).flat();
const active = holders.find(h => Date.now() - h.heldAt < LOCK_TIMEOUT_MS);

if (active && active.userId !== userId) return false; // locked by someone else

await channel.track({
userId,
userName,
heldAt: Date.now(),
} satisfies ChalkPresence);

return true;
}

/** Release the chalk — called on tool switch, canvas blur, or explicit tap. */
export async function releaseChalk(
channel: any
) {
await channel.untrack();
}

/**
* Subscribe to chalk state changes.
* On every presence_diff, update local UI to show who holds the chalk.
*/
export function subscribeChalk(
channel: any,
onUpdate: (holder: ChalkPresence | null) => void
) {
channel.on('presence', { event: 'sync' }, () => {
const state = channel.presenceState();
// @ts-ignore
const holders: ChalkPresence[] = Object.values(state).flat();
const active = holders.find(h => Date.now() - h.heldAt < LOCK_TIMEOUT_MS);
onUpdate(active ?? null);
});
}
