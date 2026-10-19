<script setup>
import { Loader2 } from "@lucide/vue";
</script>

<template>
  <Teleport to="body">
    <div class="loading-backdrop">
      <div class="loading-popup" role="status" aria-live="polite" aria-atomic="true">
        <Loader2 :size="36" class="loading-spinner" aria-hidden="true" />
        <span>Chargement…</span>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.loading-backdrop {
  position: fixed;
  inset: 0;
  z-index: 100000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: rgba(10, 20, 30, 0.45);
  cursor: progress;
}
.loading-popup {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: min(200px, 100%);
  aspect-ratio: 1 / 1;
  gap: 1rem;
  max-width: 100%;
  padding: 1.5rem;
  border-radius: 16px;
  background: var(--surface);
  color: var(--text-light);
  font-size: 1.125rem;
}
.loading-spinner {
  flex-shrink: 0;
  animation: loading-spin 0.9s linear infinite;
}
@keyframes loading-spin {
  to { transform: rotate(360deg); }
}
@media (prefers-reduced-motion: reduce) {
  .loading-spinner { animation-duration: 2s; }
}
</style>
