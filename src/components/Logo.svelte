<script lang="ts">
  /** Union's mark: two equal arms joined in one body, holding a champagne
   *  keystone. The geometry is shared with scripts/gen-icons.mjs. */
  let { size = 40, glow = false, gem = true }: { size?: number; glow?: boolean; gem?: boolean } = $props();
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Union"
  class:glow
>
  <path
    d="M20 14.25V37.75A12 12 0 0 0 44 37.75V14.25"
    stroke="currentColor"
    stroke-width="7.6"
    stroke-linecap="butt"
  />
  {#if gem}
    <path d="M32 34.55 37.2 39.75 32 44.95 26.8 39.75Z" fill="var(--gold, #8a5c14)" />
  {/if}
</svg>

<style>
  svg { display: block; overflow: visible; }
  .glow { filter: drop-shadow(0 0 22px rgb(74 58 255 / 0.32)); }
</style>
