<script setup>
import { Star } from "@lucide/vue";
</script>

<template>
  <span
    class="bonus-star-zone"
    data-bonus-star
    role="img"
    aria-disabled="true"
    aria-label="Attribuer une étoile — Dépasse les attentes"
    title="Attribuer une étoile — Dépasse les attentes"
    @pointerdown.stop
  >
    <Star :size="20" aria-hidden="true" />
    <span class="bonus-star-label" aria-hidden="true">Attribuer une étoile</span>
  </span>
</template>

<style scoped>
.bonus-star-zone {
  position: absolute;
  top: 0;
  right: 0;
  z-index: 2;
  width: clamp(32px, 4vw, 52px);
  height: clamp(32px, 4vw, 52px);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  box-sizing: border-box;
  border-radius: 0 0 0 16px;
  background: color-mix(in srgb, var(--text-muted) 12%, var(--surface));
  color: var(--text-muted);
  font-family: inherit;
  cursor: pointer;
  transition: background 120ms, color 120ms, box-shadow 120ms;
}
.bonus-star-zone:hover {
  width: min(100%, 180px);
  padding: 6px;
  background: var(--text-primary, #282828);
  color: var(--surface, #ffffff);
  box-shadow: inset 0 0 0 2px currentColor;
}
.bonus-star-zone svg {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  fill: transparent;
  transition: fill 120ms, transform 120ms;
}
.bonus-star-zone:hover svg {
  fill: currentColor;
  transform: scale(1.15);
}
.bonus-star-label {
  display: none;
  white-space: normal;
  font: 600 11px/1.2 system-ui, sans-serif;
}
.bonus-star-zone:hover .bonus-star-label {
  display: block;
}
@media (prefers-reduced-motion: reduce) {
  .bonus-star-zone,
  .bonus-star-zone svg { transition: none; }
}
</style>