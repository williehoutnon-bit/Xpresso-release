// src/services/mathStorage.ts

import { encode, decode } from '@msgpack/msgpack';
import type { MathDocument } from '../types/MathDocument';
import { mediaService } from './mediaService';
import { dbService } from './dbService';

const localMathDocCache = new Map<string, Uint8Array>();

function uint8ArrayToBase64(arr: Uint8Array): string {
  if (typeof btoa !== 'undefined') {
    let binary = '';
    const len = arr.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(arr[i]);
    }
    return btoa(binary);
  }
  return '';
}

function base64ToUint8Array(base64: string): Uint8Array {
  if (typeof atob !== 'undefined') {
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
  return new Uint8Array(0);
}

export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      const id = crypto.randomUUID();
      if (id) return id;
    } catch {
      // Fallback below
    }
  }
  return 'doc_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now().toString(36);
}

/**
 * Encode a MathDocument into a binary MsgPack array (Uint8Array)
 */
export function encodeDocument(doc: MathDocument): Uint8Array {
  try {
    return encode(doc);
  } catch (err) {
    console.error('Error encoding MathDocument with MsgPack:', err);
    throw err;
  }
}

/**
 * Decode a binary MsgPack array (Uint8Array) back into a MathDocument
 */
export function decodeDocument(data: Uint8Array): MathDocument {
  try {
    return decode(data) as MathDocument;
  } catch (err) {
    console.error('Error decoding MathDocument with MsgPack:', err);
    throw err;
  }
}

/**
 * Fork a MathDocument for co-authoring or class whiteboard iteration.
 * All element session IDs correspond to the fork's custom UUID.
 */
export function forkDocument(parent: MathDocument, editorId: string): MathDocument {
  const newDocId = generateUUID();
  const newElements = parent.elements.map(el => ({
    ...el,
    id: generateUUID(), // Assign new ID to the duplicated element
    sessionId: newDocId,
    createdBy: editorId,
    createdAt: new Date().toISOString(),
    version: 1
  }));

  return {
    documentId: newDocId,
    parentDocumentId: parent.documentId,
    subject: parent.subject,
    curriculumLevel: parent.curriculumLevel,
    viewport: { ...parent.viewport },
    createdBy: editorId,
    createdAt: new Date().toISOString(),
    version: 1,
    elements: newElements,
    operations: []
  };
}

/**
 * Upload a MathDocument to Appwrite Storage and return its fileId
 */
export async function uploadMathDocument(doc: MathDocument): Promise<string> {
  try {
    const serialized = encodeDocument(doc);
    
    // Always cache locally first
    localMathDocCache.set(doc.documentId, serialized);
    if (typeof localStorage !== 'undefined') {
      try {
        const base64 = uint8ArrayToBase64(serialized);
        localStorage.setItem(`math_doc_file_${doc.documentId}`, base64);
      } catch (e) {
        console.warn('LocalStorage save failed:', e);
      }
    }

    const blob = new Blob([serialized], { type: 'application/octet-stream' });
    const fileName = `canvas_${doc.documentId}.msgpack`;
    
    let fileId: string | null = null;
    try {
      fileId = await mediaService.uploadFile(blob, fileName);
    } catch (uploadErr) {
      console.warn('Appwrite storage upload failed, falling back to local storage ID:', uploadErr);
    }

    if (!fileId) {
      // Return documentId as fallback fileId
      fileId = doc.documentId;
    } else {
      // Association caching
      localMathDocCache.set(fileId, serialized);
      if (typeof localStorage !== 'undefined') {
        try {
          const base64 = uint8ArrayToBase64(serialized);
          localStorage.setItem(`math_doc_file_${fileId}`, base64);
        } catch (e) {}
      }
    }

    return fileId;
  } catch (err) {
    console.error('Failed to upload math document:', err);
    throw err;
  }
}

/**
 * Download a MathDocument from Appwrite Storage based on its fileId
 */
export async function downloadMathDocument(fileId: string): Promise<MathDocument> {
  // 1. Check in-memory cache
  if (localMathDocCache.has(fileId)) {
    try {
      return decodeDocument(localMathDocCache.get(fileId)!);
    } catch (e) {
      console.warn('Memory cache decode failed, clearing cache entry:', e);
      localMathDocCache.delete(fileId);
    }
  }

  // 2. Check LocalStorage cache
  if (typeof localStorage !== 'undefined') {
    try {
      const base64 = localStorage.getItem(`math_doc_file_${fileId}`);
      if (base64) {
        const bytes = base64ToUint8Array(base64);
        localMathDocCache.set(fileId, bytes);
        return decodeDocument(bytes);
      }
    } catch (e) {
      console.warn('LocalStorage retrieve/decode failed:', e);
    }
  }

  // 3. Try Appwrite Storage if configured and fileId matches Appwrite pattern
  let downloadUrl = '';
  try {
    downloadUrl = mediaService.getFileDownload(fileId);
  } catch (urlErr) {
    console.warn('Failed to retrieve file download URL:', urlErr);
  }

  if (downloadUrl) {
    try {
      const res = await fetch(downloadUrl);
      if (res.ok) {
        const arrayBuffer = await res.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        localMathDocCache.set(fileId, bytes);
        if (typeof localStorage !== 'undefined') {
          try {
            localStorage.setItem(`math_doc_file_${fileId}`, uint8ArrayToBase64(bytes));
          } catch (e) {}
        }
        return decodeDocument(bytes);
      } else {
        console.warn(`Appwrite fetch failed with status: ${res.status}. Falling back to database reconstruction.`);
      }
    } catch (fetchErr) {
      console.warn('Appwrite download fetch failed. Falling back to database reconstruction:', fetchErr);
    }
  }

  // 4. Fallback to Database Reconstruction from RxDB math_elements and canvas_sessions
  try {
    console.log('Attempting local RxDB reconstruction of math canvas:', fileId);
    const db = await dbService.getRawDB();
    
    // Find the canvas session and associated elements
    const sessionDoc = await db.canvas_sessions.findOne({ selector: { id: fileId } }).exec();
    const elementsDocs = await db.math_elements.find({ selector: { sessionId: fileId } }).exec();
    
    if (sessionDoc || elementsDocs.length > 0) {
      const elementsList = elementsDocs.map((doc: any) => {
        const item = doc.toJSON();
        return {
          id: item.id,
          sessionId: item.sessionId,
          type: item.type,
          x: item.x,
          y: item.y,
          width: item.width,
          height: item.height,
          rotation: item.rotation || 0,
          zIndex: item.zIndex,
          content: item.content || {},
          style: item.style || {},
          createdBy: item.createdBy,
          createdAt: item.createdAt,
          lastEditedBy: item.lastEditedBy,
          lastEditedAt: item.lastEditedAt,
          version: item.version,
          isDeleted: item.isDeleted,
          isAnnotation: item.isAnnotation,
          annotationTargetId: item.annotationTargetId,
          lockedBy: item.lockedBy,
          lockedAt: item.lockedAt
        };
      });

      const doc: MathDocument = {
        documentId: fileId,
        parentDocumentId: sessionDoc?.parentSessionId || null,
        subject: sessionDoc?.subject || 'Mathematics',
        curriculumLevel: sessionDoc?.curriculumLevel || 'gcse',
        viewport: { x: 0, y: 0, zoom: 1 },
        createdBy: sessionDoc?.createdBy || 'System',
        createdAt: sessionDoc?.createdAt || new Date().toISOString(),
        version: sessionDoc?.operationCount || 1,
        elements: elementsList,
        operations: []
      };

      // Cache the reconstructed document
      const bytes = encodeDocument(doc);
      localMathDocCache.set(fileId, bytes);
      if (typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem(`math_doc_file_${fileId}`, uint8ArrayToBase64(bytes));
        } catch (e) {}
      }
      return doc;
    }
  } catch (dbErr) {
    console.warn('Database reconstruction fallback failed:', dbErr);
  }

  // 5. Ultimate Fallback: Generate a clean placeholder MathDocument instead of throwing/crashing the UI
  console.warn(`Could not load document [${fileId}] from any source. Generating dynamic fallback placeholder.`);
  
  let baseDocId = fileId;
  const uuidMatch = fileId.match(/canvas_([a-f0-9\-]+)\.msgpack/i) || fileId.match(/([a-f0-9\-]{36})/i);
  if (uuidMatch) {
    baseDocId = uuidMatch[1];
  }

  const fallbackDoc: MathDocument = {
    documentId: baseDocId,
    parentDocumentId: null,
    subject: 'Mathematics',
    curriculumLevel: 'gcse',
    viewport: { x: 0, y: 0, zoom: 1 },
    createdBy: 'System',
    createdAt: new Date().toISOString(),
    version: 1,
    elements: [],
    operations: []
  };

  try {
    const bytes = encodeDocument(fallbackDoc);
    localMathDocCache.set(fileId, bytes);
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(`math_doc_file_${fileId}`, uint8ArrayToBase64(bytes));
      } catch (e) {}
    }
  } catch (err) {
    console.warn('Failed to cache generated fallback document:', err);
  }

  return fallbackDoc;
}
