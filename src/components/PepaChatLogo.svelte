<script lang="ts">
  let { size = 48, class: className = "" } = $props<{
    size?: number;
    class?: string;
  }>();
</script>

<svg 
  width={size} 
  height={size} 
  viewBox="0 0 120 120" 
  class={className} 
  fill="none" 
  xmlns="http://www.w3.org/2000/svg"
>
  <!-- Tassel line on the left -->
  <path 
    d="M 52 34 L 19 32 L 19 58" 
    stroke="#0B204C" 
    stroke-width="4.5" 
    stroke-linecap="round" 
    stroke-linejoin="round"
  />
  <circle cx="19" cy="62" r="4.5" fill="#0B204C" />

  <!-- Chat bubble outline -->
  <path 
    d="M60 48 C76.5 48 90 58.5 90 71.5 C90 84.5 76.5 95 60 95 C55 95 50.5 93.8 46.5 91.8 L32 97 L35.5 85.5 C30.5 81.8 28 77 28 71.5 C28 58.5 41.5 48 60 48 Z" 
    stroke="#0B204C" 
    stroke-width="5" 
    stroke-linecap="round" 
    stroke-linejoin="round"
    fill="white"
  />
  
  <!-- Graduation cap top plate (mortarboard diamond) -->
  <path 
    d="M60 18 L105 38 L60 58 L15 38 Z" 
    stroke="#0B204C" 
    stroke-width="5" 
    stroke-linecap="round" 
    stroke-linejoin="round"
  />
  
  <!-- 3 Dots inside the speech bubble -->
  <circle cx="48" cy="71.5" r="3.5" fill="#0B204C" />
  <circle cx="60" cy="71.5" r="3.5" fill="#0B204C" />
  <circle cx="72" cy="71.5" r="3.5" fill="#0B204C" />
</svg>
