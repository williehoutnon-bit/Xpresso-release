import { dbService } from './dbService';

export function markRead(
  node: HTMLElement,
  initialParams: { messageId: string; myUserId: string; senderId: string; disabled?: boolean }
) {
  let { messageId, myUserId, senderId, disabled } = initialParams;
  if (senderId === myUserId) return {};

  let observer: IntersectionObserver | null = null;

  function setup() {
    if (disabled) {
      if (observer) {
        observer.disconnect();
        observer = null;
      }
      return;
    }

    if (observer) return;

    observer = new IntersectionObserver(
      async ([entry]) => {
        if (!entry.isIntersecting) return;
        
        // Prevent marking as read if the parent container indicates that the math whiteboard is open
        const container = node.closest('[data-math-canvas-open="true"]');
        if (container) {
          return;
        }
        
        if (observer) {
          observer.disconnect();
          observer = null;
        }

        try {
          const db = await dbService.getRawDB();
          const msg = await db.messages.findOne(messageId).exec();
          if (msg && msg.status !== 'read') {
            // Only patch schema-defined fields
            await msg.incrementalPatch({ status: 'read' });
            console.log(`[readAction] Marked ${messageId} as read`);
          }
        } catch (err) {
          console.error('[readAction] Failed to mark as read:', err);
        }
      },
      { threshold: 0.8 }
    );

    observer.observe(node);
  }

  setup();

  return {
    update(newParams: typeof initialParams) {
      messageId = newParams.messageId;
      myUserId = newParams.myUserId;
      senderId = newParams.senderId;
      disabled = newParams.disabled;
      setup();
    },
    destroy() {
      if (observer) {
        observer.disconnect();
      }
    }
  };
}
