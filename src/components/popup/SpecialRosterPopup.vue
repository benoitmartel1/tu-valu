<script setup>
import { ref, onMounted } from "vue";
import { X } from "@lucide/vue";
defineProps({ students: Array, icon: [Object, Function], label: String, busy: Boolean, error: String });
const emit = defineEmits(["close", "remove"]);
const dialog = ref(null);
onMounted(() => dialog.value.showModal());
</script>
<template>
  <Teleport to="body">
    <dialog ref="dialog" class="special-roster-popup" :aria-label="label" @close="emit('close')" @click="($event.target === dialog) && dialog.close()">
      <div class="special-roster-header">
        <component :is="icon" :size="24" aria-hidden="true" />
        <button type="button" aria-label="Fermer" @click="dialog.close()"><X :size="22" /></button>
      </div>
      <div class="special-roster-list">
        <div v-for="student in students" :key="student.id" class="special-roster-item">
          <span>{{ student.firstname }} {{ student.lastname }}</span>
          <button type="button" :disabled="busy" :aria-label="`Retirer ${student.firstname} ${student.lastname}`" @click="emit('remove', student.id)"><X :size="20" /></button>
        </div>
      </div>
      <p v-if="error" role="alert">{{ error }}</p>
    </dialog>
  </Teleport>
</template>
<style scoped>
.special-roster-popup { margin: auto; width: min(360px, calc(100vw - 2rem)); max-height: 70dvh; padding: 1rem; border: 1px solid var(--input-border); border-radius: 16px; background: var(--surface); color: var(--text-light); }
.special-roster-popup::backdrop { background: rgba(10, 20, 30, 0.45); }
.special-roster-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem; }
.special-roster-popup button { display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; padding: 0; border: 0; border-radius: 50%; background: transparent; color: inherit; }
.special-roster-list { display: flex; flex-direction: column; gap: 0.4rem; }
.special-roster-item { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; padding: 0 0.5rem 0 1rem; border-radius: 20px; background: var(--surface-muted); }
</style>
