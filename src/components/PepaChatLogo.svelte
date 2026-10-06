<script lang="ts">
  let { size = 48, class: className = "", showText = false } = $props<{
    size?: number;
    class?: string;
    showText?: boolean;
  }>();
</script>

<div class="inline-flex items-center gap-2.5 {className}">
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 1024 1024" 
    class="flex-shrink-0"
    xmlns="http://www.w3.org/2000/svg"
  >
    <g transform="translate(0,40)">
      <!-- Speech bubble -->
      <path 
        d="M261 634 L235 740 L372 735 A300 300 0 1 0 261 634 Z"
        fill="#0050D8" 
        stroke="#0050D8" 
        stroke-width="22" 
        stroke-linejoin="round"
      />
      <!-- x -->
      <g stroke="#FFFFFF" stroke-width="54" stroke-linecap="round" fill="none">
        <line x1="382" y1="398" x2="550" y2="596"/>
        <line x1="550" y1="398" x2="382" y2="596"/>
      </g>
      <!-- superscript 2 -->
      <path 
        d="M600 345 C600 320 620 310 645 310 C672 310 690 326 690 348 C690 372 662 392 602 436 L692 436"
        stroke="#FFFFFF" 
        stroke-width="28" 
        stroke-linecap="round" 
        stroke-linejoin="round" 
        fill="none"
      />
    </g>
  </svg>
  {#if showText}
    <span class="font-bold tracking-tight text-[#2B2B2B]" style="font-size: {size * 0.45}px;">xpresso</span>
  {/if}
</div>
