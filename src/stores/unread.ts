import { readable, type Readable } from 'svelte/store';
import { dbService } from '../services/dbService';
import { nativeNotificationService } from '../services/nativeNotificationService';

export function unreadCount(conversationId: string, userId: string, lastReadAt: string | null): Readable<number> {
  return readable(0, (set) => {
    let sub: any;
    dbService.getRawDB().then((db: any) => {
      sub = db.messages
        .find({
          selector: {
            conversationId: { $eq: conversationId },
            createdAt: { $gt: lastReadAt ?? '1970-01-01T00:00:00.000Z' }
          }
        })
        .$
        .subscribe((msgs: any[]) => {
           set(msgs.filter(m => m.senderId !== userId).length);
        });
    });

    return () => {
      if (sub) {
        sub.unsubscribe();
      }
    };
  });
}

export function totalUnreadConversations(userId: string): Readable<number> {
  return readable(0, (set) => {
    let partSub: any;
    
    dbService.getRawDB().then((db: any) => {
      partSub = db.participants
        .find({ selector: { userId: userId } })
        .$
        .subscribe(async (members: any[]) => {
          let count = 0;
          for (const m of members) {
            try {
              const msgs = await db.messages.find({
                selector: {
                  conversationId: { $eq: m.conversationId },
                  createdAt: { $gt: m.lastReadAt ?? '1970-01-01T00:00:00.000Z' }
                }
              }).exec();
              const nResult = msgs.filter((msg: any) => msg.senderId !== userId).length;
              if (nResult > 0) count++;
            } catch (err) {
              console.error('Error counting messages:', err);
            }
          }
          set(count);
        });
    });

    return () => {
      if (partSub) partSub.unsubscribe();
    };
  });
}

/**
 * Calculate the total unread messages count across all active conversations.
 */
export async function calculateTotalUnread(userId: string): Promise<number> {
  if (!userId) return 0;
  try {
    const db = await dbService.getRawDB();
    const members = await db.participants.find({ selector: { userId: userId } }).exec();
    let totalCount = 0;
    for (const m of members) {
      if (m.isDeleted) continue;
      const watermark = m.lastReadAt || m.clearedAt || '1970-01-01T00:00:00.000Z';
      try {
        const msgs = await db.messages.find({
          selector: {
            conversationId: { $eq: m.conversationId },
            createdAt: { $gt: watermark }
          }
        }).exec();
        totalCount += msgs.filter((msg: any) => msg.senderId !== userId && msg.status !== 'read').length;
      } catch (err) {
        console.error('[unread] Error calculating messages for conversation:', m.conversationId, err);
      }
    }
    return totalCount;
  } catch (err) {
    console.error('[unread] Error calculating total unread messages:', err);
    return 0;
  }
}

/**
 * Imperatively refresh total unread count and synchronize with launcher badge.
 */
export async function refreshTotalUnreadMessages(userId: string): Promise<number> {
  const count = await calculateTotalUnread(userId);
  await nativeNotificationService.setBadge(count).catch(() => {});
  return count;
}

/**
 * Observable of the total unread messages count across all conversations.
 * Automatically synchronizes with the device's home screen icon badge in real time.
 */
export function totalUnreadMessages(userId: string): Readable<number> {
  return readable(0, (set) => {
    let partSub: any;
    let msgSub: any;
    let debounceTimer: any;

    const executeRecalc = async () => {
      const totalCount = await calculateTotalUnread(userId);
      set(totalCount);
      nativeNotificationService.setBadge(totalCount).catch(() => {});
    };

    const triggerDebouncedRecalc = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(executeRecalc, 50);
    };

    dbService.getRawDB().then((db: any) => {
      // Immediate initial calculation
      executeRecalc();

      // Listen to participants changes (e.g. lastReadAt updated when a chat is read)
      partSub = db.participants
        .find({ selector: { userId: userId } })
        .$
        .subscribe(() => {
          triggerDebouncedRecalc();
        });

      // Listen to messages changes (e.g. incoming new messages, read status updates)
      msgSub = db.messages
        .find()
        .$
        .subscribe(() => {
          triggerDebouncedRecalc();
        });
    });

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      if (partSub) partSub.unsubscribe();
      if (msgSub) msgSub.unsubscribe();
    };
  });
}
