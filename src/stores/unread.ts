import { readable, type Readable } from 'svelte/store';
import { dbService } from '../services/dbService';

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
    let countsSubs: any[] = [];
    
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
