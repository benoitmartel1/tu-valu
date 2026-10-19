<script setup>
import { X } from "@lucide/vue";

const props = defineProps({
  title: { type: String, required: true },
});

const emit = defineEmits(["close"]);
</script>

<template>
  <div class="popup-backdrop" @click.self="$emit('close')">
    <div class="popup-modal">
      <div class="popup-header">
        <h2>{{ title }}</h2>
        <div class="popup-header-actions"><slot name="actions" /></div>
        <button class="popup-close" @click="$emit('close')" :title="'Fermer'">
          <X :size="24" />
        </button>
      </div>
      <div class="popup-content">
        <slot></slot>
      </div>
    </div>
  </div>
</template>

<style scoped>
.popup-backdrop {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  background: rgba(10, 20, 30, 0.72);
}

.popup-modal {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 1.4rem;
  border-radius: 16px;
  background: var(--surface);
  color: var(--text-light);
  width: 80vw;
  height: 80vh;
}

.popup-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
  flex: 0 0 auto;
}

.popup-header-actions {
  display: flex; align-items: center; gap: 0.5rem; margin-left: auto;
}

.popup-header h2 {
  margin: 0;
  font-size: 1.45rem;
  color: var(--text-light);
}

.popup-close {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.45rem;
  border: 0;
  border-radius: 9px;
  background: none;
  color: var(--text-light);
  cursor: pointer;
  transition: background 0.2s;
}

.popup-close:focus-visible {
  background: rgba(0, 0, 0, 0.1);
}

.popup-content {
  flex: 1;
  overflow-y: auto;
}
</style>
