<script setup>
import { Copy, Trash2 } from "@lucide/vue";
defineProps({ duplicateLabel: String, deleteLabel: String, busy: Boolean });
defineEmits(["duplicate", "delete"]);
</script>
<template>
  <div class="detail-header-actions">
    <button type="button" :title="duplicateLabel" :aria-label="duplicateLabel" :disabled="busy" @click="$emit('duplicate')"><Copy :size="24" aria-hidden="true" /></button>
    <button type="button" :title="deleteLabel" :aria-label="deleteLabel" :disabled="busy" @click="$emit('delete')"><Trash2 :size="24" aria-hidden="true" /></button>
  </div>
</template>
<style scoped>
.detail-header-actions { display: flex; justify-content: flex-end; align-items: center; gap: 1rem; margin-left: auto; flex-shrink: 0; }
.detail-header-actions button { display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; padding: 0; background: transparent; border: none; color: var(--text-light); cursor: pointer; }
.detail-header-actions button:disabled { opacity: 0.5; cursor: default; }
.detail-header-actions button:focus-visible { outline: 2px solid var(--modal-accent, var(--stadium-yellow)); outline-offset: 2px; border-radius: 8px; }
</style>
