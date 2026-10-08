import { supabaseAdmin } from './supabaseService';
import { dbService } from './dbService';

const inFlightMessageWrites = new Map<string, Promise<void>>();

function clockNow(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

export function logMessageTiming(messageId: string, stage: string, startedAt?: number, details: Record<string, unknown> = {}) {
  const elapsedMs = startedAt === undefined ? undefined : Math.round((clockNow() - startedAt) * 10) / 10;
  console.debug('[message-timing]', {
    messageId,
    stage,
    at: new Date().toISOString(),
    ...(elapsedMs === undefined ? {} : { elapsedMs }),
    ...details
  });
}

function buildSupabaseMessagePayload(message: any) {
  const id = message.id || message.$id;
  const strokes = Array.isArray(message.strokes) ? message.strokes : [];
  let mathMeta = message.mathMeta ?? message.math_meta ?? null;

  if (strokes.length > 0) {
    const baseMeta = mathMeta && typeof mathMeta === 'object' ? mathMeta : {};
    mathMeta = { ...baseMeta, strokes, annotation_strokes: baseMeta.annotation_strokes || strokes };
  }

  // public.messages has no top-level strokes column; strokes live in math_meta.
  return {
    id,
    conversation_id: message.conversationId ?? message.conversation_id,
    sender_id: message.senderId ?? message.sender_id,
    content: message.content ?? '',
    type: message.type || 'text',
    status: ['pending', 'error'].includes(message.status) ? 'sent' : (message.status || 'sent'),
    ip: message.ip || '0.0.0.0',
    is_pinned: message.isPinned ?? message.is_pinned ?? false,
    attachments: message.attachments || [],
    math_meta: mathMeta,
    created_at: message.createdAt ?? message.created_at ?? new Date().toISOString(),
    updated_at: message.updatedAt ?? message.updated_at ?? message.createdAt ?? message.created_at ?? new Date().toISOString()
  };
}

export async function setLocalMessageStatus(messageId: string, status: 'sent' | 'error') {
  try {
    const db = await dbService.getRawDB();
    const localDoc = await db.messages.findOne(messageId).exec();
    if (!localDoc) return;
    const current = localDoc.toJSON();
    if (['delivered', 'read'].includes(current.status)) return;
    if (status === 'error' && current.status === 'sent') return;
    if (current.status === status) return;
    await db.messages.incrementalUpsert({ ...current, status });
  } catch (error: any) {
    console.warn('[Messaging] Could not update local message status:', messageId, error?.message || error);
  }
}

export function pushMessageToSupabase(message: any, startedAt?: number): Promise<void> {
  const payload = buildSupabaseMessagePayload(message);
  const messageId = payload.id;
  if (!messageId || !payload.conversation_id || !payload.sender_id) {
    return Promise.reject(new Error('Message is missing an id, conversation id, or sender id'));
  }
  if (String(payload.conversation_id).startsWith('local_convo_') || String(payload.conversation_id).startsWith('mock_')) {
    return Promise.reject(new Error('Cannot upload a message until its conversation has a Supabase id'));
  }

  const existingWrite = inFlightMessageWrites.get(messageId);
  if (existingWrite) return existingWrite;

  logMessageTiming(messageId, 'supabase_write_started', startedAt);
  let trackedWrite: Promise<void>;
  trackedWrite = (async () => {
    const { error } = await supabaseAdmin.from('messages').upsert(payload, { onConflict: 'id' });
    if (error) throw error;
    logMessageTiming(messageId, 'supabase_acknowledged', startedAt);
    await setLocalMessageStatus(messageId, 'sent');
    logMessageTiming(messageId, 'local_status_sent', startedAt);
  })().catch((error: any) => {
    logMessageTiming(messageId, 'supabase_write_failed', startedAt, {
      error: error?.message || String(error),
      code: error?.code || error?.status || null
    });
    throw error;
  }).finally(() => {
    if (inFlightMessageWrites.get(messageId) === trackedWrite) inFlightMessageWrites.delete(messageId);
  });

  inFlightMessageWrites.set(messageId, trackedWrite);
  return trackedWrite;
}
