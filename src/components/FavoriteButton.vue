<script setup>
import { Star } from "@lucide/vue";
defineProps({ active: Boolean, label: String, compact: Boolean });
defineEmits(["toggle"]);
</script>

<template>
  <button type="button" class="favorite-button" :class="{ 'favorite-button--active': active, 'favorite-button--compact': compact }"
    :aria-pressed="!!active" :aria-label="label" :title="label"
    @pointerdown.stop @click.stop="$emit('toggle')">
    <Star :size="18" :fill="active ? 'currentColor' : 'none'" aria-hidden="true" />
  </button>
</template>

<style scoped>
.favorite-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 6px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--text-muted);
  font: inherit;
  cursor: pointer;
  flex-shrink: 0;
}
.favorite-button:not(.favorite-button--compact) { width: 38px; height: 38px; }
.favorite-button--compact:not(.favorite-button--active) svg { opacity: 0.25; }
.favorite-button--active { color: var(--class-accent); }
:global(.picker-item.selected .favorite-button) { color: #ffffff; }
.favorite-button:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }
</style>
