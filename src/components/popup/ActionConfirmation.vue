<script setup>
import { onBeforeUnmount, ref } from "vue";
import { Check, Undo2 } from "@lucide/vue";

const confirmation = ref(null);
let closeTimer;

function show(details, undone = false) {
  clearTimeout(closeTimer);
  confirmation.value = { ...details, undone };
  closeTimer = setTimeout(() => {
    confirmation.value = null;
  }, 3000);
}

onBeforeUnmount(() => clearTimeout(closeTimer));
defineExpose({ show });
</script>

<template>
    <div class="action-confirmation-region" role="status" aria-live="polite" aria-atomic="true">
      <Transition name="confirmation">
        <div v-if="confirmation" class="action-confirmation">
          <Undo2 v-if="confirmation.undone" :size="18" aria-hidden="true" />
          <Check v-else :size="18" aria-hidden="true" />
          <div class="action-confirmation-content">
            <span class="action-confirmation-label">{{ confirmation.undone ? "Évaluation annulée" : "Évaluation enregistrée" }}</span>
            <p><strong>{{ confirmation.studentName }}</strong> · {{ confirmation.skillName }} · {{ confirmation.level }}</p>
          </div>
        </div>
      </Transition>
    </div>
</template>

<style scoped>
.action-confirmation-region {
  width: 100%;
  min-width: 0;
  height: 54px;
  pointer-events: none;
}

.action-confirmation {
  display: flex;
  width: 100%;
  height: 100%;
  min-width: 0;
  align-items: center;
  gap: 10px;
  padding: 6px 10px;
  border: 1px solid color-mix(in srgb, var(--text-light) 25%, transparent);
  border-radius: 14px;
  background: color-mix(in srgb, var(--court-blue) 88%, transparent);
  color: var(--text-light);
  backdrop-filter: blur(8px);
  font-size: 0.875rem;
  overflow: hidden;
}

.action-confirmation-content {
  min-width: 0;
}

.action-confirmation-content p,
.action-confirmation-label {
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.action-confirmation svg {
  flex-shrink: 0;
}

.action-confirmation-label {
  font-size: 0.75rem;
  opacity: 0.8;
}

.confirmation-enter-active,
.confirmation-leave-active {
  transition: opacity 180ms ease, transform 180ms ease;
}

.confirmation-enter-from,
.confirmation-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

@media (prefers-reduced-motion: reduce) {
  .confirmation-enter-active,
  .confirmation-leave-active {
    transition: none;
  }
}
</style>
