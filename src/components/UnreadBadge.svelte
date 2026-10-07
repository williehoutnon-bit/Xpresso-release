<script lang="ts">
  import { dbService } from '../services/dbService';

  let { conversationId, userId, lastReadAt } = $props<{ conversationId: string, userId: string, lastReadAt: string }>();

  let count = $state(0);

  $effect(() => {
    let active = true;
    let localSub: any;
    
    dbService.getRawDB().then((db: any) => {
      if (!active) return;
      localSub = db.messages
        .find({
          selector: {
            conversationId: { $eq: conversationId },
            createdAt: { $gt: lastReadAt ?? '1970-01-01T00:00:00.000Z' }
          }
        })
        .$
        .subscribe((docs: any[]) => {
           let newCount = 0;
           for (const doc of docs) {
             const m = typeof doc.toJSON === 'function' ? doc.toJSON() : doc;
             if (m.senderId !== userId && m.status !== 'read') newCount++;
           }
           count = newCount;
        });
    });

    return () => {
      active = false;
      if (localSub) { localSub.unsubscribe(); }
    };
  });
</script>

{#if count > 0}
  <div class="min-w-[18px] h-[18px] px-1 bg-[#E58A3A] rounded-full flex items-center justify-center shadow-[0_2px_8px_rgba(229,138,58,0.35)] shrink-0">
    <span class="text-[9px] font-black text-white leading-none">{count > 99 ? '99+' : count}</span>
  </div>
{/if}
