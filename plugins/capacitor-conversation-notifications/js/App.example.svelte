<!--
  Example wiring for Svelte 5 (adapt the router calls to your app).
  Mount once at the root, e.g. in +layout.svelte or App.svelte.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { Capacitor } from '@capacitor/core';
  import { ConvNotif } from './conversationNotifications';

  // Replace with your own store / router.
  let { chats, openChat }: {
    chats: { id: string; name: string; avatar?: string; isGroup?: boolean }[];
    openChat: (chatId: string) => void;
  } = $props();

  const isAndroid = Capacitor.getPlatform() === 'android';

  // 1) Keep a conversation shortcut for every chat (makes the Conversations section work
  //    even for the first message of a chat that has never notified before).
  $effect(() => {
    if (!isAndroid) return;
    for (const c of chats) {
      ConvNotif.upsertShortcut({ chatId: c.id, name: c.name, avatarUrl: c.avatar, isGroup: c.isGroup }).catch(() => {});
    }
  });

  // 2) Notification taps.
  onMount(() => {
    if (!isAndroid) return;
    let handle: { remove: () => Promise<void> } | undefined;

    // App was closed: the tap launched it.
    ConvNotif.getPendingChat().then(({ chatId }) => chatId && openChat(chatId));
    // App was already running.
    ConvNotif.addListener('chatOpened', ({ chatId }) => openChat(chatId)).then((h) => (handle = h));

    return () => handle?.remove();
  });
</script>
