<script setup>
import { ChevronUp } from "@lucide/vue";
import TeamSetup from "../TeamSetup.vue";

const props = defineProps({
  currentStudents: { type: Array, required: true },
});

const emit = defineEmits(["close", "teams-created"]);

function onTeamsCreated() {
  emit("teams-created");
}
</script>

<template>
  <div class="picker-panel class-modal picker-panel--full team-modal-bg">
    <div class="class-modal-body">
      <div class="class-modal-content">
        <aside class="class-modal-rail" aria-label="Actions de classe">
          <button
            class="class-modal-rail-button close"
            title="Fermer"
            @click="$emit('close')"
          >
            <ChevronUp :size="28" :stroke-width="3" />
          </button>
        </aside>
        <TeamSetup
          :students="currentStudents"
          @done="onTeamsCreated"
          @cancel="$emit('close')"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Modal-specific styles */
.class-modal-body {
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: thin;
  padding: 1rem;
  position: relative;
  pointer-events: auto;
}

.class-modal-content {
  width: 100%;
  display: flex;
  gap: 0.65rem;
  height: 100%;
  min-height: 0;
  align-items: flex-start;
  justify-content: flex-start;
  pointer-events: auto;
}

.class-modal-rail {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  pointer-events: auto;
}

.class-modal-rail-button {
  width: 38px;
  height: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.08);
  color: var(--text-light);
  cursor: pointer;
  pointer-events: auto;
}

.class-modal-rail-button.close {
  background: none;
}
</style>
