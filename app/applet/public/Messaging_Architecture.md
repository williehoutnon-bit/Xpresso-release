# Messaging Architecture

## Overview
The application uses a robust local-first messaging architecture powered by RxDB and Appwrite.

## Messaging Flow
1. **Local Optimistic Write**: When a message is sent, it's immediately written to the local RxDB database (`messages` collection).
2. **Background Sync**: `dbReplicationService.ts` listens for local changes and pushes them to the Appwrite remote database.
3. **Real-time Updates**: `messagingService.ts` maintains an active Appwrite Realtime subscription. Incoming messages from other users trigger an upsert to the local RxDB.

## Inbox Incoming Message Display
The Inbox (`InboxView.svelte`) reacts directly to local RxDB state. The query `dbService.getConversations()` continuously streams conversation updates. When an incoming message arrives via Appwrite, it's written to RxDB. The RxDB query automatically pushes the new data to the UI, highlighting the unread message.

## Swipe Delete Relationship
When a conversation is swipe-deleted in the UI:
1. **Local Update**: The participant record is marked with `isDeleted: true` in RxDB. This removes it from the Inbox query immediately.
2. **Remote Push**: The update syncs to Appwrite.
3. **Restoration**: If a new message is received in that conversation later, the realtime handler in `messagingService.ts` detects it, updates `isDeleted` to `false`, and the conversation reappears in the Inbox locally.
