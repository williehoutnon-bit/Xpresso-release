<template>
  <span :class="['inline-flex items-center font-bold', customClass]">
    <span>Xpresso</span>
    <svg 
      :class="['w-[0.8em] h-[0.8em] ml-[0.05em] transform -translate-y-[0.1em]', arrowClass]" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      stroke-width="3" 
      stroke-linecap="round" 
      stroke-linejoin="round"
    >
      <path d="M12 20V4" />
      <path d="M5 11l7-7 7 7" />
    </svg>
  </span>
</template>

<script setup lang="ts">
defineProps<{
  customClass?: string;
  arrowClass?: string;
}>();
</script>
