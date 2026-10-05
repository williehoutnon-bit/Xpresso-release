<template>
  <div class="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none w-full max-w-sm">
    <TransitionGroup name="notif">
      <div
        v-for="notif in notifications"
        :key="notif.id"
        class="bg-white p-4 rounded-[20px] shadow-xl border border-sage/10 pointer-events-auto flex gap-3 items-start relative overflow-hidden group"
      >
        <Info v-if="notif.type === 'info'" class="text-accent shrink-0 mt-0.5" :size="20" />
        <CheckCircle v-else-if="notif.type === 'success'" class="text-olive shrink-0 mt-0.5" :size="20" />
        <AlertTriangle v-else-if="notif.type === 'warning'" class="text-orange-500 shrink-0 mt-0.5" :size="20" />
        <AlertCircle v-else-if="notif.type === 'error'" class="text-red-500 shrink-0 mt-0.5" :size="20" />
        
        <div class="flex-1 pr-6">
          <h4 class="text-sm font-bold text-ink">{{ notif.title }}</h4>
          <p v-if="notif.message" class="text-xs text-sage mt-1 leading-relaxed">{{ notif.message }}</p>
        </div>

        <button 
          @click="removeNotification(notif.id)"
          class="absolute top-4 right-4 text-sage hover:text-ink transition-colors opacity-0 group-hover:opacity-100"
        >
          <X :size="16" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { Info, CheckCircle, AlertTriangle, AlertCircle, X } from 'lucide-vue-next';
import { type AppNotification, subscribeToNotifications } from '../services/notificationService';

const notifications = ref<AppNotification[]>([]);
let unsubscribe: (() => void) | null = null;

onMounted(() => {
  unsubscribe = subscribeToNotifications((notification) => {
    notifications.value.push(notification);

    if (notification.duration && notification.duration > 0) {
      setTimeout(() => {
        removeNotification(notification.id);
      }, notification.duration);
    }
  });
});

onUnmounted(() => {
  if (unsubscribe) unsubscribe();
});

const removeNotification = (id: string) => {
  notifications.value = notifications.value.filter((n) => n.id !== id);
};
</script>

<style scoped>
.notif-enter-active,
.notif-leave-active,
.notif-move {
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
.notif-enter-from {
  opacity: 0;
  transform: translateX(50px) scale(0.95);
}
.notif-leave-to {
  opacity: 0;
  transform: scale(0.95);
}
.notif-leave-active {
  position: absolute;
}
</style>
